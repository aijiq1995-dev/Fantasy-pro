/* مركز المباريات والنقاط المباشرة */
import { ST, PM, tName, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, crest, fmtTime, openSheet, sheetHead, toast } from '../ui.js';
import * as FPL from '../fpl.js';
import { scanLive } from '../notify.js';
import { pShirt } from './common.js';
import { liveTeamPoints } from './home.js';

let gwSel = null, poll = null, lastFetch = 0;
const isLiveGW = (g) => (ST.G.fx[g] || []).some((f) => f.started && !f.fin);
async function refreshLive(force = false) {
  const g = ST.G.cur; if (!g) return;
  try {
    const [l, fx] = await Promise.all([FPL.loadLive(g, force), FPL.loadFixturesGW(g, force)]);
    const next = Object.fromEntries(l.elements.map((x) => [x.id, x.stats]));
    const fxNorm = fx.map((x) => ({ id: x.id, ev: x.event, h: x.team_h, a: x.team_a, hd: x.team_h_difficulty, ad: x.team_a_difficulty, ko: x.kickoff_time, fin: x.finished || x.finished_provisional, started: x.started, hs: x.team_h_score, as: x.team_a_score, min: x.minutes, stats: x.stats || [] }));
    scanLive(ST.live, next, ST.G.fx[g], fxNorm);
    ST.live = next; ST.G.fx[g] = fxNorm; lastFetch = Date.now(); freshness();
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
  el.className = 'fresh ' + (embed ? '' : lm ? 'live' : 'ok');
  el.querySelector('span').textContent = embed || (lm ? tt('مباشر · ', 'Live · ') + ago : tt('محدّث ', 'Updated ') + ago);
}
export function startLivePolling() {
  clearInterval(poll); clearInterval(freshT); lastFetch = lastFetch || Date.now(); idleAt = Date.now();
  const step = () => { if (!ST.G || document.hidden) return; if (liveMode()) { if (Date.now() - lastFetch >= 28e3) refreshLive(true); } else if (Date.now() - idleAt >= 5 * 60e3) idleRefresh(); };
  poll = setInterval(step, 5000); freshT = setInterval(freshness, 5000); freshness();
  if (!window.__visBound) { window.__visBound = 1; document.addEventListener('visibilitychange', () => { if (!document.hidden && ST.G) { if (liveMode()) refreshLive(true); else if (Date.now() - idleAt > 120e3) idleRefresh(); } }); }
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
   ${gwSel === G.cur && ST.plan && ST.live ? myLiveBlock(squad) : ''}
   ${live ? `<div class="mut" style="font-size:11.5px;text-align:center;margin-bottom:8px">${tt('يتحدّث تلقائياً كل دقيقة', 'Auto-refreshes every minute')} · <button class="more" style="display:inline" onclick="lvRefresh()">${I('i-refresh', 'i', 'width:13px;height:13px')} ${t('refresh')}</button></div>` : ''}
   ${Object.values(byDay).map((list) => `<div class="sec" style="margin:12px 2px 8px"><h2 style="font-size:14px">${I('i-cal', 'i', 'width:16px;height:16px')}${list[0].ko ? new Date(list[0].ko).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }) : tt('غير محدد', 'TBD')}</h2></div>${list.map((f) => fxCard(f, myTeams)).join('')}`).join('') || `<div class="empty"><b>${t('noData')}</b></div>`}
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:10px">${tt('النتائج والنقاط من الفانتازي الرسمي. الترتيب المباشر ما ينشره الفانتازي أثناء الجولة، فيتحدّث بعد نهايتها.', 'Scores and points from official FPL. Live rank is not published mid-gameweek.')}</p>`;
}
function fxCard(f, myTeams) {
  const st = f.fin ? tt('انتهت', 'FT') : f.started ? `${f.min || ''}′` : f.ko ? new Date(f.ko).toLocaleTimeString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { hour: 'numeric', minute: '2-digit' }) : '—';
  const mine = myTeams.has(f.h) || myTeams.has(f.a);
  return `<div class="card tap" style="margin-bottom:8px;${mine ? 'border-color:rgba(52,211,153,.3)' : ''}" onclick="openMatchC(${f.id},${f.ev})"><div class="fx-card"><div class="tm">${crest(tShort(f.h), 38)}${tName(f.h)}</div><div class="mid">${f.started ? `<div class="score">${f.hs ?? 0} - ${f.as ?? 0}</div>` : ''}<span class="${f.started && !f.fin ? 'livebadge' : 'mut'}" style="font-size:11.5px">${st}</span></div><div class="tm">${crest(tShort(f.a), 38)}${tName(f.a)}</div></div></div>`;
}
function myLiveBlock(squad) {
  const pk = ST.E.picks?.picks || []; const rows = pk.map((x) => ({ id: x.element, m: x.multiplier, s: ST.live[x.element] || {} })).sort((a, b) => b.m - a.m || (b.s.total_points || 0) - (a.s.total_points || 0));
  return `<div class="card" style="margin-bottom:12px"><b>${I('i-users', 'i', 'width:16px;height:16px;vertical-align:middle')} ${tt('لاعبينك بالجولة', 'Your players this GW')}</b>${rows.map((r) => { const p = PM(r.id); if (!p) return ''; const s = r.s; const ev = [s.goals_scored ? `⚽×${s.goals_scored}` : '', s.assists ? `🅰️×${s.assists}` : '', s.yellow_cards ? '🟨' : '', s.red_cards ? '🟥' : '', s.bonus ? `+${s.bonus}B` : ''].filter(Boolean).join(' ');
    return `<div class="evt tap" onclick="openPlayer(${p.id})" style="${r.m === 0 ? 'opacity:.55' : ''}"><div style="width:30px;height:30px">${pShirt(p)}</div><span style="flex:1"><b>${esc(p.name)}</b>${r.m > 1 ? ` <span class="tag lime" style="font-size:10px">×${r.m}</span>` : ''}${r.m === 0 ? ` <span class="mut" style="font-size:11px">(${t('bench')})</span>` : ''}<br><span class="mut" style="font-size:11.5px">${s.minutes || 0}′ ${ev}</span></span><b style="font-size:18px;color:#34D399">${(s.total_points || 0) * Math.max(1, r.m)}</b></div>`; }).join('')}</div>`;
}
function openMatchC(fid, ev) {
  const f = (ST.G.fx[ev] || []).find((x) => x.id === fid); if (!f) return;
  const statRows = (key, label) => { const s = f.stats.find((x) => x.identifier === key); if (!s || (!s.h.length && !s.a.length)) return ''; const nm = (arr) => arr.map((x) => `${esc(PM(x.element)?.name || '#' + x.element)}${x.value > 1 ? ' ×' + x.value : ''}`).join('<br>'); return `<div class="evt"><span style="flex:1;text-align:start">${nm(s.h)}</span><b class="mut" style="font-size:12px">${label}</b><span style="flex:1;text-align:end">${nm(s.a)}</span></div>`; };
  const squad = ST.plan ? [...ST.plan.xi, ...ST.plan.bench].map(PM).filter((p) => p.team === f.h || p.team === f.a) : [];
  openSheet(`${sheetHead(I('i-live'), `${tName(f.h)} × ${tName(f.a)}`, `${t('gw')} ${ev} · ${fmtTime(f.ko)}`)}
   <div class="fx-card card"><div class="tm">${crest(tShort(f.h), 54)}<b>${tName(f.h)}</b>${f.hd ? `<span class="rate f${f.hd}">FDR ${f.hd}</span>` : ''}</div><div class="mid">${f.started ? `<div class="score" style="font-size:34px">${f.hs ?? 0} - ${f.as ?? 0}</div><span class="${f.fin ? 'mut' : 'livebadge'}">${f.fin ? tt('انتهت', 'Full time') : (f.min || '') + '′'}</span>` : `<b>VS</b>`}</div><div class="tm">${crest(tShort(f.a), 54)}<b>${tName(f.a)}</b>${f.ad ? `<span class="rate f${f.ad}">FDR ${f.ad}</span>` : ''}</div></div>
   ${f.started ? `<div class="card" style="margin-top:10px">${[['goals_scored', '⚽ ' + t('goals')], ['assists', '🅰️ ' + t('assists')], ['yellow_cards', '🟨'], ['red_cards', '🟥'], ['saves', tt('إنقاذات', 'Saves')], ['bonus', t('bonus')]].map((x) => statRows(...x)).join('') || `<p class="mut">${tt('ما في أحداث مسجلة بعد', 'No events yet')}</p>`}</div>` : `<p class="mut" style="margin-top:10px">${tt('الإحصائيات تظهر بعد بداية المباراة', 'Stats appear after kick-off')}</p>`}
   ${squad.length ? `<div class="sec" style="margin-top:12px"><h2 style="font-size:15px">${tt('لاعبينك بهالمباراة', 'Your players')}</h2></div>${squad.map((p) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${ST.live?.[p.id]?.minutes ?? 0}′</span></div><div class="col" style="color:#34D399;font-size:18px">${ev === ST.G.cur ? ST.live?.[p.id]?.total_points ?? '—' : '—'}</div></div>`).join('')}` : ''}`);
}
Object.assign(window, { lvGW: (g) => { gwSel = g; window.render(); setTimeout(() => document.querySelector('#lvseg .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30); }, lvRefresh: () => refreshLive(true), openMatchC });
export function afterLive() {
  setTimeout(() => document.querySelector('#lvseg .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 30);
  if (gwSel === ST.G.cur && (!ST.live || Date.now() - lastFetch > 60000)) refreshLive(false);
}
