/* =========================================================
   محرّك التحليل: النقاط المتوقعة، التشكيلة المثالية، التحليل، البدلاء
========================================================= */
export const r1 = (n) => Math.round(n * 10) / 10;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const MULT = [1, 1.3, 1.15, 1.0, 0.85, 0.7];

let G = null;
export function setGame(g) { G = g; cache.clear(); }
const cache = new Map();

export function fixturesFor(team, gw) {
  return (G.fx[gw] || []).filter((m) => m.h === team || m.a === team).map((m) => {
    const home = m.h === team;
    return { opp: home ? m.a : m.h, home, fdr: home ? m.hd : m.ad, ko: m.ko, fin: m.fin, started: m.started, hs: m.hs, as: m.as };
  });
}
export function avgFdr(team, from, n) {
  let s = 0, c = 0;
  for (let g = from; g < from + n; g++) for (const f of fixturesFor(team, g)) { s += f.fdr; c++; }
  return c ? s / c : 3;
}
export function avail(p, gw = G.next) {
  let a = p.chance != null ? p.chance / 100 : p.st === 'a' ? 1 : p.st === 'd' ? 0.5 : 0;
  if (gw && G.next && gw > G.next && p.st !== 'u') a = Math.min(1, a + 0.25 * (gw - G.next)); // احتمال التعافي لاحقاً
  if (p.st === 'u') a = 0; // غادر الدوري / غير متاح
  return a;
}
function basePts(p) {
  const share = G.finished ? clamp(p.min / (90 * G.finished), 0, 1) : 0.7;
  const b = 0.55 * p.ppg + 0.45 * p.form;
  return b * (0.3 + 0.7 * share);
}
/** النقاط المتوقعة للاعب بجولة (تدعم الجولات المزدوجة والفارغة) */
export function xp(p, gw = G.next) {
  if (!gw) return 0;
  const k = p.id + ':' + gw;
  if (cache.has(k)) return cache.get(k);
  const fx = fixturesFor(p.team, gw);
  let v;
  if (gw === G.next && p.ep != null && fx.length <= 1) v = p.ep; // تقدير الفانتازي الرسمي للجولة القادمة
  else { const b = basePts(p); v = fx.reduce((s, f) => s + b * MULT[f.fdr || 3], 0) * avail(p, gw); }
  v = r1(Math.max(0, v));
  cache.set(k, v);
  return v;
}
export function xpN(p, from, n) { let s = 0; for (let g = from; g < from + n && g <= G.lastGW; g++) s += xp(p, g); return r1(s); }

/* ---------- قواعد الفريق ---------- */
export function counts(ids) { const c = { GK: 0, DEF: 0, MID: 0, FWD: 0 }; ids.forEach((id) => c[G.PM[id].pos]++); return c; }
export function validXI(ids) { const c = counts(ids); return ids.length === 11 && c.GK === 1 && c.DEF >= 3 && c.DEF <= 5 && c.MID >= 2 && c.MID <= 5 && c.FWD >= 1 && c.FWD <= 3; }
export const formation = (ids) => { const c = counts(ids); return `${c.DEF}-${c.MID}-${c.FWD}`; };
export const teamCount = (team, ids) => ids.filter((id) => G.PM[id].team === team).length;

export function bestXI(squad, gw = G.next) {
  const ps = squad.map((id) => G.PM[id]).sort((a, b) => xp(b, gw) - xp(a, gw));
  const gks = ps.filter((p) => p.pos === 'GK'), out = ps.filter((p) => p.pos !== 'GK');
  const xi = [gks[0].id], need = { DEF: 3, MID: 2, FWD: 1 }, max = { DEF: 5, MID: 5, FWD: 3 }, c = { DEF: 0, MID: 0, FWD: 0 }, used = new Set();
  for (const pos of ['DEF', 'MID', 'FWD']) for (const p of out) if (p.pos === pos && c[pos] < need[pos]) { xi.push(p.id); c[pos]++; used.add(p.id); }
  for (const p of out) { if (xi.length >= 11) break; if (!used.has(p.id) && c[p.pos] < max[p.pos]) { xi.push(p.id); c[p.pos]++; used.add(p.id); } }
  const bench = [gks[1].id, ...out.filter((p) => !xi.includes(p.id)).map((p) => p.id)];
  const byXp = [...xi].sort((a, b) => xp(G.PM[b], gw) - xp(G.PM[a], gw));
  return { xi, bench, cap: byXp[0], vc: byXp[1] };
}

