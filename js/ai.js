/* =========================================================
   الذكاء: بحث فوري + فهم النية + أسئلة للذكاء الاصطناعي بأدوات
   على كل بيانات التطبيق (اللاعبين، فريقك، الجولات 1–38، الدوريات، الأوراق)
========================================================= */
import { ST, PM, tShort, tName } from './store.js';
import { tt, lang } from './i18n.js';
import { esc, CLUB_AR } from './ui.js';
import * as FPL from './fpl.js';
import { pricePredict, liveRankEstimate } from './predict.js';
import { xp, xpN, avail, avgFdr, fixturesFor, analyze, suggestions, canBuy, projected, bestXI, formation, dgwBgw, captainRank } from './engine.js';

/* ---------- تطبيع النص (عربي/إنجليزي/أحرف مركبة) ---------- */
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ًͯ-ٰٟ]/g, '')
  .replace(/[أإآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\p{L}\p{N}\s.<>]/gu, ' ').replace(/\s+/g, ' ').trim();

/* أسماء عربية شائعة للاعبين (لجعل البحث بالعربي يشتغل) */
const AR_NAMES = { 'هالاند': 'haaland', 'صلاح': 'salah', 'ساكا': 'saka', 'بالمر': 'palmer', 'رايس': 'rice', 'ساليبا': 'saliba', 'غابرييل': 'gabriel', 'رايا': 'raya', 'فان دايك': 'van dijk', 'الكسندر': 'alexander', 'ايزاك': 'isak', 'غوردون': 'gordon', 'برونو': 'b.fernandes', 'فرنانديز': 'fernandes', 'مبيومو': 'mbeumo', 'كونيا': 'cunha', 'واتكينز': 'watkins', 'روجرز': 'rogers', 'فودين': 'foden', 'شيركي': 'cherki', 'مرموش': 'marmoush', 'غفارديول': 'gvardiol', 'ودوكو': 'doku', 'سيمينيو': 'semenyo', 'تافيرنييه': 'tavernier', 'ايفانلسون': 'evanilson', 'كالفرت': 'calvert', 'كالافيوري': 'calafiori', 'تيمبر': 'timber', 'اوديغارد': 'odegaard', 'مادويكي': 'madueke', 'ايزي': 'eze', 'جواو بيدرو': 'joao pedro', 'جاكسون': 'jackson', 'انزو': 'enzo', 'كايسيدو': 'caicedo', 'كوكوريا': 'cucurella', 'سانشيز': 'sanchez', 'بيكفورد': 'pickford', 'ويسا': 'wissa', 'مينيه': 'mainoo', 'شيشكو': 'sesko', 'اكيتيكي': 'ekitike', 'فيرتز': 'wirtz', 'ماك اليستر': 'mac allister', 'سوبوسلاي': 'szoboszlai', 'خاكبو': 'gakpo', 'هول': 'hall', 'تروسارد': 'trossard', 'مارتينيلي': 'martinelli', 'جيوكيريس': 'gyokeres', 'ريتشارليسون': 'richarlison', 'كولو مواني': 'kolo muani', 'سون': 'son', 'كولوسيفسكي': 'kulusevski', 'بيرنفورد': 'bernabe', 'ويلسون': 'wilson', 'ميتوما': 'mitoma', 'ولتيمادي': 'woltemade', 'فيربروغن': 'verbruggen', 'دي كاوبر': 'de cuyper', 'كايودي': 'kayode', 'بلومي': 'belloumi' };
const POSW = { GK: ['حارس', 'حراس', 'gk', 'goalkeeper', 'keeper'], DEF: ['مدافع', 'مدافعين', 'دفاع', 'def', 'defender'], MID: ['وسط', 'لاعب وسط', 'mid', 'midfielder'], FWD: ['مهاجم', 'مهاجمين', 'هجوم', 'fwd', 'forward', 'striker'] };
const SORTW = [
  [['فورم', 'form', 'مستوى'], 'form'], [['نقاط', 'points', 'هداف النقاط'], 'total'], [['متوقع', 'xp', 'توقع'], 'xp5'], [['ارخص', 'رخيص', 'cheap', 'budget'], 'cheap'],
  [['ملكيه', 'ملكية', 'owned', 'ownership'], 'own'], [['مفاجا', 'مفاجآت', 'differential', 'قليل الملكيه'], 'diff'], [['اهداف', 'هداف', 'goals'], 'gls'], [['xg', 'متوقعه اهداف'], 'xg'],
  [['صاعد', 'rising', 'شراء'], 'tin'], [['قيمه', 'value', 'نقطه لكل مليون'], 'value'], [['سهله', 'easy', 'مباريات سهله'], 'fix'],
];
const VIEWW = [[['سعر', 'اسعار', 'صعود', 'نزول', 'price'], 'prices'], [['تشكيل', 'ملعب', 'فريقي', 'lineup', 'team'], 'team'], [['جوله', 'جولات', 'gameweek', 'gw', 'موسم'], 'season'], [['مباشر', 'live', 'نتائج'], 'live'], [['دوري', 'دوريات', 'ترتيب', 'league'], 'leagues'], [['ورق', 'اوراق', 'chip', 'وايلد', 'بنش', 'فري هيت', 'كابتن ثلاثي'], 'chips'], [['انتقال', 'سوق', 'transfer', 'market'], 'market'], [['مختبر', 'قرار', 'lab', 'hit', 'خصم'], 'lab'], [['تحليل', 'احصاء', 'stats', 'analytics'], 'stats'], [['مقارنه', 'compare'], 'compare'], [['اشعار', 'notif'], 'notifs'], [['اعداد', 'settings'], 'settings']];
const has = (q, words) => words.some((w) => q.includes(norm(w)));

