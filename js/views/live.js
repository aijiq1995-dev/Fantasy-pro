/* مركز المباريات والنقاط المباشرة */
import { ST, PM, tName, tShort, officialRank } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, crest, fmtTime, openSheet, sheetHead, toast, fmt, scoreHTML, KITS, fxMin, isHT } from '../ui.js';
import * as FPL from '../fpl.js';
import { scanLive } from '../notify.js';
import { pShirt } from './common.js';
import { liveTeamPoints } from './home.js';
import { liveCalc, rankImpact, whatIf, WHATIF } from '../live-engine.js';
import { liveRankEstimate } from '../predict.js';

let gwSel = null, poll = null, lastFetch = 0;
const isLiveGW = (g) => (ST.G.fx[g] || []).some((f) => f.started && !f.fin);
async function refreshLive(force = false) {
  const g = ST.G.cur; if (!g) return;
  try {
    const [l, fx] = await Promise.all([FPL.loadLive(g, force), FPL.loadFixturesGW(g, force)]);
    const next = Object.fromEntries(l.elements.map((x) => [x.id, x.stats]));
    const fxNorm = fx.map((x) => ({ id: x.id, ev: x.event, h: x.team_h, a: x.team_a, hd: x.team_h_difficulty, ad: x.team_a_difficulty, ko: x.kickoff_time, fin: !!(x.finished || (x.finished_provisional && (x.minutes || 0) >= 90)), started: x.started, hs: x.team_h_score, as: x.team_a_score, min: x.minutes, stats: x.stats || [] }));
    scanLive(ST.live, next, ST.G.fx[g], fxNorm);
    ST.live = next; ST.liveRaw = l.elements; ST.liveRawGW = g; ST.G.fx[g] = fxNorm; lastFetch = Date.now(); freshness();
    if (Date.now() - (window.__entryAt || 0) > 110e3) { window.__entryAt = Date.now(); FPL.fetchEntry(ST.profile.teamId, true).then((en) => { if (en?.id) ST.E.entry = { ...ST.E.entry, ...en }; }).catch(() => {}); }
    if (!document.querySelector('.ov') && ['live', 'home', 'team', 'season'].includes(ST.view)) window.render();
  } catch (e) { if (force) toast(e.message); }
}
/* تحديث لحظي ذكي: كل 30 ثانية وقت المباريات، كل 10 دقائق بباقي الأوقات، ويتوقف إذا التطبيق بالخلفية */
const nearKickoff = () => { const now = Date.now(); return [ST.G.cur, ST.G.next].some((g) => (ST.G.fx[g] || []).some((f) => f.ko && !f.fin && Math.abs(new Date(f.ko) - now) < 2.5 * 3600e3 && new Date(f.ko) - now < 15 * 60e3)); };
export const liveMode = () => !!ST.G && (isLiveGW(ST.G.cur) || nearKickoff());
let idleAt = Date.now(), freshT = null;
async function idleRefresh() {
  try {
    const { setGame } = await import('../engine.js'); const { scanStatic } = await import('../notify.js');
    const G2 = await FPL.loadGame(false); if (!G2.next) G2.next = G2.cur || 1;
    if (G2.cur !== ST.G.cur) return window.loadAll(true);
    const E2 = await FPL.loadEntry(ST.profile.teamId).catch(() => null);
    const sig = (E) => `${E?.gw}|${(E?.pending || []).map((t) => t.element_in + ':' + t.element_out).join(',')}`;
    if (E2 && sig(E2) !== sig(ST.E)) return window.loadAll(true);
    if (E2) { ST.E.entry = E2.entry; ST.E.hist = E2.hist; }
    ST.G = G2; setGame(G2); scanStatic(); idleAt = Date.now();
    if (!document.querySelector('.ov') && ['home', 'players', 'season', 'team'].includes(ST.view)) window.render();
  } catch {}
}
export function freshness() {
  const el = document.getElementById('fresh'); if (!el || !ST.G) return;
  const embed = window.__EMBED?.label?.();
  const lm = liveMode(), ts = lm ? lastFetch || ST.G.fetchedAt : Math.max(idleAt, ST.G.fetchedAt), s = Math.round((Date.now() - ts) / 1000);
  const ago = s < 60 ? tt(`قبل ${s} ث`, `${s}s ago`) : s < 3600 ? tt(`قبل ${Math.round(s / 60)} د`, `${Math.round(s / 60)}m ago`) : tt(`قبل ${Math.round(s / 3600)} س`, `${Math.round(s / 3600)}h ago`);
  if (FPL.staleState.on) { el.className = 'fresh stale'; el.querySelector('span').textContent = tt('الفانتازي يتحدّث', 'FPL updating'); return; }
  el.className = 'fresh ' + (embed ? '' : lm ? 'live' : 'ok');
  el.querySelector('span').textContent = embed || (lm ? tt('مباشر · ', 'Live · ') + ago : tt('محدّث ', 'Updated ') + ago);
}
export function startLivePolling() {
  clearInterval(poll); clearInterval(freshT); lastFetch = lastFetch || Date.now(); idleAt = Date.now();
  const step = () => { if (!ST.G || document.hidden) return; if (liveMode()) { if (Date.now() - lastFetch >= 28e3) refreshLive(true); } else if (Date.now() - idleAt >= 2 * 60e3) idleRefresh(); };
  poll = setInterval(step, 5000); freshT = setInterval(freshness, 5000); freshness();
  if (!window.__visBound) { window.__visBound = 1; document.addEventListener('visibilitychange', () => { if (!document.hidden && ST.G) { if (liveMode()) refreshLive(true); else if (Date.now() - idleAt > 20e3) idleRefresh(); } }); }
  if (liveMode()) refreshLive(true);
}

