/* سوق الانتقالات: الميزانية + بيع لاعب بخطوتين + بدائل ذكية بفلاتر + اقتراحات + المراقبة */
import { ST, PM, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, r1, fmt, toast } from '../ui.js';
import { xpN, xp, avail, canBuy, suggestions, avgFdr, fixturesFor } from '../engine.js';
import { pricePredict } from '../predict.js';
import { pShirt, stTag } from './common.js';
import { parseQuery } from '../ai.js';

let sellId = null, tab = 'sell', sort = 'gain', diffOnly = false, q = '', H = 5;
const POS_AR = () => ({ GK: t('gk'), DEF: t('def'), MID: t('mid'), FWD: t('fwd') });

/* شريط صعوبة المباريات الثلاث الجاية */
function heat(p, n = 3) {
  const G = ST.G; return `<span class="heat3">${Array.from({ length: n }, (_, i) => G.next + i).filter((g) => g <= G.lastGW).map((g) => { const f = fixturesFor(p.team, g); return f.length ? `<i class="f${Math.round(f.reduce((a, x) => a + x.fdr, 0) / f.length)}" title="GW${g} ${f.map((x) => tShort(x.opp)).join('+')}">${f.length > 1 ? '×2' : tShort(f[0].opp)}</i>` : '<i class="bl">—</i>'; }).join('')}</span>`;
}
const trend = (p) => { const r = pricePredict(p); return r.prog >= 70 ? `<span class="up" title="${tt('سعره ممكن يصعد', 'May rise')}">▲</span>` : r.prog <= -70 ? `<span class="down" title="${tt('سعره ممكن ينزل', 'May fall')}">▼</span>` : ''; };

function budgetHero(P) {
  const value = r1(P.squad.reduce((a, id) => a + PM(id).price, 0)), hit = P.transfers.reduce((a, x) => a + x.cost, 0);
  return `<section class="mk-hero">
    <div class="flex between" style="align-items:flex-end"><div><div class="mut" style="font-size:12.5px">${t('bank')}</div><div class="big-num" style="font-size:38px">${P.bank.toFixed(1)}<span class="mut" style="font-size:15px"> ${tt('مليون', 'm')}</span></div></div>
      <div class="mk-ft"><b class="num">${P.ft}</b><span>${tt('انتقال مجاني', 'free transfer')}${P.ft === 1 ? '' : tt('ات', 's')}</span></div></div>
    <div class="tstrip"><div><small>${t('value')}</small><b>${value.toFixed(1)}</b></div><div><small>${tt('مسجّلة', 'Recorded')}</small><b>${P.transfers.length}</b></div><div><small>${tt('خصم', 'Hits')}</small><b class="${hit ? 'down' : ''}">${hit ? '−' + hit : '0'}</b></div><div><small>${tt('الإغلاق', 'Deadline')}</small><b style="font-size:12.5px">${ST.G.deadline ? new Date(ST.G.deadline).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—'}</b></div></div>
  </section>
  ${P.transfers.length ? `<div class="list" style="margin-top:10px">${P.transfers.map((x, i) => `<div class="row"><div class="flex" style="gap:6px;flex:1;min-width:0"><div class="mini-sh">${pShirt(PM(x.out))}</div><span class="down" style="font-weight:600;font-size:13.5px">${esc(PM(x.out).name)}</span>${I('i-arrow', 'i', 'width:16px;height:16px;color:var(--mut)')}<div class="mini-sh">${pShirt(PM(x.in))}</div><span class="up" style="font-weight:600;font-size:13.5px">${esc(PM(x.in).name)}</span></div><span class="tag ${x.cost ? 'red' : 'lime'}">${x.cost ? '−4' : tt('مجاني', 'free')}</span><button class="icon-btn" style="width:34px;height:34px" onclick="undoT(${i})" aria-label="undo">${I('i-x', 'i', 'width:15px;height:15px')}</button></div>`).join('')}</div>` : ''}`;
}