/** يفهم البحث محلياً: لاعبين، أندية، جولات، أقسام، وفلاتر ذكية (مركز/سعر/ترتيب/نادي) */
export function parseQuery(raw) {
  const G = ST.G, q = norm(raw); if (!q) return null;
  let qq = q; Object.entries(AR_NAMES).forEach(([a, e]) => { if (qq.includes(norm(a))) qq = qq.replace(norm(a), e); });
  const pos = Object.keys(POSW).find((k) => has(q, POSW[k])) || null;
  const pm = q.match(/(?:تحت|اقل من|under|<|ب|max)\s*(\d+(?:\.\d)?)/); const maxPrice = pm ? +pm[1] : null;
  const sort = (SORTW.find(([w]) => has(q, w)) || [])[1] || null;
  const gwm = q.match(/(?:جوله|الجوله|gw|gameweek)\s*(\d{1,2})/); const gw = gwm ? +gwm[1] : null;
  const teams = Object.values(G.teams);
  const club = teams.find((tm) => q.includes(norm(tm.name)) || q.split(' ').includes(tm.short.toLowerCase()) || (CLUB_AR[tm.short] && q.includes(norm(CLUB_AR[tm.short]))));
  const view = (VIEWW.find(([w]) => has(q, w)) || [])[1] || null;
  const words = qq.split(' ').filter((w) => w.length > 1);
  const nameHits = G.players.map((p) => { const n = norm(p.full + ' ' + p.name); let s = 0; if (norm(p.name) === qq) s = 100; else if (n.includes(qq)) s = 60; else s = words.filter((w) => n.includes(w)).length * 20; return [p, s + Math.min(10, p.total / 20)]; }).filter((x) => x[1] >= 20).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0]);
  let smart = null;
  if (pos || maxPrice || sort || club) {
    let L = G.players.filter((p) => (!pos || p.pos === pos) && (!maxPrice || p.price <= maxPrice) && (!club || p.team === club.id) && p.st !== 'u');
    const nx = G.next || G.cur; const key = { form: (p) => p.form, total: (p) => p.total, xp5: (p) => xpN(p, nx, 5), cheap: (p) => -p.price, own: (p) => p.own, diff: (p) => (p.own < 8 ? xpN(p, nx, 5) : -1), gls: (p) => p.gls, xg: (p) => p.xg, tin: (p) => p.tin, value: (p) => p.total / p.price, fix: (p) => -avgFdr(p.team, nx, 5) * 10 + xpN(p, nx, 5) / 10 }[sort || 'xp5'];
    smart = { pos, maxPrice, sort: sort || 'xp5', club, list: L.sort((a, b) => key(b) - key(a)).slice(0, 8) };
  }
  const isQuestion = /[؟?]|^(منو|شنو|شلون|ليش|هل|متى|وين|اشلون|شكد|كم|who|what|how|why|when|should|which|is|can)\b/.test(q) || q.split(' ').length >= 4;
  return { q, pos, maxPrice, sort, gw: gw && gw <= G.lastGW ? gw : null, club, view, players: nameHits, smart, isQuestion };
}

