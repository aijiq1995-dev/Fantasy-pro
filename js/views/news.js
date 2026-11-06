/* =========================================================
   مركز الأخبار والتنبيهات — أخبار حقيقية أول بأول (مو تحليلات)
   • الأخبار الرسمية من الفانتازي: إصابة / إيقاف / احتمال المشاركة + وقت الخبر
   • أخبار الدوري من BBC Sport و The Guardian و Sky Sports: إصابات، إيقافات، تصريحات المدربين، أخبار الفرق
   يتحدث تلقائياً كل دقيقتين والصفحة مفتوحة
========================================================= */
import { ST, PM } from '../store.js';
import { tt } from '../i18n.js';
import { esc, I, LS, timeAgo } from '../ui.js';
import { pShirt } from './common.js';

let D = null, loading = false, err = '', tab = 'all', timer = 0, lastFetch = 0;
let F = null, fLoading = false, fErr = '', mode = 'fpl', ftab = 'all', fLast = 0;
const SEEN_K = 'fp_news_seen';
let seenAt = LS.get(SEEN_K, 0);

async function load(force = false) {
  if (loading || (!force && Date.now() - lastFetch < 60e3 && D)) return;
  loading = true;
  try { const r = await fetch('/api/news', { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); D = d; err = ''; lastFetch = Date.now(); }
  catch (e) { err = e.message || 'خطأ'; }
  loading = false;
  if (ST.view === 'news') window.render();
}
async function loadF(force = false) {
  if (fLoading || (!force && Date.now() - fLast < 30e3 && F)) return;
  fLoading = true;
  try { const r = await fetch('/api/news?src=fpl', { cache: 'no-store' }); const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); F = d; fErr = ''; fLast = Date.now(); }
  catch (e) { fErr = e.message || 'خطأ'; }
  fLoading = false;
  if (ST.view === 'news') window.render();
}
export function afterNews() {
  clearInterval(timer);
  let n = 0; timer = setInterval(() => { if (ST.view !== 'news') return clearInterval(timer); if (document.visibilityState !== 'visible') return; n++; loadF(true); if (n % 2 === 0) load(true); }, 60e3);
  setTimeout(() => { seenAt = Date.now(); LS.set(SEEN_K, seenAt); }, 4000);
}
/** عدد الأخبار الجديدة عن لاعبيني (للشارة) */
export const newsUnseenMine = () => (F ? (F.fpl || []).filter((x) => x.at > seenAt && ST.plan && [...ST.plan.xi, ...ST.plan.bench].includes(x.id)).length : 0);

const ST_INFO = {
  i: [tt('مصاب', 'Injured'), 'var(--bad)', 'i-alert'], s: [tt('موقوف', 'Suspended'), 'var(--bad)', 'i-x'], d: [tt('مشكوك', 'Doubtful'), 'var(--gold)', 'i-alert'],
  u: [tt('غير متاح', 'Unavailable'), 'var(--mut)', 'i-x'], n: [tt('غير مؤهل', 'Not eligible'), 'var(--mut)', 'i-x'], a: [tt('جاهز', 'Available'), 'var(--acc)', 'i-check'],
};
const CAT_INFO = { injury: [tt('إصابات', 'Injury'), '#F59E0B'], ban: [tt('إيقاف', 'Suspension'), '#EF4444'], press: [tt('تصريحات', 'Press'), '#60A5FA'], team: [tt('أخبار الفريق', 'Team news'), '#34D399'], other: [tt('أخبار', 'News'), '#94A3B8'] };