/* الخطوة 1: اختيار لاعب للبيع — مرتب حسب المركز، مع تمييز المرشح للبيع */
function sellPicker(P) {
  const gw = ST.G.next;
  return ['GK', 'DEF', 'MID', 'FWD'].map((pos) => {
    const L = P.squad.map(PM).filter((p) => p.pos === pos).sort((a, b) => xpN(a, gw, H) - xpN(b, gw, H));
    const weakest = L.length > 1 ? L[0].id : null;
    return `<div class="mk-pos"><div class="mk-pos-h"><span class="pos ${pos}">${pos}</span>${POS_AR()[pos]}<span class="mut" style="font-size:12px;margin-inline-start:auto">${L.length}</span></div>
     <div class="list">${L.map((p) => `<button class="row tap mk-row" onclick="sellPick(${p.id})" style="width:100%;text-align:start"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${stTag(p)} ${p.id === weakest ? `<span class="tag amber">${tt('مرشح للبيع', 'Sell candidate')}</span>` : ''}</b><span>${tShort(p.team)} · ${p.price.toFixed(1)}م ${trend(p)}</span></div>${heat(p)}<div class="col" style="color:var(--acc)">${xpN(p, gw, H)}<small>xP/${H}</small></div></button>`).join('')}</div></div>`;
  }).join('');
}

/* الخطوة 2: البدائل */
function replacements(P) {
  const o = PM(sellId), gw = ST.G.next, budget = r1(P.bank + o.price), oxp = xpN(o, gw, H);
  const pq = q.trim() ? new Set((parseQuery(q)?.players || []).map((p) => p.id)) : null;
  let L = ST.G.players.filter((c) => c.pos === o.pos && !P.squad.includes(c.id) && c.st !== 'u' && (!diffOnly || c.own < 10) && (!pq || pq.has(c.id) || c.name.toLowerCase().includes(q.toLowerCase())))
    .map((c) => ({ c, g: r1(xpN(c, gw, H) - oxp), e: canBuy(P, sellId, c.id) }));
  const key = { gain: (x) => x.g, price: (x) => -x.c.price, form: (x) => +x.c.form, own: (x) => x.c.own, fix: (x) => -avgFdr(x.c.team, gw, H) }[sort];
  L.sort((a, b) => (!!a.e - !!b.e) || key(b) - key(a));
  const ok = L.filter((x) => !x.e).slice(0, 30), blocked = L.filter((x) => x.e).slice(0, 8);
  const SORTS = [['gain', tt('المكسب', 'Gain'), 'i-up'], ['fix', tt('أسهل مباريات', 'Fixtures'), 'i-cal'], ['form', t('form'), 'i-activity'], ['price', tt('الأرخص', 'Cheapest'), 'i-coin'], ['own', tt('الملكية', 'Owned'), 'i-users']];
  const row = ({ c, g, e }) => `<div class="row tap mk-row ${e ? 'blocked' : ''}" onclick="openPlayer(${c.id})"><div class="mini">${pShirt(c)}</div><div class="info"><b>${esc(c.name)} ${stTag(c)} ${c.own < 10 ? `<span class="tag violet" title="${tt('ملكية قليلة', 'Low ownership')}">${c.own}%</span>` : ''}</b><span>${tShort(c.team)} · ${c.price.toFixed(1)}م ${trend(c)}${e ? ` · <em class="mk-why">${esc(e)}</em>` : ''}</span></div>${heat(c)}<div class="mk-gain ${g >= 0 ? 'pos' : 'neg'}"><b>${g > 0 ? '+' : ''}${g}</b><small>xP</small></div>${e ? '' : `<button class="btn btn-p btn-sm mk-buy" onclick="event.stopPropagation();confirmT(${sellId},${c.id})" aria-label="pick">${I('i-plus', 'i', 'width:16px;height:16px')}</button>`}</div>`;
  return `<div class="mk-out"><div class="mini" style="width:46px;height:46px">${pShirt(o)}</div><div style="flex:1;min-width:0"><div class="mut" style="font-size:12px">${tt('تبيع', 'Selling')}</div><b style="font-size:16px">${esc(o.name)}</b><div class="mut" style="font-size:12px">${tShort(o.team)} · ${o.price.toFixed(1)}م · ${oxp} xP/${H}</div></div><div style="text-align:end"><div class="mut" style="font-size:11.5px">${tt('ميزانيتك', 'Budget')}</div><b class="big-num" style="font-size:22px">${budget.toFixed(1)}</b></div><button class="icon-btn" onclick="sellPick(null)" aria-label="close">${I('i-x')}</button></div>
   <div class="searchbox" style="margin:10px 0 8px"><span class="sicon">${I('i-search')}</span><input id="mkq" value="${esc(q)}" placeholder="${tt('ابحث عن بديل بالاسم…', 'Search a replacement…')}" autocomplete="off"></div>
   <div class="seg" style="margin-bottom:6px">${SORTS.map(([k, l, ic]) => `<button class="${sort === k ? 'on' : ''}" onclick="mkSort('${k}')">${I(ic, 'i', 'width:14px;height:14px')}${l}</button>`).join('')}</div>
   <div class="flex between wrap" style="gap:8px;margin-bottom:10px"><div class="seg">${[3, 5, 8].map((h) => `<button class="${H === h ? 'on' : ''}" onclick="mkH(${h})">${h} ${tt('جولات', 'GWs')}</button>`).join('')}</div><button class="chip-tog ${diffOnly ? 'on' : ''}" onclick="mkDiff()">${I('i-target', 'i', 'width:14px;height:14px')}${tt('مفاجآت فقط (<10%)', 'Differentials only')}</button></div>
   <div id="mkList">${ok.length ? `<div class="list">${ok.map(row).join('')}</div>` : `<div class="empty">${I('i-search', 'i', 'width:34px;height:34px')}<b>${tt('ما في بدائل بهالفلتر', 'No replacements match')}</b></div>`}
   ${blocked.length ? `<div class="sec"><h2 style="font-size:13.5px;color:var(--mut)">${I('i-alert')}${tt('أفضل منهم بس ما يمشون حالياً', 'Better but not possible now')}</h2></div><div class="list">${blocked.map(row).join('')}</div>` : ''}</div>`;
}

