/* =========================================================
   الحركة: عدّاد الأرقام لكل الأرقام الكبيرة، تموّج الضغط،
   وميض تغيّر القيم المباشرة، والسحب للتحديث
========================================================= */
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const NUM_SEL = '.big-num, .kpis b, .kv b, .stat .v, .tstrip b, .lab-res b, .score-ring b, .score, .count, .col.num, .vs .big, .ring b, .gauge b';
const RX = /^([+\-−]?)([\d,]+(?:\.\d+)?)(%?)$/;
const prev = new Map();

/** يحرّك كل رقم من 0 (أو من قيمته السابقة) لحد قيمته الجديدة */
export function countAll(root, firstView) {
  if (reduced()) return;
  root.querySelectorAll(NUM_SEL).forEach((el, i) => {
    if (el.children.length && !el.classList.contains('count')) { const t = el.firstChild; if (!t || t.nodeType !== 3) return; }
    const node = el.children.length ? el.firstChild : el; const raw = (node.nodeType === 3 ? node.nodeValue : node.textContent).trim();
    const m = raw.match(RX); if (!m) return;
    const sign = m[1], str = m[2], pct = m[3], v = parseFloat(str.replace(/,/g, '')); if (!isFinite(v) || v === 0) return;
    const dec = (str.split('.')[1] || '').length, comma = str.includes(','), key = `${location.hash}|${i}`;
    const from = firstView ? 0 : prev.get(key); prev.set(key, v);
    if (from == null || from === v) return;
    if (!firstView) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add(v > from ? 'flash' : 'flash-down'); }
    const fmt = (x) => { const s = x.toFixed(dec); return comma ? Number(s).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s; };
    const set = (x) => { const txt = sign + fmt(x) + pct; if (node.nodeType === 3) node.nodeValue = txt; else node.textContent = txt; };
    const t0 = performance.now(), dur = Math.min(900, 450 + i * 25);
    set(from);
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); set(from + (v - from) * e); if (k < 1) requestAnimationFrame(step); else set(v); };
    requestAnimationFrame(step);
  });
}

/* تموّج خفيف عند الضغط — يطلع بعد الضغطة (click) حتى ما يمنع الآيفون أول لمسة */
document.addEventListener('click', (e) => {
  if (reduced()) return;
  if (e.target.closest('.bnav button')) { try { navigator.vibrate?.(6); } catch {} return; }
  const el = e.target.closest('.btn, .tap, .seg button, .chips2 button, .nb, .icon-btn'); if (!el) return;
  const r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 1.6, sp = document.createElement('span');
  sp.className = 'ripple'; sp.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.style.overflow = 'hidden'; el.appendChild(sp); setTimeout(() => sp.remove(), 600);
  try { if (el.matches('.btn-p')) navigator.vibrate?.(6); } catch {}
}, { capture: true, passive: true });

/* السحب لتحت للتحديث (بالرئيسية والصفحات الرئيسية) */
let y0 = null, pulled = 0;
const ind = () => document.getElementById('ptr') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'ptr', innerHTML: '<svg class="i"><use href="#i-refresh"/></svg>' });
document.addEventListener('touchstart', (e) => { if (window.scrollY <= 0 && !document.querySelector('.ov') && window.__canPull?.()) { y0 = e.touches[0].clientY; pulled = 0; } }, { passive: true });
document.addEventListener('touchmove', (e) => { if (y0 == null) return; pulled = Math.max(0, Math.min(110, (e.touches[0].clientY - y0) * 0.5)); const p = ind(); p.style.opacity = Math.min(1, pulled / 60); p.style.transform = `translate(-50%, ${pulled - 40}px) rotate(${pulled * 4}deg)`; p.classList.toggle('ready', pulled >= 65); }, { passive: true });
document.addEventListener('touchend', () => { if (y0 == null) return; const p = ind(); if (pulled >= 65) { p.classList.add('go'); window.loadAll?.(true).finally(() => { p.classList.remove('go', 'ready'); p.style.opacity = 0; }); } else { p.style.opacity = 0; p.style.transform = 'translate(-50%,-40px)'; } y0 = null; pulled = 0; });
