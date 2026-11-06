/* =========================================================
   بطاقة الجولة للمشاركة — صورة 1080×1350 (مناسبة للستوري والواتساب)
   ترسم بالـ Canvas بنفس هوية التطبيق وتنشارك بزر المشاركة بالآيفون
========================================================= */
import { ST, PM, tShort } from './store.js';
import { tt } from './i18n.js';
import { esc, I, openSheet, sheetHead, toast } from './ui.js';
import * as FPL from './fpl.js';
import { liveCalc } from './live-engine.js';

const W = 1080, H = 1350, AR = '"IBM Plex Sans Arabic", system-ui, sans-serif', EN = 'Inter, system-ui, sans-serif';
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
    xi: rows.slice(0, 11).map((r) => ({ name: PM(r.id)?.name || '', pos: PM(r.id)?.pos, pts: r.pts * Math.max(1, r.m), cap: r.cap })),
  };
}

function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
async function draw(d) {
  try { await Promise.all([document.fonts.load(`700 60px ${AR}`), document.fonts.load(`800 60px ${EN}`), document.fonts.load(`500 30px ${AR}`)]); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  c.direction = 'rtl';
  // الخلفية
  const g = c.createRadialGradient(W / 2, 260, 60, W / 2, 520, 1100); g.addColorStop(0, '#174A39'); g.addColorStop(0.5, '#0E2420'); g.addColorStop(1, '#090C13');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.strokeStyle = 'rgba(124,245,196,.07)'; c.lineWidth = 6; c.beginPath(); c.arc(W / 2, H + 60, 380, 0, Math.PI * 2); c.stroke(); c.strokeRect(330, -20, 420, 180);
  // الهيدر
  c.textAlign = 'right'; c.fillStyle = '#34D399'; c.font = `700 34px ${AR}`; c.fillText('فانتازي برو', W - 70, 100);
  c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `500 28px ${AR}`; c.fillText(d.live ? `الجولة ${d.gw} · مباشر` : `الجولة ${d.gw}`, W - 70, 145);
  c.textAlign = 'left'; c.fillStyle = '#FBBF24'; c.font = `800 30px ${EN}`; c.fillText('GW' + d.gw, 70, 100);
  // اسم الفريق
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `700 54px ${AR}`; c.fillText(d.team, W / 2, 255);
  if (d.mgr) { c.fillStyle = 'rgba(255,255,255,.5)'; c.font = `500 28px ${AR}`; c.fillText(d.mgr, W / 2, 300); }
  // النقاط
  const pg = c.createLinearGradient(0, 330, 0, 560); pg.addColorStop(0, '#7CF5C4'); pg.addColorStop(1, '#10B981');
  c.fillStyle = pg; c.font = `800 230px ${EN}`; c.fillText(String(d.pts ?? '—'), W / 2, 545);
  c.fillStyle = 'rgba(255,255,255,.65)'; c.font = `600 34px ${AR}`; c.fillText('نقطة', W / 2, 600);
  if (d.avg) { const diff = d.pts - d.avg; c.fillStyle = diff >= 0 ? '#34D399' : '#F87171'; c.font = `600 30px ${AR}`; c.fillText(`${diff >= 0 ? '+' : ''}${diff} عن المعدل (${d.avg})`, W / 2, 648); }
  // الإحصائيات
  const stats = [['الترتيب العام', fmt(d.rank), d.rankPrev && d.rank ? (d.rank < d.rankPrev ? '▲' : d.rank > d.rankPrev ? '▼' : '') : '', d.rank < d.rankPrev ? '#34D399' : '#F87171'], ['ترتيب الجولة', fmt(d.gwRank), '', ''], ['أعلى نقاط', fmt(d.top), '', '']];
  stats.forEach(([l, v, ar, col], i) => { const bw = 300, x = W - 70 - bw - i * (bw + 20), y = 700; rr(c, x, y, bw, 150, 26); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill();
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `500 26px ${AR}`; c.fillText(l, x + bw / 2, y + 50); c.fillStyle = '#fff'; c.font = `800 46px ${EN}`; c.fillText(v, x + bw / 2, y + 112); if (ar) { c.fillStyle = col; c.font = `800 28px ${EN}`; c.fillText(ar, x + bw / 2 + c.measureText(v).width / 2 + 52, y + 108); } });
  // الكابتن وأحسن لاعب
  const boxes = [['الكابتن', d.cap ? `${d.cap.name}` : '—', d.cap ? `${d.cap.pts}${d.cap.mult === 3 ? ' (×3)' : ''}` : '', '#FBBF24'], ['نجم فريقك', d.best?.name || '—', d.best ? String(d.best.pts) : '', '#34D399']];
  boxes.forEach(([l, n, p, col], i) => { const bw = 460, x = W - 70 - bw - i * (bw + 20), y = 880; rr(c, x, y, bw, 160, 26); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill(); c.fillStyle = col; c.fillRect(x + bw - 8, y + 30, 8, 100);
    c.textAlign = 'right'; c.fillStyle = 'rgba(255,255,255,.55)'; c.font = `500 26px ${AR}`; c.fillText(l, x + bw - 36, y + 52); c.fillStyle = '#fff'; c.font = `700 40px ${EN}`; c.fillText(n.length > 14 ? n.slice(0, 13) + '…' : n, x + bw - 36, y + 112);
    c.textAlign = 'left'; c.fillStyle = col; c.font = `800 60px ${EN}`; c.fillText(p, x + 34, y + 112); });
  // شارات
  const tags = []; if (d.chip) tags.push([CHIP[d.chip] || d.chip, '#A78BFA']); if (d.hit) tags.push([`خصم −${d.hit}`, '#F87171']); if (d.bench) tags.push([`الدكة ${d.bench}`, 'rgba(255,255,255,.6)']);
  let tx = W - 70; c.font = `600 28px ${AR}`; c.textAlign = 'right';
  tags.forEach(([txt, col]) => { const tw = c.measureText(txt).width + 44; rr(c, tx - tw, 1075, tw, 56, 28); c.fillStyle = 'rgba(255,255,255,.07)'; c.fill(); c.fillStyle = col; c.fillText(txt, tx - 22, 1113); tx -= tw + 14; });
  // التشكيلة المصغرة
  c.textAlign = 'center'; const y0 = 1185; const lines = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => d.xi.filter((x) => x.pos === pos));
  const flat = lines.flat(); const cw = (W - 140) / Math.max(1, flat.length);
  flat.forEach((p, i) => { const x = W - 70 - cw * (i + 0.5); c.fillStyle = p.cap ? '#FBBF24' : p.pts >= 6 ? '#34D399' : p.pts >= 2 ? 'rgba(255,255,255,.85)' : '#F87171'; c.font = `800 30px ${EN}`; c.fillText(String(p.pts), x, y0); c.fillStyle = 'rgba(255,255,255,.45)'; c.font = `500 17px ${EN}`; const nm = p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name; c.fillText(nm, x, y0 + 30); });
  // التذييل
  c.fillStyle = 'rgba(255,255,255,.35)'; c.font = `500 24px ${EN}`; c.fillText('fantasy-pro-aijo0.vercel.app', W / 2, H - 50);
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
