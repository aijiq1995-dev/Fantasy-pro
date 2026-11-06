/* قاعدة بيانات اللاعبين + سوق الانتقالات + المقارنة */
import { ST, PM, tName, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, r1, LS, posTag, toast, spark, barChart } from '../ui.js';
import { xp, xpN, avgFdr, avail, canBuy, suggestions } from '../engine.js';
import { parseQuery } from '../ai.js';
import { playerRow, pShirt, fdrChips, playerSummary, stTag } from './common.js';

const F = { q: '', pos: 'ALL', team: 'ALL', max: 16, sort: 'total', quick: 'all', page: 1 };
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SORTS = () => [['total', tt('مجموع النقاط', 'Total points')], ['form', t('form')], ['ppg', tt('نقطة/مباراة', 'PPG')], ['xp', tt('المتوقع 3ج', 'xP 3GW')], ['price', t('price')], ['own', t('own')], ['xgi', 'xG+xA'], ['value', tt('نقطة/مليون', 'Pts/£m')], ['min', t('minutes')], ['fix', tt('أسهل جدول', 'Easiest fixtures')], ['trend', tt('الأكثر شراءً', 'Most bought')], ['cc', tt('تغيّر السعر', 'Price change')]];
const QUICK = () => [['all', t('all')], ['rising', tt('صاعدين بالمستوى', 'In form')], ['diff', tt('أقل امتلاكاً', 'Differentials')], ['fix', tt('أفضل جدول', 'Best fixtures')], ['price', tt('تغيّر الأسعار', 'Price changes')], ['watch', '⭐ ' + t('watchlist')]];
const sortFn = { total: (p) => p.total, form: (p) => p.form, ppg: (p) => p.ppg, xp: (p) => xpN(p, ST.G.next, 3), price: (p) => p.price, own: (p) => p.own, xgi: (p) => p.xgi, value: (p) => p.total / p.price, min: (p) => p.min, fix: (p) => -avgFdr(p.team, ST.G.next, 5), trend: (p) => p.tin - p.tout, cc: (p) => Math.abs(p.cc) * 100 + p.cc };
function filtered() {
  const q = /[\u0600-\u06FF]/.test(F.q) ? '' : norm(F.q); const PQ = /[\u0600-\u06FF]/.test(F.q) ? parseQuery(F.q) : null; const arIds = PQ ? new Set((PQ.players || []).map((p) => p.id)) : null;
  let L = ST.G.players.filter((p) => (F.pos === 'ALL' || p.pos === F.pos) && (F.team === 'ALL' || p.team === +F.team) && p.price <= F.max && (!arIds || arIds.has(p.id) || (PQ.club?.id === p.team)) && (!q || norm(p.name + ' ' + p.full + ' ' + tName(p.team) + ' ' + tShort(p.team)).includes(q)));
  if (F.quick === 'rising') L = L.filter((p) => p.form >= Math.max(4, p.ppg * 1.25) && p.min > 90);
  if (F.quick === 'diff') L = L.filter((p) => p.own < 5 && p.form >= 3.5);
  if (F.quick === 'fix') L = L.filter((p) => avgFdr(p.team, ST.G.next, 5) <= 2.8 && avail(p) > 0.5);
  if (F.quick === 'price') L = L.filter((p) => p.cc !== 0);
  if (F.quick === 'watch') L = L.filter((p) => ST.watch.has(p.id));
  const key = F.quick === 'fix' && F.sort === 'total' ? 'fix' : F.quick === 'price' && F.sort === 'total' ? 'cc' : F.sort;
  return L.sort((a, b) => sortFn[key](b) - sortFn[key](a));
}
export function vPlayers() {
  if (window.__clubFilter) { F.team = String(window.__clubFilter); F.quick = 'all'; F.q = ''; window.__clubFilter = null; }
  const L = filtered(), shown = L.slice(0, F.page * 40), teams = Object.values(ST.G.teams).sort((a, b) => tName(a.id).localeCompare(tName(b.id), 'ar'));
  return `<div class="searchbox"><span class="sicon">${I('i-search')}</span><input id="pq" type="search" placeholder="${tt('ابحث عن لاعب أو نادي…', 'Search player or club…')}" value="${esc(F.q)}" autocomplete="off"></div>
   <div class="seg" style="margin:10px 0 6px">${QUICK().map((x) => `<button class="${F.quick === x[0] ? 'on' : ''}" onclick="pf('quick','${x[0]}')">${x[1]}</button>`).join('')}</div>
   <div class="seg" style="margin-bottom:6px">${['ALL', 'GK', 'DEF', 'MID', 'FWD'].map((p) => `<button class="${F.pos === p ? 'on' : ''}" onclick="pf('pos','${p}')">${p === 'ALL' ? t('all') : t(p.toLowerCase())}</button>`).join('')}</div>
   <div class="grid g3" style="margin-bottom:8px"><select id="pt" class="sel">${`<option value="ALL">${tt('كل الأندية', 'All clubs')}</option>` + teams.map((x) => `<option value="${x.id}" ${+F.team === x.id ? 'selected' : ''}>${tName(x.id)}</option>`).join('')}</select>
    <select id="pm" class="sel">${[16, 12, 10, 8, 7, 6.5, 6, 5.5, 5, 4.5].map((v) => `<option value="${v}" ${F.max == v ? 'selected' : ''}>${t('maxPrice')} ${v}م</option>`).join('')}</select>
    <select id="ps" class="sel">${SORTS().map((s) => `<option value="${s[0]}" ${F.sort === s[0] ? 'selected' : ''}>${t('sortBy')}: ${s[1]}</option>`).join('')}</select></div>
   <div class="mut" style="font-size:12px;margin:2px 2px 8px">${fmt(L.length)} ${tt('لاعب', 'players')}</div>
   ${shown.map((p) => playerRow(p, `<div class="col">${spark([p.ppg, p.form, xp(p)].map(Number))}<small>${F.sort === 'price' || F.sort === 'cc' ? p.price.toFixed(1) + 'م' : F.sort === 'own' ? p.own + '%' : F.sort === 'xgi' ? p.xgi.toFixed(1) : F.sort === 'form' ? p.form : F.sort === 'xp' ? xpN(p, ST.G.next, 3) : F.sort === 'fix' ? avgFdr(p.team, ST.G.next, 5).toFixed(1) : F.sort === 'min' ? fmt(p.min) : F.sort === 'trend' ? '+' + fmt(Math.round((p.tin - p.tout) / 1000)) + 'k' : p.total + ' ' + t('points')}</small></div><button class="icon-btn star ${ST.watch.has(p.id) ? 'on' : ''}" onclick="event.stopPropagation();toggleWatch(${p.id})">${I('i-star')}</button>`)).join('') || `<div class="empty">${I('i-search', 'i', 'width:40px;height:40px')}<b>${tt('ما في نتائج', 'No results')}</b></div>`}
   ${L.length > shown.length ? `<button class="btn btn-g btn-b" onclick="pf('page',${F.page + 1})">${tt('عرض المزيد', 'Show more')} (${L.length - shown.length})</button>` : ''}`;
}
export function afterPlayers() {
  const q = document.getElementById('pq'); let tm;
  q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { F.q = q.value; F.page = 1; const pos = q.selectionStart; window.render(); const n = document.getElementById('pq'); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
  document.getElementById('pt').onchange = (e) => window.pf('team', e.target.value);
  document.getElementById('pm').onchange = (e) => window.pf('max', +e.target.value);
  document.getElementById('ps').onchange = (e) => window.pf('sort', e.target.value);
}
window.pf = (k, v) => { F[k] = v; if (k !== 'page') F.page = 1; window.render(); };

/* ---------- سوق الانتقالات ---------- */
/* ---------- المقارنة ---------- */
export function vCompare() {
  const ids = LS.get('fp_cmp', []).filter((id) => PM(id));
  if (ids.length < 2 && ST.plan) { const c = ST.plan.cap; if (!ids.includes(c)) ids.unshift(c); const alt = ST.G.players.filter((p) => p.pos === PM(ids[0]).pos && p.id !== ids[0]).sort((a, b) => b.total - a.total)[0]; if (ids.length < 2 && alt) ids.push(alt.id); }
  const ps = ids.slice(0, 3).map(PM), G = ST.G;
  const M = [[t('price'), (p) => p.price, -1, (v) => v.toFixed(1)], [t('total'), (p) => p.total, 1], [tt('نقطة/مباراة', 'PPG'), (p) => p.ppg, 1], [t('form'), (p) => p.form, 1], [tt('متوقع 5ج', 'xP 5GW'), (p) => xpN(p, G.next, 5), 1], ['xG', (p) => r1(p.xg), 1], ['xA', (p) => r1(p.xa), 1], [t('goals'), (p) => p.gls, 1], [t('assists'), (p) => p.ast, 1], [t('minutes'), (p) => p.min, 1, fmt], [t('starts'), (p) => p.starts ?? 0, 1], [t('own') + ' %', (p) => p.own, 0], [tt('صعوبة 5ج', 'FDR 5GW'), (p) => r1(avgFdr(p.team, G.next, 5)), -1], [tt('نقطة/مليون', 'Pts/£m'), (p) => r1(p.total / p.price), 1]];
  const score = (p) => xpN(p, G.next, 5) * 2 + p.form + p.ppg - avgFdr(p.team, G.next, 5) + (avail(p) < 1 ? -4 : 0);
  const best = [...ps].sort((a, b) => score(b) - score(a))[0];
  const cols = `grid-template-columns:110px repeat(${ps.length},1fr)`;
  return `<div class="searchbox"><span class="sicon">${I('i-plus')}</span><input id="cq" list="cqList" placeholder="${tt('أضف لاعب للمقارنة (لحد 3)', 'Add player (up to 3)')}" autocomplete="off"><datalist id="cqList">${G.players.slice().sort((a, b) => b.total - a.total).slice(0, 400).map((p) => `<option value="${esc(p.name)} — ${tShort(p.team)}" data-id="${p.id}">`).join('')}</datalist></div>
   <div class="cmph" style="${cols};margin-top:12px"><span></span>${ps.map((p) => `<div class="card tap" style="padding:10px" onclick="openPlayer(${p.id})"><div style="width:44px;height:44px;margin:auto">${pShirt(p)}</div><b style="font-size:13px;display:block">${esc(p.name)}</b><span class="mut" style="font-size:11px">${tShort(p.team)} · ${posTag(p.pos)}</span><button class="icon-btn" style="margin:6px auto 0;width:30px;height:30px" onclick="event.stopPropagation();rmCompare(${p.id})">${I('i-x', 'i', 'width:14px;height:14px')}</button></div>`).join('')}</div>
   <div class="cmpg" style="margin-top:8px">${M.map(([l, f, dir, fm]) => { const vals = ps.map(f); const bv = dir === 1 ? Math.max(...vals) : dir === -1 ? Math.min(...vals) : null; return `<div class="cmph" style="${cols}"><span class="mut" style="font-size:12px;text-align:start">${l}</span>${vals.map((v) => `<div class="cmpcell ${bv != null && v === bv ? 'best' : ''}">${fm ? fm(v) : v}</div>`).join('')}</div>`; }).join('')}
    <div class="cmph" style="${cols}"><span class="mut" style="font-size:12px;text-align:start">${tt('المباريات القادمة', 'Next fixtures')}</span>${ps.map((p) => `<div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center">${fdrChips(p.team, G.next, 5)}</div>`).join('')}</div></div>
   <div class="sec"><h2>${I('i-chart')}${tt('آخر 5 جولات', 'Last 5 GWs')}</h2></div><div class="grid" style="grid-template-columns:repeat(${ps.length},1fr)" id="cmpL5">${ps.map((p) => `<div class="card" id="l5_${p.id}"><b style="font-size:13px">${esc(p.name)}</b><div class="aiload"><i></i><i></i><i></i></div></div>`).join('')}</div>
   <div class="alert" style="margin-top:12px;border-color:rgba(52,211,153,.4)"><div class="ai" style="background:rgba(52,211,153,.14);color:#34D399">${I('i-sparkle')}</div><p><b>${tt('التوصية', 'Verdict')}: ${esc(best.name)}</b> — ${tt('يجمع أفضل توازن بين النقاط المتوقعة لـ 5 جولات، والفورم، ومعدل النقاط، وسهولة المباريات', 'best balance of 5-GW xP, form, PPG and fixture ease')}${avail(best) < 1 ? tt('، بس انتبه لجاهزيته', ', but check availability') : ''}.</p></div>`;
}
export function afterCompare() {
  const inp = document.getElementById('cq');
  inp.onchange = () => { const opt = [...document.querySelectorAll('#cqList option')].find((o) => o.value === inp.value); if (!opt) return; const c = LS.get('fp_cmp', []).filter((id) => PM(id)); const id = +opt.dataset.id; if (!c.includes(id)) c.push(id); LS.set('fp_cmp', c.slice(-3)); window.render(); };
  [...document.querySelectorAll('[id^="l5_"]')].map((el) => +el.id.slice(3)).forEach((id) => { playerSummary(id).then((d) => { const h = (d.history || []).slice(-5); const e2 = document.getElementById('l5_' + id); if (e2) e2.innerHTML = `<b style="font-size:13px">${esc(PM(id).name)}</b>${barChart(h.map((r) => 'GW' + r.round), h.map((r) => r.total_points), { h: 110 })}<div class="mut" style="font-size:11.5px;text-align:center">${h.reduce((a, r) => a + r.total_points, 0)} ${t('points')}</div>`; }).catch(() => {}); });
}
window.rmCompare = (id) => { LS.set('fp_cmp', LS.get('fp_cmp', []).filter((x) => x !== id)); window.render(); };
