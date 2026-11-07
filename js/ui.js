/* أدوات الواجهة المشتركة: أيقونات، فانيلات، شعارات، نوافذ، رسوم بيانية */
import { t, tt, lang } from './i18n.js';

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const I = (n, cls = 'i', st = '') => `<svg class="${cls}" style="${st}"><use href="#${n}"/></svg>`;
export const fmt = (n) => (n == null || isNaN(n) ? '—' : Number(n).toLocaleString('en'));
export const r1 = (n) => Math.round(n * 10) / 10;
export const LS = {
  get(k, d = null) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
export function toast(m) { const d = document.createElement('div'); d.className = 'tst'; d.textContent = m; $('#toast').appendChild(d); setTimeout(() => d.remove(), 3200); }
/* الأوراق (sheets) مع زر رجوع: إذا انفتحت ورقة من داخل ورقة ثانية نحفظ السابقة ونرجعلها */
let sheetStack = [], pendingBack = null;
const curSnap = () => { const b = $('#sheetRoot .sh-body'); return b ? { html: b.innerHTML, y: $('#sheetRoot .sheet')?.scrollTop || 0 } : null; };
function renderSheet(html, y = 0) {
  const back = sheetStack.length ? `<button class="sh-back" onclick="sheetBack()" aria-label="back"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg><span>${tt('رجوع', 'Back')}</span></button>` : '';
  $('#sheetRoot').innerHTML = `<div class="ov" onclick="if(event.target===this)closeSheet(true)"><div class="sheet"><div class="grab"></div>${back}<div class="sh-body">${html}</div></div></div>`;
  if (y) { const sh = $('#sheetRoot .sheet'); if (sh) sh.scrollTop = y; }
}
export function openSheet(html, after) {
  const open = !!$('#sheetRoot .sh-body');
  if (!open) { if (pendingBack && Date.now() - pendingBack.t < 900) sheetStack = [...pendingBack.stack, pendingBack.snap]; else sheetStack = []; }
  pendingBack = null;
  renderSheet(html); after && after();
}
export function closeSheet(hard = false) {
  const snap = curSnap();
  pendingBack = !hard && snap ? { snap, stack: sheetStack, t: Date.now() } : null;
  sheetStack = []; $('#sheetRoot').innerHTML = '';
}
export function sheetBack() { const prev = sheetStack.pop(); if (!prev) return closeSheet(true); renderSheet(prev.html, prev.y); }
window.sheetBack = sheetBack;
export const sheetHead = (icon, title, sub = '', bg = 'var(--g1)', fg = '#052E1F') => `<div class="sh-head"><div style="width:46px;height:46px;border-radius:15px;background:${bg};display:grid;place-items:center;color:${fg};flex-shrink:0">${icon}</div><div style="flex:1;min-width:0"><h3>${title}</h3>${sub ? `<div class="mut" style="font-size:12.5px">${sub}</div>` : ''}</div><button class="icon-btn" onclick="closeSheet()">${I('i-x')}</button></div>`;
export const header = (title, sub = '', right = '') => `<div class="sec" style="margin-top:4px"><div><h2 style="font-size:20px">${title}</h2>${sub ? `<div class="mut" style="font-size:12.5px">${sub}</div>` : ''}</div>${right}</div>`;

/* ---------- الأندية: أسماء عربية وألوان ---------- */
export const CLUB_AR = { ARS: 'آرسنال', AVL: 'أستون فيلا', BOU: 'بورنموث', BRE: 'برينتفورد', BHA: 'برايتون', BUR: 'بيرنلي', CHE: 'تشيلسي', COV: 'كوفنتري', CRY: 'كريستال بالاس', EVE: 'إيفرتون', FUL: 'فولهام', HUL: 'هال سيتي', IPS: 'إبسويتش', LEE: 'ليدز', LIV: 'ليفربول', MCI: 'مانشستر سيتي', MUN: 'مانشستر يونايتد', NEW: 'نيوكاسل', NFO: 'نوتنغهام فورست', SUN: 'سندرلاند', TOT: 'توتنهام', WHU: 'وست هام', WOL: 'وولفرهامبتون', LEI: 'ليستر', SOU: 'ساوثهامبتون' };
export const KIT = { ARS: ['#EF0107', '#fff'], AVL: ['#670E36', '#95BFE5'], BOU: ['#DA291C', '#000'], BRE: ['#E30613', '#fff'], BHA: ['#0057B8', '#fff'], BUR: ['#6C1D45', '#99D6EA'], CHE: ['#034694', '#fff'], COV: ['#59CBE8', '#fff'], CRY: ['#1B458F', '#C4122E'], EVE: ['#003399', '#fff'], FUL: ['#f8fafc', '#000'], HUL: ['#F5A12D', '#000'], IPS: ['#3A64A3', '#fff'], LEE: ['#f8fafc', '#1D428A'], LIV: ['#C8102E', '#F6EB61'], MCI: ['#6CABDD', '#fff'], MUN: ['#DA291C', '#FBE122'], NEW: ['#241F20', '#fff'], NFO: ['#DD0000', '#fff'], SUN: ['#EB172B', '#fff'], TOT: ['#f8fafc', '#132257'], WHU: ['#7A263A', '#1BB1E7'], WOL: ['#FDB913', '#231F20'], LEI: ['#003090', '#FDBE11'], SOU: ['#D71920', '#fff'] };
export const clubName = (short, full) => (lang() === 'en' ? (full || short) : CLUB_AR[short] || full || short);
/* أزياء الأندية (تصميم أصلي بألوان كل نادي — بدون شعارات):
   b = لون القميص، s = لون الأكمام، t = لون الحواف والكتابة، p = النقشة (stripes/hoops/pin/halves/sash)، p2 = لون النقشة، gk = زي الحارس */
export const KITS = {
  ARS: { b: '#DB0007', s: '#FFFFFF', t: '#FFFFFF', gk: ['#E5E7EB', '#111827'] }, AVL: { b: '#670E36', s: '#95BFE5', t: '#FDE68A', gk: ['#FACC15', '#111827'] },
  BOU: { b: '#DA291C', p: 'stripes', p2: '#111111', t: '#111111', gk: ['#22C55E', '#111827'] }, BRE: { b: '#E30613', p: 'stripes', p2: '#FFFFFF', t: '#111111', gk: ['#FACC15', '#111827'] },
  BHA: { b: '#0057B8', p: 'stripes', p2: '#FFFFFF', t: '#FFFFFF', gk: ['#EC4899', '#1E3A8A'] }, BUR: { b: '#6C1D45', s: '#99D6EA', t: '#99D6EA', gk: ['#F59E0B', '#111827'] },
  CHE: { b: '#034694', t: '#FFFFFF', p: 'pin', p2: '#1E5BB8', gk: ['#111827', '#A3E635'] }, COV: { b: '#59CBE8', t: '#FFFFFF', gk: ['#111827', '#59CBE8'] },
  CRY: { b: '#1B458F', p: 'stripes', p2: '#C4122E', t: '#FFFFFF', gk: ['#A3E635', '#111827'] }, EVE: { b: '#003399', t: '#FFFFFF', gk: ['#F97316', '#111827'] },
  FUL: { b: '#F8FAFC', t: '#111111', gk: ['#22C55E', '#111827'] }, HUL: { b: '#F5A12D', p: 'stripes', p2: '#111111', t: '#111111', gk: ['#3B82F6', '#FFFFFF'] },
  IPS: { b: '#3A64A3', t: '#FFFFFF', gk: ['#F59E0B', '#111827'] }, LEE: { b: '#F8FAFC', t: '#1D428A', p: 'pin', p2: '#C7D7F0', gk: ['#111827', '#FFCD00'] },
  LIV: { b: '#C8102E', t: '#FFFFFF', gk: ['#22C55E', '#111827'] }, MCI: { b: '#6CABDD', t: '#FFFFFF', gk: ['#111827', '#A3E635'] },
  MUN: { b: '#DA291C', t: '#FFFFFF', gk: ['#22C55E', '#111827'] }, NEW: { b: '#F8FAFC', p: 'stripes', p2: '#111111', t: '#111111', gk: ['#F59E0B', '#111827'] },
  NFO: { b: '#DD0000', t: '#FFFFFF', gk: ['#111827', '#F59E0B'] }, SUN: { b: '#EB172B', p: 'stripes', p2: '#FFFFFF', t: '#111111', gk: ['#22C55E', '#111827'] },
  TOT: { b: '#F8FAFC', t: '#132257', gk: ['#F97316', '#132257'] }, WHU: { b: '#7A263A', s: '#1BB1E7', t: '#F3D459', gk: ['#22C55E', '#111827'] },
  WOL: { b: '#FDB913', t: '#231F20', gk: ['#22C55E', '#111827'] }, LEI: { b: '#003090', t: '#FDBE11', gk: ['#22C55E', '#111827'] },
  SOU: { b: '#D71920', p: 'stripes', p2: '#FFFFFF', t: '#111111', gk: ['#FACC15', '#111827'] },
};
let SID = 0;
const BODY = 'M30 8 L14 14 L3 34 L16 41 L22 32 L22 92 Q22 95 25 95 L75 95 Q78 95 78 92 L78 32 L84 41 L97 34 L86 14 L70 8 Q66 16 50 17 Q34 16 30 8 Z';
const BODY_GK = 'M30 8 L14 14 L4 54 L15 57 L22 34 L22 92 Q22 95 25 95 L75 95 Q78 95 78 92 L78 34 L85 57 L96 54 L86 14 L70 8 Q66 16 50 17 Q34 16 30 8 Z';
const lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
export function shirt(short, pos, cls = '') {
  const K = KITS[short] || { b: (KIT[short] || ['#64748b'])[0], t: (KIT[short] || [0, '#fff'])[1] }, gk = pos === 'GK', id = 'k' + (++SID);
  const b = gk ? (K.gk || ['#22C55E', '#111827'])[0] : K.b, t = gk ? (K.gk || ['#22C55E', '#111827'])[1] : K.t || '#fff', sl = gk ? b : K.s || b;
  const body = gk ? BODY_GK : BODY;
  let pat = '';
  if (!gk && K.p === 'stripes') for (let x = 26; x < 78; x += 13) pat += `<rect x="${x}" y="0" width="6.5" height="100" fill="${K.p2}"/>`;
  else if (!gk && K.p === 'pin') for (let x = 27; x < 78; x += 6) pat += `<rect x="${x}" y="0" width="1.3" height="100" fill="${K.p2}" opacity=".9"/>`;
  else if (!gk && K.p === 'hoops') for (let y = 22; y < 95; y += 14) pat += `<rect x="0" y="${y}" width="100" height="7" fill="${K.p2}"/>`;
  else if (!gk && K.p === 'halves') pat = `<rect x="50" y="0" width="50" height="100" fill="${K.p2}"/>`;
  const sleeves = gk ? '' : `<path d="M24 10.5 L14 14 L3 34 L16 41 L22 32 Z M76 10.5 L86 14 L97 34 L84 41 L78 32 Z" fill="${sl}"/>`;
  const cuffs = gk ? `<path d="M4.6 50 L15.8 53.4 M95.4 50 L84.2 53.4" stroke="${t}" stroke-width="3" opacity=".9"/>` : `<path d="M4.4 31.5 L17 38.5 M95.6 31.5 L83 38.5" stroke="${t}" stroke-width="3" opacity=".95"/>`;
  const light = lum(b) > 0.8;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><defs><clipPath id="${id}c"><path d="${body}"/></clipPath>
   <linearGradient id="${id}h" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".26" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".16"/><stop offset=".74" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".34"/></linearGradient>
   <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
   <g clip-path="url(#${id}c)"><rect width="100" height="100" fill="${b}"/>${pat}${sleeves}<rect width="100" height="100" fill="url(#${id}h)"/><rect width="100" height="100" fill="url(#${id}v)"/>
    <path d="M36 40 Q40 62 35 92 M64 40 Q60 62 65 92" stroke="#000" stroke-opacity=".10" stroke-width="2" fill="none"/></g>
   <path d="M38 10.5 Q50 23 62 10.5 Q56 16.5 50 16.8 Q44 16.5 38 10.5 Z" fill="#000" fill-opacity=".35"/>
   <path d="M37 10 Q50 24 63 10" stroke="${t}" stroke-width="3.4" fill="none" stroke-linecap="round"/>${cuffs}
   <path d="${body}" fill="none" stroke="${light ? 'rgba(15,23,42,.45)' : 'rgba(0,0,0,.42)'}" stroke-width="1.3" stroke-linejoin="round"/>
   <text x="50" y="${gk ? 58 : 60}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="15" fill="${t}" stroke="${lum(t) > 0.6 ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.8)'}" stroke-width="${K.p === 'stripes' && !gk ? 2.6 : 0.8}" stroke-linejoin="round" paint-order="stroke">${esc(short || '')}</text></svg>`;
}
export function crest(short, size = 40) {
  const k = KIT[short] || ['#334155', '#fff'];
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}"><path d="M20 3l14 5v10c0 9-6 15-14 19C12 33 6 27 6 18V8z" fill="${k[0]}" stroke="${k[1]}" stroke-width="2"/><text x="20" y="24" text-anchor="middle" font-size="9.5" font-weight="900" fill="${k[1]}" font-family="Cairo">${esc(short)}</text></svg>`;
}
export const POS_K = { GK: 'gk', DEF: 'def', MID: 'mid', FWD: 'fwd' };
export const posTag = (p) => `<span class="pos ${p}">${t(POS_K[p])}</span>`;
export const fdr = (d, label) => `<span class="rate f${d || 3}">${label ?? d}</span>`;
export const RATE_TXT = () => ['', tt('سهلة جداً', 'Very easy'), tt('سهلة', 'Easy'), tt('متوسطة', 'Medium'), tt('صعبة', 'Hard'), tt('صعبة جداً', 'Very hard')];