/* ---------- أدوات الذكاء الاصطناعي (تشتغل على بيانات التطبيق) ---------- */
const pBrief = (p, gw = ST.G.next) => ({ id: p.id, name: p.full, short: p.name, pos: p.pos, club: tShort(p.team), price: p.price, total_points: p.total, form: p.form, ppg: p.ppg, ownership_pct: p.own, goals: p.gls, assists: p.ast, clean_sheets: p.cs, minutes: p.min, xG: +p.xg.toFixed(2), xA: +p.xa.toFixed(2), status: p.st, news: p.news || undefined, availability_pct: Math.round(avail(p) * 100), xp_next: xp(p, gw), xp_next5: xpN(p, gw, 5), next_fixtures: nextFx(p.team, gw, 5), in_my_team: !!ST.plan?.squad.includes(p.id), estimated: window.__EMBED?.isEst?.(p.id) || undefined });
const nextFx = (team, from, n) => Array.from({ length: n }, (_, i) => from + i).filter((g) => g <= ST.G.lastGW).map((g) => { const f = fixturesFor(team, g); return f.length ? f.map((x) => `GW${g} ${tShort(x.opp)}(${x.home ? 'H' : 'A'}) FDR${x.fdr}`).join(' + ') : `GW${g} blank`; });
const findP = (name) => { const r = parseQuery(name); return r?.players?.[0] || null; };