function items() {
  const sq = new Set(ST.plan ? [...ST.plan.xi, ...ST.plan.bench] : []), watch = ST.watch || new Set();
  const b = (D.feed || []).map((x) => ({ k: x.link, type: 'feed', at: x.at, cat: x.cat, mine: (x.players || []).some((id) => sq.has(id)), watch: (x.players || []).some((id) => watch.has(id)), x }));
  return b.sort((p, q) => q.at - p.at);
}
function dayLabel(t) {
  const d = new Date(t), now = new Date(), y = new Date(now - 864e5);
  if (d.toDateString() === now.toDateString()) return tt('اليوم', 'Today');
  if (d.toDateString() === y.toDateString()) return tt('أمس', 'Yesterday');
  return d.toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' });
}
function fplCard(it, i) {
  const x = it.x, p = PM(x.id), S = ST_INFO[x.st] || ST_INFO.d, isNew = it.at > seenAt;
  return `<div class="nw-card ${it.mine ? 'mine' : ''}" style="--d:${Math.min(i, 12) * 30}ms" onclick="openPlayer(${x.id})">
   <div class="nw-ic">${p ? `<div class="mini-sh">${pShirt(p)}</div>` : I('i-user')}</div>
   <div class="nw-body"><div class="nw-top"><b>${esc(p?.name || x.name)}</b><span class="mut">${esc(x.team)}</span><span class="nw-st" style="--c:${S[1]}">${I(S[2], 'i', 'width:12px;height:12px')}${S[0]}${x.st === 'd' && x.chance != null ? ` ${x.chance}%` : ''}</span>${it.mine ? `<span class="tag lime" style="font-size:10.5px">${tt('بفريقك', 'Yours')}</span>` : it.watch ? `<span class="tag" style="font-size:10.5px">⭐</span>` : ''}${isNew ? '<i class="nw-new"></i>' : ''}</div>
    <div class="nw-txt">${esc(x.newsAr || x.news)}</div>${x.newsAr && x.newsAr !== x.news ? `<div class="nw-orig" dir="ltr">${esc(x.news)}</div>` : ''}
    <div class="nw-meta">${I('i-shield', 'i', 'width:12px;height:12px')} ${tt('الفانتازي الرسمي', 'Official FPL')} · ${timeAgo(x.at)}${x.own >= 5 ? ` · ${tt('يمتلكه', 'owned')} ${x.own}%` : ''}</div></div></div>`;
}
function feedCard(it, i) {
  const x = it.x, C = CAT_INFO[x.cat] || CAT_INFO.other, isNew = it.at > seenAt;
  const ps = (x.players || []).map(PM).filter(Boolean).slice(0, 3);
  return `<div class="nw-card ${it.mine ? 'mine' : ''}" style="--d:${Math.min(i, 12) * 30}ms">
   <div class="nw-ic" style="background:${C[1]}22;color:${C[1]}">${I(x.cat === 'press' ? 'i-msg' : x.cat === 'ban' ? 'i-x' : x.cat === 'injury' ? 'i-alert' : 'i-news', 'i', 'width:18px;height:18px')}</div>
   <div class="nw-body"><div class="nw-top"><span class="nw-cat" style="--c:${C[1]}">${C[0]}</span><span class="mut" style="font-size:11.5px">${esc(x.src)}</span>${it.mine ? `<span class="tag lime" style="font-size:10.5px">${tt('بفريقك', 'Yours')}</span>` : ''}${isNew ? '<i class="nw-new"></i>' : ''}</div>
    <a class="nw-title" dir="auto" href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.titleAr || x.title)}</a>
    ${x.descAr || x.desc ? `<div class="nw-txt mut" dir="auto" style="font-size:12.5px">${esc(x.descAr || x.desc)}</div>` : ''}
    ${x.titleAr ? `<div class="nw-orig" dir="ltr">${esc(x.title)}</div>` : ''}
    ${ps.length ? `<div class="nw-ps">${ps.map((p) => `<button onclick="event.stopPropagation();openPlayer(${p.id})"><span class="mini-sh">${pShirt(p)}</span>${esc(p.name)}</button>`).join('')}</div>` : ''}
    <div class="nw-meta">${timeAgo(x.at)} · <a href="${esc(x.link)}" target="_blank" rel="noopener" style="color:var(--acc)">${tt('اقرأ الخبر كامل', 'Read full story')} ↗</a></div></div></div>`;
}

