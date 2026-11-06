/* =========================================================
   الحلّال الذكي (Transfer Solver)
   يدوّر على أفضل خطة انتقالات لعدة جولات لفريقك أنت:
   • أسعار البيع الحقيقية (سعر الشراء + نصف الربح)  • البنك والانتقالات المجانية (حد 5)
   • حد 3 لاعبين من نفس النادي  • خصم 4 نقاط لكل انتقال إضافي
   • أفضل تشكيلة وكابتن لكل جولة  • قيمة للانتقال المجاني المدّخر
   الخوارزمية: بحث شعاعي (Beam search) مع تقييم بقية الجولات لكل حركة
========================================================= */
import { ST } from './store.js';
import { xp } from './engine.js';

/** سعر البيع (بالعُشر): إذا السعر صعد تاخذ نصف الربح مقرّب لتحت */
export function sellPrice10(id) {
  const p = ST.G.PM[id]; if (!p) return 0;
  const now = Math.round(p.price * 10);
  const tr = (ST.E.transfers || []).filter((t) => t.element_in === id).sort((a, b) => new Date(b.time) - new Date(a.time))[0];
  const buy = tr ? tr.element_in_cost : Math.round((p.price - (p.ccs || 0)) * 10);
  return now <= buy ? now : buy + Math.floor((now - buy) / 2);
}

const POSN = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