export const TOOLS = [
  { name: 'find_players', description: 'Search/filter all Premier League fantasy players. Use for "best X", cheap options, differentials, by club/position/price.', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'player name (optional)' }, position: { type: 'string', enum: ['GK', 'DEF', 'MID', 'FWD'] }, club: { type: 'string', description: '3-letter club code e.g. ARS' }, max_price: { type: 'number' }, min_price: { type: 'number' }, sort: { type: 'string', enum: ['xp5', 'form', 'total', 'value', 'own', 'diff', 'xg', 'cheap', 'fix'] }, limit: { type: 'number' } } },
    execute: ({ query, position, club, max_price, min_price, sort = 'xp5', limit = 8 }) => { const G = ST.G, nx = G.next || G.cur; if (query) { const r = parseQuery(query); return (r?.players || []).slice(0, limit).map((p) => pBrief(p)); } const key = { form: (p) => p.form, total: (p) => p.total, xp5: (p) => xpN(p, nx, 5), cheap: (p) => -p.price, own: (p) => p.own, diff: (p) => (p.own < 8 ? xpN(p, nx, 5) : -1), xg: (p) => p.xg, value: (p) => p.total / p.price, fix: (p) => -avgFdr(p.team, nx, 5) }[sort] || ((p) => xpN(p, nx, 5)); return G.players.filter((p) => (!position || p.pos === position) && (!club || tShort(p.team) === club.toUpperCase()) && (!max_price || p.price <= max_price) && (!min_price || p.price >= min_price) && p.st !== 'u').sort((a, b) => key(b) - key(a)).slice(0, Math.min(limit, 15)).map((p) => pBrief(p)); } },
  { name: 'player_detail', description: 'Full detail for one player: season stats, every played gameweek (points, minutes, goals, assists), next fixtures, availability news.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    execute: async ({ name }) => { const p = findP(name); if (!p) return { error: 'not found' }; let hist = []; try { const d = await FPL.loadPlayerSummary(p.id); hist = (d.history || []).map((h) => ({ gw: h.round, opp: tShort(h.opponent_team), home: h.was_home, pts: h.total_points, min: h.minutes, g: h.goals_scored, a: h.assists, cs: h.clean_sheets, bonus: h.bonus })); } catch {} return { ...pBrief(p), per_gameweek: hist }; } },
  { name: 'my_team', description: 'The user\'s current squad: XI, bench, captain, bank, free transfers, projected points, formation and engine alerts.', inputSchema: { type: 'object', properties: {} },
    execute: () => { const P = ST.plan; if (!P) return { error: 'no team' }; const a = analyze(P, (s) => s); return { team: ST.E.entry.name, gw_next: ST.G.next, formation: formation(P.xi), captain: PM(P.cap).full, vice: PM(P.vc).full, bank_m: P.bank, free_transfers: P.ft, projected_next: projected(P), rating: a.overall, optimal_projected: a.opt, alerts: a.alerts.map((x) => x.m.replace(/<[^>]+>/g, '')).slice(0, 8), xi: P.xi.map((id) => pBrief(PM(id))), bench: P.bench.map((id) => pBrief(PM(id))) }; } },
  { name: 'my_season', description: 'User gameweek-by-gameweek history: points, average, highest, overall rank, transfers, hits, bench points, chips used; plus total and rank.', inputSchema: { type: 'object', properties: {} },
    execute: () => { const h = ST.E.hist; return { total: ST.E.entry.summary_overall_points, overall_rank: ST.E.entry.summary_overall_rank, chips_used: h.chips, gameweeks: (h.current || []).map((x) => { const ev = ST.G.events.find((e) => e.id === x.event) || {}; return { gw: x.event, pts: x.points, avg: ev.avg, highest: ev.top, rank: x.overall_rank, transfers: x.event_transfers, hit: x.event_transfers_cost, bench_pts: x.points_on_bench }; }) }; } },
  { name: 'gameweek', description: 'Any gameweek 1-38: deadline, fixtures with scores/difficulty, average & highest score, double/blank teams.', inputSchema: { type: 'object', properties: { gw: { type: 'number' } }, required: ['gw'] },
    execute: ({ gw }) => { const G = ST.G, ev = G.events.find((e) => e.id === gw); if (!ev) return { error: 'invalid gw' }; const fx = (G.fx[gw] || []).map((f) => ({ home: tShort(f.h), away: tShort(f.a), score: f.started ? `${f.hs}-${f.as}` : null, kickoff: f.ko, fdr_home: f.hd, fdr_away: f.ad })); const cnt = {}; (G.fx[gw] || []).forEach((f) => { cnt[f.h] = (cnt[f.h] || 0) + 1; cnt[f.a] = (cnt[f.a] || 0) + 1; }); return { gw, deadline: ev.deadline, finished: ev.fin, average: ev.avg, highest: ev.top, fixtures: fx, doubles: Object.keys(cnt).filter((k) => cnt[k] > 1).map((k) => tShort(+k)), blanks: Object.values(G.teams).filter((tm) => !cnt[tm.id] && fx.length).map((tm) => tm.short) }; } },
  { name: 'fixture_run', description: 'Fixture difficulty run for clubs over a range of gameweeks, sorted easiest first.', inputSchema: { type: 'object', properties: { from_gw: { type: 'number' }, n: { type: 'number' }, club: { type: 'string' } } },
    execute: ({ from_gw, n = 5, club }) => { const G = ST.G, f0 = from_gw || G.next; return Object.values(G.teams).filter((tm) => !club || tm.short === club.toUpperCase()).map((tm) => ({ club: tm.short, avg_fdr: +avgFdr(tm.id, f0, n).toFixed(2), run: nextFx(tm.id, f0, n) })).sort((a, b) => a.avg_fdr - b.avg_fdr); } },
  { name: 'simulate_transfer', description: 'Simulate selling one player and buying another: validity, xP gain per GW over horizon, hit cost, net and breakeven.', inputSchema: { type: 'object', properties: { out: { type: 'string' }, in: { type: 'string' }, horizon: { type: 'number' } }, required: ['out', 'in'] },
    execute: ({ out, in: inn, horizon = 5 }) => { const o = findP(out), n = findP(inn); if (!o || !n) return { error: 'player not found' }; return labCompute(o.id, n.id, horizon); } },
  { name: 'league_standings', description: 'Standings of one of the user\'s classic leagues (private leagues by name).', inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
    execute: async ({ name }) => { const ls = ST.E.entry.leagues?.classic || []; const l = ls.find((x) => name && norm(x.name).includes(norm(name))) || ls.find((x) => x.league_type === 'x') || ls[0]; if (!l) return { error: 'no leagues' }; try { const d = await FPL.loadLeague(l.id); return { league: l.name, my_rank: l.entry_rank, rows: d.standings.results.slice(0, 20).map((r) => ({ rank: r.rank, team: r.entry_name, manager: r.player_name, gw: r.event_total, total: r.total })) }; } catch (e) { return { league: l.name, my_rank: l.entry_rank, of: l.rank_count, error: e.message }; } } },
  { name: 'chips_and_calendar', description: 'Chips remaining per season rules and upcoming double/blank gameweeks.', inputSchema: { type: 'object', properties: {} },
    execute: () => ({ chips: FPL.chipStatus(ST.G, ST.E.hist).map((c) => ({ chip: c.name, window: `GW${c.start}-${c.stop}`, left: c.left, used: c.used.map((u) => u.event) })), doubles_blanks: dgwBgw(ST.G.next, ST.G.lastGW).map((x) => ({ gw: x.gw, doubles: x.dbl.map(tShort), blanks: x.blank.map(tShort) })) }) },
  { name: 'price_predictions', description: 'Estimated price-change progress (-100..+100 = approx threshold) from net transfers this GW, for the user squad/watchlist or top risers/fallers. Estimates only.', inputSchema: { type: 'object', properties: { scope: { type: 'string', enum: ['mine', 'risers', 'fallers'] } } },
    execute: ({ scope = 'mine' }) => { const mine = new Set([...(ST.plan?.squad || []), ...ST.watch]); let L = ST.G.players.filter((p) => p.st !== 'u').map((p) => ({ p, r: pricePredict(p) })); L = scope === 'mine' ? L.filter((x) => mine.has(x.p.id)) : scope === 'risers' ? L.sort((a, b) => b.r.prog - a.r.prog).slice(0, 12) : L.sort((a, b) => a.r.prog - b.r.prog).slice(0, 12); return L.map(({ p, r }) => ({ name: p.full, club: tShort(p.team), price: p.price, changed_this_gw: p.cc, net_transfers_gw: r.net, progress_pct: r.prog, state: r.state })); } },
  { name: 'live_rank', description: 'Estimated live overall rank during an ongoing gameweek (estimate).', inputSchema: { type: 'object', properties: {} },
    execute: async () => { const { liveTeamPoints } = await import('./views/home.js'); const lp = liveTeamPoints(); const r = liveRankEstimate(lp); return r ? { live_points: lp, estimated_rank: r.rank, previous_rank: r.from, estimated_live_average: r.avgLive } : { note: 'No live gameweek in progress or not enough data' }; } },
];

