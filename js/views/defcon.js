/* =========================================================
   متتبّع المساهمات الدفاعية (DefCon)
   المدافع: 10 (تشتيت + صد + اعتراض + تاكل) = +2 نقطة
   الوسط/المهاجم: 12 (نفسها + استرجاع الكرة) = +2 نقطة
   الاحتمال تقديري من معدّل اللاعب لكل 90 دقيقة ومعدّل دقائقه
========================================================= */
import { ST, PM, tShort } from '../store.js';
import { tt, t } from '../i18n.js';
import { esc, I } from '../ui.js';
import { pShirt } from './common.js';
import { fixturesFor } from '../engine.js';

export const DC_T = { DEF: 10, MID: 12, FWD: 12 };
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const k = 1 / (1 + 0.3275911 * x); return s * (1 - ((((1.061405429 * k - 1.453152027) * k + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x)); };
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/** دقائق متوقعة للاعب لما يلعب */
const minsPerStart = (p) => (p.starts ? Math.min(90, p.min / Math.max(1, p.starts)) : p.min > 0 ? 70 : 0);
/** احتمال يوصل للحد بالمباراة الوحدة (0..1) — توزيع طبيعي بتشتت أعلى من بواسون */
export function dcProb(p) {
  const T = DC_T[p.pos]; if (!T || !p.dc90) return 0;
  const lam = p.dc90 * (minsPerStart(p) / 90); if (lam <= 0) return 0;
  return Math.max(0, Math.min(0.99, 1 - Phi((T - 0.5 - lam) / Math.sqrt(1.7 * lam))));
}
/** نقاط DefCon المتوقعة لعدة جولات (يحسب الجولات المزدوجة والفارغة) */
export const dcXP = (p, from, n) => { let s = 0; for (let g = from; g < from + n && g <= ST.G.lastGW; g++) s += fixturesFor(p.team, g).length * dcProb(p) * 2; return Math.round(s * 10) / 10; };
const pct = (x) => Math.round(x * 100);
const col = (x) => (x >= 0.5 ? 'var(--acc)' : x >= 0.3 ? 'var(--gold)' : 'var(--mut)');

let tab = 'mine', pos = 'DEF';
function liveDC(id) {
  const G = ST.G; if (!ST.liveRaw || ST.liveRawGW !== G.cur) return null;
  const s = ST.liveRaw.find((e) => e.id === id)?.stats; return s && s.minutes ? s : null;
}
function row(p, i) {
  const pr = dcProb(p), T = DC_T[p.pos], L = liveDC(p.id), xp5 = dcXP(p, ST.G.next || ST.G.cur, 5);
  const live = L && L.defensive_contribution != null ? `<div class="dc-live"><div class="dc-bar"><i style="width:${Math.min(100, (L.defensive_contribution / T) * 100)}%;background:${L.defensive_contribution >= T ? 'var(--acc)' : 'var(--gold)'}"></i></div><span class="num" dir="ltr">${L.defensive_contribution}/${T}</span>${L.defensive_contribution >= T ? '<b class="up" style="font-size:11.5px">+2 ✓</b>' : ''}</div>` : '';
  return `<div class="row tap dc-row" style="--d:${i * 25}ms" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div>
   <div class="info"><b>${esc(p.name)}</b><span>${tShort(p.team)} · ${t(p.pos.toLowerCase())} · ${p.price.toFixed(1)}م · <span class="num">${p.dc90.toFixed(1)}</span> ${tt('بالمباراة', '/90')}</span>${live}</div>
   <div class="dc-ring" style="--p:${pct(pr)};--c:${col(pr)}"><b class="num">${pct(pr)}<small>%</small></b></div>
   <div class="col" style="min-width:44px"><span class="num" style="color:var(--acc);font-weight:700">${xp5}</span><small>${tt('نقاط/5', 'pts/5')}</small></div></div>`;
}

export function vDefcon() {
  const G = ST.G, has = G.players.some((p) => p.dc90 > 0);
  const head = `<div class="card dc-hero"><div class="flex" style="gap:12px;align-items:center"><div class="pbig" style="background:rgba(52,211,153,.14);color:var(--acc)">${I('i-shield', 'i', 'width:22px;height:22px')}</div><div style="flex:1"><b style="font-size:15px">${tt('المساهمات الدفاعية', 'Defensive contributions')}</b><div class="mut" style="font-size:12.5px;line-height:1.7">${tt('<b>المدافع</b>: 10 (تشتيت، صد، اعتراض، تاكل) = <b class="up">+2</b> · <b>الوسط والمهاجم</b>: 12 (ونفسها + استرجاع الكرة) = <b class="up">+2</b>', '<b>DEF</b>: 10 CBIT = <b class="up">+2</b> · <b>MID/FWD</b>: 12 CBIRT = <b class="up">+2</b>')}</div></div></div></div>`;
  if (!has) return head + `<div class="empty">${I('i-shield', 'i', 'width:40px;height:40px')}<b>${tt('بيانات المساهمات الدفاعية مو متوفرة حالياً', 'No defensive data yet')}</b></div>`;
  const tabs = `<div class="seg" style="margin-top:12px"><button class="${tab === 'mine' ? 'on' : ''}" onclick="dcTab('mine')">${tt('فريقي', 'My team')}</button><button class="${tab === 'top' ? 'on' : ''}" onclick="dcTab('top')">${tt('الأفضل', 'Leaders')}</button><button class="${tab === 'value' ? 'on' : ''}" onclick="dcTab('value')">${tt('رخيص ومفيد', 'Value')}</button></div>`;
  let L;
  if (tab === 'mine') {
    const sq = ST.plan ? [...ST.plan.xi, ...ST.plan.bench] : [];
    L = sq.map(PM).filter((p) => p && p.pos !== 'GK').sort((a, b) => dcProb(b) - dcProb(a));
    const tot = L.filter((p) => ST.plan.xi.includes(p.id)).reduce((a, p) => a + dcXP(p, G.next || G.cur, 1), 0);
    return head + tabs + `<div class="card" style="margin-top:10px;display:flex;gap:10px;align-items:center"><span class="mut" style="flex:1;font-size:13px">${tt('نقاط DefCon المتوقعة لتشكيلتك الأساسية بالجولة الجاية', 'Expected DefCon pts for your XI next GW')}</span><b class="big-num count" data-v="${tot.toFixed(1)}" style="font-size:24px">${tot.toFixed(1)}</b></div>
      <div class="list" style="margin-top:10px">${L.map(row).join('')}</div>${foot()}`;
  }
  const posSeg = `<div class="chips2" style="margin-top:10px">${['DEF', 'MID', 'FWD'].map((k) => `<button class="${pos === k ? 'on' : ''}" onclick="dcPos('${k}')">${t(k.toLowerCase())}</button>`).join('')}</div>`;
  L = G.players.filter((p) => p.pos === pos && p.st !== 'u' && p.min >= 180 && (tab !== 'value' || p.price <= (pos === 'DEF' ? 5 : 6)));
  L.sort(tab === 'value' ? (a, b) => dcXP(b, G.next || G.cur, 5) / b.price - dcXP(a, G.next || G.cur, 5) / a.price : (a, b) => dcProb(b) - dcProb(a));
  return head + tabs + posSeg + `<div class="list" style="margin-top:10px">${L.slice(0, 25).map(row).join('')}</div>${foot()}`;
}
const foot = () => `<p class="mut" style="font-size:11.5px;margin:12px 4px;line-height:1.7">${I('i-info', 'i', 'width:13px;height:13px;vertical-align:-2px')} ${tt('النسبة = احتمال يوصل للحد بالمباراة (تقديري من معدّله لكل 90 دقيقة ودقائق لعبه). «نقاط/5» = نقاط DefCon المتوقعة بالخمس جولات الجاية مع حساب الجولات المزدوجة. أثناء المباريات يطلع العدّاد المباشر تحت اسم اللاعب.', 'Probability of reaching the threshold per match (estimated). pts/5 = expected DefCon points over the next 5 GWs.')}</p>`;
Object.assign(window, {
  dcTab: (k) => { tab = k; window.render(); },
  dcPos: (k) => { pos = k; window.render(); },
});
