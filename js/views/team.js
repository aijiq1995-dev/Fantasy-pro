/* فريقي: ملخص احترافي + ملعب تفاعلي + أدوات (تشكيل، أوراق، تحليل الفريق) */
import { ST, PM, tShort, savePlan } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, toast, fmt, r1, LS, crest, fmtTime } from '../ui.js';
import { xp, xpN, validXI, formation, bestXI, bestXIFormation, projected, hits, avail, fixturesFor, analyze, avgFdr } from '../engine.js';
import { pShirt } from './common.js';
import { pricePredict } from '../predict.js';
import { basePlan } from '../app.js';

const FORMS = ['3-4-3', '3-5-2', '4-4-2', '4-3-3', '4-5-1', '5-3-2', '5-4-1'];
let swapFrom = null, tab = 'pitch', chipPrev = '';
const LABELS = () => [['fx', tt('المباراة', 'Fixture'), 'i-cal'], ['next', tt('القادمة', 'Next 3'), 'i-season'], ['xp', tt('المتوقع', 'xP'), 'i-target'], ['pts', tt('النقاط', 'Points'), 'i-star'], ['price', t('price'), 'i-coin']];
const mode = () => LS.get('fp_label', 'fx');

function label(p) {
  const m = mode(), G = ST.G;
  if (m === 'price') { const r = pricePredict(p); return `<div class="lb">${p.price.toFixed(1)}${r.prog >= 70 ? ' <span style="color:#059669">▲</span>' : r.prog <= -70 ? ' <span style="color:#DC2626">▼</span>' : ''}</div>`; }
  if (m === 'xp') { const v = xp(p); return `<div class="lb" style="background:${v >= 6 ? '#34D399' : v >= 4 ? '#A7F3D0' : '#F1F5F9'}">${v}</div>`; }
  if (m === 'pts') { const v = ST.live?.[p.id]?.total_points; return `<div class="lb" style="background:${v == null ? '#E2E8F0' : v >= 8 ? '#34D399' : v >= 4 ? '#A7F3D0' : v >= 1 ? '#FED7AA' : '#FECACA'}">${v ?? '—'}</div>`; }
  if (m === 'next') { const cells = [0, 1, 2].map((i) => { const f = fixturesFor(p.team, G.next + i); return f.length ? `<i class="f${Math.round(f.reduce((a, x) => a + x.fdr, 0) / f.length)}" title="${f.map((x) => tShort(x.opp)).join('+')}">${f.length > 1 ? '2' : tShort(f[0].opp).slice(0, 3)}</i>` : '<i style="background:#475569;color:#fff">—</i>'; }).join(''); return `<div class="lb nx3">${cells}</div>`; }
  const f = fixturesFor(p.team, G.next); return `<div class="lb ${f[0] ? 'f' + f[0].fdr : ''}">${f.length ? f.map((x) => tShort(x.opp) + (x.home ? '' : '*')).join('+') : '—'}</div>`;
}
function canSwap(a, b) {
  const P = ST.plan, ia = P.xi.includes(a), ib = P.xi.includes(b);
  if (ia === ib) return !ia && PM(a).pos !== 'GK' && PM(b).pos !== 'GK';
  const s = ia ? a : b, bn = ia ? b : a; if ((PM(s).pos === 'GK') !== (PM(bn).pos === 'GK')) return false;
  return validXI(P.xi.map((x) => (x === s ? bn : x)));
}
function card(id, i = 0) {
  const p = PM(id), P = ST.plan, sel = swapFrom === id, a = avail(p);
  let cls = 'pl'; if (sel) cls += ' sel'; else if (swapFrom) cls += canSwap(swapFrom, id) ? ' can' : ' dim';
  if (P.transfers.some((x) => x.in === id)) cls += ' new';
  if (P.cap === id) cls += ' capt';
  const badge = a < 1 || p.st === 's' ? `<span class="rk ${a === 0 || p.st === 's' ? 'r2' : 'r1'}" title="${esc(p.news || '')}">${a > 0 && a < 1 ? Math.round(a * 100) : '!'}</span>` : '';
  return `<div class="${cls}" style="--d:${i * 35}ms" onclick="pitchTap(${id})" role="button" aria-label="${esc(p.name)}">${P.cap === id ? `<span class="cb">${P.chip === '3xc' ? '3×' : 'C'}</span>` : P.vc === id ? '<span class="cb v">V</span>' : ''}${badge}<div class="sh">${pShirt(p)}</div><div class="nm">${esc(p.name)}</div>${label(p)}</div>`;
}
const LINES = `<svg class="lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width=".45"><rect x="4" y="3" width="92" height="134" rx="1.5"/><line x1="4" y1="70" x2="96" y2="70"/><ellipse cx="50" cy="70" rx="12" ry="8.6"/><rect x="26" y="3" width="48" height="18"/><rect x="38" y="3" width="24" height="7"/><path d="M41 21 Q50 27 59 21"/><rect x="26" y="119" width="48" height="18"/><rect x="38" y="130" width="24" height="7"/><path d="M41 119 Q50 113 59 119"/></g><circle cx="50" cy="70" r=".9" fill="#fff"/></svg>`;