/* ---------- مختبر القرار (يُستخدم بالواجهة والأدوات) ---------- */
export function labCompute(outId, inId, horizon = 5) {
  const P = ST.plan, G = ST.G, o = PM(outId), n = PM(inId), from = G.next;
  const err = P ? canBuy(P, outId, inId) : '';
  const per = Array.from({ length: horizon }, (_, i) => from + i).filter((g) => g <= G.lastGW).map((g) => ({ gw: g, out: xp(o, g), in: xp(n, g), diff: Math.round((xp(n, g) - xp(o, g)) * 10) / 10 }));
  const gain = Math.round(per.reduce((a, x) => a + x.diff, 0) * 10) / 10;
  const hit = P && P.ft - (P.transfers?.length || 0) <= 0 ? 4 : 0;
  let cum = 0, be = null; per.forEach((x) => { cum += x.diff; if (be == null && cum >= hit && hit > 0) be = x.gw; });
  const net = Math.round((gain - hit) * 10) / 10;
  const verdict = err ? 'invalid' : net >= 2 ? 'go' : net > -0.5 ? 'wait' : 'no';
  return { out: o.full, in: n.full, valid: !err, reason: err || undefined, horizon: per.length, per_gw: per, xp_gain: gain, hit_cost: hit, net, breakeven_gw: be, verdict, bank_after: P ? Math.round((P.bank + o.price - n.price) * 10) / 10 : null };
}

