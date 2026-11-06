/* =========================================================
   تقديرات محسوبة من البيانات الرسمية (مثل مواقع التتبع):
   1) توقع تغيّر الأسعار  2) الترتيب المباشر التقديري
   كلها تقديرية — خوارزمية الفانتازي الحقيقية غير منشورة
========================================================= */
import { ST } from './store.js';

/** تقدّم اللاعب نحو تغيّر السعر (−100..+100 = حد التغيير التقريبي) */
export function pricePredict(p) {
  const N = ST.G.totalPlayers || 10e6, owners = Math.max(1, (p.own / 100) * N);
  const net = (p.tin || 0) - (p.tout || 0);
  // العتبة تكبر مع عدد المالكين؛ اللاعب المصاب/الغائب ينزل أسرع
  let thr = Math.max(15000, owners * 0.06);
  if (net < 0 && p.st !== 'a') thr *= 0.55;
  // إذا تغيّر سعره هذي الجولة، العتبة الجاية أصعب شوية
  if (p.cc) thr *= 1.25;
  const prog = Math.max(-150, Math.min(150, Math.round((net / thr) * 100)));
  const state = prog >= 100 ? 'rise' : prog >= 70 ? 'near-rise' : prog <= -100 ? 'fall' : prog <= -70 ? 'near-fall' : 'stable';
  return { net, prog, state, owners: Math.round(owners) };
}
export const PRICE_LABEL = (s, tt) => ({ rise: tt('متوقع يصعد', 'Likely to rise'), 'near-rise': tt('قريب من الصعود', 'Close to rising'), fall: tt('متوقع ينزل', 'Likely to fall'), 'near-fall': tt('قريب من النزول', 'Close to falling'), stable: tt('مستقر', 'Stable') }[s]);

/* ---------- توزيع طبيعي ---------- */
const erf = (x) => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
function invPhi(p) { p = Math.min(1 - 1e-9, Math.max(1e-9, p)); let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

/** معدل نقاط الجولة المباشر التقديري: كل لاعب × نسبة امتلاكه (+ أثر الكابتن للأكثر امتلاكاً) */
export function liveAverage(live) {
  if (!live) return null;
  const P = ST.G.players; let s = 0;
  const top = [...P].sort((a, b) => b.own - a.own).slice(0, 3);
  P.forEach((p) => { const st = live[p.id]; if (st) s += (p.own / 100) * 0.9 * (st.total_points || 0); });
  // تقريب الكابتن: أعلى 3 امتلاكاً يتقاسمون شارة الكابتن بنسبة امتلاكهم
  const capShare = [0.55, 0.2, 0.08]; top.forEach((p, i) => { const st = live[p.id]; if (st) s += capShare[i] * (st.total_points || 0); });
  return Math.round(s * 10) / 10;
}

/** الترتيب العام التقديري بعد نقاط الجولة الحالية */
export function liveRankEstimate(livePts, avgOverride = null) {
  const G = ST.G, E = ST.E, hist = E.hist.current || [], N = G.totalPlayers;
  if (livePts == null || !ST.live || !N || hist.length < 2) return null;
  const done = hist.filter((h) => h.event < G.cur), last = done[done.length - 1]; if (!last || !last.overall_rank) return null;
  const T = last.total_points, R = last.overall_rank;
  const M = done.reduce((a, h) => a + (G.events.find((e) => e.id === h.event)?.avg || 0), 0);
  const z = invPhi(1 - R / N); if (Math.abs(z) < 0.05) return null;
  let sd = (T - M) / z; if (!(sd > 5)) sd = 9 * Math.sqrt(done.length);
  const avgLive = avgOverride ?? liveAverage(ST.live) ?? 0;
  const sd2 = Math.sqrt(sd * sd + 12 * 12);
  const z2 = (T + livePts - (M + avgLive)) / sd2;
  const rank = Math.max(1, Math.round(N * (1 - Phi(z2))));
  return { rank, from: R, move: R - rank, avgLive };
}
