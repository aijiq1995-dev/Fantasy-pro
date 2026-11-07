/* =========================================================
   المحرك المباشر: نقاط رسمية فقط، تبديلات تلقائية، الكابتن البديل،
   الملكية الفعلية (EO)، أسهم الترتيب، التهديدات، ومحاكي "ماذا لو"
========================================================= */
import { ST, PM } from './store.js';
import { validXI } from './engine.js';

/* ---------- البونص المؤقت لكل مباراة ---------- */
/* حسب طلب المستخدم: ما نتوقّع بونص — النقاط فقط من الفانتازي الرسمي (البونص ينضاف لما الفانتازي يأكده) */
export function provisionalBonus(gw) {
  // البونص اللي ينشره الفانتازي نفسه بالمباريات (stats → bonus) — بدون أي توقع من عدنا
  const out = {};
  (ST.G.fx[gw] || []).filter((f) => f.started).forEach((f) => {
    const b = (f.stats || []).find((s) => s.identifier === 'bonus'); if (!b) return;
    [...(b.h || []), ...(b.a || [])].forEach((x) => (out[x.element] = (out[x.element] || 0) + x.value));
  });
  return out;
}
export function estimatedBonus(gw) {
  const out = {}, raw = ST.liveRaw && ST.liveRawGW === gw ? ST.liveRaw : null; if (!raw) return out;
  const fx = ST.G.fx[gw] || [];
  fx.filter((f) => f.started).forEach((f) => {
    const confirmed = (f.stats || []).find((s) => s.identifier === 'bonus'); if (confirmed && (confirmed.h.length || confirmed.a.length)) return;
    // كل لاعبي الفريقين اللي لعبوا بهالمباراة
    const pl = raw.filter((e) => { const p = PM(e.id); if (!p || (p.team !== f.h && p.team !== f.a)) return false; const ex = e.explain || []; return ex.length ? ex.some((x) => x.fixture === f.id) : (e.stats?.minutes || 0) > 0; })
      .map((e) => { const ex = (e.explain || []).find((x) => x.fixture === f.id); const b = ex ? (ex.stats || []).find((s) => s.identifier === 'bps')?.value : null; return { id: e.id, bps: b ?? e.stats?.bps ?? 0, min: e.stats?.minutes || 0 }; })
      .filter((x) => x.min > 0).sort((a, b) => b.bps - a.bps);
    // توزيع 3/2/1 مع التعادل حسب قوانين الفانتازي
    let pts = 3, i = 0;
    while (i < pl.length && pts > 0) { const v = pl[i].bps, grp = pl.filter((x) => x.bps === v); grp.forEach((x) => (out[x.id] = (out[x.id] || 0) + pts)); i += grp.length; pts -= grp.length; }
  });
  return out;
}

const teamDone = (team, gw) => { const f = (ST.G.fx[gw] || []).filter((x) => x.h === team || x.a === team); return f.length > 0 && f.every((x) => x.fin); };
const teamBlank = (team, gw) => !(ST.G.fx[gw] || []).some((x) => x.h === team || x.a === team);