export function vLive() {
  const G = ST.G; if (gwSel == null) gwSel = isLiveGW(G.cur) || !G.next ? G.cur : G.next;
  const fx = (G.fx[gwSel] || []).slice().sort((a, b) => (a.ko || '').localeCompare(b.ko || ''));
  const live = gwSel === G.cur && isLiveGW(G.cur);
  const squad = ST.plan ? new Set([...ST.plan.xi, ...ST.plan.bench]) : new Set();
  const myTeams = new Set([...squad].map((id) => PM(id)?.team));
  const lp = gwSel === G.cur ? liveTeamPoints() : null;
  const byDay = {}; fx.forEach((f) => { const k = f.ko ? new Date(f.ko).toDateString() : 'tbd'; (byDay[k] = byDay[k] || []).push(f); });
  return `<div class="stadium"><div style="position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-end;gap:10px"><div><div style="font-size:12.5px;opacity:.85">${tt('مركز المباريات', 'Match centre')}</div><div style="font-size:28px;font-weight:700">${t('gw')} ${gwSel}</div>${live ? `<span class="livebadge">${tt('مباشر', 'LIVE')}</span>` : ''}</div>
    ${lp != null ? `<div style="text-align:end"><div style="font-size:12px;opacity:.85">${tt('نقاط فريقك', 'Your points')}</div><div class="score" style="font-size:40px;color:#34D399">${lp}</div></div>` : ''}</div></div>
   <div class="seg" id="lvseg" style="margin:12px 0">${Array.from({ length: G.lastGW }, (_, i) => i + 1).map((g) => `<button class="${g === gwSel ? 'on' : ''}" onclick="lvGW(${g})">${g}</button>`).join('')}</div>
   ${live ? `<div class="mut" style="font-size:11.5px;text-align:center;margin-bottom:8px">${tt('يتحدّث تلقائياً كل دقيقة', 'Auto-refreshes every minute')} · <button class="more" style="display:inline" onclick="lvRefresh()">${I('i-refresh', 'i', 'width:13px;height:13px')} ${t('refresh')}</button></div>` : ''}
   ${Object.values(byDay).map((list) => `<div class="sec" style="margin:12px 2px 8px"><h2 style="font-size:14px">${I('i-cal', 'i', 'width:16px;height:16px')}${list[0].ko ? new Date(list[0].ko).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }) : tt('غير محدد', 'TBD')}</h2></div>${list.map((f) => fxCard(f, myTeams)).join('')}`).join('') || `<div class="empty"><b>${t('noData')}</b></div>`}
   ${gwSel === G.cur && ST.E.picks && ST.live ? `<div class="sec" style="margin:16px 2px 8px"><h2 style="font-size:14px">${I('i-pitch', 'i', 'width:16px;height:16px')}${tt('فريقك مباشر', 'Your team live')}</h2></div>${myLiveBlock()}` : ''}
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:10px">${tt('النتائج والنقاط والبونص من الفانتازي الرسمي مباشرة — بدون توقعات.', 'Scores, points and bonus straight from official FPL — no estimates.')}</p>`;
}
function fxCard(f, myTeams) {
  const st = f.fin ? tt('انتهت', 'FT') : f.started ? fxMin(f) : f.ko ? new Date(f.ko).toLocaleTimeString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { hour: 'numeric', minute: '2-digit' }) : '—';
  const mine = myTeams.has(f.h) || myTeams.has(f.a);
  return `<div class="card tap" style="margin-bottom:8px;${mine ? 'border-color:rgba(52,211,153,.3)' : ''}" onclick="openMatchC(${f.id},${f.ev})"><div class="fx-card"><div class="tm">${crest(tShort(f.h), 38)}${tName(f.h)}</div><div class="mid">${f.started ? `<div>${scoreHTML(f.hs, f.as)}</div>` : ''}<span class="${f.started && !f.fin ? 'livebadge' : 'mut'}" style="font-size:11.5px">${st}</span></div><div class="tm">${crest(tShort(f.a), 38)}${tName(f.a)}</div></div></div>`;
}
function myLiveBlock() {
  const calc = liveCalc(ST.E.picks, ST.G.cur); if (!calc) return '';
  const R = rankImpact(calc), lr = officialRank();
  const subs = calc.subs.map((x) => `${esc(PM(x.out)?.name)} ← ${esc(PM(x.in)?.name)}`).join('، ');
  const pbN = calc.rows.filter((r) => r.bonus && r.m).reduce((a, r) => a + r.bonus * r.m, 0);
  const row = (r) => { const p = PM(r.id); if (!p) return ''; const s = ST.live[r.id] || {}; const g = R.gains.find((x) => x.p.id === r.id);
    const ev = [s.goals_scored ? `${I('i-goal', 'i', 'width:12px;height:12px;vertical-align:-2px')}×${s.goals_scored}` : '', s.assists ? `A×${s.assists}` : '', s.yellow_cards ? '<i style="display:inline-block;width:8px;height:11px;background:#FACC15;border-radius:2px;vertical-align:-1px"></i>' : '', s.red_cards ? '<i style="display:inline-block;width:8px;height:11px;background:#EF4444;border-radius:2px;vertical-align:-1px"></i>' : '', r.bonus ? `<span class="tag cyan" style="padding:0 5px">+${r.bonus} ${tt('بونص مؤقت', 'prov. bonus')}</span>` : ''].filter(Boolean).join(' ');
    return `<div class="row tap" onclick="playerGW(${p.id},${ST.G.cur},${Math.max(1, r.m)})" style="${r.m === 0 ? 'opacity:.55' : ''}"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}${r.m > 1 ? ` <span class="tag" style="background:var(--gold);color:#1C1404">×${r.m}</span>` : ''}${r.subIn ? ` <span class="tag lime">${tt('دخل تلقائياً', 'auto-in')}</span>` : ''}${r.subOut ? ` <span class="tag red">${tt('طلع', 'out')}</span>` : ''}</b><span>${r.min}′ ${ev} · EO ${g ? g.eo : '—'}%</span></div>${g ? `<div class="col" style="min-width:52px"><span class="${g.gain >= 0 ? 'up' : 'down'}">${g.gain >= 0 ? '▲' : '▼'}${Math.abs(g.gain)}</span><small>${tt('مقابل الكل', 'vs field')}</small></div>` : ''}<div class="col" style="font-size:17px;color:var(--acc)">${r.pts * Math.max(1, r.m)}<small>${tt('نقطة', 'pts')}</small></div></div>`; };
  return `<div class="card" style="margin-bottom:12px"><div class="kv" style="margin-top:0"><div><b style="color:var(--acc);font-size:22px">${calc.total}</b><span>${tt('نقاطك المباشرة', 'Live points')}${calc.hit ? ` (−${calc.hit})` : ''}</span></div><div><b>${lr.rank ? fmt(lr.rank) : '—'}</b><span>${tt('الترتيب العام', 'Overall rank')}${lr.move ? ` <em class="${lr.move >= 0 ? 'up' : 'down'}" style="font-style:normal">${lr.move >= 0 ? '▲' : '▼'}${fmt(Math.abs(lr.move))}</em>` : ''}</span></div><div><b>${R.safety}</b><span>${tt('نقاط الأمان', 'Safety score')}</span></div></div>
    ${pbN ? `<div class="note" style="margin-top:0">${I('i-star', 'i', 'color:var(--info)')}<span>${tt(`ضمن نقاطك ${pbN} نقطة بونص حسب الفانتازي المباشر.`, `Includes ${pbN} live FPL bonus points.`)}</span></div>` : ''}
    ${subs ? `<div class="note">${I('i-swap', 'i', 'color:var(--acc)')}<span>${tt('تبديلات تلقائية', 'Auto-subs')}: ${subs}</span></div>` : ''}
    ${calc.capOut ? `<div class="note">${I('i-crown', 'i', 'color:var(--gold)')}<span>${tt('الكابتن ما لعب، فالنائب صار كابتن.', 'Captain did not play — vice captain doubled.')}</span></div>` : ''}
    <div class="flex" style="gap:8px;margin-top:10px"><button class="btn btn-g btn-sm" style="flex:1" onclick="openWhatIf()">${I('i-lab', 'i', 'width:16px;height:16px')}${tt('ماذا لو؟', 'What if?')}</button><button class="btn btn-g btn-sm" style="flex:1" onclick="openThreats()">${I('i-alert', 'i', 'width:16px;height:16px')}${tt('التهديدات', 'Threats')}</button></div></div>
   <div class="list" style="margin-bottom:12px">${calc.rows.slice().sort((a, b) => b.m - a.m || b.pts - a.pts).map(row).join('')}</div>
   <p class="mut" style="font-size:11.5px;margin:-4px 2px 12px">${tt('EO = الملكية الفعلية التقديرية (الملكية + الكابتن). السهم الأخضر يعني اللاعب يصعّد ترتيبك لأنك مستفيد منه أكثر من باقي المدربين.', 'EO = estimated effective ownership. Green arrow = player is gaining you rank.')}</p>`;
}
window.openThreats = () => {
  const calc = liveCalc(ST.E.picks, ST.G.cur); if (!calc) return; const R = rankImpact(calc);
  openSheet(`${sheetHead(I('i-alert'), tt('التهديدات حول ترتيبك', 'Threats around your rank'), tt('لاعبين ما عندك وملكيتهم عالية — كل نقطة يجيبونها تنزّلك', 'High-EO players you don\'t own'))}
   <div class="list">${R.threats.map((x) => `<div class="row tap" onclick="openPlayer(${x.p.id})"><div class="mini">${pShirt(x.p)}</div><div class="info"><b>${esc(x.p.name)}</b><span>EO ${x.eo}% · ${x.pts} ${tt('نقطة', 'pts')}</span></div><div class="col"><span class="down">▼${Math.abs(x.gain)}</span><small>${tt('مقابل الكل', 'vs field')}</small></div></div>`).join('') || `<p class="mut">${t('noData')}</p>`}</div>`);
};
let wiP = null;
window.openWhatIf = () => {
  const calc = liveCalc(ST.E.picks, ST.G.cur); if (!calc) return;
  const cand = [...calc.rows.filter((r) => r.m > 0).map((r) => PM(r.id)), ...rankImpact(calc).threats.slice(0, 6).map((x) => x.p)].filter(Boolean);
  if (!wiP) wiP = cand[0]?.id;
  const EV = [['goal', tt('هدف', 'Goal')], ['assist', tt('صناعة', 'Assist')], ['cs', tt('شباك نظيفة', 'Clean sheet')], ['bonus3', tt('3 بونص', '3 bonus')], ['yellow', tt('صفراء', 'Yellow')], ['red', tt('حمراء', 'Red')]];
  const lp = calc.total, R = rankImpact(calc), base = liveRankEstimate(lp, R.safety);
  openSheet(`${sheetHead(I('i-lab'), tt('ماذا لو؟', 'What if?'), tt('شوف شلون يتغير ترتيبك إذا صار حدث', 'See how an event would move your rank'))}
   <div class="seg" style="margin-bottom:10px">${cand.map((p) => `<button class="${wiP === p.id ? 'on' : ''}" onclick="wiSet(${p.id})">${esc(p.name)}</button>`).join('')}</div>
   <div class="list">${EV.map(([k, l]) => { const w = whatIf(calc, wiP, k); const nr = base ? liveRankEstimate(lp + w.me, R.safety + w.field) : null; return `<div class="row"><div class="info"><b>${l}</b><span>${tt('نقاطك', 'You')} ${w.me >= 0 ? '+' : ''}${w.me} · ${tt('المعدل', 'Field')} ${w.field >= 0 ? '+' : ''}${w.field}</span></div><div class="col" style="min-width:90px"><span class="${w.net >= 0 ? 'up' : 'down'}">${w.net >= 0 ? '+' : ''}${w.net}</span><small>${nr && base ? `${tt('ترتيب', 'rank')} ${nr.rank < base.rank ? '▲' : nr.rank > base.rank ? '▼' : ''}${fmt(Math.abs(base.rank - nr.rank))}` : ''}</small></div></div>`; }).join('')}</div>
   <p class="mut" style="font-size:11.5px;margin-top:8px">${tt('تقديري: محسوب من الملكية الفعلية التقديرية وتوزيع النقاط.', 'Estimate based on estimated EO.')}</p>`);
};
window.wiSet = (id) => { wiP = id; window.openWhatIf(); };
/* =========================================================
   صفحة المباراة — تصميم احترافي:
   لوحة النتيجة بألوان الفريقين · أحداث المباراة لكل فريق بأيقونات
   · البونص ونقاط BPS · المساهمات الدفاعية · ترتيب نقاط الفانتازي بالمباراة · لاعبينك
========================================================= */
const mcLive = {}; let mcTimer = 0;
const DCT = (id) => ({ DEF: 10, MID: 12, FWD: 12 })[PM(id)?.pos] || 99;
const nmOf = (id) => esc(PM(id)?.name || '#' + id);
function mcBody(f, ev) {
  const st = (k) => f.stats.find((x) => x.identifier === k) || { h: [], a: [] };
  const KH = KITS[tShort(f.h)]?.b || '#334155', KA = KITS[tShort(f.a)]?.b || '#334155';
  const L = mcLive[ev], live = f.started && !f.fin;
  const status = !f.started ? `<span class="mc-ko">${f.ko ? new Date(f.ko).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'VS'}</span>` : live ? `<span class="mc-live${isHT(f) ? ' ht' : ''}"><i></i>${fxMin(f)}</span>` : `<span class="mc-ft">${tt('انتهت', 'Full time')}</span>`;
  const board = `<div class="mc-board" style="--kh:${KH};--ka:${KA}">
    <div class="mc-team">${crest(tShort(f.h), 58)}<b>${tName(f.h)}</b>${f.hd ? `<span class="rate f${f.hd}">${tt('صعوبة', 'FDR')} ${f.hd}</span>` : ''}</div>
    <div class="mc-mid">${f.started ? scoreHTML(f.hs, f.as, 'mc-score') : ''}${status}</div>
    <div class="mc-team">${crest(tShort(f.a), 58)}<b>${tName(f.a)}</b>${f.ad ? `<span class="rate f${f.ad}">${tt('صعوبة', 'FDR')} ${f.ad}</span>` : ''}</div></div>`;
  if (!f.started) return board + `<div class="mc-empty">${I('i-clock', 'i', 'width:28px;height:28px')}<b>${tt('المباراة بعدها ما بدت', 'Not started yet')}</b><span>${fmtTime(f.ko)}</span></div>` + mineBlock(f, ev);
  // صف حدث بعمودين
  const evRow = (icon, label, side) => { const H = side(st, 'h'), A = side(st, 'a'); if (!H && !A) return ''; return `<div class="mc-ev"><div class="mc-side h">${H || '<span class="mc-none">—</span>'}</div><div class="mc-lbl">${icon}<span>${label}</span></div><div class="mc-side a">${A || '<span class="mc-none">—</span>'}</div></div>`; };
  const list = (key, extra = (x) => (x.value > 1 ? `<small>×${x.value}</small>` : '')) => (S, side) => S(key)[side].map((x) => `<button class="mc-chip" onclick="closeSheet();setTimeout(()=>playerGW(${x.element},${ev}),200)">${nmOf(x.element)}${extra(x)}</button>`).join('');
  const goalsOwn = (S, side) => { const g = list('goals_scored')(S, side), og = S('own_goals')[side === 'h' ? 'a' : 'h'].map((x) => `<span class="mc-chip og">${nmOf(x.element)}<small>${tt('عكسي', 'OG')}</small></span>`).join(''); return g + og; };
  const cards = (S, side) => S('yellow_cards')[side].map((x) => `<span class="mc-chip"><i class="mc-card y"></i>${nmOf(x.element)}</span>`).join('') + S('red_cards')[side].map((x) => `<span class="mc-chip"><i class="mc-card r"></i>${nmOf(x.element)}</span>`).join('');
  const pens = (S, side) => S('penalties_missed')[side].map((x) => `<span class="mc-chip">${nmOf(x.element)}<small>${tt('أضاع جزاء', 'pen miss')}</small></span>`).join('') + S('penalties_saved')[side].map((x) => `<span class="mc-chip">${nmOf(x.element)}<small>${tt('صد جزاء', 'pen save')}</small></span>`).join('');
  const bonusSide = (S, side) => S('bonus')[side].sort((a, b) => b.value - a.value).map((x) => `<span class="mc-chip bn b${x.value}"><i>${x.value}</i>${nmOf(x.element)}</span>`).join('');
  const dcSide = (S, side) => { const arr = S('defensive_contribution')[side]; const got = arr.filter((x) => x.value >= DCT(x.element)).sort((a, b) => b.value - a.value), near = arr.filter((x) => x.value < DCT(x.element) && x.value >= DCT(x.element) - 2).sort((a, b) => b.value - a.value);
    return got.map((x) => `<span class="mc-chip dc">${nmOf(x.element)}<small dir="ltr">${x.value}</small><em>+2</em></span>`).join('') + near.map((x) => `<span class="mc-chip near">${nmOf(x.element)}<small dir="ltr">${x.value}/${DCT(x.element)}</small></span>`).join(''); };
  const events = `<div class="mc-card-box">
    ${evRow(I('i-goal', 'i', 'width:15px;height:15px'), t('goals'), goalsOwn)}
    ${evRow('<b class="mc-a">A</b>', t('assists'), list('assists'))}
    ${evRow('<i class="mc-card y" style="margin:0"></i>', tt('البطاقات', 'Cards'), cards)}
    ${evRow(I('i-target', 'i', 'width:15px;height:15px'), tt('ضربات جزاء', 'Penalties'), pens)}
    ${evRow(I('i-shield', 'i', 'width:15px;height:15px'), tt('تصديات', 'Saves'), list('saves', (x) => `<small>${x.value}</small>`))}
  </div>`;
  const bps = st('bps'), topB = [...bps.h.map((x) => ({ ...x, s: 'h' })), ...bps.a.map((x) => ({ ...x, s: 'a' }))].sort((a, b) => b.value - a.value).slice(0, 3);
  const hasBonus = st('bonus').h.length || st('bonus').a.length;
  const bonusBox = `<div class="mc-sec"><h4>${I('i-star', 'i', 'width:15px;height:15px')}${hasBonus ? tt('البونص', 'Bonus') : tt('ترتيب BPS', 'BPS leaders')}${hasBonus && live ? `<small>${tt('من الفانتازي مباشرة', 'live from FPL')}</small>` : !hasBonus && f.started ? `<small>${tt('بانتظار بونص الفانتازي', 'Awaiting FPL bonus')}</small>` : ''}</h4>
    ${hasBonus ? `<div class="mc-bps">${[...st('bonus').h.map((x) => ({ ...x, s: 'h' })), ...st('bonus').a.map((x) => ({ ...x, s: 'a' }))].sort((a, b) => b.value - a.value || (bps.h.concat(bps.a).find((y) => y.element === b.element)?.value || 0) - (bps.h.concat(bps.a).find((y) => y.element === a.element)?.value || 0)).map((x) => `<div><i class="b${x.value}">${x.value}</i><b>${nmOf(x.element)}</b><small dir="ltr">${tShort(x.s === 'h' ? f.h : f.a)}${(() => { const v = bps.h.concat(bps.a).find((y) => y.element === x.element)?.value; return v != null ? ` · BPS ${v}` : ''; })()}</small></div>`).join('')}</div>` : topB.length ? `<div class="mc-bps">${topB.map((x) => `<div><i class="bn">BPS</i><b>${nmOf(x.element)}</b><small>${tShort(x.s === 'h' ? f.h : f.a)} · ${x.value}</small></div>`).join('')}</div>` : '<p class="mc-none">—</p>'}
  </div>`;
  const dcH = dcSide(st, 'h'), dcA = dcSide(st, 'a');
  const dcBox = st('defensive_contribution').h.length || st('defensive_contribution').a.length ? `<div class="mc-sec"><h4>${I('i-shield', 'i', 'width:15px;height:15px')}${tt('المساهمات الدفاعية', 'Defensive contributions')}<small>${tt('مدافع 10 · وسط ومهاجم 12', 'DEF 10 · MID/FWD 12')}</small></h4>
    <div class="mc-two"><div class="mc-side h">${dcH || '<span class="mc-none">—</span>'}</div><div class="mc-side a">${dcA || '<span class="mc-none">—</span>'}</div></div></div>` : '';
  // ترتيب نقاط الفانتازي بالمباراة
  let fpBox = '';
  if (L) {
    const rows = ST.G.players.filter((p) => (p.team === f.h || p.team === f.a) && L[p.id]?.minutes > 0).map((p) => ({ p, pts: L[p.id].total_points, min: L[p.id].minutes })).sort((a, b) => b.pts - a.pts).slice(0, 8);
    const mx = Math.max(1, ...rows.map((r) => r.pts));
    if (rows.length) fpBox = `<div class="mc-sec"><h4>${I('i-chart', 'i', 'width:15px;height:15px')}${tt('أعلى نقاط فانتازي بالمباراة', 'Top fantasy points')}</h4>
      ${rows.map((r, k) => `<button class="mc-fp" onclick="closeSheet();setTimeout(()=>playerGW(${r.p.id},${ev}),200)"><span class="mc-rk">${k + 1}</span><span class="mini-sh">${pShirt(r.p)}</span><span class="mc-fpn"><b>${esc(r.p.name)}</b><small>${tShort(r.p.team)} · ${r.min}′</small></span><span class="mc-bar"><i style="width:${(Math.max(0, r.pts) / mx) * 100}%"></i></span><b class="num mc-pts">${r.pts}</b></button>`).join('')}</div>`;
  }
  return board + events + bonusBox + dcBox + fpBox + ((L && f.started) || LU[f.id]?.d ? lineupBox(f, ev, L) : '') + mineBlock(f, ev);
}

