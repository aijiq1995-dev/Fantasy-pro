/* مركز المباريات والنقاط المباشرة */
import { ST, PM, tName, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, crest, fmtTime, openSheet, sheetHead, toast, fmt } from '../ui.js';
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
    const fxNorm = fx.map((x) => ({ id: x.id, ev: x.event, h: x.team_h, a: x.team_a, hd: x.team_h_difficulty, ad: x.team_a_difficulty, ko: x.kickoff_time, fin: x.finished || x.finished_provisional, started: x.started, hs: x.team_h_score, as: x.team_a_score, min: x.minutes, stats: x.stats || [] }));
    scanLive(ST.live, next, ST.G.fx[g], fxNorm);
    ST.live = next; ST.liveRaw = l.elements; ST.liveRawGW = g; ST.G.fx[g] = fxNorm; lastFetch = Date.now(); freshness();
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
   ${gwSel === G.cur && ST.E.picks && ST.live ? myLiveBlock() : ''}
   ${live ? `<div class="mut" style="font-size:11.5px;text-align:center;margin-bottom:8px">${tt('يتحدّث تلقائياً كل دقيقة', 'Auto-refreshes every minute')} · <button class="more" style="display:inline" onclick="lvRefresh()">${I('i-refresh', 'i', 'width:13px;height:13px')} ${t('refresh')}</button></div>` : ''}
   ${Object.values(byDay).map((list) => `<div class="sec" style="margin:12px 2px 8px"><h2 style="font-size:14px">${I('i-cal', 'i', 'width:16px;height:16px')}${list[0].ko ? new Date(list[0].ko).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }) : tt('غير محدد', 'TBD')}</h2></div>${list.map((f) => fxCard(f, myTeams)).join('')}`).join('') || `<div class="empty"><b>${t('noData')}</b></div>`}
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:10px">${tt('النتائج والنقاط من الفانتازي الرسمي. البونص المؤقت والترتيب المباشر والملكية الفعلية تقديرات محسوبة لحد ما يتأكدون رسمياً.', 'Scores from official FPL. Provisional bonus, live rank and EO are estimates until confirmed.')}</p>`;
}
function fxCard(f, myTeams) {
  const st = f.fin ? tt('انتهت', 'FT') : f.started ? `${f.min || ''}′` : f.ko ? new Date(f.ko).toLocaleTimeString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { hour: 'numeric', minute: '2-digit' }) : '—';
  const mine = myTeams.has(f.h) || myTeams.has(f.a);
  return `<div class="card tap" style="margin-bottom:8px;${mine ? 'border-color:rgba(52,211,153,.3)' : ''}" onclick="openMatchC(${f.id},${f.ev})"><div class="fx-card"><div class="tm">${crest(tShort(f.h), 38)}${tName(f.h)}</div><div class="mid">${f.started ? `<div class="score">${f.hs ?? 0} - ${f.as ?? 0}</div>` : ''}<span class="${f.started && !f.fin ? 'livebadge' : 'mut'}" style="font-size:11.5px">${st}</span></div><div class="tm">${crest(tShort(f.a), 38)}${tName(f.a)}</div></div></div>`;
}
function myLiveBlock() {
  const calc = liveCalc(ST.E.picks, ST.G.cur); if (!calc) return '';
  const R = rankImpact(calc), lr = liveRankEstimate(calc.total, R.safety);
  const subs = calc.subs.map((x) => `${esc(PM(x.out)?.name)} ← ${esc(PM(x.in)?.name)}`).join('، ');
  const pbN = calc.rows.filter((r) => r.bonus && r.m).reduce((a, r) => a + r.bonus * r.m, 0);
  const row = (r) => { const p = PM(r.id); if (!p) return ''; const s = ST.live[r.id] || {}; const g = R.gains.find((x) => x.p.id === r.id);
    const ev = [s.goals_scored ? `${I('i-goal', 'i', 'width:12px;height:12px;vertical-align:-2px')}×${s.goals_scored}` : '', s.assists ? `A×${s.assists}` : '', s.yellow_cards ? '<i style="display:inline-block;width:8px;height:11px;background:#FACC15;border-radius:2px;vertical-align:-1px"></i>' : '', s.red_cards ? '<i style="display:inline-block;width:8px;height:11px;background:#EF4444;border-radius:2px;vertical-align:-1px"></i>' : '', r.bonus ? `<span class="tag cyan" style="padding:0 5px">+${r.bonus} ${tt('بونص مؤقت', 'prov. bonus')}</span>` : ''].filter(Boolean).join(' ');
    return `<div class="row tap" onclick="playerGW(${p.id},${ST.G.cur},${Math.max(1, r.m)})" style="${r.m === 0 ? 'opacity:.55' : ''}"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}${r.m > 1 ? ` <span class="tag" style="background:var(--gold);color:#1C1404">×${r.m}</span>` : ''}${r.subIn ? ` <span class="tag lime">${tt('دخل تلقائياً', 'auto-in')}</span>` : ''}${r.subOut ? ` <span class="tag red">${tt('طلع', 'out')}</span>` : ''}</b><span>${r.min}′ ${ev} · EO ${g ? g.eo : '—'}%</span></div>${g ? `<div class="col" style="min-width:52px"><span class="${g.gain >= 0 ? 'up' : 'down'}">${g.gain >= 0 ? '▲' : '▼'}${Math.abs(g.gain)}</span><small>${tt('مقابل الكل', 'vs field')}</small></div>` : ''}<div class="col" style="font-size:17px;color:var(--acc)">${r.pts * Math.max(1, r.m)}<small>${tt('نقطة', 'pts')}</small></div></div>`; };
  return `<div class="card" style="margin-bottom:12px"><div class="kv" style="margin-top:0"><div><b style="color:var(--acc);font-size:22px">${calc.total}</b><span>${tt('نقاطك المباشرة', 'Live points')}${calc.hit ? ` (−${calc.hit})` : ''}</span></div><div><b>${lr ? fmt(lr.rank) : '—'}</b><span>${tt('ترتيب تقديري', 'Est. rank')}${lr ? ` <em class="${lr.move >= 0 ? 'up' : 'down'}" style="font-style:normal">${lr.move >= 0 ? '▲' : '▼'}${fmt(Math.abs(lr.move))}</em>` : ''}</span></div><div><b>${R.safety}</b><span>${tt('نقاط الأمان', 'Safety score')}</span></div></div>
    ${pbN ? `<div class="note" style="margin-top:0">${I('i-star', 'i', 'color:var(--info)')}<span>${tt(`ضمن نقاطك ${pbN} نقطة بونص مؤقت محسوبة من BPS، وتتأكد بعد نهاية المباريات.`, `Includes ${pbN} provisional bonus points from BPS.`)}</span></div>` : ''}
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
function openMatchC(fid, ev) {
  const f = (ST.G.fx[ev] || []).find((x) => x.id === fid); if (!f) return;
  const statRows = (key, label) => { const s = f.stats.find((x) => x.identifier === key); if (!s || (!s.h.length && !s.a.length)) return ''; const nm = (arr) => arr.map((x) => `${esc(PM(x.element)?.name || '#' + x.element)}${x.value > 1 ? ' ×' + x.value : ''}`).join('<br>'); return `<div class="evt"><span style="flex:1;text-align:start">${nm(s.h)}</span><b class="mut" style="font-size:12px">${label}</b><span style="flex:1;text-align:end">${nm(s.a)}</span></div>`; };
  const squad = ST.plan ? [...ST.plan.xi, ...ST.plan.bench].map(PM).filter((p) => p.team === f.h || p.team === f.a) : [];
  openSheet(`${sheetHead(I('i-live'), `${tName(f.h)} × ${tName(f.a)}`, `${t('gw')} ${ev} · ${fmtTime(f.ko)}`)}
   <div class="fx-card card"><div class="tm">${crest(tShort(f.h), 54)}<b>${tName(f.h)}</b>${f.hd ? `<span class="rate f${f.hd}">FDR ${f.hd}</span>` : ''}</div><div class="mid">${f.started ? `<div class="score" style="font-size:34px">${f.hs ?? 0} - ${f.as ?? 0}</div><span class="${f.fin ? 'mut' : 'livebadge'}">${f.fin ? tt('انتهت', 'Full time') : (f.min || '') + '′'}</span>` : `<b>VS</b>`}</div><div class="tm">${crest(tShort(f.a), 54)}<b>${tName(f.a)}</b>${f.ad ? `<span class="rate f${f.ad}">FDR ${f.ad}</span>` : ''}</div></div>
   ${f.started ? `<div class="card" style="margin-top:10px">${[['goals_scored', t('goals')], ['assists', t('assists')], ['yellow_cards', tt('صفراء', 'Yellow')], ['red_cards', tt('حمراء', 'Red')], ['saves', tt('إنقاذات', 'Saves')], ['bonus', t('bonus')]].map((x) => statRows(...x)).join('') || `<p class="mut">${tt('ما في أحداث مسجلة بعد', 'No events yet')}</p>`}</div>` : `<p class="mut" style="margin-top:10px">${tt('الإحصائيات تظهر بعد بداية المباراة', 'Stats appear after kick-off')}</p>`}
   ${squad.length ? `<div class="sec" style="margin-top:12px"><h2 style="font-size:15px">${tt('لاعبينك بهالمباراة', 'Your players')}</h2></div>${squad.map((p) => `<div class="row tap" onclick="closeSheet();setTimeout(()=>playerGW(${p.id},${ev}),200)"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${ST.live?.[p.id]?.minutes ?? 0}′</span></div><div class="col" style="color:#34D399;font-size:18px">${ev === ST.G.cur ? ST.live?.[p.id]?.total_points ?? '—' : '—'}</div></div>`).join('')}` : ''}`);
}
Object.assign(window, { lvGW: (g) => { gwSel = g; window.render(); setTimeout(() => document.querySelector('#lvseg .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30); }, lvRefresh: () => refreshLive(true), openMatchC });
export function afterLive() {
  setTimeout(() => document.querySelector('#lvseg .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30);
  if (gwSel === ST.G.cur && (!ST.live || Date.now() - lastFetch > 60000)) refreshLive(false);
}
