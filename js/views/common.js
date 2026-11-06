/* مكونات مشتركة بين الأقسام */
import { ST, tShort, tName, PM, savePlan } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, shirt, crest, posTag, fdr, spark, toast, openSheet, closeSheet, sheetHead, fmt, r1, RATE_TXT, LS } from '../ui.js';
import { xp, xpN, fixturesFor, avail, avgFdr, canBuy } from '../engine.js';
import * as FPL from '../fpl.js';
import * as AU from '../auth.js';

export const pShirt = (p, cls = '') => shirt(tShort(p.team), p.pos, cls);
export const fxLabel = (team, gw = ST.G.next) => { const f = fixturesFor(team, gw); return f.length ? f.map((x) => `${tShort(x.opp)} (${x.home ? t('home_s') : t('away_s')})`).join(' + ') : tt('لا مباراة', 'No match'); };
export const fdrChips = (team, from, n) => Array.from({ length: n }, (_, i) => from + i).filter((g) => g <= ST.G.lastGW).map((g) => { const f = fixturesFor(team, g); return f.length ? f.map((x) => `<span class="rate f${x.fdr}" title="GW${g}">${tShort(x.opp)}${x.home ? '' : '*'}</span>`).join('') : '<span class="rate" style="background:#1f2944;color:#94A3B8">—</span>'; }).join(' ');
export const stTag = (p) => { const a = avail(p); if (p.st === 's') return `<span class="tag red" style="font-size:10px">${tt('موقوف', 'Susp.')}</span>`; return a === 1 ? '' : `<span class="tag ${a === 0 ? 'red' : 'amber'}" style="font-size:10px">${a === 0 ? tt('غائب', 'Out') : Math.round(a * 100) + '%'}</span>`; };
export function playerRow(p, right = '', click = `openPlayer(${p.id})`) {
  const mine = ST.plan?.squad.includes(p.id);
  return `<div class="row tap" onclick="${click}"><div class="mini">${pShirt(p)}</div><div class="info"><b>${posTag(p.pos)} ${esc(p.name)} ${stTag(p)} ${mine ? `<span class="tag lime" style="font-size:10px">${tt('بفريقك', 'Yours')}</span>` : ''}${ST.watch.has(p.id) ? I('i-star', 'i', 'width:13px;height:13px;color:#34D399;fill:#34D399;fill-opacity:1;vertical-align:middle') : ''}</b><span>${tName(p.team)} · ${p.price.toFixed(1)}م · ${fxLabel(p.team)}</span></div>${right}</div>`;
}
export const RISK_NOTE = (p) => (p.news ? `<div class="note" style="border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.07)">${I('i-alert', 'i', 'color:#F59E0B')}<span>${esc(p.news)}</span></div>` : '');

