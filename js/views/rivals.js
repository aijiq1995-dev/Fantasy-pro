/* =========================================================
   متتبّع المنافسين — الدوريات الكلاسيكية + دوريات المواجهات (H2H)
   بعد إغلاق الجولة: تشكيلة كل منافس، الكابتن، الكروت، الانتقالات والخصم،
   نقاطه المباشرة، اللاعبين اللي عنده وانت ما عندك (الخطر) والعكس (فرصتك)،
   ونسبة فوزك بالدوري (محاكاة) أو بمواجهة هالأسبوع (H2H)
========================================================= */
import { ST, PM, tShort } from '../store.js';
import { tt, t } from '../i18n.js';
import { esc, I, fmt, toast, openSheet, sheetHead } from '../ui.js';
import * as FPL from '../fpl.js';
import { liveCalc } from '../live-engine.js';
import { xp } from '../engine.js';
import { pShirt } from './common.js';

let sel = null, S = {}, busy = false, lastRefresh = 0;
const CHIP = { wildcard: tt('وايلد كارد', 'Wildcard'), freehit: tt('فري هت', 'Free Hit'), bboost: tt('بنش بوست', 'Bench Boost'), '3xc': tt('تريبل كابتن', 'Triple Captain'), manager: tt('المدرب', 'Manager') };
function leagues() {
  const c = (ST.E.entry.leagues?.classic || []).filter((l) => l.league_type === 'x').map((l) => ({ id: l.id, name: l.name, kind: 'c', rank: l.entry_rank, n: l.rank_count }));
  const h = (ST.E.entry.leagues?.h2h || []).map((l) => ({ id: l.id, name: l.name, kind: 'h', rank: l.entry_rank, n: l.rank_count }));
  return [...h, ...c];
}
const gwStarted = () => { const ev = ST.G.events.find((e) => e.id === ST.G.cur); return ev && new Date(ev.deadline) < new Date(); };
async function ensureLive(gw) {
  if (ST.live && ST.liveRawGW === gw) return;
  const l = await FPL.loadLive(gw); ST.live = Object.fromEntries(l.elements.map((x) => [x.id, x.stats])); ST.liveRaw = l.elements; ST.liveRawGW = gw;
}
const pool = async (arr, n, fn) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(...(await Promise.all(arr.slice(i, i + n).map(fn)))); return out; };

async function load(L) {
  busy = true; const me = ST.profile.teamId, gw = ST.G.cur; S = { L, err: '' }; window.render();
  try {
    await ensureLive(gw).catch(() => {});
    let members = [], opp = null, table = null;
    if (L.kind === 'c') {
      const d = await FPL.loadLeague(L.id, 1); const res = d.standings?.results || [];
      const myIdx = res.findIndex((r) => r.entry === me);
      const pick = new Set(res.slice(0, 10).map((r) => r.entry)); if (myIdx >= 0) res.slice(Math.max(0, myIdx - 3), myIdx + 4).forEach((r) => pick.add(r.entry));
      members = res.filter((r) => pick.has(r.entry)).map((r) => ({ entry: r.entry, name: r.entry_name, mgr: r.player_name, rank: r.rank, total: r.total, gwPts: r.event_total }));
      if (myIdx < 0) members.push({ entry: me, name: ST.E.entry.name, mgr: '', rank: L.rank, total: ST.E.entry.summary_overall_points, gwPts: 0 });
    } else {
      const d = await FPL.loadH2H(L.id); table = d.standings?.results || [];
      members = table.slice(0, 24).map((r) => ({ entry: r.entry, name: r.entry_name, mgr: r.player_name, rank: r.rank, total: r.total, pf: r.points_for, w: r.matches_won, dr: r.matches_drawn, l: r.matches_lost }));
      const oppOf = async (g) => { try { const m = await FPL.loadH2HMatches(L.id, g); const mm = (m.results || []).find((x) => x.entry_1_entry === me || x.entry_2_entry === me); return mm ? (mm.entry_1_entry === me ? mm.entry_2_entry : mm.entry_1_entry) : null; } catch { return null; } };
      if (gwStarted()) opp = await oppOf(gw);
      var nextOpp = ST.G.next && ST.G.next !== gw ? await oppOf(ST.G.next) : null;
      if (!members.some((x) => x.entry === me)) members.push({ entry: me, name: ST.E.entry.name, rank: L.rank });
    }
    // تشكيلات + انتقالات الجولة
    await pool(members, 6, async (m) => {
      try { m.picks = await FPL.fetchPicks(m.entry, gw); m.calc = liveCalc(m.picks, gw); } catch { m.picks = null; }
      if (m.entry !== me) { try { const tr = await FPL.fetchTransfers(m.entry); m.tr = (Array.isArray(tr) ? tr : []).filter((x) => x.event === gw); } catch { m.tr = []; } }
    });
    S = { L, members, opp, nextOpp: typeof nextOpp !== 'undefined' ? nextOpp : null, table, gw, at: Date.now() };
    if (L.kind === 'c') simSeason(members).catch(() => {});
  } catch (e) { S = { L, err: e.message }; }
  busy = false; if (ST.view === 'rivals') window.render();
}