export function solve({ H = 5, maxHits = 1, beam = 10, movesPerState = 7, ftValue = 1.2 } = {}) {
  const G = ST.G, P = ST.plan; if (!P || !G.next) return null;
  const g0 = G.next, gws = []; for (let g = g0; g < g0 + H && g <= G.lastGW; g++) gws.push(g);
  const PM = G.PM;
  // مجموعة المرشحين: أفضل لاعبين بكل مركز على مدى الخطة + تشكيلتك
  const hz = (p) => gws.reduce((s, g) => s + xp(p, g), 0);
  const pool = new Set(P.squad);
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) G.players.filter((p) => p.pos === pos && p.st !== 'u' && p.st !== 'n' && p.min > 0).sort((a, b) => hz(b) - hz(a)).slice(0, pos === 'GK' ? 6 : 16).forEach((p) => pool.add(p.id));
  const ids = [...pool];
  const XP = new Map(ids.map((id) => [id, gws.map((g) => xp(PM[id], g))]));
  const price10 = (id) => Math.round(PM[id].price * 10);
  const sell0 = new Map(P.squad.map((id) => [id, sellPrice10(id)]));

  // قيمة التشكيلة بجولة: أفضل 11 (حارس 1، دفاع 3-5، وسط 2-5، هجوم 1-3) + الكابتن
  function gwScore(squad, gi) {
    const by = [[], [], [], []];
    for (const id of squad) by[POSN[PM[id].pos]].push(XP.get(id)[gi]);
    by.forEach((a) => a.sort((x, y) => y - x));
    let s = by[0][0] || 0, cap = by[0][0] || 0;
    const take = [0, 3, 2, 1], left = [];
    for (let k = 1; k < 4; k++) { for (let i = 0; i < by[k].length; i++) { if (i < take[k]) { s += by[k][i]; cap = Math.max(cap, by[k][i]); } else if (i < [0, 5, 5, 3][k]) left.push(by[k][i]); } }
    left.sort((x, y) => y - x); for (let i = 0; i < 4 && i < left.length; i++) { s += left[i]; cap = Math.max(cap, left[i]); }
    return s + cap;
  }
  const restScore = (squad, from) => { let s = 0; for (let gi = from; gi < gws.length; gi++) s += gwScore(squad, gi); return s; };
  const clubOk = (squad) => { const c = {}; for (const id of squad) { const t = PM[id].team; c[t] = (c[t] || 0) + 1; if (c[t] > 3) return false; } return true; };

  function movesFor(st, gi) {
    const out = [];
    const base = restScore(st.squad, gi);
    const singles = [];
    for (const o of st.squad) {
      const po = PM[o].pos, sv = st.sell.get(o) ?? price10(o);
      for (const n of ids) {
        if (PM[n].pos !== po || st.squad.includes(n)) continue;
        const cost = price10(n); if (cost > st.bank + sv) continue;
        const sq = st.squad.map((x) => (x === o ? n : x)); if (!clubOk(sq)) continue;
        const gain = restScore(sq, gi) - base;
        if (gain > 0.3) singles.push({ o, n, gain, sq, bank: st.bank + sv - cost });
      }
    }
    singles.sort((a, b) => b.gain - a.gain);
    singles.slice(0, movesPerState).forEach((m) => out.push({ tr: [[m.o, m.n]], sq: m.sq, bank: m.bank, est: m.gain }));
    // انتقالين بنفس الجولة (من أفضل الحركات الفردية)
    const top = singles.slice(0, 18);
    for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
      const a = top[i], b = top[j]; if (a.o === b.o || a.n === b.n) continue;
      const sq = st.squad.map((x) => (x === a.o ? a.n : x === b.o ? b.n : x)); if (!clubOk(sq)) continue;
      const bank = st.bank + (st.sell.get(a.o) ?? price10(a.o)) + (st.sell.get(b.o) ?? price10(b.o)) - price10(a.n) - price10(b.n); if (bank < 0) continue;
      const gain = restScore(sq, gi) - base; if (gain > a.gain + 0.5) out.push({ tr: [[a.o, a.n], [b.o, b.n]], sq, bank, est: gain });
    }
    return out.sort((a, b) => b.est - a.est).slice(0, movesPerState + 3);
  }

  let states = [{ squad: [...P.squad], bank: Math.round(P.bank * 10), ft: P.ft, sell: sell0, hits: 0, total: 0, steps: [] }];
  for (let gi = 0; gi < gws.length; gi++) {
    const next = [];
    for (const st of states) {
      const opts = [{ tr: [], sq: st.squad, bank: st.bank, est: 0 }, ...movesFor(st, gi)];
      for (const m of opts) {
        const n = m.tr.length, paid = Math.max(0, n - st.ft), hits = st.hits + paid;
        if (paid && hits > maxHits) continue;
        const sell = new Map(st.sell); m.tr.forEach(([o, nn]) => { sell.delete(o); sell.set(nn, price10(nn)); });
        const ft = Math.min(5, Math.max(0, st.ft - n) + 1);
        const sc = gwScore(m.sq, gi), total = st.total + sc - paid * 4;
        next.push({ squad: m.sq, bank: m.bank, ft, sell, hits, total, steps: [...st.steps, { gw: gws[gi], tr: m.tr, hit: paid * 4, pts: sc, ftBefore: st.ft }], key: [...m.sq].sort().join(',') + '|' + ft, rank: total + restScore(m.sq, gi + 1) + ft * ftValue });
      }
    }
    const seen = new Map();
    for (const s of next.sort((a, b) => b.rank - a.rank)) if (!seen.has(s.key)) seen.set(s.key, s);
    states = [...seen.values()].slice(0, beam);
  }
  const final = (s) => s.total + s.ft * ftValue;
  const best = states.sort((a, b) => final(b) - final(a))[0];
  // المرجع: بدون أي انتقال
  let hold = 0; for (let gi = 0; gi < gws.length; gi++) hold += gwScore(P.squad, gi);
  const holdFt = Math.min(5, P.ft + gws.length);
  // الكابتن المقترح لكل جولة
  best.steps.forEach((s, i) => { const sq = i === 0 ? applyAll(P.squad, best.steps.slice(0, 1)) : applyAll(P.squad, best.steps.slice(0, i + 1)); s.cap = [...sq].sort((a, b) => XP.get(b)[i] - XP.get(a)[i])[0]; s.squad = sq; });
  return { gws, steps: best.steps, total: Math.round(best.total * 10) / 10, hold: Math.round(hold * 10) / 10, gain: Math.round((best.total - hold) * 10) / 10, ftEnd: best.ft, holdFt, bankEnd: best.bank / 10, hits: best.hits * 4 };
}
function applyAll(squad, steps) { let sq = [...squad]; steps.forEach((s) => s.tr.forEach(([o, n]) => (sq = sq.map((x) => (x === o ? n : x))))); return sq; }