/* ---------- السؤال للذكاء الاصطناعي ---------- */
export function contextText() {
  const G = ST.G, P = ST.plan;
  return `Data: official FPL feed fetched ${new Date(G.fetchedAt).toISOString()}. Season GW1-${G.lastGW}; finished GWs ${G.finished}; next GW ${G.next} (deadline ${G.deadline}). Team "${ST.E.entry.name}", total ${ST.E.entry.summary_overall_points}, rank ${ST.E.entry.summary_overall_rank}. ${P ? `Bank £${P.bank}m, FT ${P.ft}. Captain ${PM(P.cap).name}. XI: ${P.xi.map((id) => PM(id).name).join(', ')}. Bench: ${P.bench.map((id) => PM(id).name).join(', ')}.` : ''}`;
}
export async function askAI(question, { onText, onTool, signal, history = [] } = {}) {
  const ar = lang() !== 'en';
  const sys = `${ar ? 'أنت "المساعد الذكي" داخل تطبيق فانتازي برو للدوري الإنجليزي. جاوب بالعربي بلهجة عراقية خفيفة، مباشرة وبنقاط مرتبة، وابدأ بالخلاصة. استخدم الأدوات دائماً لجلب الأرقام بدل التخمين، وتقدر تستدعي أكثر من أداة. إذا السؤال خارج بيانات التطبيق (قوانين اللعبة، تاريخ، نصائح عامة) جاوب من معرفتك ووضّح إنه معلومة عامة. لا تخترع أخبار إصابات أو أرقام. الحقول estimated=true تعني إحصاءات تقديرية فنبّه عليها. النقاط المتوقعة (xp) تقدير من الفورم والمباريات.' : 'You are the smart assistant inside Fantasy Pro (FPL). Answer concisely with bullets, lead with the answer. Always use tools for numbers; call several if needed. For general knowledge outside the data, say so. Never invent news. Fields estimated=true are estimates — flag them.'}\n${contextText()}`;
  const S = window.__EMBED?.sample ? await window.__EMBED.sample() : null;
  if (S) {
    const tools = TOOLS.map((t) => ({ ...t, execute: async (inp) => { onTool && onTool(t.name, inp); try { const r = await t.execute(inp || {}); return JSON.stringify(r).slice(0, 12000); } catch (e) { return JSON.stringify({ error: String(e.message || e) }); } } }));
    const msgs = [...history.slice(-6), { role: 'user', content: `${sys}\n\n${ar ? 'سؤال المستخدم' : 'User question'}: ${question}` }];
    const r = await S(msgs, { tools, modelTier: 'default', cache: false, signal, onText: ({ text }) => onText && onText(text) });
    return { text: r.text, source: 'ai' };
  }
  // التطبيق المنشور: السيرفر (Claude) مع سياق مُجهز مسبقاً من الأدوات
  const pre = await prefetch(question);
  const AU = await import('./auth.js');
  const res = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (await AU.getIdToken()) }, signal, body: JSON.stringify({ question, lang: lang(), context: `${contextText()}\n\nRelevant data (JSON):\n${pre}`, history: history.slice(-6) }) });
  const d = await res.json().catch(() => ({}));
  if (res.ok && d.text) { onText && onText(d.text); return { text: d.text, source: 'ai' }; }
  throw Object.assign(new Error(d.error || 'ai_unavailable'), { code: res.status === 429 ? 'rate_limited' : 'unavailable' });
}
async function prefetch(question) {
  const r = parseQuery(question) || {}, T = Object.fromEntries(TOOLS.map((t) => [t.name, t.execute])), out = { my_team: T.my_team({}) };
  if (r.players?.length) out.players = await Promise.all(r.players.slice(0, 3).map((p) => T.player_detail({ name: p.full })));
  if (r.smart) out.filtered = r.smart.list.map((p) => pBrief(p));
  if (r.gw) out.gameweek = T.gameweek({ gw: r.gw });
  if (/دوري|ترتيب|league/.test(r.q || '')) out.league = await T.league_standings({});
  if (/ورق|chip|مزدوج|double|blank|فارغ/.test(r.q || '')) out.chips = T.chips_and_calendar({});
  if (/موسم|تاريخ|جولات|season|history|ترتيبي/.test(r.q || '')) out.season = T.my_season({});
  if (!r.smart && !r.players?.length) out.top = T.find_players({ sort: 'xp5', limit: 10 });
  return JSON.stringify(out).slice(0, 24000);
}