/* ---------- محاكاة نهاية الموسم (كلاسيك) ---------- */
async function simSeason(members) {
  const top = [...members].sort((a, b) => b.total - a.total).slice(0, 12);
  await pool(top, 6, async (m) => { try { const h = await FPL.fetchHistory(m.entry); const pts = h.current.slice(-10).map((x) => x.points - (x.event_transfers_cost || 0)); const mu = pts.reduce((a, b) => a + b, 0) / Math.max(1, pts.length); m.mu = mu; m.sd = Math.max(8, Math.sqrt(pts.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, pts.length))); } catch { m.mu = 50; m.sd = 14; } });
  const R = Math.max(0, ST.G.lastGW - ST.G.cur), N = 4000, wins = new Map(top.map((m) => [m.entry, 0]));
  const randn = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  for (let s = 0; s < N; s++) { let best = null, bv = -1e9; for (const m of top) { const v = m.total + R * m.mu + Math.sqrt(R) * m.sd * randn(); if (v > bv) { bv = v; best = m.entry; } } wins.set(best, wins.get(best) + 1); }
  top.forEach((m) => { m.win = (wins.get(m.entry) / N) * 100; });
  S.sim = { R, top: top.sort((a, b) => b.win - a.win) };
  if (ST.view === 'rivals') window.render();
}

/* ---------- احتمال الفوز بمواجهة هالأسبوع (H2H) ---------- */
function remainingXP(m) {
  if (!m?.calc) return { exp: 0, n: 0 };
  const gw = S.gw, fx = ST.G.fx[gw] || []; let exp = 0, n = 0;
  m.calc.rows.forEach((r) => { if (r.m === 0 && !r.subIn) return; const p = PM(r.id); if (!p) return; const f = fx.filter((x) => x.h === p.team || x.a === p.team); const left = f.filter((x) => !x.fin); if (!left.length) return; const frac = left.reduce((a, x) => a + (x.started ? Math.max(0, 1 - (x.min || 0) / 90) : 1), 0) / Math.max(1, f.length); exp += xp(p, gw) * frac * Math.max(1, r.m); n += frac; });
  return { exp, n };
}
const Phi = (z) => { const tt2 = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * tt2 * (0.3193815 + tt2 * (-0.3565638 + tt2 * (1.781478 + tt2 * (-1.821256 + tt2 * 1.330274)))); return z > 0 ? 1 - p : p; };

