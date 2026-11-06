/* توقع الأسعار: صعود ونزول محتمل + اللي تغيّر سعرهم هالجولة */
import { ST, PM, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt } from '../ui.js';
import { pricePredict, PRICE_LABEL } from '../predict.js';
import { pShirt } from './common.js';

let tab = 'mine';
export function vPrices() {
  const G = ST.G, mine = new Set([...(ST.plan?.squad || []), ...ST.watch]);
  const all = G.players.filter((p) => p.st !== 'u').map((p) => ({ p, r: pricePredict(p) }));
  let L;
  if (tab === 'mine') L = all.filter((x) => mine.has(x.p.id)).sort((a, b) => Math.abs(b.r.prog) - Math.abs(a.r.prog));
  else if (tab === 'up') L = all.filter((x) => x.r.prog > 30).sort((a, b) => b.r.prog - a.r.prog).slice(0, 40);
  else if (tab === 'down') L = all.filter((x) => x.r.prog < -30).sort((a, b) => a.r.prog - b.r.prog).slice(0, 40);
  else if (tab === 'tin') L = all.slice().sort((a, b) => b.p.tin - a.p.tin).slice(0, 25);
  else if (tab === 'tout') L = all.slice().sort((a, b) => b.p.tout - a.p.tout).slice(0, 25);
  else L = all.filter((x) => x.p.cc).sort((a, b) => b.p.cc - a.p.cc);
  const ups = all.filter((x) => x.r.prog >= 100).length, downs = all.filter((x) => x.r.prog <= -100).length;
  const bar = (v) => { const w = Math.min(100, Math.abs(v)); const c = v >= 100 ? 'var(--good)' : v > 0 ? '#86EFAC' : v <= -100 ? 'var(--bad)' : '#FCA5A5'; return `<div style="display:flex;direction:ltr;height:6px;background:var(--s3);border-radius:99px;overflow:hidden;position:relative;margin-top:6px"><i style="position:absolute;top:0;bottom:0;${v >= 0 ? 'left:50%' : 'right:50%'};width:${w / 2}%;background:${c};border-radius:99px"></i><i style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--line2)"></i></div>`; };
  return `<div class="grid g3"><div class="card stat"><span class="k">${I('i-up', 'i', 'width:15px;height:15px;color:var(--good)')}${tt('متوقع يصعدون', 'Likely risers')}</span><span class="v up">${ups}</span></div><div class="card stat"><span class="k">${I('i-down', 'i', 'width:15px;height:15px;color:var(--bad)')}${tt('متوقع ينزلون', 'Likely fallers')}</span><span class="v down">${downs}</span></div><div class="card stat"><span class="k">${I('i-coin', 'i', 'width:15px;height:15px')}${tt('تغيّروا هالجولة', 'Changed this GW')}</span><span class="v">${all.filter((x) => x.p.cc).length}</span></div></div>
   <div class="seg" style="margin:12px 0">${[['mine', tt('فريقي والمراقبة', 'My team & watchlist')], ['up', tt('الصعود', 'Rises')], ['down', tt('النزول', 'Falls')], ['tin', tt('الأكثر شراءً', 'Most bought')], ['tout', tt('الأكثر بيعاً', 'Most sold')], ['done', tt('تغيّر فعلاً', 'Already changed')]].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="prTab('${k}')">${l}</button>`).join('')}</div>
   ${L.length ? `<div class="list">${L.map(({ p, r }) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${ST.plan?.squad.includes(p.id) ? `<span class="tag lime">${tt('بفريقك', 'Yours')}</span>` : ''}</b><span>${tShort(p.team)} · ${p.price.toFixed(1)}م${p.cc ? ` · <em style="font-style:normal;font-weight:600" class="${p.cc > 0 ? 'up' : 'down'}">${p.cc > 0 ? '+' : ''}${p.cc.toFixed(1)}</em>` : ''} · ${tt('صافي', 'Net')} <span class="num ${r.net >= 0 ? 'up' : 'down'}">${r.net >= 0 ? '+' : ''}${fmt(r.net)}</span></span>${tab === 'done' ? '' : tab === 'tin' || tab === 'tout' ? `<span style="display:block;font-size:12px">${tt('شراء', 'In')} <b class="up num" style="display:inline">${fmt(p.tin)}</b> · ${tt('بيع', 'Out')} <b class="down num" style="display:inline">${fmt(p.tout)}</b></span>` : bar(r.prog)}</div><div class="col" style="min-width:64px"><span class="${r.prog >= 0 ? 'up' : 'down'}">${r.prog > 0 ? '+' : ''}${r.prog}%</span><small>${PRICE_LABEL(r.state, tt)}</small></div></div>`).join('')}</div>` : `<div class="empty">${I('i-coin', 'i', 'width:36px;height:36px')}<b>${t('noData')}</b></div>`}
   <div class="note">${I('i-info', 'i', 'color:var(--info)')}<span>${tt('التوقع تقديري: الفانتازي ما ينشر طريقة تغيير الأسعار. نحسبه من صافي الشراء والبيع بهالجولة مقارنة بعدد مالكي اللاعب، واللاعب المصاب ينزل أسرع. 100% تعني وصل الحد التقريبي. الأسعار تتغير عادة مرة باليوم الصبح بتوقيت بريطانيا.', 'Estimate only: FPL does not publish its price algorithm. Based on this GW\'s net transfers relative to owners; injured players fall faster. 100% = approximate threshold. Prices usually change once daily (UK morning).')}</span></div>`;
}
window.prTab = (k) => { tab = k; window.render(); };