/* ---------- صفحة اللاعب الكاملة ---------- */
const sumCache = new Map();
export async function playerSummary(id) { if (sumCache.has(id)) return sumCache.get(id); const d = await FPL.loadPlayerSummary(id); sumCache.set(id, d); return d; }
export function openPlayer(id) {
  const p = PM(id), G = ST.G; if (!p) return;
  const mine = ST.plan?.squad.includes(id), inXI = ST.plan?.xi.includes(id), ov = ST.overrides?.[id];
  const nexts = Array.from({ length: 6 }, (_, i) => G.next + i).filter((g) => g <= G.lastGW);
  const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
  openSheet(`${sheetHead(`<div style="width:46px;height:46px">${pShirt(p)}</div>`, esc(p.full || p.name), `${t(({ GK: 'gk', DEF: 'def', MID: 'mid', FWD: 'fwd' })[p.pos])} · ${tName(p.team)}`, 'var(--glass2)', '')}
   <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${stTag(p) || `<span class="tag lime">${tt('جاهز', 'Available')}</span>`}<span class="tag">${p.price.toFixed(1)}م ${p.cc > 0 ? '<span class="up">▲</span>' : p.cc < 0 ? '<span class="down">▼</span>' : ''}</span><span class="tag">${t('own')} ${p.own}%</span>${mine ? `<span class="tag lime">${tt('بفريقك', 'In your team')}</span>` : ''}</div>
   ${RISK_NOTE(p)}${window.__EMBED?.isEst(id) ? `<div class="note" style="border-color:rgba(96,165,250,.35)">${I('i-alert', 'i', 'color:#60A5FA')}<span>${tt('الاسم والنادي والسعر والإصابة حقيقية؛ باقي الإحصاءات تقديرية بنسخة المحادثة.', 'Name, club, price and injury are real; other stats are estimates in this in-chat version.')}</span></div>` : ''}${ov?.note ? `<div class="note">${I('i-msg', 'i', 'color:#60A5FA')}<span><b>${tt('ملاحظة الإدارة', 'Admin note')}:</b> ${esc(ov.note)}</span></div>` : ''}
   <div class="kv" style="grid-template-columns:repeat(4,1fr)">${stat(p.total, t('total'))}${stat(p.form, t('form'))}${stat(p.ppg, tt('نقطة/مباراة', 'PPG'))}${stat(xp(p), tt('متوقع ج', 'xP GW') + G.next)}
    ${stat(p.gls, t('goals'))}${stat(p.ast, t('assists'))}${stat(p.xg.toFixed(1), 'xG')}${stat(p.xa.toFixed(1), 'xA')}
    ${stat(fmt(p.min), t('minutes'))}${stat(p.starts ?? '—', t('starts'))}${stat(p.cs, t('cs'))}${stat(p.bonus, t('bonus'))}
    ${stat(p.yc, t('yc'))}${stat(p.rc, t('rc'))}${stat(p.ict.toFixed(1), 'ICT')}${stat(r1(p.total / p.price), tt('نقطة/مليون', 'Pts/£m'))}</div>
   <div class="sec" style="margin:10px 2px 6px"><h2 style="font-size:15px">${I('i-chart')}${tt('نقاطه بكل جولة', 'Points per GW')}</h2><span class="mut" style="font-size:11.5px" id="psLast5"></span></div>
   <div id="psHist"><div class="aiload"><i></i><i></i><i></i><span>${t('loading')}</span></div></div>
   <div class="sec" style="margin:12px 2px 6px"><h2 style="font-size:15px">${I('i-cal')}${tt('المباريات القادمة', 'Upcoming fixtures')}</h2></div>
   <div class="nx5">${nexts.map((g) => { const f = fixturesFor(p.team, g); return f.length ? f.map((x) => `<button><small>GW${g}</small>${crest(tShort(x.opp), 30)}<b>${tShort(x.opp)}</b><span class="rate f${x.fdr}">${x.home ? t('home_s') : t('away_s')}</span></button>`).join('') : `<button><small>GW${g}</small><b>—</b></button>`; }).join('')}</div>
   <p class="mut" style="font-size:11px;margin-top:6px">${tt('الفرص الكبيرة والتسديدات ما ينشرها الفانتازي الرسمي، فنعرض مؤشر التهديد (Threat) بدالها:', 'Big chances and shots are not published by FPL; Threat index shown instead:')} <b>${p.threat.toFixed(0)}</b></p>
   <div class="acts">${mine ? `${inXI ? `<button class="btn btn-g" onclick="setCap(${id})">${I('i-star')}${t('captain')}</button><button class="btn btn-g" onclick="setVC(${id})">${I('i-star')}${t('vice')}</button>` : ''}<button class="btn btn-g" onclick="startSwap(${id})">${I('i-swap')}${tt('تبديل', 'Swap')}</button><button class="btn btn-g" onclick="sellFlow(${id})">${I('i-coin')}${tt('بيع/استبدال', 'Sell')}</button>`
    : `<button class="btn btn-p" onclick="buyFlow(${id})">${I('i-plus')}${tt('شراء بالخطة', 'Buy (plan)')}</button>`}
    <button class="btn btn-g" onclick="toggleWatch(${id})">${I('i-star')}${ST.watch.has(id) ? tt('إزالة من المراقبة', 'Unwatch') : t('watchlist')}</button><button class="btn btn-g" onclick="addCompare(${id})">${I('i-chart')}${t('compare')}</button></div>`);
  playerSummary(id).then((d) => {
    const el = document.getElementById('psHist'); if (!el) return;
    const h = d.history || []; if (!h.length) { el.innerHTML = `<p class="mut">${t('noData')}</p>`; return; }
    const vals = h.map((r) => r.total_points), mx = Math.max(...vals, 1), last5 = vals.slice(-5);
    document.getElementById('psLast5').textContent = tt(`آخر 5: ${last5.reduce((a, b) => a + b, 0)} نقطة`, `Last 5: ${last5.reduce((a, b) => a + b, 0)} pts`);
    el.innerHTML = `<div class="pbars">${h.map((r) => `<button class="${mine ? 'own' : ''}" onclick="gwDetail(${id},${r.round})"><b>${r.total_points}</b><i style="height:${Math.max(4, r.total_points / mx * 100)}%;background:${r.total_points >= 8 ? '#10B981' : r.total_points >= 4 ? '#34D399' : r.total_points >= 1 ? '#FB7185' : '#EF4444'}"></i><span>${r.round}</span></button>`).join('')}</div>`;
  }).catch((e) => { const el = document.getElementById('psHist'); if (el) el.innerHTML = `<p class="mut">${esc(e.message)}</p>`; });
}
export function gwDetail(id, gw) {
  const p = PM(id), d = sumCache.get(id); const r = d?.history?.find((x) => x.round === gw); if (!r) return;
  const SC = ST.scoring || {}; const gp = { GK: SC.goalGK ?? 10, DEF: SC.goalDEF ?? 6, MID: SC.goalMID ?? 5, FWD: SC.goalFWD ?? 4 }[p.pos];
  const parts = []; if (r.minutes) parts.push(r.minutes >= 60 ? tt('لعب 60+ دقيقة (+2)', '60+ mins (+2)') : tt('لعب أقل من 60 (+1)', '<60 mins (+1)'));
  if (r.goals_scored) parts.push(`${r.goals_scored} ${t('goals')} (+${r.goals_scored * gp})`); if (r.assists) parts.push(`${r.assists} ${t('assists')} (+${r.assists * 3})`);
  if (r.clean_sheets && (p.pos === 'GK' || p.pos === 'DEF')) parts.push(`${t('cs')} (+4)`); if (r.clean_sheets && p.pos === 'MID') parts.push(`${t('cs')} (+1)`);
  if (r.bonus) parts.push(`${t('bonus')} (+${r.bonus})`); if (r.yellow_cards) parts.push(`${t('yc')} (−1)`); if (r.red_cards) parts.push(`${t('rc')} (−3)`);
  openSheet(`${sheetHead(`<div style="width:46px;height:46px">${pShirt(p)}</div>`, `${esc(p.name)} · GW${gw}`, `${tt('ضد', 'vs')} ${tName(r.opponent_team)} (${r.was_home ? t('home_s') : t('away_s')})`, 'var(--glass2)', '')}
   <div style="text-align:center;margin:8px 0"><div class="pbig" style="width:86px;height:86px;font-size:38px;margin:auto;background:${r.total_points >= 8 ? '#10B981' : r.total_points >= 4 ? '#34D399' : '#EF4444'};color:#0B1222">${r.total_points}</div></div>
   <div class="kv" style="grid-template-columns:repeat(5,1fr)"><div><b>${r.minutes}′</b><span>${t('minutes')}</span></div><div><b>${r.goals_scored}</b><span>${t('goals')}</span></div><div><b>${r.assists}</b><span>${t('assists')}</span></div><div><b>${r.clean_sheets ? '✓' : '✗'}</b><span>${t('cs')}</span></div><div><b>${r.bonus}</b><span>${t('bonus')}</span></div></div>
   <div class="note">${I('i-sparkle', 'i', 'color:#60A5FA')}<span>${parts.join('، ') || tt('ما لعب', 'Did not play')}</span></div><button class="btn btn-g btn-b" style="margin-top:10px" onclick="openPlayer(${id})">${t('back')}</button>`);
}
export async function toggleWatch(id) {
  ST.watch.has(id) ? ST.watch.delete(id) : ST.watch.add(id);
  LS.set(`fp_watch_${ST.profile.teamId}`, [...ST.watch]);
  AU.saveProfile(ST.user.uid, { watchlist: [...ST.watch] }).catch(() => {});
  toast(ST.watch.has(id) ? tt('أضيف لقائمة المراقبة ⭐', 'Added to watchlist ⭐') : tt('أزيل من المراقبة', 'Removed'));
  if (document.querySelector('.sheet')) openPlayer(id); window.render();
}
/* ---------- أفعال الخطة ---------- */
export function setCap(id) { const P = ST.plan; if (!P.xi.includes(id)) return toast(tt('الكابتن لازم يكون أساسي', 'Captain must start')); if (P.vc === id) P.vc = P.cap; P.cap = id; savePlan(); closeSheet(); window.render(); toast(PM(id).name + ' ©'); }
export function setVC(id) { const P = ST.plan; if (!P.xi.includes(id)) return toast(tt('النائب لازم يكون أساسي', 'Vice must start')); if (P.cap === id) P.cap = P.vc; P.vc = id; savePlan(); closeSheet(); window.render(); toast(PM(id).name + ' (V)'); }
export function buyFlow(inId) {
  const n = PM(inId), opts = ST.plan.squad.filter((x) => PM(x).pos === n.pos);
  openSheet(`${sheetHead(I('i-swap'), tt('منو تبيع مقابل ', 'Sell who for ') + esc(n.name) + '؟')}${opts.map((x) => { const o = PM(x), e = canBuy(ST.plan, x, inId), g = r1(xpN(n, ST.G.next, 3) - xpN(o, ST.G.next, 3)); return playerRow(o, `<div class="col">${e ? `<small style="color:#EF4444">${e}</small>` : `<span class="tag ${g >= 0 ? 'lime' : 'red'}">${g > 0 ? '+' : ''}${g}</span>`}</div>`, e ? '' : `confirmT(${x},${inId})`); }).join('')}<p class="mut" style="font-size:11.5px">${tt('الرقم = فرق النقاط المتوقعة لـ 3 جولات', 'Number = xP difference over 3 GWs')}</p>`);
}
export function confirmT(outId, inId) {
  const P = ST.plan, o = PM(outId), n = PM(inId), free = P.chip === 'wildcard' || P.chip === 'freehit', cost = free || P.ft > 0 ? 0 : 4;
  openSheet(`${sheetHead(I('i-swap'), tt('تأكيد الانتقال', 'Confirm transfer'), tt('خطة — نفّذه بالتطبيق الرسمي', 'Plan — execute in the official app'))}
   <div class="fx-card card"><div class="tm"><div style="width:48px;height:48px">${pShirt(o)}</div><span class="down">${esc(o.name)}</span><small class="mut">${o.price.toFixed(1)}م</small></div><div class="mid">${I('i-swap', 'i', 'width:28px;height:28px;color:#34D399')}</div><div class="tm"><div style="width:48px;height:48px">${pShirt(n)}</div><span class="up">${esc(n.name)}</span><small class="mut">${n.price.toFixed(1)}م</small></div></div>
   <div class="kv"><div><b>${r1(P.bank + o.price - n.price).toFixed(1)}م</b><span>${t('bank')}</span></div><div><b class="${cost ? 'down' : ''}">${cost ? '−4' : '0'}</b><span>${tt('خصم', 'Hit')}</span></div><div><b class="up">${r1(xpN(n, ST.G.next, 3) - xpN(o, ST.G.next, 3))}</b><span>${tt('مكسب متوقع (3ج)', 'xP gain (3GW)')}</span></div></div>
   <button class="btn btn-p btn-b" onclick="doTransfer(${outId},${inId})">${tt('أضف للخطة', 'Add to plan')}</button>`);
}
export function doTransfer(outId, inId) {
  const P = ST.plan, e = canBuy(P, outId, inId); if (e) return toast(e);
  const o = PM(outId), n = PM(inId), free = P.chip === 'wildcard' || P.chip === 'freehit';
  let cost = 0; if (!free) { if (P.ft > 0) P.ft--; else cost = 4; }
  P.bank = r1(P.bank + o.price - n.price);
  const rep = (a) => a.map((x) => (x === outId ? inId : x)); P.squad = rep(P.squad); P.xi = rep(P.xi); P.bench = rep(P.bench);
  if (P.cap === outId) P.cap = inId; if (P.vc === outId) P.vc = inId;
  P.transfers.push({ out: outId, in: inId, cost }); savePlan(); closeSheet(); toast(`✓ ${o.name} ← ${n.name}${cost ? ' (−4)' : ''}`); window.render();
}
export function addCompare(id) { const c = LS.get('fp_cmp', []); if (!c.includes(id)) c.push(id); LS.set('fp_cmp', c.slice(-3)); closeSheet(); window.go('compare'); }
Object.assign(window, { openPlayer, gwDetail, toggleWatch, setCap, setVC, buyFlow, confirmT, doTransfer, addCompare });