/* ---------- الرسم ---------- */
function diffs(me, them) {
  const mm = new Map((me?.picks?.picks || []).map((p) => [p.element, p.multiplier])), tm = new Map((them?.picks?.picks || []).map((p) => [p.element, p.multiplier]));
  const ids = new Set([...mm.keys(), ...tm.keys()]); const mine = [], theirs = [];
  ids.forEach((id) => { const a = mm.get(id) || 0, b = tm.get(id) || 0; if (a > b) mine.push({ id, d: a - b }); else if (b > a) theirs.push({ id, d: b - a }); });
  const pts = (id) => ST.live?.[id]?.total_points ?? 0;
  return { mine: mine.sort((x, y) => pts(y.id) * y.d - pts(x.id) * x.d), theirs: theirs.sort((x, y) => pts(y.id) * y.d - pts(x.id) * x.d) };
}
function threats(members, meE) {
  const me = members.find((m) => m.entry === meE), mine = new Set((me?.picks?.picks || []).filter((p) => p.multiplier > 0).map((p) => p.element));
  const others = members.filter((m) => m.entry !== meE && m.picks);
  const cnt = new Map(), capC = new Map();
  others.forEach((m) => m.picks.picks.forEach((p) => { if (p.multiplier > 0) { cnt.set(p.element, (cnt.get(p.element) || 0) + 1); if (p.multiplier >= 2) capC.set(p.element, (capC.get(p.element) || 0) + 1); } }));
  const n = Math.max(1, others.length);
  const th = [...cnt].filter(([id]) => !mine.has(id)).map(([id, c]) => ({ id, pct: Math.round((c / n) * 100), cap: capC.get(id) || 0 })).sort((a, b) => b.pct - a.pct).slice(0, 6);
  const op = [...mine].map((id) => ({ id, pct: Math.round(((cnt.get(id) || 0) / n) * 100) })).filter((x) => x.pct <= 30).sort((a, b) => a.pct - b.pct).slice(0, 6);
  return { th, op, n: others.length };
}
const chipTag = (c) => (c ? `<span class="tag" style="background:rgba(167,139,250,.18);color:var(--violet);font-size:10.5px">${CHIP[c] || c}</span>` : '');
function rivalCard(m, me, i) {
  const isMe = m.entry === ST.profile.teamId, cap = m.picks?.picks.find((p) => p.is_captain), capP = cap && PM(cap.element);
  const live = m.calc?.total ?? m.gwPts ?? null, gap = !isMe && me?.calc && m.calc ? m.calc.total - me.calc.total : null;
  const hit = m.picks?.entry_history?.event_transfers_cost || 0;
  return `<div class="rv-c ${isMe ? 'me' : ''} ${m.entry === S.opp ? 'opp' : m.entry === S.nextOpp ? 'nopp' : ''}" style="--d:${Math.min(i, 14) * 35}ms" onclick="rvOpen(${m.entry})">
   <div class="rv-rank">${m.rank ?? '—'}</div>
   <div style="flex:1;min-width:0"><div class="flex" style="gap:6px;flex-wrap:wrap;align-items:center"><b class="rv-name">${esc(m.name)}</b>${isMe ? `<span class="tag lime" style="font-size:10.5px">${tt('إنت', 'You')}</span>` : ''}${m.entry === S.opp ? `<span class="tag" style="background:rgba(239,68,68,.15);color:var(--bad);font-size:10.5px">${tt(`خصمك بالجولة ${S.gw}`, `Opponent GW${S.gw}`)}</span>` : ''}${m.entry === S.nextOpp ? `<span class="tag" style="background:rgba(251,146,60,.16);color:#FB923C;font-size:10.5px">${tt(`خصمك الجاي (ج${ST.G.next})`, `Next opponent (GW${ST.G.next})`)}</span>` : ''}${chipTag(m.picks?.active_chip)}</div>
    <div class="mut" style="font-size:12px;margin-top:2px">${capP ? `${I('i-crown', 'i', 'width:12px;height:12px;vertical-align:-2px;color:var(--gold)')} ${esc(capP.name)} (${(ST.live?.[capP.id]?.total_points ?? 0) * (cap.multiplier || 2)})` : tt('التشكيلة تنكشف بعد الإغلاق', 'Hidden until deadline')}${!isMe && m.tr?.length ? ` · ${I('i-swap', 'i', 'width:12px;height:12px;vertical-align:-2px')} ${m.tr.length}${hit ? ` <span class="down">(−${hit})</span>` : ''}` : ''}</div>
    ${!isMe && m.tr?.length ? `<div class="rv-tr">${m.tr.slice(0, 3).map((x) => `<span><b class="up">${esc(PM(x.element_in)?.name || '?')}</b> ← <s class="mut">${esc(PM(x.element_out)?.name || '?')}</s></span>`).join('')}</div>` : ''}</div>
   <div class="rv-pts"><b class="num">${live ?? '—'}</b><small>${tt('الجولة', 'GW')}</small>${gap != null ? `<span class="${gap > 0 ? 'down' : gap < 0 ? 'up' : 'mut'}" style="font-size:11px">${gap > 0 ? '+' + gap : gap}</span>` : ''}</div></div>`;
}