function suggest(P) {
  const s = suggestions(P, 8), gw = ST.G.next;
  if (!s.length) return `<div class="empty">${I('i-check', 'i', 'width:36px;height:36px;color:var(--acc)')}<b>${tt('فريقك متوازن', 'Your squad is balanced')}</b><p>${tt('ما في انتقال يرفع متوقعك بشكل واضح. فكّر تحتفظ بالانتقال للجولة الجاية.', 'No clear upgrade — consider rolling your transfer.')}</p></div>`;
  return `<div class="stack">${s.map((x, i) => `<div class="mk-sug" style="--d:${i * 50}ms">
    <div class="mk-side"><div class="mini-sh">${pShirt(x.o)}</div><div><b class="down">${esc(x.o.name)}</b><div class="mut">${x.o.price.toFixed(1)}م</div>${heat(x.o)}</div></div>
    <div class="mk-mid"><span class="mk-badge">+${x.g}</span><small class="mut">xP/3</small>${I('i-arrow', 'i', 'width:18px;height:18px;color:var(--mut)')}</div>
    <div class="mk-side"><div class="mini-sh">${pShirt(x.c)}</div><div><b class="up">${esc(x.c.name)}</b><div class="mut">${x.c.price.toFixed(1)}م ${trend(x.c)}</div>${heat(x.c)}</div></div>
    <div class="mk-acts"><button class="btn btn-p btn-sm" onclick="confirmT(${x.o.id},${x.c.id})">${tt('أضف للخطة', 'Add')}</button><button class="btn btn-g btn-sm" onclick="labPreset(${x.o.id},${x.c.id})">${I('i-lab', 'i', 'width:14px;height:14px')}${tt('حلّل', 'Analyse')}</button></div>
   </div>`).join('')}</div>`;
}

