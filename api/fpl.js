/* =========================================================
   /api/fpl — وسيط آمن لبيانات الفانتازي الرسمية
   - مسارات محددة فقط (منع إساءة الاستخدام)
   - كاش بالذاكرة + Cache-Control للـ CDN
   - يرجّع آخر نسخة محفوظة إذا موقع الفانتازي وقف
   - fresh=1 يتجاوز الكاش (محدود: مرة كل 30 ثانية لكل مسار)
========================================================= */
const BASE = 'https://fantasy.premierleague.com/api/';
const UA = 'Mozilla/5.0 (compatible; FantasyPro/2.0)';
const ROUTES = [
  { re: /^bootstrap-static\/$/, ttl: 300 },
  { re: /^fixtures\/$/, ttl: 600 },
  { re: /^entry\/\d{1,10}\/$/, ttl: 20 },
  { re: /^entry\/\d{1,10}\/history\/$/, ttl: 60 },
  { re: /^entry\/\d{1,10}\/transfers\/$/, ttl: 15 },
  { re: /^entry\/\d{1,10}\/event\/\d{1,2}\/picks\/$/, ttl: 30 },
  { re: /^entry\/\d{1,10}\/cup\/$/, ttl: 600 },
  { re: /^leagues-classic\/\d{1,10}\/standings\/$/, ttl: 180 },
  { re: /^leagues-h2h\/\d{1,10}\/standings\/$/, ttl: 120 },
  { re: /^leagues-h2h-matches\/league\/\d{1,10}\/$/, ttl: 60 },
  { re: /^event\/\d{1,2}\/live\/$/, ttl: 30 },
  { re: /^element-summary\/\d{1,5}\/$/, ttl: 900 },
];
const memo = new Map();
const stats = { hits: 0, misses: 0, errors: [], started: Date.now() };
const lastFresh = new Map();

function send(res, code, data, ttl = 0) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl, 60)}` : 'no-store');
  res.end(JSON.stringify(data));
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
function slimBootstrap(b) {
  return {
    total_players: b.total_players,
    chips: (b.chips || []).map((c) => pick(c, ['name', 'number', 'start_event', 'stop_event', 'chip_type'])),
    teams: b.teams.map((t) => pick(t, ['id', 'name', 'short_name', 'strength', 'code', 'strength_overall_home', 'strength_overall_away'])),
    events: b.events.map((e) => pick(e, ['id', 'deadline_time', 'is_current', 'is_next', 'finished', 'data_checked', 'average_entry_score', 'highest_score', 'top_element', 'most_captained', 'chip_plays'])),
    elements: b.elements.map((e) => pick(e, ['id', 'code', 'web_name', 'first_name', 'second_name', 'team', 'element_type', 'now_cost', 'form', 'points_per_game', 'ep_next', 'total_points', 'selected_by_percent', 'status', 'chance_of_playing_next_round', 'news', 'goals_scored', 'assists', 'clean_sheets', 'minutes', 'starts', 'yellow_cards', 'red_cards', 'saves', 'bonus', 'bps', 'goals_conceded', 'cost_change_event', 'cost_change_start', 'transfers_in_event', 'transfers_out_event', 'expected_goals', 'expected_assists', 'expected_goal_involvements', 'ict_index', 'threat', 'creativity'])),
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://local');
  if (url.searchParams.get('status') === '1') {
    const entries = [...memo.entries()].map(([k, v]) => ({ path: k, age: Math.round((Date.now() - v.t) / 1000) })).sort((a, b) => a.age - b.age).slice(0, 40);
    return send(res, 200, { ok: true, mock: process.env.FPL_MOCK === '1', aiCoach: !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY), aiKeys: { claude: !!process.env.ANTHROPIC_API_KEY, gemini: !!process.env.GEMINI_API_KEY }, env: process.env.VERCEL_ENV || 'local', commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7), uptime: Math.round((Date.now() - stats.started) / 1000), cache: { size: memo.size, hits: stats.hits, misses: stats.misses, entries }, errors: stats.errors.slice(0, 15), now: Date.now() });
  }
  let path = (url.searchParams.get('path') || '').replace(/^\/+/, '');
  if (path && !path.endsWith('/')) path += '/';
  const route = ROUTES.find((r) => r.re.test(path));
  if (!route) return send(res, 400, { error: 'مسار غير مسموح' });

  let qs = '';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  if ((path.startsWith('leagues-classic') || path.startsWith('leagues-h2h/')) && page > 1) qs = `?page_standings=${Math.min(page, 1000)}`;
  const ev = parseInt(url.searchParams.get('event') || '0', 10);
  if (path.startsWith('leagues-h2h-matches')) qs = `?page=${Math.min(page, 100)}${ev >= 1 && ev <= 38 ? `&event=${ev}` : ''}`;
  let ttl = route.ttl;
  if (path === 'fixtures/' && ev >= 1 && ev <= 38) { qs = `?event=${ev}`; ttl = 30; }
  const key = path + qs;
  let fresh = url.searchParams.get('fresh') === '1';
  if (fresh) { const lf = lastFresh.get(key) || 0; if (Date.now() - lf < 30000) fresh = false; else lastFresh.set(key, Date.now()); }
  const hit = memo.get(key);
  if (!fresh && hit && Date.now() - hit.t < ttl * 1000) { stats.hits++; return send(res, 200, hit.d, ttl); }
  stats.misses++;
  try {
    let data;
    if (process.env.FPL_MOCK === '1') {
      const { mockFPL } = await import('./_mock.js');
      data = mockFPL(path, { page, event: ev });
      if (data == null) return send(res, 404, { error: 'غير موجود' });
    } else {
      const r = await fetch(BASE + key, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 404) return send(res, 404, { error: 'غير موجود — تأكد من الرقم' });
      if (r.status === 503) return send(res, 503, { error: 'موقع الفانتازي يتحدّث حالياً (عادة بين الجولات) — جرّب بعد شوية' });
      if (!r.ok) throw new Error('upstream ' + r.status);
      data = await r.json();
    }
    if (path === 'bootstrap-static/') data = slimBootstrap(data);
    memo.set(key, { t: Date.now(), d: data });
    if (memo.size > 500) memo.delete(memo.keys().next().value);
    return send(res, 200, data, ttl);
  } catch (e) {
    stats.errors.unshift({ t: Date.now(), path: key, msg: String(e.message || e) }); stats.errors.length = Math.min(stats.errors.length, 30);
    if (hit) return send(res, 200, hit.d, 30);
    return send(res, 502, { error: 'تعذّر الاتصال بموقع الفانتازي — حاول بعد شوية' });
  }
}