export function vRivals() {
  const Ls = leagues();
  if (!Ls.length) return `<div class="empty">${I('i-users', 'i', 'width:40px;height:40px')}<b>${tt('ما مشترك بأي دوري خاص', 'No private leagues')}</b></div>`;
  if (!sel) sel = Ls[0];
  // بدت جولة جديدة؟ نحدّث بيانات الجولة ونعيد التحميل حتى ينتقل الأحمر لخصمك الجديد
  const nx = ST.G.events.find((e) => e.id === ST.G.next);
  if (nx && new Date(nx.deadline) < new Date() && Date.now() - lastRefresh > 60e3) { lastRefresh = Date.now(); window.loadAll?.(true).then(() => { S = {}; if (ST.view === 'rivals') window.render(); }); }
  if (S.gw && S.gw !== ST.G.cur && !busy) S = {};
  if (!S.L || S.L.id !== sel.id) { if (!busy) load(sel); }
  const picker = `<div class="rv-lgs">${Ls.map((l) => `<button class="${sel.id === l.id ? 'on' : ''}" onclick="rvSel(${l.id},'${l.kind}')">${I(l.kind === 'h' ? 'i-swords' : 'i-trophy', 'i', 'width:14px;height:14px')}<span>${esc(l.name)}</span><small>${l.kind === 'h' ? 'H2H' : '#' + (l.rank ?? '—')}</small></button>`).join('')}</div>`;
  if (busy || !S.members) return picker + (S.err ? `<div class="card mut" style="margin-top:12px">${esc(S.err)}</div>` : `<div class="card aiload" style="margin-top:12px"><i></i><i></i><i></i><span>${tt('جارِ جلب تشكيلات منافسينك…', 'Fetching rivals’ teams…')}</span></div>`);
  const meE = ST.profile.teamId, me = S.members.find((m) => m.entry === meE), started = gwStarted();
  const T = threats(S.members, meE);
  let top = '';
  const curFin = !!ST.G.events.find((e) => e.id === S.gw)?.fin;
  if (sel.kind === 'h' && S.opp && !(curFin && S.nextOpp)) {
    const o = S.members.find((m) => m.entry === S.opp);
    if (o && me?.calc && o.calc) {
      const a = remainingXP(me), b = remainingXP(o), mu = me.calc.total + a.exp - (o.calc.total + b.exp), sd = Math.max(1.5, Math.sqrt((a.n + b.n) * 16));
      const pw = Math.round(Phi(mu / sd) * 100);
      top = `<div class="card rv-h2h"><div class="mut" style="font-size:12px;text-align:center">${tt(`مواجهتك بالجولة ${S.gw}`, `Your GW${S.gw} match`)}</div><div class="rv-vs"><div><b>${tt('إنت', 'You')}</b><span class="num big-num">${me.calc.total}</span></div><div class="rv-prob" style="--p:${pw}"><b>${pw}%</b><small>${tt('احتمال فوزك', 'Win chance')}</small></div><div><b>${esc(o.name)}</b><span class="num big-num">${o.calc.total}</span></div></div><div class="mut" style="font-size:11.5px;text-align:center">${tt(`متبقي متوقع: إنت +${a.exp.toFixed(1)} · هو +${b.exp.toFixed(1)}`, `Remaining xP: you +${a.exp.toFixed(1)} · them +${b.exp.toFixed(1)}`)}</div><button class="btn btn-g btn-b" style="margin-top:10px" onclick="rvOpen(${o.entry})">${I('i-pitch', 'i', 'width:16px;height:16px')}${tt('شوف تشكيلته والفروقات', 'See lineup & differentials')}</button></div>`;
    }
  }
  if (sel.kind === 'h' && S.nextOpp && !top) {
    const o = S.members.find((m) => m.entry === S.nextOpp);
    if (o) top = `<div class="card rv-h2h" style="border-color:rgba(251,146,60,.4)"><div class="mut" style="font-size:12px;text-align:center">${tt(`مواجهتك الجاية · الجولة ${ST.G.next}`, `Next match · GW${ST.G.next}`)}</div><div class="rv-vs"><div><b>${tt('إنت', 'You')}</b><span class="num big-num">${me?.rank ?? '—'}</span><small class="mut">${tt('ترتيبك', 'rank')}</small></div><div class="mut" style="font-size:20px;font-weight:700">VS</div><div><b>${esc(o.name)}</b><span class="num big-num">${o.rank ?? '—'}</span><small class="mut">${tt('ترتيبه', 'rank')} · ${o.w ?? 0}-${o.dr ?? 0}-${o.l ?? 0}</small></div></div><div class="mut" style="font-size:11.5px;text-align:center">${tt('تشكيلته للجولة الجاية تنكشف بعد الإغلاق — هسة تگدر تشوف تشكيلته الحالية', 'Their next lineup appears after the deadline')}</div><button class="btn btn-g btn-b" style="margin-top:10px" onclick="rvOpen(${o.entry})">${I('i-pitch', 'i', 'width:16px;height:16px')}${tt('شوف تشكيلته الحالية', 'See current lineup')}</button></div>`;
  }
  if (sel.kind === 'c') top = S.sim ? `<div class="card"><b style="font-size:14px">${I('i-trophy', 'i', 'width:16px;height:16px;vertical-align:-3px;color:var(--gold)')} ${tt('نسبة الفوز بالدوري', 'Chance to win the league')}</b><span class="mut" style="font-size:11.5px"> · ${tt(`محاكاة ${S.sim.R} جولة متبقية`, `${S.sim.R} GWs simulated`)}</span>
     <div class="rv-sim">${S.sim.top.slice(0, 6).map((m) => `<div class="${m.entry === meE ? 'me' : ''}"><span>${esc(m.name)}</span><div class="dc-bar"><i style="width:${Math.max(2, m.win)}%;background:${m.entry === meE ? 'var(--acc)' : '#60A5FA'}"></i></div><b class="num">${m.win < 1 && m.win > 0 ? '<1' : Math.round(m.win)}%</b></div>`).join('')}</div>
     ${S.sim.top.some((m) => m.entry === meE) ? '' : `<div class="mut" style="font-size:12px;margin-top:6px">${tt('إنت بعيد عن الصدارة حالياً — الفرص الأكبر للي فوك', 'You are currently far from the top')}</div>`}</div>` : `<div class="card aiload"><i></i><i></i><i></i><span>${tt('جارِ حساب نسبة الفوز بالدوري…', 'Simulating the season…')}</span></div>`;
  const thr = started && T.n ? `<div class="grid g2" style="margin-top:10px"><div class="card"><b style="font-size:13.5px;color:var(--bad)">${I('i-alert', 'i', 'width:15px;height:15px;vertical-align:-3px')} ${tt('خطر عليك', 'Threats')}</b><div class="mut" style="font-size:11px;margin-bottom:6px">${tt('عند منافسينك وانت ما عندك', 'Owned by rivals, not you')}</div>${T.th.map((x) => `<div class="rv-own" onclick="openPlayer(${x.id})"><span>${esc(PM(x.id)?.name || '')}${x.cap ? ` ${I('i-crown', 'i', 'width:11px;height:11px;color:var(--gold)')}${x.cap}` : ''}</span><b class="num">${x.pct}%</b><small class="num">${ST.live?.[x.id]?.total_points ?? 0}${tt('ن', 'p')}</small></div>`).join('') || '<p class="mut">—</p>'}</div>
     <div class="card"><b style="font-size:13.5px;color:var(--acc)">${I('i-sparkle', 'i', 'width:15px;height:15px;vertical-align:-3px')} ${tt('فرصتك', 'Your edge')}</b><div class="mut" style="font-size:11px;margin-bottom:6px">${tt('عندك وقليل منهم عنده', 'Yours, rarely owned')}</div>${T.op.map((x) => `<div class="rv-own" onclick="openPlayer(${x.id})"><span>${esc(PM(x.id)?.name || '')}</span><b class="num">${x.pct}%</b><small class="num">${ST.live?.[x.id]?.total_points ?? 0}${tt('ن', 'p')}</small></div>`).join('') || '<p class="mut">—</p>'}</div></div>` : '';
  const list = [...S.members].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  return picker + `<div style="margin-top:12px">${top}</div>${thr}
   <div class="sec"><h2>${I('i-users')}${tt(`منافسينك بالجولة ${S.gw}`, `Rivals in GW${S.gw}`)}</h2><button class="icon-btn" onclick="rvReload(this)" aria-label="refresh">${I('i-refresh')}</button></div>
   ${!started ? `<div class="note">${I('i-info', 'i', 'color:var(--info)')}<span>${tt('تشكيلات وانتقالات الجولة الجاية تنكشف بعد الإغلاق — هسة تشوف تشكيلاتهم بالجولة الحالية.', 'Next GW picks appear after the deadline.')}</span></div>` : ''}
   <div class="rv-list">${list.map((m, i) => rivalCard(m, me, i)).join('')}</div>
   <p class="mut" style="font-size:11px;text-align:center;margin-top:10px">${sel.kind === 'c' ? tt('يعرض أول 10 بالدوري واللي حواليك. اضغط على أي فريق حتى تشوف تشكيلته كاملة والفروقات.', 'Shows top 10 and those around you. Tap a team for full lineup.') : tt('اضغط على أي فريق حتى تشوف تشكيلته كاملة والفروقات.', 'Tap a team for full lineup.')}</p>`;
}

