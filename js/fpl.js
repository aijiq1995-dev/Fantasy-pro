/* =========================================================
   طبقة البيانات: جلب بيانات الفانتازي الرسمية عبر /api/fpl
   - كاش بالذاكرة + localStorage لعرض آخر نسخة إذا الشبكة فشلت
   - كل استجابة تسجّل وقت آخر تحديث
========================================================= */
import { LS } from './ui.js';
const POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const mem = new Map();
export const lastUpdated = {};

async function get(path, params = {}, { ttl = 0, fresh = false } = {}) {
  const qs = new URLSearchParams({ path, ...params, ...(fresh ? { fresh: '1' } : {}) }).toString();
  const key = qs.replace('&fresh=1', '');
  const hit = mem.get(key);
  if (!fresh && hit && Date.now() - hit.t < ttl * 1000) return hit.d;
  let res;
  try { res = await fetch('/api/fpl?' + qs); }
  catch {
    const cached = LS.get('fpc_' + key);
    if (cached) { lastUpdated[path] = cached.t; return cached.d; }
    throw new Error('تعذّر الاتصال بالسيرفر — تأكد من الإنترنت');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw Object.assign(new Error(data?.error || 'خطأ ' + res.status), { status: res.status });
  const now = Date.now();
  mem.set(key, { t: now, d: data }); lastUpdated[path] = now;
  if (JSON.stringify(data).length < 400000) LS.set('fpc_' + key, { t: now, d: data });
  return data;
}

export async function loadGame(fresh = false) {
  const [b, f] = await Promise.all([get('bootstrap-static/', {}, { ttl: 300, fresh }), get('fixtures/', {}, { ttl: 600, fresh })]);
  const teams = {};
  b.teams.forEach((t) => (teams[t.id] = { id: t.id, name: t.name, short: t.short_name, str: t.strength, sh: t.strength_overall_home, sa: t.strength_overall_away }));
  const players = b.elements.filter((e) => POS[e.element_type]).map((e) => ({
    id: e.id, code: e.code, name: e.web_name, full: `${e.first_name} ${e.second_name}`.trim(), team: e.team, pos: POS[e.element_type],
    price: e.now_cost / 10, form: +e.form || 0, ppg: +e.points_per_game || 0, ep: e.ep_next != null ? +e.ep_next : null,
    total: e.total_points, own: +e.selected_by_percent || 0, st: e.status, chance: e.chance_of_playing_next_round, news: e.news || '',
    gls: e.goals_scored, ast: e.assists, cs: e.clean_sheets, min: e.minutes, starts: e.starts ?? null, yc: e.yellow_cards, rc: e.red_cards,
    saves: e.saves, bonus: e.bonus, bps: e.bps, gc: e.goals_conceded, xg: +e.expected_goals || 0, xa: +e.expected_assists || 0,
    xgi: +e.expected_goal_involvements || 0, ict: +e.ict_index || 0, threat: +e.threat || 0, creativity: +e.creativity || 0,
    cc: (e.cost_change_event || 0) / 10, ccs: (e.cost_change_start || 0) / 10, tin: e.transfers_in_event || 0, tout: e.transfers_out_event || 0,
  }));
  const events = b.events.map((e) => ({ id: e.id, deadline: e.deadline_time, cur: e.is_current, next: e.is_next, fin: e.finished, checked: e.data_checked,
    avg: e.average_entry_score, top: e.highest_score, topEl: e.top_element, cap: e.most_captained, chipPlays: e.chip_plays || [] }));
  const cur = events.find((e) => e.cur), nxt = events.find((e) => e.next);
  const fx = {}, fxList = [];
  f.forEach((x) => {
    const o = { id: x.id, ev: x.event, h: x.team_h, a: x.team_a, hd: x.team_h_difficulty, ad: x.team_a_difficulty, ko: x.kickoff_time, fin: x.finished || x.finished_provisional, started: x.started, hs: x.team_h_score, as: x.team_a_score, min: x.minutes, stats: x.stats || [] };
    fxList.push(o); if (x.event) (fx[x.event] = fx[x.event] || []).push(o);
  });
  return {
    teams, players, PM: Object.fromEntries(players.map((p) => [p.id, p])), events, fx, fxList,
    cur: cur ? cur.id : 0, next: nxt ? nxt.id : null, deadline: nxt ? nxt.deadline : null,
    finished: events.filter((e) => e.fin).length, totalPlayers: b.total_players || 0, lastGW: events.length ? events[events.length - 1].id : 38,
    chipRules: (b.chips || []).map((c) => ({ name: c.name, number: c.number, start: c.start_event, stop: c.stop_event })),
    fetchedAt: Date.now(),
  };
}

export async function loadEntry(id, fresh = false) {
  const [entry, hist, transfers] = await Promise.all([
    get(`entry/${id}/`, {}, { ttl: 120, fresh }), get(`entry/${id}/history/`, {}, { ttl: 300, fresh }), get(`entry/${id}/transfers/`, {}, { ttl: 300, fresh }).catch(() => []),
  ]);
  const gw = entry.current_event || null;
  const picks = gw ? await get(`entry/${id}/event/${gw}/picks/`, {}, { ttl: 300, fresh }).catch(() => null) : null;
  // بعد الفري هيت الفريق يرجع لتشكيلة الجولة اللي قبلها
  let basePicks = picks, fhRevert = false;
  if (picks?.active_chip === 'freehit' && gw > 1) { const prev = await get(`entry/${id}/event/${gw - 1}/picks/`, {}, { ttl: 3600, fresh }).catch(() => null); if (prev) { basePicks = prev; fhRevert = true; } }
  // الانتقالات اللي سويتها للجولة الجاية (تنعرض فوراً بالواجهة العامة)
  const pending = (Array.isArray(transfers) ? transfers : []).filter((t) => t.event > gw).sort((a, b) => new Date(a.time) - new Date(b.time));
  return { entry, hist, transfers, picks, basePicks, fhRevert, pending, gw };
}
export const fetchEntry = (id) => get(`entry/${id}/`, {}, { ttl: 120 });
export const fetchHistory = (id) => get(`entry/${id}/history/`, {}, { ttl: 300 });
export const fetchPicks = (id, gw) => get(`entry/${id}/event/${gw}/picks/`, {}, { ttl: 3600 });
export const loadLeague = (id, page = 1) => get(`leagues-classic/${id}/standings/`, { page }, { ttl: 180 });
export const loadLive = (gw, fresh = false) => get(`event/${gw}/live/`, {}, { ttl: 30, fresh });
export const loadFixturesGW = (gw, fresh = false) => get('fixtures/', { event: gw }, { ttl: 30, fresh });
export const loadPlayerSummary = (id) => get(`element-summary/${id}/`, {}, { ttl: 900 });
export const serverStatus = () => fetch('/api/fpl?status=1').then((r) => r.json());

/** تقدير الانتقالات المجانية من سجل الجولات (الحد 5) */
export function estimateFT(hist) {
  const chips = {}; (hist.chips || []).forEach((c) => (chips[c.event] = c.name));
  const cur = hist.current || []; if (!cur.length) return 1;
  let ft = 1;
  cur.forEach((h, i) => { if (i === 0) { ft = 1; return; } if (chips[h.event] !== 'wildcard' && chips[h.event] !== 'freehit') ft = Math.max(0, ft - (h.event_transfers || 0)); ft = Math.min(5, ft + 1); });
  return ft;
}
/** حالة الأوراق حسب قوانين الموسم القادمة من الفانتازي نفسه (bootstrap.chips) */
export function chipStatus(G, hist) {
  const used = hist.chips || [];
  const rules = G.chipRules.length ? G.chipRules : [{ name: 'wildcard', number: 1, start: 1, stop: 38 }, { name: 'freehit', number: 1, start: 1, stop: 38 }, { name: 'bboost', number: 1, start: 1, stop: 38 }, { name: '3xc', number: 1, start: 1, stop: 38 }];
  return rules.map((r) => {
    const u = used.filter((c) => c.name === r.name && c.event >= r.start && c.event <= r.stop);
    const ref = G.next || G.cur || 1;
    const open = ref >= r.start && ref <= r.stop;
    return { ...r, used: u, left: Math.max(0, r.number - u.length), open, expired: ref > r.stop };
  });
}