/** حساب نقاط تشكيلة مباشرة (مع البونص المؤقت والتبديلات التلقائية) */
export function liveCalc(picks, gw = ST.G.cur, bonusMap = null, liveMap = null) {
  const L = liveMap || ST.live || {}; if (!picks?.picks) return null;
  const pb = bonusMap || provisionalBonus(gw), chip = picks.active_chip;
  const ps = [...picks.picks].sort((a, b) => a.position - b.position).map((x) => ({ ...x }));
  const ptsOf = (id) => { const s = L[id] || {}; return (s.total_points || 0) + (s.bonus ? 0 : pb[id] || 0); };
  const minOf = (id) => L[id]?.minutes || 0;
  const out = (id) => { const p = PM(id); return p && minOf(id) === 0 && (teamDone(p.team, gw) || teamBlank(p.team, gw)); };
  let xi = ps.filter((x) => x.position <= 11), bench = ps.filter((x) => x.position > 11);
  const subs = [];
  if (chip !== 'bboost') {
    xi.filter((x) => out(x.element)).forEach((o) => {
      const isGK = PM(o.element)?.pos === 'GK';
      for (const b of bench) {
        if (b.used || minOf(b.element) === 0) continue;
        if ((PM(b.element)?.pos === 'GK') !== isGK) continue;
        const ids = xi.map((x) => (x === o ? b.element : x.element));
        if (!validXI(ids)) continue;
        b.used = true; subs.push({ out: o.element, in: b.element }); o.subbedOut = true; b.subbedIn = true; break;
      }
    });
  }
  const starters = chip === 'bboost' ? ps : [...xi.filter((x) => !x.subbedOut), ...bench.filter((x) => x.subbedIn)];
  const cap = ps.find((x) => x.is_captain), vc = ps.find((x) => x.is_vice_captain);
  const capOut = cap && out(cap.element);
  const capMult = chip === '3xc' ? 3 : 2;
  let total = 0; const rows = ps.map((x) => {
    const on = starters.includes(x);
    let m = on ? 1 : 0;
    if (on && x === cap && !capOut) m = capMult; if (on && x === vc && capOut) m = capMult;
    const pts = ptsOf(x.element), bonus = (L[x.element]?.bonus ? 0 : pb[x.element] || 0);
    total += pts * m;
    return { id: x.element, pos: x.position, pts, m, bonus, min: minOf(x.element), subIn: !!x.subbedIn, subOut: !!x.subbedOut, cap: x === cap, vc: x === vc };
  });
  const hit = picks.entry_history?.event_transfers_cost || 0;
  return { total: total - hit, raw: total, hit, rows, subs, capOut, chip, bonus: pb };
}

/* ---------- الملكية الفعلية التقديرية ---------- */
let eoCache = null;
export function eoMap() {
  if (eoCache && eoCache.t === ST.G.fetchedAt) return eoCache.m;
  const P = ST.G.players, m = {};
  P.forEach((p) => (m[p.id] = p.own * 0.88));
  // شارة الكابتن: الأكثر امتلاكاً + الأعلى متوقعاً يتقاسمونها
  const caps = [...P].sort((a, b) => b.own * (+b.form + 2) - a.own * (+a.form + 2)).slice(0, 4), share = [48, 18, 8, 4];
  caps.forEach((p, i) => (m[p.id] += share[i]));
  eoCache = { t: ST.G.fetchedAt, m }; return m;
}
/** أسهم الترتيب: كل لاعب شكد يربحك أو يخسرك مقابل باقي المدربين */
export function rankImpact(calc) {
  const eo = eoMap(), L = ST.live || {}, pb = calc?.bonus || {};
  const mine = Object.fromEntries((calc?.rows || []).map((r) => [r.id, r.m]));
  const all = ST.G.players.map((p) => { const s = L[p.id] || {}; const pts = (s.total_points || 0) + (s.bonus ? 0 : pb[p.id] || 0); const my = mine[p.id] || 0; const e = eo[p.id] / 100; return { p, pts, my, eo: Math.round(eo[p.id]), gain: Math.round((my - e) * pts * 10) / 10, perPt: Math.round((my - e) * 100) / 100 }; });
  const gains = all.filter((x) => x.my > 0).sort((a, b) => b.gain - a.gain);
  const threats = all.filter((x) => x.my === 0 && x.eo >= 5).sort((a, b) => a.gain - b.gain).slice(0, 12);
  const safety = Math.round(all.reduce((a, x) => a + (eo[x.p.id] / 100) * x.pts, 0) * 10) / 10;
  return { gains, threats, safety };
}

/* ---------- ماذا لو ---------- */
export const WHATIF = { goal: { GK: 10, DEF: 6, MID: 5, FWD: 4 }, assist: { GK: 3, DEF: 3, MID: 3, FWD: 3 }, cs: { GK: 4, DEF: 4, MID: 1, FWD: 0 }, bonus3: { GK: 3, DEF: 3, MID: 3, FWD: 3 }, yellow: { GK: -1, DEF: -1, MID: -1, FWD: -1 }, red: { GK: -3, DEF: -3, MID: -3, FWD: -3 }, pensave: { GK: 5, DEF: 0, MID: 0, FWD: 0 } };
export function whatIf(calc, pid, ev) {
  const p = PM(pid); const d = WHATIF[ev]?.[p.pos] ?? 0;
  const my = calc?.rows.find((r) => r.id === pid)?.m || 0, eo = eoMap()[pid] / 100;
  return { pts: d, me: d * my, field: Math.round(d * eo * 10) / 10, net: Math.round((d * my - d * eo) * 10) / 10 };
}