export function projected(plan, gw = G.next) {
  let s = 0;
  plan.xi.forEach((id) => { let v = xp(G.PM[id], gw); if (id === plan.cap) v *= plan.chip === '3xc' ? 3 : 2; s += v; });
  if (plan.chip === 'bboost') plan.bench.forEach((id) => (s += xp(G.PM[id], gw)));
  return r1(s - hits(plan));
}
export const hits = (plan) => plan.transfers.reduce((a, t) => a + t.cost, 0);

export function canBuy(plan, outId, inId) {
  const o = G.PM[outId], n = G.PM[inId];
  if (plan.squad.includes(inId)) return 'اللاعب موجود بفريقك';
  if (o.pos !== n.pos) return 'لازم نفس المركز';
  if (n.price > r1(plan.bank + o.price)) return 'الميزانية ما تكفي';
  if (teamCount(n.team, plan.squad) - (o.team === n.team ? 1 : 0) >= 3) return 'الحد 3 لاعبين من نفس النادي';
  return '';
}

/* ---------- التحليل ---------- */
export function analyze(plan, esc) {
  const gw = G.next, PM = G.PM;
  const xi = plan.xi.map((id) => PM[id]), sq = plan.squad.map((id) => PM[id]);
  const opt = bestXI(plan.squad);
  const optPts = opt.xi.reduce((a, id) => a + xp(PM[id], gw), 0) + xp(PM[opt.cap], gw);
  const cur = xi.reduce((a, p) => a + xp(p, gw), 0) + xp(PM[plan.cap], gw);
  const grp = (f) => xi.filter(f);
  const att = grp((p) => p.pos === 'MID' || p.pos === 'FWD'), def = grp((p) => p.pos === 'GK' || p.pos === 'DEF');
  const m = {
    attack: clamp(att.reduce((a, p) => a + xpN(p, gw, 3), 0) / (att.length || 1) / 18 * 100, 0, 100),
    defense: clamp(def.reduce((a, p) => a + xpN(p, gw, 3), 0) / (def.length || 1) / 13 * 100, 0, 100),
    fixt: clamp((5 - xi.reduce((a, p) => a + avgFdr(p.team, gw, 3), 0) / 11) / 3 * 100, 0, 100),
    form: clamp(xi.reduce((a, p) => a + p.form, 0) / 11 / 6.5 * 100, 0, 100),
    availability: xi.reduce((a, p) => a + avail(p), 0) / 11 * 100,
    lineup: clamp(optPts ? cur / optPts * 100 : 100, 0, 100),
  };
  const overall = Math.round(m.attack * 0.22 + m.defense * 0.15 + m.fixt * 0.15 + m.form * 0.15 + m.availability * 0.18 + m.lineup * 0.15);
  const A = [];
  xi.forEach((p) => {
    if (avail(p) === 0) A.push({ t: 'bad', ic: '!', m: `<b>${esc(p.name)}</b> غير متاح وهو بالتشكيلة الأساسية${p.news ? ` — ${esc(p.news)}` : ''}`, act: { l: 'بدّل', f: `openPlayer(${p.id})` } });
    else if (avail(p) < 1) A.push({ t: 'warn', ic: '?', m: `<b>${esc(p.name)}</b> مشكوك بمشاركته (${Math.round(avail(p) * 100)}%)${p.news ? ` — ${esc(p.news)}` : ''}` });
    if (!fixturesFor(p.team, gw).length) A.push({ t: 'bad', ic: '∅', m: `<b>${esc(p.name)}</b> فريقه ما عنده مباراة بالجولة ${gw} (جولة فارغة)` });
  });
  const capBest = [...xi].sort((a, b) => xp(b, gw) - xp(a, gw))[0];
  if (capBest && capBest.id !== plan.cap && xp(capBest, gw) - xp(PM[plan.cap], gw) > 0.8)
    A.push({ t: 'warn', ic: 'C', m: `الكابتن الأفضل هو <b>${esc(capBest.name)}</b> (${xp(capBest, gw)} متوقع) بدل ${esc(PM[plan.cap].name)}`, act: { l: 'اجعله كابتن', f: `setCap(${capBest.id})` } });
  const b1 = PM[plan.bench[1]], worst = [...xi].filter((p) => p.pos !== 'GK').sort((a, b) => xp(a, gw) - xp(b, gw))[0];
  if (b1 && worst && xp(b1, gw) - xp(worst, gw) > 1)
    A.push({ t: 'info', ic: '⇅', m: `<b>${esc(b1.name)}</b> على الدكة متوقع ${xp(b1, gw)}، أكثر من <b>${esc(worst.name)}</b> (${xp(worst, gw)})`, act: { l: 'تشكيلة مثالية', f: 'applyBest()' } });
  const tc = {}; plan.squad.forEach((id) => (tc[PM[id].team] = (tc[PM[id].team] || 0) + 1));
  Object.entries(tc).forEach(([t, n]) => { if (n >= 3 && avgFdr(+t, gw, 3) >= 3.7) A.push({ t: 'warn', ic: '⚠', m: `عندك ${n} لاعبين من <b>${esc(G.teams[t].name)}</b> ومبارياته الجاية صعبة` }); });
  xi.forEach((p) => { if (avail(p) === 1 && avgFdr(p.team, gw, 3) >= 4.2) A.push({ t: 'info', ic: '📅', m: `مباريات <b>${esc(p.name)}</b> الثلاث الجاية صعبة جداً` }); });
  sq.forEach((p) => { if (p.cc < 0 || (p.tout > 3 * p.tin && p.tout > 50000)) A.push({ t: 'info', ic: '▼', m: `سعر <b>${esc(p.name)}</b> ${p.cc < 0 ? 'نزل هالجولة' : 'معرّض للنزول (بيع كبير)'}` }); });
  if (plan.bank >= 1.5) A.push({ t: 'info', ic: '$', m: `عندك <b>${plan.bank.toFixed(1)}م</b> بالبنك غير مستغلة` });
  if (plan.ft >= 2) A.push({ t: 'ok', ic: '↻', m: `عندك ${plan.ft} انتقالات مجانية (تقديري) — استغلها قبل ما تضيع` });
  if (!A.length) A.push({ t: 'ok', ic: '✓', m: 'تشكيلتك ممتازة وما بيها مشاكل واضحة هالجولة!' });
  return { overall, metrics: m, alerts: A, cur: r1(cur), opt: r1(optPts) };
}