function watch(P) {
  const gw = ST.G.next, L = [...ST.watch].map(PM).filter(Boolean).filter((p) => !P.squad.includes(p.id));
  if (!L.length) return `<div class="empty">${I('i-star', 'i', 'width:36px;height:36px')}<b>${tt('قائمة المراقبة فارغة', 'Watchlist empty')}</b><p>${tt('افتح أي لاعب واضغط النجمة حتى يطلع هنا مع سعره ومبارياته.', 'Open any player and tap the star to track him here.')}</p></div>`;
  return `<div class="list">${L.map((p) => `<div class="row tap mk-row" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${stTag(p)}</b><span>${tShort(p.team)} · ${p.price.toFixed(1)}م ${trend(p)} · ${p.own}%</span></div>${heat(p)}<div class="col" style="color:var(--acc)">${xpN(p, gw, 5)}<small>xP/5</small></div><button class="btn btn-p btn-sm mk-buy" onclick="event.stopPropagation();buyFlow(${p.id})" aria-label="buy">${I('i-plus', 'i', 'width:16px;height:16px')}</button></div>`).join('')}</div>`;
}

export function vMarket() {
  const P = ST.plan; if (!P) return `<div class="empty">${t('noData')}</div>`;
  if (sellId && !P.squad.includes(sellId)) sellId = null;
  const TABS = [['sell', tt('بيع وشراء', 'Sell & buy'), 'i-swap'], ['sugg', tt('اقتراحات', 'Suggestions'), 'i-sparkle'], ['watch', tt('المراقبة', 'Watchlist'), 'i-star']];
  let body;
  if (tab === 'sell') body = sellId ? replacements(P) : `<div class="mk-step">${I('i-info', 'i', 'width:16px;height:16px;color:var(--info)')}<span>${tt('اختار اللاعب اللي تريد تبيعه، وبعدها نطلعلك أفضل البدائل ضمن ميزانيتك.', 'Pick the player to sell, then we show the best replacements in budget.')}</span></div>${sellPicker(P)}`;
  else if (tab === 'sugg') body = suggest(P);
  else body = watch(P);
  return `${budgetHero(P)}
   <div class="tabs2" style="margin-top:12px">${TABS.map(([k, l, ic]) => `<button class="${tab === k ? 'on' : ''}" onclick="mkTab('${k}')">${I(ic, 'i', 'width:15px;height:15px;vertical-align:-3px')} ${l}${k === 'watch' && ST.watch.size ? ` <span class="tag" style="padding:0 6px">${ST.watch.size}</span>` : ''}</button>`).join('')}</div>
   ${body}
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:12px">${tt('الانتقالات تنحفظ كخطة على جهازك، ونفّذها بتطبيق الفانتازي. سعر البيع الفعلي ممكن يختلف شوية عن السعر الحالي.', 'Transfers save as a plan; execute in the FPL app. Actual sell price may differ slightly.')}</p>`;
}
let qt;
export function afterMarket() {
  const i = document.getElementById('mkq'); if (!i) return;
  i.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { q = i.value; const tmp = document.createElement('div'); tmp.innerHTML = replacements(ST.plan); const n = tmp.querySelector('#mkList'), o = document.getElementById('mkList'); if (n && o) o.innerHTML = n.innerHTML; }, 150); };
}
Object.assign(window, {
  sellPick: (id) => { sellId = id; q = ''; tab = 'sell'; window.render(); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  sellFlow: (id) => { window.closeSheet(); sellId = id; q = ''; tab = 'sell'; window.go('market'); },
  mkTab: (k) => { tab = k; window.render(); },
  mkSort: (k) => { sort = k; window.render(); },
  mkH: (h) => { H = h; window.render(); },
  mkDiff: () => { diffOnly = !diffOnly; window.render(); },
});
const prevHook = window.__backHook;
window.__backHook = () => { if (ST.view === 'market' && sellId) { sellId = null; window.render(); return true; } return prevHook ? prevHook() : false; };
