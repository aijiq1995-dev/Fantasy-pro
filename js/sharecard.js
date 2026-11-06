/* =========================================================
   بطاقة الجولة للمشاركة — صورة 1080×1350 (مناسبة للستوري والواتساب)
   ترسم بالـ Canvas بنفس هوية التطبيق وتنشارك بزر المشاركة بالآيفون
========================================================= */
import { ST, PM, tShort } from './store.js';
import { tt } from './i18n.js';
import { esc, I, openSheet, sheetHead, toast } from './ui.js';
import * as FPL from './fpl.js';
import { liveCalc } from './live-engine.js';
import { shirt } from './ui.js';

const W = 1080, H = 1920, AR = '"IBM Plex Sans Arabic", system-ui, sans-serif', EN = 'Inter, system-ui, sans-serif';
const CHIP = { wildcard: 'وايلد كارد', freehit: 'فري هت', bboost: 'بنش بوست', '3xc': 'تريبل كابتن' };
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en'));

async function gather(gw) {
  const G = ST.G, id = ST.profile.teamId, hist = ST.E.hist.current || [];
  const h = hist.find((x) => x.event === gw) || {}, hp = hist.find((x) => x.event === gw - 1);
  const ev = G.events.find((e) => e.id === gw) || {};
  const picks = gw === ST.E.gw && ST.E.picks ? ST.E.picks : await FPL.fetchPicks(id, gw);
  const lv = await FPL.loadLive(gw); const live = Object.fromEntries(lv.elements.map((x) => [x.id, x.stats]));
  const calc = liveCalc(picks, gw, gw === G.cur ? null : {}, live);
  const rows = calc.rows.filter((r) => (r.m > 0 && !r.subOut) || r.subIn);
  const capRow = calc.rows.find((r) => r.cap), cap = capRow && PM(capRow.id);
  const best = [...rows].sort((a, b) => b.pts * Math.max(1, b.m) - a.pts * Math.max(1, a.m))[0];
  const pts = gw === G.cur && !ev.fin ? calc.total : h.points ?? calc.total;
  return {
    gw, team: ST.E.entry.name, mgr: `${ST.E.entry.player_first_name || ''} ${ST.E.entry.player_last_name || ''}`.trim(),
    pts, avg: ev.avg, top: ev.top, rank: h.overall_rank, rankPrev: hp?.overall_rank, gwRank: h.rank, total: h.total_points,
    cap: cap ? { name: cap.name, pts: capRow.pts * Math.max(1, capRow.m), mult: capRow.m } : null,
    best: best ? { name: PM(best.id)?.name, pts: best.pts * Math.max(1, best.m) } : null,
    chip: picks.active_chip, hit: h.event_transfers_cost || 0, bench: h.points_on_bench, live: gw === G.cur && !ev.fin,
    squad: calc.rows.map((r) => ({ id: r.id, name: PM(r.id)?.name || '', pos: PM(r.id)?.pos, team: tShort(PM(r.id)?.team), slot: r.pos, pts: r.m ? r.pts * r.m : r.pts, counted: r.m > 0, cap: r.cap, vc: r.vc, m: r.m, subIn: r.subIn, subOut: r.subOut, best: best && r.id === best.id })),
  };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
const shirtImg = new Map();
function loadShirt(team, pos) {
  const k = team + (pos === 'GK' ? 'G' : '');
  if (!shirtImg.has(k)) shirtImg.set(k, new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(shirt(team, pos).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" ')); }));
  return shirtImg.get(k);
}
const clip = (c, t, max) => { if (c.measureText(t).width <= max) return t; while (t.length > 2 && c.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
async function player(c, p, x, y, sz, dim) {
  const im = await loadShirt(p.team, p.pos);
  c.save(); if (dim) c.globalAlpha = 0.55;
  c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
  if (im) c.drawImage(im, x - sz / 2, y - sz / 2, sz, sz);
  c.restore();
  // الاسم
  const nw = 168, ny = y + sz / 2 + 2; c.font = `600 25px ${EN}`; c.textAlign = 'center';
  rr(c, x - nw / 2, ny, nw, 38, 9); c.fillStyle = 'rgba(8,12,20,.88)'; c.fill();
  c.fillStyle = dim ? 'rgba(255,255,255,.6)' : '#fff'; c.fillText(clip(c, p.name, nw - 14), x, ny + 27);
  // النقاط
  const pc = p.cap ? '#FBBF24' : !p.counted ? '#94A3B8' : p.pts >= 10 ? '#34D399' : p.pts >= 4 ? '#F8FAFC' : p.pts >= 2 ? '#E2E8F0' : '#F87171';
  rr(c, x - nw / 2, ny + 40, nw, 42, 9); c.fillStyle = p.cap ? 'rgba(251,191,36,.22)' : p.best ? 'rgba(52,211,153,.22)' : 'rgba(255,255,255,.92)'; c.fill();
  c.fillStyle = p.cap || p.best ? pc : '#0B1222'; if (!p.counted && !p.cap && !p.best) c.fillStyle = '#64748B';
  c.font = `800 30px ${EN}`; c.fillText(String(p.pts), x, ny + 72);
  // شارات
  const badge = (txt, bx, bg, fg) => { c.beginPath(); c.arc(bx, y - sz / 2 + 22, 22, 0, Math.PI * 2); c.fillStyle = bg; c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.stroke(); c.fillStyle = fg; c.font = `800 22px ${EN}`; c.fillText(txt, bx, y - sz / 2 + 30); };
  if (p.cap) badge(p.m === 3 ? '3×' : 'C', x + sz / 2 - 8, '#FBBF24', '#1C1404'); else if (p.vc) badge('V', x + sz / 2 - 8, '#E2E8F0', '#0B1222');
  if (p.subIn) badge('↑', x - sz / 2 + 8, '#34D399', '#052E1C'); if (p.subOut) badge('↓', x - sz / 2 + 8, '#F87171', '#2A0606');
  if (p.best && !p.cap) badge('★', x - sz / 2 + 8, '#34D399', '#052E1C');
}
async function draw(d) {
  try { await Promise.all([document.fonts.load(`700 60px ${AR}`), document.fonts.load(`800 60px ${EN}`), document.fonts.load(`500 30px ${AR}`), document.fonts.load(`600 25px ${EN}`)]); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.direction = 'rtl';
  // الخلفية
  const g = c.createRadialGradient(W / 2, 200, 60, W / 2, 700, 1500); g.addColorStop(0, '#174A39'); g.addColorStop(0.45, '#0E2420'); g.addColorStop(1, '#090C13');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // الهيدر
  c.textAlign = 'right'; c.fillStyle = '#34D399'; c.font = `700 36px ${AR}`; c.fillText('فانتازي برو', W - 64, 92);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `500 28px ${AR}`; c.fillText(d.live ? `الجولة ${d.gw} · مباشر` : `الجولة ${d.gw}`, W - 64, 136);
  c.textAlign = 'left'; c.fillStyle = '#FBBF24'; c.font = `800 34px ${EN}`; c.fillText('GW' + d.gw, 64, 96);
  if (d.mgr) { c.fillStyle = 'rgba(255,255,255,.5)'; c.font = `500 26px ${AR}`; c.fillText(d.mgr, 64, 136); }
  // اسم الفريق + النقاط
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `700 52px ${AR}`; c.fillText(d.team, W / 2, 228);
  const pg = c.createLinearGradient(0, 250, 0, 430); pg.addColorStop(0, '#7CF5C4'); pg.addColorStop(1, '#10B981');
  c.fillStyle = pg; c.font = `800 176px ${EN}`; c.fillText(String(d.pts ?? '—'), W / 2, 420);
  c.font = `600 30px ${AR}`; const sub = d.avg != null ? `نقطة · ${d.pts - d.avg >= 0 ? '+' : ''}${d.pts - d.avg} عن المعدل (${d.avg})` : 'نقطة';
  c.fillStyle = d.avg != null && d.pts < d.avg ? '#F87171' : 'rgba(255,255,255,.75)'; c.fillText(sub, W / 2, 470);
  // الإحصائيات
  const stats = [['الترتيب العام', fmt(d.rank), d.rankPrev && d.rank ? (d.rank < d.rankPrev ? '▲' : d.rank > d.rankPrev ? '▼' : '') : '', d.rank < d.rankPrev ? '#34D399' : '#F87171'], ['ترتيب الجولة', fmt(d.gwRank), '', ''], ['أعلى نقاط', fmt(d.top), '', '']];
  stats.forEach(([l, v, ar, col], i) => { const bw = 306, x = W - 64 - bw - i * (bw + 18), y = 505; rr(c, x, y, bw, 124, 24); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill();
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `500 24px ${AR}`; c.fillText(l, x + bw / 2, y + 42); c.fillStyle = '#fff'; c.font = `800 42px ${EN}`; c.fillText(v, x + bw / 2, y + 96);
    if (ar) { c.fillStyle = col; c.font = `800 26px ${EN}`; c.fillText(ar, x + bw / 2 + c.measureText(v).width / 2 + 44, y + 93); } });
  // الملعب
  const px = 40, py = 660, pw = W - 80, ph = 900;
  rr(c, px, py, pw, ph, 34); const fg = c.createLinearGradient(0, py, 0, py + ph); fg.addColorStop(0, '#15803D'); fg.addColorStop(1, '#166534'); c.fillStyle = fg; c.fill();
  c.save(); rr(c, px, py, pw, ph, 34); c.clip();
  for (let i = 0; i < 9; i++) { if (i % 2) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(px, py + (ph / 9) * i, pw, ph / 9); } }
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 4; c.strokeRect(px + 40, py + 30, pw - 80, ph - 60);
  c.strokeRect(W / 2 - 200, py + 30, 400, 150); c.strokeRect(W / 2 - 95, py + 30, 190, 60);
  c.beginPath(); c.moveTo(px + 40, py + ph - 30); c.lineTo(px + pw - 40, py + ph - 30); c.stroke();
  c.beginPath(); c.arc(W / 2, py + ph - 30, 130, Math.PI, 0); c.stroke();
  c.restore();
  const xi = d.squad.filter((p) => p.slot <= 11), bench = d.squad.filter((p) => p.slot > 11);
  const lines = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => xi.filter((p) => p.pos === pos)).filter((l) => l.length);
  const sz = 132, rowH = (ph - 60) / lines.length;
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li], cy = py + 30 + rowH * li + rowH / 2 - 40, gap = Math.min(200, (pw - 60) / L.length);
    for (let k = 0; k < L.length; k++) { const cx = W / 2 + (k - (L.length - 1) / 2) * gap * -1; await player(c, L[k], cx, cy, sz, L[k].subOut); }
  }
  // الدكة
  const by = 1590, bh = 240; rr(c, px, by, pw, bh, 28); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill();
  c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `600 24px ${AR}`; c.fillText(`الدكة${d.bench != null ? ` · ${d.bench} نقطة` : ''}`, W - 70, by + 40);
  const bgap = (pw - 40) / Math.max(1, bench.length);
  for (let k = 0; k < bench.length; k++) { const cx = W - px - 20 - bgap * (k + 0.5); await player(c, bench[k], cx, by + 104, 104, !bench[k].subIn && d.chip !== 'bboost'); }
  // التذييل
  const tags = []; if (d.chip) tags.push([CHIP[d.chip] || d.chip, '#A78BFA']); if (d.hit) tags.push([`خصم −${d.hit}`, '#F87171']); if (d.cap) tags.push([`الكابتن: ${d.cap.name} (${d.cap.pts})`, '#FBBF24']);
  c.font = `600 26px ${AR}`; let tw = tags.reduce((a, [t]) => a + c.measureText(t).width + 60, -14), tx = W / 2 + tw / 2; c.textAlign = 'right';
  tags.forEach(([txt, col]) => { const w = c.measureText(txt).width + 46; rr(c, tx - w, 1846, w, 50, 25); c.fillStyle = 'rgba(255,255,255,.08)'; c.fill(); c.fillStyle = col; c.fillText(txt, tx - 23, 1880); tx -= w + 14; });
  if (!tags.length) { c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.35)'; c.font = `500 24px ${EN}`; c.fillText('fantasy-pro-aijo0.vercel.app', W / 2, 1880); }
  return cv;
}

let lastBlob = null;
export async function openShareCard(gw = ST.G.cur) {
  openSheet(`${sheetHead(I('i-send'), tt('بطاقة الجولة', 'Gameweek card'), tt(`الجولة ${gw}`, `GW${gw}`))}<div id="shc" class="aiload"><i></i><i></i><i></i><span>${tt('جارِ تجهيز البطاقة…', 'Preparing card…')}</span></div>`);
  try {
    const cv = await draw(await gather(gw));
    lastBlob = await new Promise((r) => cv.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(lastBlob), box = document.getElementById('shc'); if (!box) return;
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [new File([lastBlob], 'x.png', { type: 'image/png' })] }));
    box.outerHTML = `<img src="${url}" alt="" class="shc-img"><div class="flex" style="gap:8px;margin-top:12px">${canShare ? `<button class="btn btn-p" style="flex:1" onclick="shcShare()">${I('i-send')}${tt('مشاركة', 'Share')}</button>` : ''}<a class="btn ${canShare ? 'btn-g' : 'btn-p'}" style="flex:1;text-align:center" href="${url}" download="fantasy-pro-gw${gw}.png">${I('i-download')}${tt('حفظ الصورة', 'Save image')}</a></div><p class="mut" style="font-size:11.5px;text-align:center;margin-top:8px">${tt('على الآيفون: «مشاركة» ← واتساب أو إنستغرام أو «حفظ الصورة»', 'On iPhone: Share → WhatsApp / Instagram / Save Image')}</p>`;
    window.__shcGw = gw;
  } catch (e) { const box = document.getElementById('shc'); if (box) box.outerHTML = `<p class="mut">${esc(e.message || 'خطأ')}</p>`; }
}
window.openShareCard = openShareCard;
window.shcShare = async () => {
  if (!lastBlob) return;
  const file = new File([lastBlob], `fantasy-pro-gw${window.__shcGw || ''}.png`, { type: 'image/png' });
  try { await navigator.share({ files: [file], title: 'فانتازي برو' }); } catch (e) { if (e?.name !== 'AbortError') toast(tt('ما گدرنا نشارك — استخدم «حفظ الصورة»', 'Share failed — use Save')); }
};
