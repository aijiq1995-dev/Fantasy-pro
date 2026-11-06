/* مختبر القرارات: محاكاة الانتقال (مع حساب الخصم ونقطة التعادل) + مصفوفة الكابتن */
import { ST, PM, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, openSheet, closeSheet, sheetHead } from '../ui.js';
import { xp, xpN, canBuy } from '../engine.js';
import { labCompute, parseQuery } from '../ai.js';
import { pShirt } from './common.js';

let outId = null, inId = null, H = 5, pickQ = '';
export function vLab() {
  const P = ST.plan; if (!P) return `<div class="empty">${t('noData')}</div>`;
  const o = outId && PM(outId), n = inId && PM(inId), R = o && n ? labCompute(outId, inId, H) : null;
  const pick = (p, side) => `<button class="pick ${p ? 'set' : ''}" onclick="labPick('${side}')" style="width:100%;text-align:start">${p ? `<div class="mini-sh">${pShirt(p)}</div><div style="flex:1;min-width:0"><b style="font-size:14px">${esc(p.name)}</b><div class="mut" style="font-size:12px">${tShort(p.team)} · ${p.price.toFixed(1)}م · ${xpN(p, ST.G.next, H)} xP/${H}</div></div>` : `<div class="pbig" style="background:var(--s3);color:var(--mut)">${I('i-plus')}</div><span class="mut">${side === 'out' ? tt('اختار لاعب تبيعه', 'Pick a player to sell') : tt('اختار لاعب تشتريه', 'Pick a player to buy')}</span>`}${I('i-chev', 'chev')}</button>`;
  return `<div class="card"><div class="flex between" style="margin-bottom:10px"><b>${I('i-swap', 'i', 'width:18px;height:18px;vertical-align:-3px;color:var(--acc)')} ${tt('محاكاة انتقال', 'Transfer simulator')}</b><span class="mut" style="font-size:12px">${tt('البنك', 'Bank')} ${P.bank}م · ${tt('مجانية', 'FT')} ${P.ft}</span></div>
    <div class="stack"><div><div class="mut" style="font-size:12px;margin-bottom:4px">${tt('خارج', 'Out')}</div>${pick(o, 'out')}</div><div><div class="mut" style="font-size:12px;margin-bottom:4px">${tt('داخل', 'In')}</div>${pick(n, 'in')}</div></div>
    <div class="seg" style="margin-top:12px">${[1, 3, 5, 8].map((h) => `<button class="${H === h ? 'on' : ''}" onclick="labH(${h})">${h} ${h === 1 ? tt('جولة', 'GW') : tt('جولات', 'GWs')}</button>`).join('')}</div></div>
   ${R ? result(R) : `<p class="mut" style="font-size:13px;margin:10px 2px">${tt('يحسب الفرق بالنقاط المتوقعة جولة بجولة، وإذا ما عندك انتقال مجاني يخصم 4 ويحسبلك بأي جولة تسترجعها.', 'Computes xP difference per GW; with no free transfer it deducts 4 and finds the breakeven GW.')}</p>`}
   <div class="sec"><h2>${I('i-crown')}${tt('مصفوفة الكابتن', 'Captain matrix')}</h2><span class="mut" style="font-size:12px">${tt('النقاط المتوقعة ×2', 'xP ×2')}</span></div>${capMatrix()}`;
}
function result(R) {
  if (!R.valid) return `<div class="verdict no" style="margin-top:12px">${I('i-x')}${esc(R.reason)}</div>`;
  const mx = Math.max(1, ...R.per_gw.map((x) => Math.abs(x.diff)));
  const V = { go: [tt('سوّها — يستاهل', 'Do it — worth it'), 'i-check'], wait: [tt('الفرق بسيط — فكّر تأجلها', 'Marginal — consider waiting'), 'i-clock'], no: [tt('لا تسويها — خسارة متوقعة', 'Avoid — expected loss'), 'i-x'] }[R.verdict];
  return `<div class="card" style="margin-top:10px"><div class="lab-res"><div><b class="${R.xp_gain >= 0 ? 'up' : 'down'}">${R.xp_gain >= 0 ? '+' : ''}${R.xp_gain}</b><span>${tt('فرق المتوقع', 'xP gain')}</span></div><div><b>${R.hit_cost ? '−' + R.hit_cost : 0}</b><span>${tt('الخصم', 'Hit')}</span></div><div><b class="${R.net >= 0 ? 'up' : 'down'}">${R.net >= 0 ? '+' : ''}${R.net}</b><span>${tt('الصافي', 'Net')}</span></div><div><b>${R.hit_cost ? (R.breakeven_gw ? 'GW' + R.breakeven_gw : '✗') : '—'}</b><span>${tt('يسترجع الخصم', 'Breakeven')}</span></div></div>
   <div style="margin-top:14px">${R.per_gw.map((x) => `<div class="flex" style="gap:10px;margin:6px 0;font-size:12.5px"><span class="num mut" style="width:40px">GW${x.gw}</span><div style="flex:1;display:flex;direction:ltr;height:18px;background:var(--s3);border-radius:5px;overflow:hidden;position:relative"><i style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--line2)"></i><i style="position:absolute;top:2px;bottom:2px;border-radius:3px;${x.diff >= 0 ? `left:50%;width:${(x.diff / mx) * 50}%;background:var(--acc)` : `right:50%;width:${(-x.diff / mx) * 50}%;background:var(--bad)`}"></i></div><span class="num" style="width:44px;text-align:end;font-weight:600" class="${x.diff >= 0 ? 'up' : 'down'}">${x.diff >= 0 ? '+' : ''}${x.diff}</span></div>`).join('')}</div>
   <div class="verdict ${R.verdict}">${I(V[1])}${V[0]}</div>
   <p class="mut" style="font-size:12px;margin-top:8px">${tt('البنك بعد الانتقال', 'Bank after')}: ${R.bank_after}م</p>
   <button class="btn btn-p btn-b" style="margin-top:6px" onclick="labApply()">${I('i-check')}${tt('ضيفه لخطة فريقك', 'Add to my plan')}</button></div>`;
}
function capMatrix() {
  const G = ST.G, gws = Array.from({ length: 5 }, (_, i) => G.next + i).filter((g) => g <= G.lastGW);
  const cands = [...ST.plan.xi].map(PM).sort((a, b) => xpN(b, G.next, 5) - xpN(a, G.next, 5)).slice(0, 6);
  const best = Object.fromEntries(gws.map((g) => [g, Math.max(...cands.map((p) => xp(p, g)))]));
  return `<div class="card scroll-x" style="padding:10px"><table class="mx" style="width:100%"><thead><tr><th style="text-align:right">${tt('اللاعب', 'Player')}</th>${gws.map((g) => `<th>GW${g}</th>`).join('')}</tr></thead><tbody>${cands.map((p) => `<tr><td class="tn" onclick="openPlayer(${p.id})">${esc(p.name)}</td>${gws.map((g) => { const v = xp(p, g); const top = v === best[g] && v > 0; return `<td class="c" style="background:${top ? 'var(--acc)' : 'var(--s2)'};color:${top ? 'var(--on-acc)' : 'var(--txt)'}">${(v * 2).toFixed(1)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function pickSheet(side) {
  const P = ST.plan, G = ST.G;
  const o = outId && PM(outId);
  let L;
  if (side === 'out') L = [...P.xi, ...P.bench].map(PM);
  else { const pq = pickQ.trim() ? new Set((parseQuery(pickQ)?.players || []).map((p) => p.id)) : null; L = G.players.filter((p) => (!o || p.pos === o.pos) && !P.squad.includes(p.id) && p.st !== 'u' && (!pq || pq.has(p.id) || p.name.toLowerCase().includes(pickQ.toLowerCase()))).sort((a, b) => xpN(b, G.next, H) - xpN(a, G.next, H)).slice(0, 40); }
  return `${sheetHead(I(side === 'out' ? 'i-logout' : 'i-plus'), side === 'out' ? tt('اختار لاعب تبيعه', 'Pick player to sell') : tt('اختار لاعب تشتريه', 'Pick player to buy'), side === 'in' && o ? `${t(o.pos.toLowerCase())} · ${tt('الميزانية', 'Budget')} ${(P.bank + o.price).toFixed(1)}م` : '')}
   ${side === 'in' ? `<div class="searchbox" style="margin-bottom:10px"><span class="sicon">${I('i-search')}</span><input id="lq" value="${esc(pickQ)}" placeholder="${tt('ابحث…', 'Search…')}" oninput="labQ(this.value)"></div>` : ''}
   <div class="list" id="labList">${L.map((p) => { const bad = side === 'in' && o ? canBuy(P, o.id, p.id) : ''; return `<div class="row tap" onclick="labSet('${side}',${p.id})" style="${bad ? 'opacity:.45' : ''}"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${tShort(p.team)} · ${p.price.toFixed(1)}م${bad ? ' · ' + esc(bad) : ''}</span></div><div class="col" style="color:var(--acc)">${xpN(p, G.next, H)}<small>xP/${H}</small></div></div>`; }).join('')}</div>`;
}
Object.assign(window, {
  labPick: (side) => { if (side === 'in' && !outId) return window.labPick('out'); pickQ = ''; openSheet(pickSheet(side)); },
  labQ: (v) => { pickQ = v; const tmp = document.createElement('div'); tmp.innerHTML = pickSheet('in'); const nl = tmp.querySelector('#labList'), ol = document.getElementById('labList'); if (nl && ol) ol.innerHTML = nl.innerHTML; },
  labSet: (side, id) => { if (side === 'out') { outId = id; inId = null; closeSheet(); window.render(); setTimeout(() => window.labPick('in'), 150); } else { inId = id; closeSheet(); window.render(); } },
  labH: (h) => { H = h; window.render(); },
  labApply: () => { if (outId && inId && window.doTransfer) { window.doTransfer(outId, inId); outId = inId = null; window.go('team'); } },
  labPreset: (o, n) => { outId = o; inId = n; window.go('lab'); },
});
