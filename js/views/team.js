/* إدارة الفريق: الملعب التفاعلي، التشكيلات، الكابتن، التبديلات */
import { ST, PM, tShort, savePlan } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, toast, fmt, r1, LS } from '../ui.js';
import { xp, validXI, formation, bestXI, bestXIFormation, projected, hits, avail, fixturesFor } from '../engine.js';
import { pShirt } from './common.js';
import { basePlan } from '../app.js';

const FORMS = ['3-4-3', '3-5-2', '4-4-2', '4-3-3', '4-5-1', '5-3-2', '5-4-1'];
let swapFrom = null;
const LABELS = () => [['fx', tt('المباراة', 'Fixture'), 'i-cal'], ['pts', tt('نقاط الجولة', 'GW pts'), 'i-star'], ['xp', tt('المتوقع', 'xP'), 'i-target'], ['price', t('price'), 'i-coin']];
const mode = () => LS.get('fp_label', 'fx');
function label(p) {
  const m = mode();
  if (m === 'price') return `<div class="lb">${p.price.toFixed(1)}م</div>`;
  if (m === 'xp') return `<div class="lb" style="background:#0B1222;color:#34D399">${xp(p)}</div>`;
  if (m === 'pts') { const v = ST.live?.[p.id]?.total_points; return `<div class="lb" style="background:${v == null ? '#1f2944' : v >= 8 ? '#10B981' : v >= 4 ? '#34D399' : v >= 1 ? '#FB7185' : '#EF4444'};color:#0B1222">${v ?? '—'}</div>`; }
  const f = fixturesFor(p.team, ST.G.next); return `<div class="lb ${f[0] ? 'f' + f[0].fdr : ''}">${f.length ? f.map((x) => tShort(x.opp) + (x.home ? '' : '*')).join('+') : '—'}</div>`;
}
function canSwap(a, b) {
  const P = ST.plan, ia = P.xi.includes(a), ib = P.xi.includes(b);
  if (ia === ib) return !ia && PM(a).pos !== 'GK' && PM(b).pos !== 'GK';
  const s = ia ? a : b, bn = ia ? b : a; if ((PM(s).pos === 'GK') !== (PM(bn).pos === 'GK')) return false;
  return validXI(P.xi.map((x) => (x === s ? bn : x)));
}
function card(id) {
  const p = PM(id), P = ST.plan, sel = swapFrom === id, a = avail(p);
  let cls = 'pl'; if (sel) cls += ' sel'; else if (swapFrom) cls += canSwap(swapFrom, id) ? ' can' : ' dim';
  if (P.transfers.some((x) => x.in === id)) cls += ' new';
  return `<div class="${cls}" onclick="pitchTap(${id})">${P.cap === id ? '<span class="cb">C</span>' : P.vc === id ? '<span class="cb v">V</span>' : ''}${a < 1 || p.st === 's' ? `<span class="rk ${a === 0 || p.st === 's' ? 'r2' : 'r1'}">!</span>` : ''}<div class="sh">${pShirt(p)}</div><div class="nm">${esc(p.name)}</div>${label(p)}</div>`;
}
const LINES = `<svg class="lines" viewBox="0 0 100 140" preserveAspectRatio="none"><rect x="4" y="3" width="92" height="134" rx="2" fill="none" stroke="#fff" stroke-width=".5"/><rect x="28" y="3" width="44" height="17" fill="none" stroke="#fff" stroke-width=".5"/><rect x="28" y="120" width="44" height="17" fill="none" stroke="#fff" stroke-width=".5"/></svg>`;
export function vTeam() {
  const P = ST.plan; if (!P) return `<div class="empty">${I('i-pitch', 'i', 'width:44px;height:44px')}<b>${tt('فريقك ما لعب أي جولة بعد', 'Your team has not played yet')}</b></div>`;
  const rows = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => P.xi.filter((id) => PM(id).pos === pos));
  const value = r1(P.squad.reduce((a, id) => a + PM(id).price, 0));
  const E = ST.E, pend = E.pending || [];
  const info = E.gw && ST.G.next > E.gw ? `<div class="note" style="margin:0 0 10px;font-size:12.5px">${I('i-info', 'i', 'color:var(--info)')}<span>${tt(`هذي تشكيلتك للجولة ${ST.G.next}`, `Your team for GW${ST.G.next}`)}${E.fhRevert ? tt(' (رجعت لفريقك بعد الفري هيت)', ' (reverted after Free Hit)') : ''}${pend.length ? tt(` مع انتقالاتك: ${pend.map((t) => `${PM(t.element_out)?.name || '?'} ← ${PM(t.element_in)?.name || '?'}`).join('، ')}`, ` incl. transfers: ${pend.map((t) => `${PM(t.element_out)?.name} → ${PM(t.element_in)?.name}`).join(', ')}`) : ''}. ${tt('الفانتازي يخفي الانتقالات الجديدة والكابتن عن الواجهة العامة لحد الإغلاق، فإذا سويت انتقال بتطبيق الفانتازي سجّله هنا مرة وحدة وينحفظ، وبعد الإغلاق يتحدث كلشي رسمياً وحده.', 'FPL hides new transfers & captain from the public API until the deadline — record your move here once; it syncs officially after the deadline.')}</span></div>
   <div class="flex" style="gap:8px;margin:-2px 0 10px"><button class="btn btn-p btn-sm" style="flex:1" onclick="go('market')">${I('i-swap', 'i', 'width:16px;height:16px')}${tt('سجّل انتقال سويته', 'Record a transfer')}</button>${P.transfers.length ? `<button class="btn btn-g btn-sm" onclick="resetToOfficial()">${I('i-reset', 'i', 'width:16px;height:16px')}${tt('رجّع الرسمي', 'Reset')}</button>` : ''}</div>` : '';
  const sync = `<button class="btn btn-g btn-sm btn-b" style="margin-bottom:10px" onclick="syncTeam(this)">${I('i-refresh', 'i', 'width:16px;height:16px')}${tt('تحديث من الفانتازي', 'Refresh from FPL')}</button>`;
  return info + sync + `<div class="seg" style="margin-bottom:8px">${LABELS().map((l) => `<button class="${mode() === l[0] ? 'on' : ''}" onclick="setLabel('${l[0]}')">${I(l[2], 'i', 'width:15px;height:15px')}${l[1]}</button>`).join('')}</div>
   <div class="seg" style="margin-bottom:10px">${FORMS.map((f) => `<button class="${formation(P.xi) === f ? 'on' : ''}" onclick="setForm('${f}')">${f}</button>`).join('')}</div>
   ${swapFrom ? `<div class="banner"><span>${tt('اختر لاعب يتبادل مع', 'Pick a player to swap with')} <b>${esc(PM(swapFrom).name)}</b></span><button class="btn btn-g btn-sm" onclick="cancelSwap()">${t('cancel')}</button></div>` : ''}
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px"><span class="tag lime">${formation(P.xi)}</span><span class="tag">${tt('المتوقع', 'xP')} ${projected(P)}</span><span class="tag cyan">${t('bank')} ${P.bank.toFixed(1)}م</span><span class="tag">${t('value')} ${value.toFixed(1)}م</span><span class="tag">${t('ft')} ${P.ft}</span>${hits(P) ? `<span class="tag red">−${hits(P)}</span>` : ''}${P.transfers.length ? `<span class="tag violet">${P.transfers.length} ${tt('انتقال مخطط', 'planned')}</span>` : ''}</div>
   <div class="pitch">${LINES}${rows.map((r) => `<div class="prow">${r.map(card).join('')}</div>`).join('')}</div>
   <div class="benchbox"><div class="t"><span>${I('i-bench', 'i', 'width:16px;height:16px;vertical-align:middle')} ${t('bench')}</span><button class="btn btn-g btn-sm" onclick="autoBench()">${I('i-sparkle', 'i', 'width:14px;height:14px')}${tt('رتّب الدكة', 'Order bench')}</button></div>
    <div class="prow">${P.bench.map((id, i) => `<div class="slot"><small>${i === 0 ? t('gk') : i}</small>${card(id)}</div>`).join('')}</div></div>
   <div class="grid g3" style="margin-top:12px"><button class="btn btn-p" onclick="bestLineup()">${I('i-sparkle')}${tt('التشكيلة المتوقعة', 'Predicted XI')}</button><button class="btn btn-g" onclick="go('market')">${I('i-swap')}${t('transfers')}</button><button class="btn btn-g" onclick="resetPlan()">${I('i-reset')}${tt('الفريق الرسمي', 'Official team')}</button></div>
   ${P.transfers.length ? `<div class="sec"><h2>${I('i-swap')}${tt('انتقالات مخططة', 'Planned transfers')}</h2></div>${P.transfers.map((x, i) => `<div class="row"><div class="mini">${pShirt(PM(x.in))}</div><div class="info"><b><span class="down">${esc(PM(x.out).name)}</span> ← <span class="up">${esc(PM(x.in).name)}</span></b><span>${x.cost ? '−4' : tt('مجاني', 'free')}</span></div><button class="icon-btn" onclick="undoT(${i})">${I('i-x')}</button></div>`).join('')}` : ''}
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:10px">${tt('* = خارج الأرض. التغييرات تنحفظ تلقائياً على جهازك كخطة، والتنفيذ الفعلي بالتطبيق الرسمي (الفانتازي ما يسمح لتطبيقات خارجية تعدّل فريقك).', '* = away. Changes auto-save as a plan; execute them in the official app (FPL does not allow third-party edits).')}</p>`;
}
function pitchTap(id) { if (swapFrom) { const a = swapFrom; swapFrom = null; if (a !== id) doSwap(a, id); return window.render(); } window.openPlayer(id); }
function doSwap(a, b) {
  const P = ST.plan; if (!canSwap(a, b)) return toast(tt('التبديل يكسر قواعد التشكيلة', 'Invalid formation'));
  const ia = P.xi.includes(a), ib = P.xi.includes(b);
  if (!ia && !ib) { const i = P.bench.indexOf(a), j = P.bench.indexOf(b); P.bench[i] = b; P.bench[j] = a; }
  else { const s = ia ? a : b, bn = ia ? b : a; P.xi = P.xi.map((x) => (x === s ? bn : x)); P.bench = P.bench.map((x) => (x === bn ? s : x)); if (P.cap === s) P.cap = bn; if (P.vc === s) P.vc = bn; }
  savePlan(); toast('✓');
}
Object.assign(window, {
  pitchTap,
  setLabel: (m) => { LS.set('fp_label', m); window.render(); },
  setForm: (f) => { const r = bestXIFormation(ST.plan.squad, f); if (!r) return toast(tt('ما يمشي هذا التشكيل بلاعبينك', 'Not possible with your squad')); Object.assign(ST.plan, r); savePlan(); window.render(); toast(f); },
  startSwap: (id) => { window.closeSheet(); swapFrom = id; if (ST.view !== 'team') window.go('team'); else window.render(); },
  cancelSwap: () => { swapFrom = null; window.render(); },
  autoBench: () => { const P = ST.plan; P.bench = [P.bench[0], ...P.bench.slice(1).sort((a, b) => xp(PM(b)) - xp(PM(a)))]; savePlan(); window.render(); toast(tt('✓ رتّبت الدكة حسب المتوقع', '✓ Bench ordered by xP')); },
  bestLineup: () => { Object.assign(ST.plan, bestXI(ST.plan.squad)); savePlan(); window.render(); toast(tt('✓ التشكيلة المتوقعة الأفضل للجولة القادمة', '✓ Best predicted XI')); },
  resetPlan: () => { ST.plan = basePlan(); savePlan(); window.render(); toast(tt('رجعنا للفريق الرسمي', 'Reverted to official team')); },
  undoT: (i) => { const P = ST.plan, x = P.transfers[i]; const rep = (a) => a.map((y) => (y === x.in ? x.out : y)); P.squad = rep(P.squad); P.xi = rep(P.xi); P.bench = rep(P.bench); if (P.cap === x.in) P.cap = x.out; if (P.vc === x.in) P.vc = x.out; P.bank = r1(P.bank - PM(x.out).price + PM(x.in).price); if (!x.cost && P.chip !== 'wildcard' && P.chip !== 'freehit') P.ft++; P.transfers.splice(i, 1); savePlan(); window.render(); },
});

window.syncTeam = async (b) => { if (b) { b.disabled = true; b.textContent = tt('جارِ التحديث…', 'Refreshing…'); } await window.loadAll(true); window.go('team'); };
window.resetToOfficial = () => { try { Object.keys(localStorage).filter((k) => k.startsWith('fp_plan_')).forEach((k) => localStorage.removeItem(k)); } catch {} window.loadAll(true).then(() => window.go('team')); };