/* ---------- محرك محلي (إذا الذكاء الاصطناعي غير متاح) ---------- */
export function localAnswer(question) {
  const r = parseQuery(question) || {}, P = ST.plan, gw = ST.G.next;
  if (/كابتن|captain/.test(r.q)) { const c = captainRank(P, 3); return `**${tt('أفضل كابتن للجولة', 'Best captain GW')} ${gw}**\n${c.map((p, i) => `${i + 1}. **${p.name}** — ${xp(p)} xP · ${nextFx(p.team, gw, 1)[0]}`).join('\n')}`; }
  if (r.smart) return `**${tt('أفضل النتائج', 'Top matches')}**\n${r.smart.list.slice(0, 6).map((p, i) => `${i + 1}. **${p.name}** (${tShort(p.team)}, ${p.price}م) — ${xpN(p, gw, 5)} xP/5 · ${tt('فورم', 'form')} ${p.form}`).join('\n')}`;
  if (r.players?.length) { const p = r.players[0]; return `**${p.full}** · ${tName(p.team)} · ${p.price}م\n- ${tt('النقاط', 'Points')}: ${p.total} · ${tt('فورم', 'Form')} ${p.form} · ${tt('ملكية', 'Owned')} ${p.own}%\n- ${tt('أهداف/صناعة', 'G/A')}: ${p.gls}/${p.ast}\n- ${tt('المتوقع لـ5 جولات', 'xP next 5')}: ${xpN(p, gw, 5)}\n- ${nextFx(p.team, gw, 3).join(' · ')}`; }
  if (/انتقال|بيع|اشتري|transfer/.test(r.q)) { const s = suggestions(P, 4); return `**${tt('أفضل الانتقالات', 'Best transfers')}**\n${s.map((x) => `- ${x.o.name} ← **${x.c.name}** (+${x.g} xP/3)`).join('\n') || tt('احتفظ بانتقالك', 'Roll the transfer')}`; }
  const a = analyze(P, (s) => s); return `**${tt('تقييم فريقك', 'Team rating')}: ${a.overall}/100** · ${tt('المتوقع', 'Projected')} ${a.cur}\n${a.alerts.slice(0, 4).map((x) => '- ' + x.m.replace(/<[^>]+>/g, '')).join('\n')}`;
}

/* ---------- عرض Markdown بسيط وآمن ---------- */
export function md(s) {
  const lines = esc(s || '').split('\n'); let out = '', list = null, tbl = [];
  const inl = (x) => x.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const flushT = () => { if (!tbl.length) return; const rows = tbl.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)); out += '<table>' + rows.map((r, i) => '<tr>' + r.replace(/^\||\|$/g, '').split('|').map((c) => (i ? `<td>${inl(c.trim())}</td>` : `<th>${inl(c.trim())}</th>`)).join('') + '</tr>').join('') + '</table>'; tbl = []; };
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const l of lines) {
    if (/^\s*\|.*\|\s*$/.test(l)) { close(); tbl.push(l); continue; } flushT();
    let m;
    if ((m = l.match(/^\s*[-•*]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inl(m[1])}</li>`; }
    else if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); out += `<h4>${inl(m[1])}</h4>`; }
    else if (l.trim()) { close(); out += `<p>${inl(l)}</p>`; } else close();
  }
  close(); flushT(); return out;
}