function hero(P) {
  const G = ST.G, value = r1(P.squad.reduce((a, id) => a + PM(id).price, 0)), proj = projected({ ...P, chip: chipPrev || P.chip });
  const a = analyze(P, esc), ring = Math.round(a.overall), C = 2 * Math.PI * 26;
  return `<section class="team-hero">
    <div class="flex between" style="align-items:flex-start">
      <div><div class="mut" style="font-size:12.5px">${t('gw')} ${G.next} · ${tt('الإغلاق', 'Deadline')} ${fmtTime(G.deadline)}</div>
        <div class="flex" style="gap:8px;align-items:baseline"><span class="big-num count" data-v="${proj}" style="font-size:40px">${proj}</span><span class="mut" style="font-size:13px">${tt('نقطة متوقعة', 'projected pts')}</span></div>
        ${a.opt - a.cur >= 0.5 ? `<button class="hint-chip" onclick="bestLineup()">${I('i-sparkle', 'i', 'width:13px;height:13px')}${tt(`+${(a.opt - a.cur).toFixed(1)} نقطة بالتشكيلة الأفضل`, `+${(a.opt - a.cur).toFixed(1)} with best XI`)}</button>` : `<span class="hint-chip ok">${I('i-check', 'i', 'width:13px;height:13px')}${tt('تشكيلتك هي الأفضل', 'Optimal lineup')}</span>`}
      </div>
      <button class="score-ring" onclick="teamTab('insight')" aria-label="rating"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,.08)" stroke-width="6" fill="none"/><circle cx="32" cy="32" r="26" stroke="url(#rg)" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ring / 100)}" transform="rotate(-90 32 32)"/><defs><linearGradient id="rg"><stop offset="0" stop-color="#34D399"/><stop offset="1" stop-color="#60A5FA"/></linearGradient></defs></svg><b>${ring}</b><small>${tt('تقييم', 'Rating')}</small></button>
    </div>
    <div class="tstrip"><div><small>${tt('التشكيل', 'Formation')}</small><b>${formation(P.xi)}</b></div><div><small>${t('bank')}</small><b>${P.bank.toFixed(1)}</b></div><div><small>${t('ft')}</small><b>${Math.max(0, P.ft - P.transfers.filter((x) => !x.cost).length)}</b></div><div><small>${t('value')}</small><b>${value.toFixed(1)}</b></div>${hits(P) ? `<div><small>${tt('خصم', 'Hits')}</small><b class="down">−${hits(P)}</b></div>` : ''}</div>
  </section>`;
}
function toolbar(P) {
  return `<div class="tbar">
    <div class="seg" style="flex:1">${LABELS().map((l) => `<button class="${mode() === l[0] ? 'on' : ''}" onclick="setLabel('${l[0]}')">${I(l[2], 'i', 'width:15px;height:15px')}${l[1]}</button>`).join('')}</div>
    <label class="form-sel">${I('i-layers', 'i', 'width:15px;height:15px')}<select onchange="setForm(this.value)" aria-label="formation">${FORMS.map((f) => `<option ${formation(P.xi) === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
  </div>`;
}
function pitch(P) {
  const rows = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => P.xi.filter((id) => PM(id).pos === pos));
  let k = 0;
  const benchXp = P.bench.reduce((a, id) => a + xp(PM(id)), 0);
  return `${swapFrom ? `<div class="banner"><span>${I('i-swap', 'i', 'width:16px;height:16px;vertical-align:-3px')} ${tt('اختر لاعب يتبادل مع', 'Pick a player to swap with')} <b>${esc(PM(swapFrom).name)}</b></span><button class="btn btn-g btn-sm" onclick="cancelSwap()">${t('cancel')}</button></div>` : ''}
   <div class="pitch">${LINES}${rows.map((r) => `<div class="prow">${r.map((id) => card(id, k++)).join('')}</div>`).join('')}</div>
   <div class="benchbox"><div class="t"><span>${I('i-bench', 'i', 'width:16px;height:16px;vertical-align:-3px')} ${t('bench')} <span class="mut" style="font-size:12px">· ${r1(benchXp)} xP</span></span><button class="btn btn-g btn-sm" onclick="autoBench()">${I('i-sparkle', 'i', 'width:14px;height:14px')}${tt('رتّب الدكة', 'Order bench')}</button></div>
    <div class="prow">${P.bench.map((id, i) => `<div class="slot"><small>${i === 0 ? t('gk') : i}</small>${card(id, 11 + i)}</div>`).join('')}</div></div>
   <div class="chip-prev"><span class="mut" style="font-size:12.5px">${tt('جرّب ورقة', 'Preview chip')}:</span>${[['', tt('بدون', 'None')], ['bboost', tt('بنش بوست', 'Bench Boost')], ['3xc', tt('كابتن ثلاثي', 'Triple C')]].map(([c, l]) => `<button class="${chipPrev === c ? 'on' : ''}" onclick="chipPreview('${c}')">${l}${c ? ` <b>+${r1(projected({ ...P, chip: c }) - projected({ ...P, chip: '' }))}</b>` : ''}</button>`).join('')}</div>`;
}
function insight(P) {
  const G = ST.G, gw = G.next, a = analyze(P, esc), sq = P.squad.map(PM);
  const posXp = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => { const L = sq.filter((p) => p.pos === pos); return [pos, r1(L.reduce((s, p) => s + xpN(p, gw, 5), 0) / (L.length || 1))]; });
  const mx = Math.max(...posXp.map((x) => x[1]), 1);
  const clubs = {}; sq.forEach((p) => (clubs[p.team] = (clubs[p.team] || 0) + 1));
  const risks = sq.map((p) => { const r = []; if (avail(p) < 1) r.push([avail(p) === 0 ? 'red' : 'amber', avail(p) === 0 ? tt('غير متاح', 'Out') : `${Math.round(avail(p) * 100)}%`]); if (!fixturesFor(p.team, gw).length) r.push(['amber', tt('ما يلعب', 'Blank')]); const pp = pricePredict(p); if (pp.prog <= -70) r.push(['red', tt('سعره ينزل', 'Price drop')]); return [p, r]; }).filter((x) => x[1].length);
  const M = [['attack', tt('الهجوم', 'Attack')], ['defense', tt('الدفاع', 'Defence')], ['fixt', tt('المباريات', 'Fixtures')], ['form', tt('الفورم', 'Form')], ['availability', tt('الجاهزية', 'Availability')], ['lineup', tt('التشكيلة', 'Lineup')]];
  const gws = [0, 1, 2, 3, 4].map((i) => gw + i).filter((g) => g <= G.lastGW);
  return `<div class="card"><div class="flex between" style="margin-bottom:10px"><b>${I('i-gauge', 'i', 'width:17px;height:17px;vertical-align:-3px;color:var(--acc)')} ${tt('تقييم الفريق', 'Team rating')}</b><span class="big-num" style="font-size:22px">${a.overall}<span class="mut" style="font-size:12px">/100</span></span></div>
    ${M.map(([k, l]) => `<div class="mrow"><span>${l}</span><div class="meter" style="flex:1;margin:0"><i style="width:${Math.round(a.metrics?.[k] ?? 0)}%;background:${(a.metrics?.[k] ?? 0) >= 70 ? 'var(--acc)' : (a.metrics?.[k] ?? 0) >= 45 ? 'var(--warn)' : 'var(--bad)'}"></i></div><b class="num">${Math.round(a.metrics?.[k] ?? 0)}</b></div>`).join('')}</div>
   <div class="sec"><h2>${I('i-season')}${tt('مباريات فريقك القادمة', 'Squad fixture run')}</h2></div>
   <div class="card scroll-x" dir="ltr" style="padding:10px"><table class="mx" style="width:100%"><thead><tr><th style="text-align:left">${tt('اللاعب', 'Player')}</th>${gws.map((g) => `<th>GW${g}</th>`).join('')}<th>xP5</th></tr></thead><tbody>${[...P.xi, ...P.bench].map(PM).map((p) => `<tr><td class="tn" onclick="openPlayer(${p.id})"><span class="pos ${p.pos}">${p.pos}</span>${esc(p.name)}</td>${gws.map((g) => { const f = fixturesFor(p.team, g); return f.length ? `<td class="c f${Math.round(f.reduce((s, x) => s + x.fdr, 0) / f.length)}">${f.map((x) => `${tShort(x.opp)}<small>${x.home ? 'H' : 'A'}</small>`).join('')}</td>` : '<td class="c blank">—</td>'; }).join('')}<td class="c" style="background:var(--s2)">${xpN(p, gw, 5)}</td></tr>`).join('')}</tbody></table></div>
   <div class="grid g2 one-sm" style="margin-top:12px">
    <div class="card"><b style="font-size:14px">${I('i-layers', 'i', 'width:16px;height:16px;vertical-align:-3px;color:var(--acc)')} ${tt('قوة الخطوط (xP/5)', 'Line strength (xP/5)')}</b>${posXp.map(([pos, v]) => `<div class="mrow"><span class="pos ${pos}">${pos}</span><div class="meter" style="flex:1;margin:0"><i style="width:${(v / mx) * 100}%;background:var(--acc)"></i></div><b class="num">${v}</b></div>`).join('')}</div>
    <div class="card"><b style="font-size:14px">${I('i-shield', 'i', 'width:16px;height:16px;vertical-align:-3px;color:var(--acc)')} ${tt('توزيع الأندية', 'Club exposure')}</b><div class="flex wrap" style="gap:6px;margin-top:10px">${Object.entries(clubs).sort((x, y) => y[1] - x[1]).map(([tm, n]) => `<span class="club-chip ${n >= 3 ? 'full' : ''}" onclick="openClub(${tm})">${crest(tShort(+tm), 18)}${tShort(+tm)} <b>${n}/3</b></span>`).join('')}</div></div>
   </div>
   <div class="sec"><h2>${I('i-alert')}${tt('مخاطر بفريقك', 'Squad risks')}</h2></div>
   ${risks.length ? `<div class="list">${risks.map(([p, r]) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span style="white-space:normal">${esc(p.news || tShort(p.team))}</span></div><div class="flex" style="gap:4px">${r.map(([c, l]) => `<span class="tag ${c}">${l}</span>`).join('')}</div></div>`).join('')}</div>` : `<div class="card flex" style="gap:10px">${I('i-check', 'i', 'color:var(--acc)')}<span>${tt('ما في مخاطر واضحة بفريقك هالجولة', 'No obvious risks this GW')}</span></div>`}`;
}
export function vTeam() {
  const P = ST.plan; if (!P) return `<div class="empty">${I('i-pitch', 'i', 'width:44px;height:44px')}<b>${tt('فريقك ما لعب أي جولة بعد', 'Your team has not played yet')}</b></div>`;
  const E = ST.E, pend = E.pending || [], preDeadline = E.gw && ST.G.next > E.gw;
  const info = preDeadline ? `<details class="tnote"><summary>${I('i-info', 'i', 'width:16px;height:16px;color:var(--info)')}<span>${tt(`تشكيلتك للجولة ${ST.G.next}`, `Your team for GW${ST.G.next}`)}${E.fhRevert ? tt(' · رجعت بعد الفري هيت', ' · reverted after FH') : ''}${P.transfers.length ? ` · ${P.transfers.length} ${tt('انتقال مسجّل', 'recorded')}` : ''}</span>${I('i-chev', 'chev')}</summary><p>${pend.length ? tt(`انتقالات من الفانتازي: ${pend.map((x) => `${PM(x.element_out)?.name} ← ${PM(x.element_in)?.name}`).join('، ')}. `, '') : ''}${tt('الفانتازي يخفي الانتقالات الجديدة والكابتن لحد الإغلاق. إذا سويت انتقال بتطبيق الفانتازي سجّله هنا مرة وحدة، وبعد الإغلاق كلشي يتحدث رسمياً وحده.', 'FPL hides new transfers & captain until the deadline — record your move here once; it syncs officially after.')}</p></details>` : '';
  const actions = `<div class="tactions"><button class="btn btn-p" onclick="bestLineup()">${I('i-sparkle')}${tt('أفضل تشكيلة', 'Best XI')}</button><button class="btn btn-g" onclick="go('market')">${I('i-swap')}${preDeadline ? tt('سجّل انتقال', 'Record transfer') : t('transfers')}</button><button class="icon-btn" onclick="syncTeam(this)" aria-label="refresh" title="${tt('تحديث من الفانتازي', 'Refresh from FPL')}">${I('i-refresh')}</button><button class="icon-btn" onclick="resetToOfficial()" aria-label="reset" title="${tt('رجّع الرسمي', 'Reset')}">${I('i-reset')}</button></div>`;
  return `${hero(P)}${info}
   <div class="tabs2" style="margin-top:12px"><button class="${tab === 'pitch' ? 'on' : ''}" onclick="teamTab('pitch')">${I('i-pitch', 'i', 'width:16px;height:16px;vertical-align:-3px')} ${tt('الملعب', 'Pitch')}</button><button class="${tab === 'insight' ? 'on' : ''}" onclick="teamTab('insight')">${I('i-gauge', 'i', 'width:16px;height:16px;vertical-align:-3px')} ${tt('تحليل الفريق', 'Insights')}</button></div>
   ${tab === 'pitch' ? toolbar(P) + pitch(P) + actions : insight(P)}
   ${P.transfers.length ? `<div class="sec"><h2>${I('i-swap')}${tt('انتقالات مسجّلة', 'Recorded transfers')}</h2></div><div class="list">${P.transfers.map((x, i) => `<div class="row"><div class="mini">${pShirt(PM(x.in))}</div><div class="info"><b><span class="down">${esc(PM(x.out).name)}</span> ← <span class="up">${esc(PM(x.in).name)}</span></b><span>${x.cost ? '−4' : tt('مجاني', 'free')} · ${tt('فرق المتوقع', 'xP diff')} ${r1(xpN(PM(x.in), ST.G.next, 3) - xpN(PM(x.out), ST.G.next, 3))}/3</span></div><button class="icon-btn" onclick="undoT(${i})" aria-label="undo">${I('i-x')}</button></div>`).join('')}</div>` : ''}
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:12px">${tt('* = خارج الأرض. اضغط لاعب لتفاصيله، أو اختار "بدّل" من صفحته حتى تبدّله. التغييرات تنحفظ كخطة، والتنفيذ بالتطبيق الرسمي.', '* = away. Tap a player for details or swap. Changes save as a plan.')}</p>`;
}
function pitchTap(id) { if (swapFrom) { const a = swapFrom; swapFrom = null; if (a !== id) doSwap(a, id); return window.render(); } window.openPlayer(id); }
function doSwap(a, b) {
  const P = ST.plan; if (!canSwap(a, b)) return toast(tt('التبديل يكسر قواعد التشكيلة', 'Invalid formation'));
  const ia = P.xi.includes(a), ib = P.xi.includes(b);
  if (!ia && !ib) { const i = P.bench.indexOf(a), j = P.bench.indexOf(b); P.bench[i] = b; P.bench[j] = a; }
  else { const s = ia ? a : b, bn = ia ? b : a; P.xi = P.xi.map((x) => (x === s ? bn : x)); P.bench = P.bench.map((x) => (x === bn ? s : x)); if (P.cap === s) P.cap = bn; if (P.vc === s) P.vc = bn; }
  savePlan(); toast(tt('تم التبديل', 'Swapped'));
}
Object.assign(window, {
  pitchTap,
  teamTab: (x) => { tab = x; window.render(); },
  chipPreview: (c) => { chipPrev = c; window.render(); },
  setLabel: (m) => { LS.set('fp_label', m); window.render(); },
  setForm: (f) => { const r = bestXIFormation(ST.plan.squad, f); if (!r) { toast(tt('ما يمشي هذا التشكيل بلاعبينك', 'Not possible with your squad')); return window.render(); } Object.assign(ST.plan, r); savePlan(); window.render(); toast(f); },
  startSwap: (id) => { window.closeSheet(); swapFrom = id; tab = 'pitch'; if (ST.view !== 'team') window.go('team'); else window.render(); },
  cancelSwap: () => { swapFrom = null; window.render(); },
  autoBench: () => { const P = ST.plan; P.bench = [P.bench[0], ...P.bench.slice(1).sort((a, b) => xp(PM(b)) - xp(PM(a)))]; savePlan(); window.render(); toast(tt('رتّبت الدكة حسب المتوقع', 'Bench ordered by xP')); },
  bestLineup: () => { Object.assign(ST.plan, bestXI(ST.plan.squad)); savePlan(); tab = 'pitch'; window.render(); toast(tt('التشكيلة الأفضل للجولة القادمة', 'Best predicted XI')); },
  resetPlan: () => { ST.plan = basePlan(); savePlan(); window.render(); toast(tt('رجعنا للفريق الرسمي', 'Reverted to official team')); },
  undoT: (i) => { const P = ST.plan, x = P.transfers[i]; const rep = (a) => a.map((y) => (y === x.in ? x.out : y)); P.squad = rep(P.squad); P.xi = rep(P.xi); P.bench = rep(P.bench); if (P.cap === x.in) P.cap = x.out; if (P.vc === x.in) P.vc = x.out; P.bank = r1(P.bank - PM(x.out).price + PM(x.in).price); if (!x.cost && P.chip !== 'wildcard' && P.chip !== 'freehit') P.ft++; P.transfers.splice(i, 1); savePlan(); window.render(); },
  syncTeam: async (b) => { if (b) b.classList.add('spin'); await window.loadAll(true); window.go('team', { back: true }); },
  resetToOfficial: () => { try { Object.keys(localStorage).filter((k) => k.startsWith('fp_plan_')).forEach((k) => localStorage.removeItem(k)); } catch {} window.loadAll(true).then(() => window.go('team', { back: true })); },
});