function lineupSheet(entry) {
  const m = S.members?.find((x) => x.entry === entry); if (!m) return;
  const meE = ST.profile.teamId, me = S.members.find((x) => x.entry === meE);
  if (!m.picks) return openSheet(`${sheetHead(I('i-users'), esc(m.name))}<div class="note">${I('i-info')}<span>${tt('التشكيلة تنكشف بعد الإغلاق', 'Lineup hidden until deadline')}</span></div>`);
  const ps = [...m.picks.picks].sort((a, b) => a.position - b.position), mine = new Set((me?.picks?.picks || []).map((p) => p.element));
  const rows = m.calc?.rows || [], R = (id) => rows.find((r) => r.id === id);
  const pl = (p) => { const q = PM(p.element); if (!q) return ''; const r = R(p.element), pts = (r?.pts ?? ST.live?.[p.element]?.total_points ?? 0) * Math.max(1, p.multiplier); return `<div class="rv-pl ${mine.has(p.element) ? '' : 'diff'} ${r?.subOut ? 'dim' : ''}" onclick="closeSheet();setTimeout(()=>playerGW(${q.id},${S.gw},${Math.max(1, p.multiplier)}),200)">${p.is_captain ? `<span class="cb">${p.multiplier === 3 ? '3×' : 'C'}</span>` : p.is_vice_captain ? '<span class="cb v">V</span>' : ''}<div class="sh">${pShirt(q)}</div><div class="nm">${esc(q.name)}</div><div class="pt">${pts}</div></div>`; };
  const xi = ps.filter((p) => p.position <= 11), bench = ps.filter((p) => p.position > 11);
  const lines = ['GK', 'DEF', 'MID', 'FWD'].map((pos) => xi.filter((p) => PM(p.element)?.pos === pos));
  const D = diffs(me, m), hit = m.picks.entry_history?.event_transfers_cost || 0;
  const li = (x, who) => { const q = PM(x.id); return q ? `<div class="rv-own" onclick="closeSheet();setTimeout(()=>openPlayer(${q.id}),200)"><span>${esc(q.name)}${x.d > 1 ? ` ×${x.d}` : ''}</span><b class="num ${who}">${(ST.live?.[x.id]?.total_points ?? 0) * x.d}</b></div>` : ''; };
  openSheet(`${sheetHead(I('i-users'), esc(m.name), `${esc(m.mgr || '')} · ${tt('الجولة', 'GW')} ${S.gw}`)}
   <div class="kv"><div><b class="num">${m.calc?.total ?? '—'}</b><span>${tt('نقاطه', 'Points')}</span></div><div><b class="num">${me?.calc ? (m.calc.total - me.calc.total > 0 ? '+' : '') + (m.calc.total - me.calc.total) : '—'}</b><span>${tt('الفرق عنك', 'Gap')}</span></div><div><b>${m.picks.active_chip ? CHIP[m.picks.active_chip] || m.picks.active_chip : '—'}</b><span>${tt('الكرت', 'Chip')}</span></div><div><b class="num ${hit ? 'down' : ''}">${hit ? '−' + hit : 0}</b><span>${tt('خصم', 'Hit')}</span></div></div>
   ${m.tr?.length ? `<div class="rv-tr" style="margin:8px 0">${m.tr.map((x) => `<span><b class="up">${esc(PM(x.element_in)?.name || '?')}</b> ← <s class="mut">${esc(PM(x.element_out)?.name || '?')}</s></span>`).join('')}</div>` : ''}
   <div class="rv-pitch">${lines.map((l) => `<div class="rv-row">${l.map(pl).join('')}</div>`).join('')}</div>
   <div class="rv-bench">${bench.map(pl).join('')}</div>
   <div class="mut" style="font-size:11px;text-align:center;margin-top:6px">${tt('اللاعب المظلّل = مو موجود بفريقك', 'Highlighted = not in your team')}</div>
   ${m.entry !== meE ? `<div class="grid g2" style="margin-top:12px"><div><div class="mut" style="font-size:12px;margin-bottom:4px">${tt('عنده وما عندك', 'Only them')}</div>${D.theirs.map((x) => li(x, 'down')).join('') || '<p class="mut">—</p>'}</div><div><div class="mut" style="font-size:12px;margin-bottom:4px">${tt('عندك وما عنده', 'Only you')}</div>${D.mine.map((x) => li(x, 'up')).join('') || '<p class="mut">—</p>'}</div></div>` : ''}`);
}
Object.assign(window, {
  rvSel: (id, kind) => { sel = leagues().find((l) => l.id === id && l.kind === kind) || sel; S = {}; window.render(); },
  rvReload: (b) => { b?.classList.add('spin'); S = {}; window.render(); },
  rvOpen: (e) => lineupSheet(e),
});