/* ---------- تشكيلة الفريقين بالمباراة (من دقائق اللعب والـ starts بالفانتازي) ---------- */
let mcSide = 'h';
function matchLineup(f, L, team) {
  const ps = ST.G.players.filter((p) => p.team === team && L[p.id]?.minutes > 0).map((p) => ({ p, s: L[p.id] }));
  if (!ps.length) return null;
  const hasStarts = ps.some((x) => x.s.starts != null);
  let st, sb;
  if (hasStarts) { st = ps.filter((x) => x.s.starts > 0); sb = ps.filter((x) => !(x.s.starts > 0)); }
  else { const srt = [...ps].sort((a, b) => b.s.minutes - a.s.minutes); st = srt.slice(0, 11); sb = srt.slice(11); }
  const total = f.fin ? 90 : Math.max(1, Math.min(90, f.min || 0));
  // نربط كل بديل باللاعب اللي طلع (نفس المركز ومجموع الدقائق أقرب للمباراة)
  const offs = st.filter((x) => x.s.minutes < total - 1 && !x.s.red_cards), pair = new Map(), used = new Set();
  [...sb].sort((a, b) => b.s.minutes - a.s.minutes).forEach((on) => {
    const score = (o) => Math.abs(o.s.minutes + on.s.minutes - total) + (o.p.pos === on.p.pos ? 0 : 25);
    const cand = offs.filter((o) => !used.has(o.p.id)).sort((a, b) => score(a) - score(b))[0];
    if (cand) { used.add(cand.p.id); pair.set(cand.p.id, on); }
  });
  // بدلاء ما انربطوا: غالباً دخلوا بالوقت بدل الضايع واللي طلع محسوبله 90 دقيقة — نربطهم بأقرب لاعب بنفس المركز (تقريبي)
  const approx = new Set();
  [...sb].filter((x) => ![...pair.values()].includes(x)).sort((a, b) => a.s.minutes - b.s.minutes).forEach((on) => {
    const pool = st.filter((o) => !used.has(o.p.id) && !o.s.red_cards);
    const cand = pool.sort((a, b) => (a.p.pos === on.p.pos ? 0 : 1) - (b.p.pos === on.p.pos ? 0 : 1) || (a.s.bps ?? 0) - (b.s.bps ?? 0))[0];
    if (cand) { used.add(cand.p.id); pair.set(cand.p.id, on); approx.add(cand.p.id); }
  });
  const leftover = sb.filter((x) => ![...pair.values()].includes(x));
  return { st, pair, leftover, approx, offs: st.filter((x) => pair.has(x.p.id)) };
}