/* ---------- رسوم بيانية (SVG) ---------- */
export function spark(vals, w = 70, h = 24, col = '#34D399') {
  if (!vals || vals.length < 2) return '';
  const mx = Math.max(...vals, 1), X = (i) => i * (w - 4) / (vals.length - 1) + 2, Y = (x) => h - 3 - x / mx * (h - 6);
  const id = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".45"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs><path d="M${X(0)},${h} ${vals.map((x, i) => `L${X(i)},${Y(x)}`).join(' ')} L${X(vals.length - 1)},${h}Z" fill="url(#${id})"/><polyline points="${vals.map((x, i) => `${X(i)},${Y(x)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}
/** رسم خطي تفاعلي: series=[{name,color,vals:[...]}], labels=[...] ; invert للترتيب */
export function lineChart(labels, series, { h = 170, invert = false, fmtV = (v) => v } = {}) {
  const W = 600, P = 28, all = series.flatMap((s) => s.vals.filter((v) => v != null));
  if (!all.length) return `<p class="mut">${t('noData')}</p>`;
  let mx = Math.max(...all), mn = Math.min(...all); if (mx === mn) { mx += 1; mn -= 1; }
  const X = (i) => P + i * (W - 2 * P) / Math.max(1, labels.length - 1);
  const Y = (v) => { const r = (v - mn) / (mx - mn); return invert ? P + r * (h - 2 * P) : h - P - r * (h - 2 * P); };
  const id = 'lc' + Math.random().toString(36).slice(2, 7);
  const paths = series.map((s, si) => { const pts = s.vals.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    return `${si === 0 ? `<path d="M${pts[0][0]},${h - P} ${pts.map((p) => `L${p[0]},${p[1]}`).join(' ')} L${pts[pts.length - 1][0]},${h - P}Z" fill="url(#${id})"/>` : ''}<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${s.color}" stroke-width="${si === 0 ? 3 : 2}" ${si ? 'stroke-dasharray="5 5"' : ''} stroke-linejoin="round"/>
    ${si === 0 ? s.vals.map((v, i) => (v == null ? '' : `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="${s.color}"><title>${labels[i]}: ${fmtV(v)}</title></circle>`)).join('') : ''}`; }).join('');
  return `<svg viewBox="0 0 ${W} ${h}" width="100%" style="direction:ltr;display:block"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${series[0].color}" stop-opacity=".25"/><stop offset="1" stop-color="${series[0].color}" stop-opacity="0"/></linearGradient></defs>${paths}
   ${labels.map((l, i) => (labels.length > 20 && i % 2 ? '' : `<text x="${X(i)}" y="${h - 8}" fill="#94A3B8" font-size="11" text-anchor="middle">${l}</text>`)).join('')}</svg>
   <div style="display:flex;gap:14px;font-size:11.5px;flex-wrap:wrap" class="mut">${series.map((s, i) => `<span><b style="color:${s.color}">${i ? '┅' : '━'}</b> ${s.name}</span>`).join('')}</div>`;
}
export function barChart(labels, vals, { h = 150, color = 'var(--g1)', onclick = null, sel = null } = {}) {
  const mx = Math.max(...vals.map((v) => v || 0), 1);
  return `<div class="bars" style="height:${h}px">${vals.map((v, i) => `<button class="${sel === i ? 'sel' : ''}" style="height:${Math.max(3, (v || 0) / mx * 100)}%;background:${color}" ${onclick ? `onclick="${onclick}(${i})"` : ''}><b>${v ?? '—'}</b><span>${labels[i]}</span></button>`).join('')}</div>`;
}
export function gauge(v, label, col = '#34D399') { const C = 2 * Math.PI * 30; return `<div class="gauge"><svg viewBox="0 0 72 72" width="72" height="72"><circle cx="36" cy="36" r="30" stroke="rgba(255,255,255,.08)" stroke-width="7" fill="none"/><circle cx="36" cy="36" r="30" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(100, v)) / 100)}" transform="rotate(-90 36 36)"/></svg><b>${Math.round(v)}</b><span>${label}</span></div>`; }
export function ring(v, sub = '') { const C = 2 * Math.PI * 62, col = v >= 65 ? '#34D399' : v >= 50 ? '#F59E0B' : '#EF4444'; return `<div class="ring"><svg width="150" height="150"><circle cx="75" cy="75" r="62" stroke="rgba(255,255,255,.08)" stroke-width="13" fill="none"/><circle cx="75" cy="75" r="62" stroke="${col}" stroke-width="13" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - v / 100)}"/></svg><div class="c"><div><b>${v}</b><div class="mut" style="font-size:12px">${sub}</div></div></div></div>`; }
export const timeAgo = (ts) => { const s = Math.round((Date.now() - ts) / 1000); if (s < 60) return tt('الآن', 'now'); if (s < 3600) return tt(`قبل ${Math.round(s / 60)} د`, `${Math.round(s / 60)}m ago`); if (s < 86400) return tt(`قبل ${Math.round(s / 3600)} س`, `${Math.round(s / 3600)}h ago`); return new Date(ts).toLocaleDateString(lang() === 'en' ? 'en-GB' : 'ar-IQ'); };
/** النتيجة: كل رقم بصندوق مستقل حتى يبقى جنب فريقه (الكتابة العربية تقلب «2 - 0» إذا انكتبت كنص واحد) */
/* دقيقة المباراة كما يعرضها الفانتازي، مع "نهاية الشوط الأول" وقت الاستراحة */
const koAgo = (f) => (f.ko ? (Date.now() - new Date(f.ko)) / 60e3 : 0);
export const isHT = (f) => !!(f?.started && !f.fin && (f.min || 0) === 45 && koAgo(f) >= 49 && koAgo(f) <= 70);
export const fxMin = (f, short = false) => {
  if (isHT(f)) return short ? tt('استراحة', 'HT') : tt('نهاية الشوط الأول', 'Half time');
  const m = f?.min || 0; return `${m}${m === 45 || m >= 90 ? '+' : ''}′`;
};
export const scoreHTML = (h, a, cls = 'score', style = '') => `<span class="${cls} sc2" style="${style}"><span>${h ?? 0}</span><i>–</i><span>${a ?? 0}</span></span>`;
export const fmtTime = (iso) => { if (!iso) return '—'; const d = new Date(iso); return d.toLocaleString(lang() === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); };

/** تأكيد داخل التطبيق (بدل confirm اللي ما يشتغل بكل البيئات) */
export function askConfirm(msg, onYes, danger = true) {
  window.__askYes = () => { closeSheet(); onYes(); };
  openSheet(`<div style="text-align:center;padding:8px 4px"><p style="font-size:16px;font-weight:700;margin:6px 0 16px">${esc(msg)}</p><div style="display:flex;gap:8px"><button class="btn ${danger ? 'btn-r' : 'btn-p'}" style="flex:1" onclick="__askYes()">${lang() === 'en' ? 'Yes' : 'نعم'}</button><button class="btn btn-g" style="flex:1" onclick="closeSheet()">${lang() === 'en' ? 'Cancel' : 'إلغاء'}</button></div></div>`);
}