export function suggestions(plan, limit = 6) {
  const gw = G.next, PM = G.PM, res = [];
  plan.squad.forEach((oid) => {
    const o = PM[oid], budget = r1(plan.bank + o.price);
    let best = null;
    for (const c of G.players) {
      if (c.pos !== o.pos || plan.squad.includes(c.id) || c.price > budget || avail(c) < 0.75) continue;
      if (G.finished && c.min < 90 * G.finished * 0.35) continue; // لاعب ما يلعب أساسي
      if (teamCount(c.team, plan.squad) - (o.team === c.team ? 1 : 0) >= 3) continue;
      const g = xpN(c, gw, 3) - xpN(o, gw, 3);
      if (!best || g > best.g) best = { c, g };
    }
    if (best && best.g > 0.5) res.push({ o, c: best.c, g: r1(best.g) });
  });
  return res.sort((a, b) => b.g - a.g).slice(0, limit);
}
export function captainRank(plan, n = 5) { return plan.xi.map((id) => G.PM[id]).sort((a, b) => xp(b) - xp(a)).slice(0, n); }

/** أفضل تشكيلة بتشكيل محدد مثل "3-4-3" */
export function bestXIFormation(squad, f, gw = G.next) {
  const [d, m, fw] = f.split('-').map(Number);
  const ps = squad.map((id) => G.PM[id]).sort((a, b) => xp(b, gw) - xp(a, gw));
  const take = (pos, n) => ps.filter((p) => p.pos === pos).slice(0, n).map((p) => p.id);
  const xi = [...take('GK', 1), ...take('DEF', d), ...take('MID', m), ...take('FWD', fw)];
  if (xi.length !== 11) return null;
  const gks = ps.filter((p) => p.pos === 'GK');
  const bench = [gks.find((p) => !xi.includes(p.id)).id, ...ps.filter((p) => p.pos !== 'GK' && !xi.includes(p.id)).map((p) => p.id)];
  const byXp = [...xi].sort((a, b) => xp(G.PM[b], gw) - xp(G.PM[a], gw));
  return { xi, bench, cap: byXp[0], vc: byXp[1] };
}
/** الجولات المزدوجة والفارغة من جدول المباريات الرسمي */
export function dgwBgw(from, to) {
  const out = [];
  for (let g = from; g <= to; g++) {
    const fx = G.fx[g] || []; const cnt = {};
    fx.forEach((m) => { cnt[m.h] = (cnt[m.h] || 0) + 1; cnt[m.a] = (cnt[m.a] || 0) + 1; });
    const dbl = Object.keys(cnt).filter((k) => cnt[k] > 1).map(Number);
    const blank = Object.keys(G.teams).map(Number).filter((k) => !cnt[k]);
    if (dbl.length || blank.length) out.push({ gw: g, dbl, blank });
  }
  return out;
}
export const getGame = () => G;