/* ---------- التشكيلة الرسمية والتبديلات الحقيقية (من /api/lineups) ---------- */
const LU = {};
const nrm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z]/g, '');
const lastTok = (x) => nrm(String(x || '').trim().split(/\s+/).pop());
function loadLU(f, ev, force = false) {
  const c = LU[f.id]; if (c?.busy) return; const empty = !c?.d || !Object.values(c.d.sides || {}).some((x) => x.players?.length);
  if (!force && c && (Date.now() - c.at < 55e3 || (!empty && !(f.started && !f.fin)))) return;
  LU[f.id] = { ...(c || {}), busy: true };
  fetch(`/api/lineups?ko=${encodeURIComponent(f.ko)}&h=${tShort(f.h)}&a=${tShort(f.a)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
    LU[f.id] = { d: d?.sides && Object.keys(d.sides).length ? d : c?.d || null, at: Date.now() };
    const el = document.getElementById('mcBody'); if (el && el.dataset.fid == f.id) el.innerHTML = mcBody(f, ev);
  });
}
/** ربط لاعبي ESPN بلاعبي الفانتازي بالاسم */
function mapFPL(players, team) {
  const pool = ST.G.players.filter((p) => p.team === team), used = new Set(), out = {};
  const tests = [
    (e, p) => nrm(p.full) === nrm(e.name),
    (e, p) => nrm(p.name) === nrm(e.name) || nrm(p.name) === nrm(e.last) || nrm(p.name) === nrm(e.short),
    (e, p) => lastTok(p.full) === lastTok(e.name) && nrm(p.full)[0] === nrm(e.name)[0],
    (e, p) => nrm(e.name).endsWith(nrm(p.name)) && nrm(p.name).length >= 4,
    (e, p) => lastTok(p.full) === lastTok(e.name),
    (e, p) => nrm(e.name).includes(nrm(p.name)) && nrm(p.name).length >= 4,
  ];
  tests.forEach((t) => players.forEach((e) => { if (out[e.id]) return; const m = pool.filter((p) => !used.has(p.id) && t(e, p)); if (m.length === 1) { out[e.id] = m[0]; used.add(m[0].id); } }));
  return out;
}
const DEPTH = (pos) => { const p = pos.toUpperCase(); if (p === 'G' || p === 'GK') return 0; if (/^(CD|D|SW|LB|RB|CB)/.test(p)) return 1; if (/^(LWB|RWB|DM|CDM)/.test(p)) return 2; if (/^(CM|LM|RM|M)(-|$)/.test(p)) return 3; if (/^(AM|CF-|LW|RW|CAM)/.test(p)) return 4; return 5; };
const SIDE = (pos) => { const p = pos.toUpperCase(); if (/^(LB|LM|LW|LWB|LF)$/.test(p)) return 0; if (/^(RB|RM|RW|RWB|RF)$/.test(p)) return 4; if (/-L$/.test(p)) return 1; if (/-R$/.test(p)) return 3; return 2; };
function lineupBoxESPN(f, ev, L, d) {
  const sd = d.sides[mcSide]; const team = mcSide === 'h' ? f.h : f.a;
  const tabs = `<div class="mc-tabs"><button class="${mcSide === 'h' ? 'on' : ''}" onclick="mcSideSet('h',${f.id},${ev})">${tName(f.h)}</button><button class="${mcSide === 'a' ? 'on' : ''}" onclick="mcSideSet('a',${f.id},${ev})">${tName(f.a)}</button></div>`;
  if (!sd?.players?.length) return `<div class="mc-sec"><h4>${I('i-pitch', 'i', 'width:15px;height:15px')}${tt('التشكيلة', 'Lineups')}</h4>${tabs}<p class="mc-none">${tt('التشكيلة ما انعلنت بعد', 'Lineup not announced yet')}</p></div>`;
  const live = f.started && !f.fin, M = mapFPL(sd.players, team), byId = Object.fromEntries(sd.players.map((p) => [p.id, p]));
  const subs = (d.subs || []).filter((x) => byId[x.in] || byId[x.out]);
  const ptsOf = (e) => { const p = M[e.id]; const s = p && L?.[p.id]; return s ? s.total_points : f.started ? 0 : null; };
  const nameOf = (e) => M[e.id]?.name || e.last || e.name;
  const card = (e, kind, at) => { const p = M[e.id], pts = ptsOf(e), onPitch = kind !== 'out' && kind !== 'unused';
    const mins = p && L?.[p.id] ? L[p.id].minutes : null;
    const lab = kind === 'in' ? `${at?.txt || ''}↑` : kind === 'out' ? `${at?.txt || ''}↓` : kind === 'unused' ? tt('ما لعب', 'unused') : mins != null && f.started ? `${mins}′` : '';
    return `<button class="rvp-pl ${onPitch ? '' : 'out'}" ${p ? `onclick="closeSheet();setTimeout(()=>playerGW(${p.id},${ev}),200)"` : ''}>
      <div class="rvp-sh">${p ? pShirt(p) : pShirt({ team, pos: e.pos === 'G' ? 'GK' : 'MID' })}${kind === 'in' ? '<i class="rvp-b in">↑</i>' : kind === 'out' ? '<i class="rvp-b outb">↓</i>' : ''}${e.yc && !e.rc ? '<i class="mc-yc"></i>' : ''}${e.rc ? '<i class="mc-yc r"></i>' : ''}</div>
      <span class="rvp-nm">${esc(nameOf(e))}</span><span class="rvp-pt ${live && onPitch ? 'live' : ''}">${pts ?? '—'}</span>${lab ? `<small class="mc-min">${lab}</small>` : ''}</button>`; };
  // كل أساسي: إذا تبدّل نحط مكانه اللاعب اللي دخل (ونتبع سلسلة التبديلات)
  const starters = sd.players.filter((p) => p.starter);
  const slots = starters.map((e) => { let cur = e, at = null, k = ''; let sx; const seen = new Set(); while ((sx = subs.find((x) => x.out === cur.id)) && byId[sx.in] && !seen.has(sx.in)) { seen.add(sx.in); cur = byId[sx.in]; at = sx.at; k = 'in'; } return { e, cur, at, k }; });
  const ordered = [...slots].sort((a, b) => DEPTH(a.e.pos) - DEPTH(b.e.pos));
  const nums = (sd.formation || '').split('-').map(Number).filter((n) => n > 0);
  let lines = [];
  if (nums.length && nums.reduce((a, b) => a + b, 0) === ordered.length - 1) { let i = 1; lines.push(ordered.slice(0, 1)); nums.forEach((n) => { lines.push(ordered.slice(i, i + n)); i += n; }); }
  else { const g = {}; ordered.forEach((z) => (g[DEPTH(z.e.pos)] = g[DEPTH(z.e.pos)] || []).push(z)); lines = Object.keys(g).sort((a, b) => a - b).map((k) => g[k]); }
  lines = lines.map((l) => [...l].sort((a, b) => SIDE(b.e.pos) - SIDE(a.e.pos)));
  const offIds = new Set(subs.map((x) => x.out)), onIds = new Set(subs.map((x) => x.in));
  const offs = sd.players.filter((p) => offIds.has(p.id) && byId[p.id]).map((p) => card(p, 'out', subs.find((x) => x.out === p.id)?.at));
  const unused = sd.players.filter((p) => !p.starter && !onIds.has(p.id)).map((p) => card(p, 'unused'));
  const teamPts = f.started ? sd.players.reduce((a, e) => a + (ptsOf(e) || 0), 0) : null;
  return `<div class="mc-sec"><h4>${I('i-pitch', 'i', 'width:15px;height:15px')}${tt('التشكيلة والنقاط', 'Lineups & points')}${live ? `<small>${tt('مباشر', 'live')}</small>` : ''}</h4>${tabs}
    <div class="mc-lu-sum"><span>${sd.formation ? `${tt('الخطة', 'Formation')} <b dir="ltr" style="color:var(--txt);font-size:13px">${esc(sd.formation)}</b>` : ''}</span>${teamPts != null ? `<span>${tt('مجموع النقاط', 'Team points')} <b class="num">${teamPts}</b></span>` : ''}</div>
    <div class="rvp mc-pitch"><div class="rvp-lines"><i class="box t"></i><i class="six t"></i><i class="mid"></i><i class="circle"></i><i class="box b"></i><i class="six b"></i></div>${lines.map((l) => `<div class="rvp-row" style="direction:ltr">${l.map((z) => card(z.cur, z.k, z.at)).join('')}</div>`).join('')}</div>
    ${offs.length ? `<div class="rvp-bench"><span class="rvp-bl">${tt('طلعوا من الملعب', 'Substituted off')}</span><div class="rvp-row" style="flex-wrap:wrap">${offs.join('')}</div></div>` : ''}
    ${unused.length ? `<div class="rvp-bench"><span class="rvp-bl">${tt('الدكة (ما لعبوا)', 'Unused subs')}</span><div class="rvp-row" style="flex-wrap:wrap">${unused.join('')}</div></div>` : ''}
    <div class="rvp-legend"><span><i class="rvp-b in" style="position:static">↑</i>${tt('دخل', 'On')}</span><span><i class="rvp-b outb" style="position:static">↓</i>${tt('طلع', 'Off')}</span></div></div>`;
}
function lineupBox(f, ev, L) {
  const luD = LU[f.id]?.d, has = luD?.sides?.[mcSide]?.players?.length;
  if (luD && (has || !(L && f.started))) return lineupBoxESPN(f, ev, L, luD);
  if (!L) return '';
  const team = mcSide === 'h' ? f.h : f.a, lu = matchLineup(f, L, team);
  const tabs = `<div class="mc-tabs"><button class="${mcSide === 'h' ? 'on' : ''}" onclick="mcSideSet('h',${f.id},${ev})">${tName(f.h)}</button><button class="${mcSide === 'a' ? 'on' : ''}" onclick="mcSideSet('a',${f.id},${ev})">${tName(f.a)}</button></div>`;
  if (!lu) return `<div class="mc-sec"><h4>${I('i-pitch', 'i', 'width:15px;height:15px')}${tt('التشكيلة', 'Lineups')}</h4>${tabs}<p class="mc-none">${tt('التشكيلة تظهر أول ما تبدي المباراة', 'Lineups appear at kick-off')}</p></div>`;
  const live = f.started && !f.fin;
  const card = (x, badge, onPitch = true, lone = false, ap = false) => `<button class="rvp-pl ${onPitch ? '' : 'out'}" onclick="closeSheet();setTimeout(()=>playerGW(${x.p.id},${ev}),200)">
      <div class="rvp-sh">${pShirt(x.p)}${badge === 'in' ? '<i class="rvp-b in">↑</i>' : badge === 'out' ? '<i class="rvp-b outb">↓</i>' : ''}${x.s.yellow_cards ? '<i class="mc-yc"></i>' : ''}${x.s.red_cards ? '<i class="mc-yc r"></i>' : ''}</div>
      <span class="rvp-nm">${esc(x.p.name)}</span><span class="rvp-pt ${live && onPitch ? 'live' : ''}">${x.s.total_points}</span><small class="mc-min">${badge === 'in' && ap ? `${T >= 90 ? '90+' : T}′↑~` : badge === 'in' && !lone ? `${total(x)}′↑` : badge === 'in' ? `${x.s.minutes}′` : badge === 'out' ? `${x.s.minutes}′↓${ap ? '~' : ''}` : `${x.s.minutes}′`}</small></button>`;
  const T = f.fin ? 90 : Math.min(90, f.min || 0), total = (x) => Math.max(0, T - x.s.minutes);
  const slots = lu.st.map((x) => (lu.pair.has(x.p.id) ? { x: lu.pair.get(x.p.id), pos: x.p.pos, b: 'in', ap: lu.approx.has(x.p.id) } : { x, pos: x.p.pos, b: '' }));
  const lines = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => slots.filter((z) => z.pos === pos)).filter((l) => l.length);
  const bench = [...lu.offs.map((x) => card(x, 'out', false, false, lu.approx.has(x.p.id))), ...lu.leftover.map((x) => card(x, 'in', false, true))];
  const pts = slots.reduce((a, z) => a + z.x.s.total_points, 0) + lu.offs.reduce((a, x) => a + x.s.total_points, 0) + lu.leftover.reduce((a, x) => a + x.s.total_points, 0);
  return `<div class="mc-sec"><h4>${I('i-pitch', 'i', 'width:15px;height:15px')}${tt('التشكيلة والنقاط', 'Lineups & points')}${live ? `<small>${tt('مباشر', 'live')}</small>` : ''}</h4>${tabs}
    <div class="mc-lu-sum"><span>${tt('مجموع نقاط الفريق', 'Team fantasy points')}</span><b class="num">${pts}</b></div>
    <div class="rvp mc-pitch"><div class="rvp-lines"><i class="box t"></i><i class="six t"></i><i class="mid"></i><i class="circle"></i><i class="box b"></i><i class="six b"></i></div>${lines.map((l) => `<div class="rvp-row">${l.map((z) => card(z.x, z.b, true, false, z.ap)).join('')}</div>`).join('')}</div>
    <div class="rvp-bench"><span class="rvp-bl">${tt('البدلاء — اللي طلعوا', 'Substituted')}</span>${bench.length ? `<div class="rvp-row" style="flex-wrap:wrap">${bench.join('')}</div>` : `<p class="mc-none" style="text-align:center">${tt('ماكو تبديلات لحد هسة', 'No substitutions yet')}</p>`}</div>
    <div class="rvp-legend"><span><i class="rvp-b in" style="position:static">↑</i>${tt('دخل', 'On')}</span><span><i class="rvp-b outb" style="position:static">↓</i>${tt('طلع', 'Off')}</span></div>
    <p class="mc-none" style="font-size:10.5px;text-align:center;margin-top:6px">${tt('التشكيلة والتبديلات مأخوذة من دقائق اللعب بالفانتازي. علامة ~ تعني تبديل بالوقت بدل الضايع والفانتازي يحسب للخارج 90 دقيقة، فاللاعب الخارج تقديري.', 'Built from FPL minutes. ~ = stoppage-time change; the player off is estimated.')}</p></div>`;
}
function mineBlock(f, ev) {
  const squad = ST.plan ? [...ST.plan.xi, ...ST.plan.bench].map(PM).filter((p) => p && (p.team === f.h || p.team === f.a)) : [];
  if (!squad.length) return '';
  const L = mcLive[ev];
  return `<div class="mc-sec mine"><h4>${I('i-users', 'i', 'width:15px;height:15px')}${tt('لاعبينك بهالمباراة', 'Your players')}</h4>${squad.map((p) => { const s = L?.[p.id]; return `<button class="mc-fp" onclick="closeSheet();setTimeout(()=>playerGW(${p.id},${ev}),200)"><span class="mini-sh">${pShirt(p)}</span><span class="mc-fpn"><b>${esc(p.name)}</b><small>${tShort(p.team)} · ${s ? s.minutes + '′' : '—'}</small></span><b class="num mc-pts">${s ? s.total_points : '—'}</b></button>`; }).join('')}</div>`;
}
async function openMatchC(fid, ev) {
  mcSide = 'h';
  const f = (ST.G.fx[ev] || []).find((x) => x.id === fid); if (!f) return;
  if (ev === ST.G.cur && ST.live && ST.liveRawGW === ev) mcLive[ev] = ST.live;
  openSheet(`<div class="mc-head"><span>${t('gw')} ${ev} · ${fmtTime(f.ko)}</span><button class="icon-btn" onclick="closeSheet()" aria-label="close">${I('i-x')}</button></div><div id="mcBody" data-fid="${f.id}">${mcBody(f, ev)}</div>`);
  if (f.started || (f.ko && new Date(f.ko) - Date.now() < 90 * 60e3)) loadLU(f, ev);
  clearInterval(mcTimer); mcTimer = setInterval(async () => { const el = document.getElementById('mcBody'); if (!el || el.dataset.fid != f.id) return clearInterval(mcTimer); const ff = (ST.G.fx[ev] || []).find((x) => x.id === fid) || f; if (!(ff.started && !ff.fin) || document.hidden) return; try { const l = await FPL.loadLive(ev, true); mcLive[ev] = Object.fromEntries(l.elements.map((x) => [x.id, x.stats])); } catch {} loadLU(ff, ev, true); const e2 = document.getElementById('mcBody'); if (e2 && e2.dataset.fid == f.id) e2.innerHTML = mcBody(ff, ev); }, 60e3);
  if (f.started && (!mcLive[ev] || ev === ST.G.cur)) {
    try { const l = await FPL.loadLive(ev); mcLive[ev] = Object.fromEntries(l.elements.map((x) => [x.id, x.stats])); const el = document.getElementById('mcBody'); if (el && el.dataset.fid == f.id) el.innerHTML = mcBody(f, ev); } catch {}
  }
}
Object.assign(window, { mcSideSet: (sd, fid, ev) => { mcSide = sd; const f = (ST.G.fx[ev] || []).find((x) => x.id === fid), el = document.getElementById('mcBody'); if (f && el) el.innerHTML = mcBody(f, ev); }, lvGW: (g) => { gwSel = g; window.render(); setTimeout(() => document.querySelector('#lvseg .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30); }, lvRefresh: () => refreshLive(true), openMatchC });
export function afterLive() {
  setTimeout(() => document.querySelector('#lvseg .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30);
  if (gwSel === ST.G.cur && (!ST.live || Date.now() - lastFetch > 60000)) refreshLive(false);
}
