/* =========================================================
   مسددين الجزاء والكرات الثابتة — من الترتيب الرسمي للفانتازي
   (penalties_order · corners_and_indirect_freekicks_order · direct_freekicks_order)
   + ملاحظات الفانتازي الرسمية لكل فريق
========================================================= */
import { ST, PM, tName, tShort } from '../store.js';
import { tt } from '../i18n.js';
import { esc, I, crest } from '../ui.js';
import * as FPL from '../fpl.js';
import { pShirt } from './common.js';

let notes = null, notesBusy = false, mode = 'teams', onlyMine = false;
const KINDS = [['pen', tt('ضربات الجزاء', 'Penalties'), '🎯'], ['cor', tt('الركنيات والفاولات غير المباشرة', 'Corners & indirect FKs'), '🚩'], ['dfk', tt('الفاولات المباشرة', 'Direct free kicks'), '⚡']];
const ORD = (n) => (n === 1 ? tt('الأول', '1st') : n === 2 ? tt('الثاني', '2nd') : n === 3 ? tt('الثالث', '3rd') : `#${n}`);

/** شارات اللاعب (تنعرض بصفحة اللاعب) */
export function spBadges(p) {
  const out = [];
  if (p.pen) out.push(`<span class="tag sp-tag ${p.pen === 1 ? 'one' : ''}">🎯 ${tt('الجزاء', 'Pens')} ${ORD(p.pen)}</span>`);
  if (p.cor) out.push(`<span class="tag sp-tag ${p.cor === 1 ? 'one' : ''}">🚩 ${tt('الركنيات', 'Corners')} ${ORD(p.cor)}</span>`);
  if (p.dfk) out.push(`<span class="tag sp-tag ${p.dfk === 1 ? 'one' : ''}">⚡ ${tt('الفاولات', 'FKs')} ${ORD(p.dfk)}</span>`);
  return out.join('');
}
async function loadNotes() {
  if (notesBusy || notes) return; notesBusy = true;
  try { const d = await FPL.loadSetPieceNotes(); notes = Object.fromEntries((d.teams || []).map((t) => [t.id, (t.notes || []).map((n) => n.info_message).filter(Boolean)])); notes.__at = d.last_updated; }
  catch { notes = {}; }
  notesBusy = false; if (ST.view === 'setpieces') window.render();
}
const takers = (team, k) => ST.G.players.filter((p) => p.team === team && p[k]).sort((a, b) => a[k] - b[k]);
const chip = (p, k) => `<button class="sp-p ${p[k] === 1 ? 'one' : ''} ${ST.plan?.squad.includes(p.id) ? 'mine' : ''}" onclick="openPlayer(${p.id})"><span class="mini-sh">${pShirt(p)}</span><span>${esc(p.name)}</span><small>${p[k]}</small></button>`;