export function vNews() {
  if (!F && !fLoading) loadF(true);
  if (mode === 'feed' && !D && !loading) load(true);
  const upd = mode === 'fpl' ? F : D;
  const head = `<div class="card nw-hero"><div class="flex" style="gap:12px;align-items:center"><div class="pbig" style="background:rgba(52,211,153,.14);color:var(--acc)">${I('i-news', 'i', 'width:22px;height:22px')}</div><div style="flex:1"><b style="font-size:15px">${tt('مركز الأخبار', 'News centre')}</b><div class="mut" style="font-size:12px">${upd ? `<span class="nw-live"></span>${tt('يتحدث تلقائياً', 'Auto-updating')} · ${tt('آخر تحديث', 'updated')} ${timeAgo(upd.at)}` : tt('جارِ جلب آخر الأخبار…', 'Fetching latest news…')}</div></div><button class="icon-btn" onclick="newsRefresh(this)" aria-label="refresh">${I('i-refresh')}</button></div>
    <div class="nw-mode"><button class="${mode === 'fpl' ? 'on' : ''}" onclick="newsMode('fpl')">${I('i-shield', 'i', 'width:16px;height:16px')}${tt('الفانتازي الرسمي', 'Official FPL')}${F ? `<small>${(F.fpl || []).length}</small>` : ''}</button><button class="${mode === 'feed' ? 'on' : ''}" onclick="newsMode('feed')">${I('i-news', 'i', 'width:16px;height:16px')}${tt('أخبار الصحف', 'Press & media')}</button></div></div>`;
  return head + (mode === 'fpl' ? fplSection() : feedSection());
}
const skel = () => `<div class="skel" style="height:96px;margin-top:12px"></div><div class="skel" style="height:96px;margin-top:10px"></div><div class="skel" style="height:96px;margin-top:10px"></div>`;
function fplSection() {
  if (!F) return fErr ? `<div class="card mut" style="margin-top:12px">${esc(fErr)} <button class="btn btn-g btn-sm" onclick="newsRefresh(this)">${tt('إعادة المحاولة', 'Retry')}</button></div>` : skel();
  const sq = new Set(ST.plan ? [...ST.plan.xi, ...ST.plan.bench] : []), watch = ST.watch || new Set();
  const all = (F.fpl || []).map((x) => ({ k: 'f' + x.id, type: 'fpl', at: x.at, mine: sq.has(x.id), watch: watch.has(x.id), x }));
  const fm = { all: () => true, mine: (it) => it.mine || it.watch, i: (it) => it.x.st === 'i', d: (it) => it.x.st === 'd', s: (it) => it.x.st === 's', other: (it) => !['i', 'd', 's'].includes(it.x.st) };
  const TABS = [['all', tt('الكل', 'All')], ['mine', tt('فريقي', 'My team')], ['i', tt('مصابين', 'Injured')], ['d', tt('مشكوك بمشاركتهم', 'Doubtful')], ['s', tt('موقوفين', 'Suspended')], ['other', tt('انتقالات وغيرها', 'Other')]];
  const mineFlag = all.filter((it) => it.mine);
  const summary = mineFlag.length ? `<div class="card nw-mine"><b style="font-size:13.5px">${I('i-alert', 'i', 'width:15px;height:15px;vertical-align:-3px;color:var(--gold)')} ${tt(`${mineFlag.length} من لاعبين فريقك عليهم خبر`, `${mineFlag.length} of your players have news`)}</b><div class="nw-ps" style="margin-top:8px">${mineFlag.map((it) => { const S = ST_INFO[it.x.st] || ST_INFO.d; return `<button onclick="openPlayer(${it.x.id})" style="border-color:${S[1]}"><span class="mini-sh">${PM(it.x.id) ? pShirt(PM(it.x.id)) : ''}</span>${esc(PM(it.x.id)?.name || it.x.name)} <b style="color:${S[1]};font-size:11px">${it.x.st === 'd' && it.x.chance != null ? it.x.chance + '%' : S[0]}</b></button>`; }).join('')}</div></div>` : `<div class="card nw-mine ok">${I('i-check', 'i', 'width:15px;height:15px;vertical-align:-3px;color:var(--acc)')} <b style="font-size:13.5px">${tt('كل لاعبين فريقك جاهزين — ماكو أخبار سلبية', 'All your players are fine')}</b></div>`;
  const L = all.filter(fm[ftab] || fm.all);
  let lastDay = '', html = '';
  L.forEach((it, i) => { const dl = dayLabel(it.at); if (dl !== lastDay) { html += `<div class="nw-day">${dl}</div>`; lastDay = dl; } html += fplCard(it, i); });
  return summary + `<div class="seg nw-tabs" style="margin-top:12px">${TABS.map(([k, l]) => `<button class="${ftab === k ? 'on' : ''}" onclick="newsFTab('${k}')">${l}<small>${all.filter(fm[k]).length}</small></button>`).join('')}</div>
   <div class="nw-list">${html || `<div class="empty">${I('i-shield', 'i', 'width:40px;height:40px')}<b>${tt('ماكو أخبار بهالقسم', 'Nothing here')}</b></div>`}</div>
   <p class="mut" style="font-size:11px;text-align:center;margin:14px 6px;line-height:1.7">${tt('المصدر: موقع الفانتازي الرسمي مباشرة (يتحدث كل دقيقة). الوقت = وقت نزول الخبر بالفانتازي.', 'Source: official FPL, refreshed every minute.')}</p>`;
}
function feedSection() {
  if (!D) return err ? `<div class="card mut" style="margin-top:12px">${esc(err)} <button class="btn btn-g btn-sm" onclick="newsRefresh(this)">${tt('إعادة المحاولة', 'Retry')}</button></div>` : skel();
  const all = items();
  const TABS = [['all', tt('الكل', 'All')], ['mine', tt('فريقي', 'My team')], ['injury', tt('إصابات', 'Injuries')], ['ban', tt('إيقافات', 'Bans')], ['press', tt('تصريحات المدربين', 'Press')], ['team', tt('أخبار الفرق', 'Team news')]];
  const L = all.filter((x) => match(x, tab)).slice(0, 120);
  let lastDay = '', html = '';
  L.forEach((it, i) => { const dl = dayLabel(it.at); if (dl !== lastDay) { html += `<div class="nw-day">${dl}</div>`; lastDay = dl; } html += feedCard(it, i); });
  const srcs = (D.sources || []).map(([n, ok]) => `<span style="opacity:${ok ? 1 : 0.45}">${esc(n)}${ok ? '' : ' ✗'}</span>`).join(' · ');
  return `<div class="seg nw-tabs" style="margin-top:12px">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="newsTab('${k}')">${l}<small>${all.filter((x) => match(x, k)).length}</small></button>`).join('')}</div>
   <div class="nw-list">${html || `<div class="empty">${I('i-news', 'i', 'width:40px;height:40px')}<b>${tab === 'mine' ? tt('ما في أخبار جديدة عن لاعبينك', 'No news about your players') : tt('ما في أخبار بهالقسم حالياً', 'Nothing here right now')}</b></div>`}</div>
   <p class="mut" style="font-size:11px;text-align:center;margin:14px 6px;line-height:1.7">${tt('المصادر', 'Sources')}: ${srcs}<br>${tt('العناوين مترجمة آلياً — اضغط على الخبر حتى تقرأه كامل بالمصدر الأصلي.', 'Headlines machine-translated — tap to read at the source.')}</p>`;
}
function match(it, k) {
  if (k === 'all') return true;
  if (k === 'mine') return it.mine || it.watch;
  return it.cat === k;
}
Object.assign(window, {
  newsTab: (k) => { tab = k; window.render(); },
  newsFTab: (k) => { ftab = k; window.render(); },
  newsMode: (m) => { mode = m; window.render(); },
  newsRefresh: (b) => { b?.classList.add('spin'); mode === 'fpl' ? loadF(true) : load(true); },
});