/* ---------- صفحة النادي: نتائجه، مبارياته الجاية، أفضل لاعبيه ---------- */
window.openClub = (tid) => {
  const G = ST.G, tm = G.teams[tid]; if (!tm) return;
  const all = G.fxList.filter((f) => f.h === tid || f.a === tid).sort((a, b) => (a.ev || 99) - (b.ev || 99));
  const past = all.filter((f) => f.fin).slice(-6).reverse(), next = all.filter((f) => !f.fin).slice(0, 6);
  const res = (f) => { const home = f.h === tid, gf = home ? f.hs : f.as, ga = home ? f.as : f.hs; return gf > ga ? ['W', 'var(--good)'] : gf < ga ? ['L', 'var(--bad)'] : ['D', 'var(--mut)']; };
  const form = past.map((f) => { const [r, c] = res(f); return `<span class="rate" style="background:${c};color:#0A0D14">${tt({ W: 'ف', L: 'خ', D: 'ت' }[r], r)}</span>`; }).join(' ');
  const players = G.players.filter((p) => p.team === tid).sort((a, b) => b.total - a.total).slice(0, 8);
  const mine = new Set(ST.plan?.squad || []);
  openSheet(`${sheetHead(crest(tm.short, 44), tName(tid), `${tt('الفورم', 'Form')}: ${form || '—'}`)}
   <div class="sec" style="margin-top:4px"><h2 style="font-size:14px">${I('i-cal', 'i', 'width:16px;height:16px')}${tt('المباريات الجاية', 'Next fixtures')}</h2></div>
   <div class="nx5">${next.map((f) => { const home = f.h === tid, opp = home ? f.a : f.h, d = home ? f.hd : f.ad; return `<button><small>GW${f.ev}</small><span class="rate f${d}">${tShort(opp)}</span><small>${home ? t('home_s') : t('away_s')}</small></button>`; }).join('') || '<p class="mut">—</p>'}</div>
   <div class="sec"><h2 style="font-size:14px">${I('i-history', 'i', 'width:16px;height:16px')}${tt('آخر النتائج', 'Recent results')}</h2></div>
   <div class="list">${past.map((f) => { const [r, c] = res(f); return `<div class="row"><span class="rate" style="background:${c};color:#0A0D14">${tt({ W: 'فوز', L: 'خسارة', D: 'تعادل' }[r], r)}</span><div class="info"><b style="font-size:13px">${tName(f.h)} <span class="num">${f.hs}–${f.as}</span> ${tName(f.a)}</b><span>GW${f.ev}</span></div></div>`; }).join('') || '<p class="mut" style="padding:10px">—</p>'}</div>
   <div class="sec"><h2 style="font-size:14px">${I('i-users', 'i', 'width:16px;height:16px')}${tt('أفضل اللاعبين', 'Top players')}</h2></div>
   <div class="list">${players.map((p) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${mine.has(p.id) ? `<span class="tag lime">${tt('بفريقك', 'Yours')}</span>` : ''}</b><span><span class="pos ${p.pos}">${p.pos}</span>${p.price.toFixed(1)}م · ${p.own}%</span></div><div class="col">${p.total}<small>${tt('نقطة', 'pts')}</small></div></div>`).join('')}</div>
   <button class="btn btn-g btn-b" style="margin-top:12px" onclick="closeSheet();goClub(${tid})">${tt('كل لاعبي النادي', 'All club players')}</button>`);
};

/* ---------- تفاصيل اللاعب بجولة معيّنة (مباراته فقط) ---------- */
const EXPL = () => ({ minutes: tt('الدقائق', 'Minutes'), goals_scored: tt('أهداف', 'Goals'), assists: tt('صناعة', 'Assists'), clean_sheets: tt('شباك نظيفة', 'Clean sheet'), goals_conceded: tt('أهداف مستقبلة', 'Goals conceded'), own_goals: tt('هدف عكسي', 'Own goal'), penalties_saved: tt('صد جزاء', 'Penalty saved'), penalties_missed: tt('إضاعة جزاء', 'Penalty missed'), yellow_cards: tt('بطاقة صفراء', 'Yellow card'), red_cards: tt('بطاقة حمراء', 'Red card'), saves: tt('تصديات', 'Saves'), bonus: tt('بونص', 'Bonus'), defensive_contribution: tt('مساهمات دفاعية', 'Defensive contribution') });
window.playerGW = async (id, gw, mult = 1) => {
  const p = PM(id); if (!p) return;
  openSheet(`${sheetHead(`<div style="width:46px;height:46px">${pShirt(p)}</div>`, esc(p.name), `${t('gw')} ${gw} · ${tName(p.team)}`)}<div id="pgw" class="aiload"><i></i><i></i><i></i><span>${t('loading')}</span></div>`);
  let el;
  try {
    if (ST.liveRaw && ST.liveRawGW === gw) el = ST.liveRaw.find((e) => e.id === id);
    else { const l = await FPL.loadLive(gw); el = l.elements.find((e) => e.id === id); }
  } catch (e) { const b = document.getElementById('pgw'); if (b) b.outerHTML = `<p class="mut">${esc(e.message)}</p>`; return; }
  const box = document.getElementById('pgw'); if (!box) return;
  const s = el?.stats || {}, fxs = (ST.G.fx[gw] || []).filter((f) => f.h === p.team || f.a === p.team);
  const { provisionalBonus } = await import('../live-engine.js');
  const pb = s.bonus ? 0 : (provisionalBonus(gw)[id] || 0);
  const total = (s.total_points || 0) + pb, shown = total * Math.max(1, mult);
  const match = (f) => { const home = f.h === p.team, opp = home ? f.a : f.h; const st = f.fin ? tt('انتهت', 'FT') : f.started ? `<span class="livebadge">${f.min || ''}′</span>` : (f.ko ? new Date(f.ko).toLocaleString(document.documentElement.lang === 'en' ? 'en-GB' : 'ar-IQ', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '—');
    return `<div class="pgw-match" onclick="closeSheet();setTimeout(()=>openMatchC&&openMatchC(${f.id},${gw}),200)"><div class="flex" style="gap:6px">${crest(tShort(f.h), 26)}<b>${tShort(f.h)}</b></div><div style="text-align:center">${f.started ? `<b class="score" style="font-size:20px">${f.hs ?? 0} – ${f.as ?? 0}</b>` : '<b class="mut">VS</b>'}<div style="font-size:11.5px" class="mut">${st}</div></div><div class="flex" style="gap:6px;justify-content:flex-end"><b>${tShort(f.a)}</b>${crest(tShort(f.a), 26)}</div></div>`; };
  const rows = []; (el?.explain || []).forEach((x) => (x.stats || []).forEach((r) => { if (r.identifier === 'bps') return; const ex = rows.find((y) => y.k === r.identifier); if (ex) { ex.v += r.value; ex.p += r.points; } else rows.push({ k: r.identifier, v: r.value, p: r.points }); }));
  if (!rows.length && (s.minutes || 0) > 0) Object.keys(EXPL()).forEach((k) => { if (k !== 'bonus' && +s[k]) rows.push({ k, v: s[k], p: null }); });
  if (!rows.some((r) => r.k === 'bonus') && s.bonus) rows.push({ k: 'bonus', v: s.bonus, p: s.bonus });
  if (pb) rows.push({ k: 'bonus', v: pb, p: pb, prov: true });
  const X = EXPL();
  const extra = [['xG', s.expected_goals], ['xA', s.expected_assists], ['BPS', s.bps], ['ICT', s.ict_index], [tt('تأثير', 'Influence'), s.influence], [tt('صناعة الفرص', 'Creativity'), s.creativity], [tt('تهديد', 'Threat'), s.threat], [tt('دفاعية', 'Def. contrib.'), s.defensive_contribution], [tt('استرجاع', 'Recoveries'), s.recoveries], [tt('تدخلات', 'Tackles'), s.tackles]].filter(([, v]) => v != null && v !== '' && +v !== 0);
  box.outerHTML = `${fxs.length ? fxs.map(match).join('') : `<div class="note">${I('i-info', 'i', 'color:var(--info)')}<span>${tt('فريقه ما عنده مباراة بهالجولة', 'No fixture this gameweek')}</span></div>`}
   <div class="pgw-total"><div><span class="mut" style="font-size:12.5px">${tt('نقاطه بالجولة', 'GW points')}</span><b class="big-num count" data-v="${shown}">${shown}</b>${mult > 1 ? `<span class="tag" style="background:var(--gold);color:#1C1404">×${mult} ${tt('كابتن', 'captain')}</span>` : ''}</div><div class="kv" style="margin:0;flex:1"><div><b>${s.minutes || 0}′</b><span>${tt('دقائق', 'Minutes')}</span></div><div><b>${s.goals_scored || 0}</b><span>${tt('أهداف', 'Goals')}</span></div><div><b>${s.assists || 0}</b><span>${tt('صناعة', 'Assists')}</span></div></div></div>
   ${rows.length ? `<div class="sec" style="margin-top:12px"><h2 style="font-size:14px">${I('i-list', 'i', 'width:16px;height:16px')}${tt('تفصيل النقاط', 'Points breakdown')}</h2></div><div class="list">${rows.map((r) => `<div class="row"><div class="info"><b style="font-size:13.5px">${X[r.k] || r.k}${r.prov ? ` <span class="tag cyan">${tt('مؤقت', 'provisional')}</span>` : ''}</b><span>${r.k === 'minutes' ? r.v + '′' : '×' + r.v}</span></div><div class="col ${r.p > 0 ? 'up' : r.p < 0 ? 'down' : ''}" style="font-size:16px">${r.p == null ? '' : (r.p > 0 ? '+' : '') + r.p}</div></div>`).join('')}<div class="row" style="background:var(--s2)"><div class="info"><b>${tt('المجموع', 'Total')}</b></div><div class="col" style="font-size:17px;color:var(--acc)">${total}</div></div></div>` : `<p class="mut" style="margin-top:10px">${tt('ما لعب أو مباراته ما بدت بعد', 'Has not played yet')}</p>`}
   ${extra.length ? `<div class="sec"><h2 style="font-size:14px">${I('i-activity', 'i', 'width:16px;height:16px')}${tt('أرقامه بالمباراة', 'Match stats')}</h2></div><div class="pgw-grid">${extra.map(([l, v]) => `<div><b class="num">${v}</b><span>${l}</span></div>`).join('')}</div>` : ''}
   <button class="btn btn-g btn-b" style="margin-top:14px" onclick="closeSheet();setTimeout(()=>openPlayer(${id}),200)">${I('i-user', 'i', 'width:16px;height:16px')}${tt('صفحة اللاعب الكاملة', 'Full player page')}</button>`;
  import('../motion.js').then((m) => m.countAll(document.getElementById('sheetRoot'), true)).catch(() => {});
};