export function vSetpieces() {
  const G = ST.G, has = G.players.some((p) => p.pen || p.cor || p.dfk);
  if (!notes) loadNotes();
  const head = `<div class="card sp-hero"><div class="flex" style="gap:12px;align-items:center"><div class="pbig" style="background:rgba(251,191,36,.14);color:var(--gold);font-size:22px">🎯</div><div style="flex:1"><b style="font-size:15px">${tt('مسددين الجزاء والكرات الثابتة', 'Set-piece takers')}</b><div class="mut" style="font-size:12px;line-height:1.6">${tt('الترتيب الرسمي من موقع الفانتازي — رقم 1 هو المسدد الأساسي', 'Official FPL order — 1 is the first-choice taker')}</div></div></div>
    <div class="seg" style="margin-top:12px"><button class="${mode === 'teams' ? 'on' : ''}" onclick="spMode('teams')">${tt('حسب الفريق', 'By team')}</button><button class="${mode === 'pen' ? 'on' : ''}" onclick="spMode('pen')">🎯 ${tt('الجزاء', 'Pens')}</button><button class="${mode === 'mine' ? 'on' : ''}" onclick="spMode('mine')">${tt('فريقي', 'My team')}</button></div></div>`;
  if (!has) return head + `<div class="empty">${I('i-info', 'i', 'width:40px;height:40px')}<b>${tt('الفانتازي ما نشر ترتيب المسددين حالياً', 'No set-piece data yet')}</b></div>`;
  if (mode === 'mine') {
    const sq = (ST.plan?.squad || []).map(PM).filter((p) => p && (p.pen || p.cor || p.dfk));
    const teams = [...new Set((ST.plan?.squad || []).map((id) => PM(id)?.team))];
    const missing = teams.map((tm) => takers(tm, 'pen')[0]).filter((p) => p && !ST.plan.squad.includes(p.id));
    return head + `<div class="sec"><h2>${I('i-check')}${tt('لاعبينك اللي يسددون', 'Your set-piece takers')}</h2></div>
      <div class="list">${sq.map((p) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${tShort(p.team)}</span><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${spBadges(p)}</div></div></div>`).join('') || `<div class="empty" style="padding:20px"><b>${tt('ماكو أحد بفريقك يسدد جزاء أو كرات ثابتة', 'None of your players take set pieces')}</b></div>`}</div>
      ${missing.length ? `<div class="sec"><h2>${I('i-info')}${tt('مسددين جزاء بفرق لاعبينك وما عندك', 'Penalty takers at your clubs you don’t own')}</h2></div><div class="list">${missing.map((p) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${tShort(p.team)} · ${p.price.toFixed(1)}م · ${tt('يمتلكه', 'owned')} ${p.own}%</span></div><span class="tag sp-tag one">🎯 ${ORD(1)}</span></div>`).join('')}</div>` : ''}`;
  }
  if (mode === 'pen') {
    const L = G.players.filter((p) => p.pen === 1).sort((a, b) => b.own - a.own);
    return head + `<div class="list" style="margin-top:12px">${L.map((p) => { const b = takers(p.team, 'pen')[1]; return `<div class="row tap" onclick="openPlayer(${p.id})">${crest(tShort(p.team), 28)}<div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${tName(p.team)} · ${p.price.toFixed(1)}م${b ? ` · ${tt('البديل', 'backup')}: ${esc(b.name)}` : ''}</span></div><div class="col"><span class="num">${p.own}%</span><small>${tt('امتلاك', 'owned')}</small></div></div>`; }).join('')}</div>`;
  }
  const teams = Object.values(G.teams).sort((a, b) => a.name.localeCompare(b.name));
  return head + `<div class="sp-grid">${teams.map((tm) => { const n = notes?.[tm.id] || [];
    return `<div class="card sp-team"><div class="flex" style="gap:8px;align-items:center;margin-bottom:8px">${crest(tm.short, 26)}<b style="font-size:14px">${tName(tm.id)}</b></div>
      ${KINDS.map(([k, l, ic]) => { const L = takers(tm.id, k); return `<div class="sp-k"><span class="sp-l">${ic} ${l}</span><div class="sp-ps">${L.length ? L.slice(0, 3).map((p) => chip(p, k)).join('') : '<span class="mut" style="font-size:12px">—</span>'}</div></div>`; }).join('')}
      ${n.length ? `<details class="sp-notes"><summary>${tt('ملاحظات الفانتازي الرسمية', 'Official FPL notes')}</summary>${n.map((x) => `<p dir="ltr">${esc(x)}</p>`).join('')}</details>` : ''}</div>`; }).join('')}</div>
   <p class="mut" style="font-size:11px;text-align:center;margin:12px">${tt('المصدر: موقع الفانتازي الرسمي. اللاعب المؤطر بالأخضر موجود بفريقك.', 'Source: official FPL. Green outline = in your team.')}</p>`;
}
Object.assign(window, { spMode: (m) => { mode = m; window.render(); } });
