/* =========================================================
   فحص قبل الإغلاق + ضمان المشاركة (خطر الدقائق)
   يفحص خطة فريقك للجولة الجاية ويطلع الأخطاء ويا زر يصلحها
   ملاحظة: التعديلات على خطتك بالتطبيق — لازم تطبّقها بتطبيق الفانتازي الرسمي
========================================================= */
import { ST, PM, tShort, savePlan } from '../store.js';
import { tt, t } from '../i18n.js';
import { esc, I, toast } from '../ui.js';
import { xp, fixturesFor, validXI, bestXI, projected } from '../engine.js';
import { pricePredict } from '../predict.js';
import { upcoming } from '../fpl.js';
import { pShirt, playerSummary } from './common.js';

/* ---------- ضمان المشاركة من آخر 5 مباريات ---------- */
const minsCache = new Map();
export async function minutesProfile(id) {
  if (minsCache.has(id)) return minsCache.get(id);
  const d = await playerSummary(id).catch(() => null);
  const rows = (d?.history || []).filter((r) => r.round <= ST.G.cur).slice(-5);
  if (!rows.length) { const r = { n: 0 }; minsCache.set(id, r); return r; }
  const starts = rows.filter((r) => (r.starts ?? (r.minutes >= 60 ? 1 : 0)) > 0).length;
  const mins = rows.reduce((a, r) => a + (r.minutes || 0), 0) / rows.length;
  const benched = rows.filter((r) => r.minutes === 0).length;
  const subOff = rows.filter((r) => r.minutes > 0 && r.minutes < 70 && (r.starts ?? 1)).length;
  const p = PM(id), inj = p && p.st !== 'a';
  let lvl = starts >= 4 && mins >= 75 ? 'nailed' : starts >= 3 && mins >= 55 ? 'likely' : starts >= 1 ? 'rotation' : 'bench';
  if (inj && (p.chance ?? 0) <= 25) lvl = 'out';
  const r = { n: rows.length, starts, mins: Math.round(mins), benched, subOff, lvl, seq: rows.map((x) => (x.minutes >= 60 ? 2 : x.minutes > 0 ? 1 : 0)) };
  minsCache.set(id, r); return r;
}
export const MIN_LBL = {
  nailed: [tt('مضمون أساسي', 'Nailed'), 'var(--acc)'], likely: [tt('أساسي غالباً', 'Likely starter'), '#60A5FA'],
  rotation: [tt('خطر مداورة', 'Rotation risk'), 'var(--gold)'], bench: [tt('احتياطي', 'Bench player'), 'var(--bad)'], out: [tt('غايب', 'Out'), 'var(--bad)'],
};

/* ---------- الفحوصات ---------- */
const isOut = (p) => p.st === 'i' || p.st === 's' || p.st === 'u' || p.st === 'n' || (p.st === 'd' && (p.chance ?? 100) <= 25);
const isDoubt = (p) => p.st === 'd' && (p.chance ?? 100) > 25;
function swapCandidate(P, outId, gw) {
  const cands = P.bench.filter((b) => { const q = PM(b); return q && !isOut(q) && fixturesFor(q.team, gw).length; })
    .map((b) => ({ b, xi: P.xi.map((x) => (x === outId ? b : x)) })).filter((c) => validXI(c.xi)).sort((a, b) => xp(PM(b.b), gw) - xp(PM(a.b), gw));
  return cands[0]?.b || null;
}
export function runChecks() {
  const G = ST.G, P = ST.plan, gw = G.next; if (!P || !gw) return [];
  const out = [];
  const add = (lvl, icon, title, body, fix, fixLbl, ids = []) => out.push({ lvl, icon, title, body, fix, fixLbl, ids });
  // 1) أساسي غايب أو ما عنده مباراة
  P.xi.forEach((id) => {
    const p = PM(id), fx = fixturesFor(p.team, gw).length;
    if (isOut(p) || !fx) {
      const sub = swapCandidate(P, id, gw);
      add('bad', 'i-alert', tt(`${p.name} ${!fx ? 'ما عنده مباراة بالجولة' : p.st === 's' ? 'موقوف' : 'غايب'} وهو بتشكيلتك الأساسية`, `${p.name} won't play but is in your XI`), p.news || '', sub ? `chkSwap(${id},${sub})` : '', sub ? tt(`بدّله بـ ${PM(sub).name}`, `Swap for ${PM(sub).name}`) : '', [id]);
    } else if (isDoubt(p)) add('warn', 'i-alert', tt(`${p.name} مشكوك بمشاركته (${p.chance}%)`, `${p.name} is doubtful (${p.chance}%)`), p.news || '', '', '', [id]);
  });
  // 2) الكابتن والنائب
  const cap = PM(P.cap), vc = PM(P.vc), ranked = [...P.xi].map(PM).filter((p) => !isOut(p) && fixturesFor(p.team, gw).length).sort((a, b) => xp(b, gw) - xp(a, gw));
  if (cap && (isOut(cap) || !fixturesFor(cap.team, gw).length)) add('bad', 'i-crown', tt(`الكابتن ${cap.name} ما راح يلعب!`, `Captain ${cap.name} won't play!`), tt('النقاط راح تروح للنائب بس', 'Armband passes to vice'), ranked[0] ? `chkCap(${ranked[0].id})` : '', ranked[0] ? tt(`خلّي ${ranked[0].name} كابتن`, `Captain ${ranked[0].name}`) : '', [cap.id]);
  else if (cap && isDoubt(cap)) add('warn', 'i-crown', tt(`الكابتن ${cap.name} مشكوك بمشاركته`, `Captain ${cap.name} doubtful`), tt('فكّر تكبتن لاعب مضمون', 'Consider a safer captain'), ranked[0] && ranked[0].id !== cap.id ? `chkCap(${ranked[0].id})` : '', ranked[0] && ranked[0].id !== cap.id ? tt(`خلّي ${ranked[0].name} كابتن`, `Captain ${ranked[0].name}`) : '', [cap.id]);
  else if (cap && ranked[0] && ranked[0].id !== cap.id && xp(ranked[0], gw) - xp(cap, gw) >= 1.5) add('info', 'i-crown', tt(`${ranked[0].name} متوقع يجيب أكثر من كابتنك`, `${ranked[0].name} projects higher than your captain`), tt(`${xp(ranked[0], gw)} مقابل ${xp(cap, gw)} نقطة متوقعة`, `${xp(ranked[0], gw)} vs ${xp(cap, gw)} xP`), `chkCap(${ranked[0].id})`, tt('غيّر الكابتن', 'Change captain'), [cap.id]);
  if (vc && (isOut(vc) || !fixturesFor(vc.team, gw).length)) { const alt = ranked.find((p) => p.id !== P.cap); add('warn', 'i-shield', tt(`النائب ${vc.name} ما راح يلعب`, `Vice ${vc.name} won't play`), '', alt ? `chkVC(${alt.id})` : '', alt ? tt(`خلّي ${alt.name} نائب`, `Make ${alt.name} vice`) : '', [vc.id]); }
  // 3) ترتيب الدكة
  const outB = P.bench.filter((id) => PM(id).pos !== 'GK'), sorted = [...outB].sort((a, b) => xp(PM(b), gw) - xp(PM(a), gw));
  if (outB.join() !== sorted.join() && xp(PM(sorted[0]), gw) - xp(PM(outB[0]), gw) >= 1) add('info', 'i-bench', tt('ترتيب الدكة مو أحسن شي', 'Bench order could be better'), tt(`خلّي ${PM(sorted[0]).name} أول بديل — إذا غاب أساسي يدخل اللي نقاطه أعلى`, `Put ${PM(sorted[0]).name} first`), 'chkBench()', tt('رتّب الدكة', 'Fix bench order'));
  const deadB = P.bench.filter((id) => isOut(PM(id)));
  if (deadB.length >= 2) add('info', 'i-bench', tt(`${deadB.length} من دكتك غايبين`, `${deadB.length} bench players out`), tt('إذا غاب أساسي ما راح يلگى بديل يدخل', 'Auto-subs may fail'), '', '', deadB);
  // 4) أفضل تشكيلة
  const best = bestXI(P.squad, gw), gain = Math.round((projected({ ...P, ...best, transfers: [] }, gw) - projected({ ...P, transfers: [] }, gw)) * 10) / 10;
  if (gain >= 2) add('info', 'i-sparkle', tt(`أكو تشكيلة أحسن (+${gain} نقطة متوقعة)`, `A better XI exists (+${gain} xP)`), '', 'chkBest()', tt('طبّق أفضل تشكيلة', 'Apply best XI'));
  // 5) الانتقالات المجانية
  if (!P.transfers.length && P.ft >= 5) add('warn', 'i-swap', tt('عندك 5 انتقالات مجانية — إذا ما تستخدم واحد راح يضيع', 'You have 5 FTs — one will be wasted'), '', "go('lab')", tt('افتح الحلّال الذكي', 'Open solver'));
  else if (!P.transfers.length && P.ft >= 1) add('ok', 'i-swap', tt(`عندك ${P.ft} انتقال مجاني`, `${P.ft} free transfer(s) available`), tt('الحلّال الذكي يكلك إذا الأحسن تستخدمه لو تدّخره', 'The solver can tell you whether to use or bank it'), "go('lab')", tt('اسأل الحلّال', 'Ask solver'));
  // 6) أسعار راح تنزل الليلة
  const falling = P.squad.map(PM).filter((p) => pricePredict(p).state === 'fall');
  if (falling.length) add('info', 'i-coin', tt(`سعر ${falling.map((p) => p.name).join('، ')} متوقع ينزل الليلة`, `${falling.map((p) => p.name).join(', ')} likely to fall tonight`), tt('إذا ناوي تبيعه، بيعه قبل التغيير', 'Sell before the change if planned'), '', '', falling.map((p) => p.id));
  const order = { bad: 0, warn: 1, info: 2, ok: 3 };
  return out.sort((a, b) => order[a.lvl] - order[b.lvl]);
}

let mins = {}, minsBusy = false;
async function loadMins() {
  if (minsBusy) return; minsBusy = true;
  const ids = ST.plan.squad;
  for (let i = 0; i < ids.length; i += 5) { const part = await Promise.all(ids.slice(i, i + 5).map(async (id) => [id, await minutesProfile(id)])); part.forEach(([id, r]) => (mins[id] = r)); }
  minsBusy = false; if (ST.view === 'check') window.render();
}

export function vCheck() {
  const G = ST.G, P = ST.plan; if (!P || !G.next) return `<div class="empty">${t('noData')}</div>`;
  if (!ST.plan.squad.every((id) => mins[id])) loadMins();
  const C = runChecks(), bad = C.filter((c) => c.lvl === 'bad').length, warn = C.filter((c) => c.lvl === 'warn').length;
  const UP = upcoming(G), h = UP.deadline ? (new Date(UP.deadline) - Date.now()) / 36e5 : null;
  const dl = h != null && h > 0 ? (h < 48 ? tt(`باقي ${Math.floor(h)} ساعة و ${Math.round((h % 1) * 60)} دقيقة`, `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m left`) : tt(`باقي ${Math.round(h / 24)} أيام`, `${Math.round(h / 24)} days left`)) : '';
  const st = bad ? ['bad', tt('لازم تصلح هالأشياء قبل الإغلاق', 'Fix these before the deadline'), 'var(--bad)'] : warn ? ['warn', tt('أكو أشياء تحتاج انتباهك', 'Some things need attention'), 'var(--gold)'] : ['ok', tt('فريقك جاهز ✓', 'Your team is ready ✓'), 'var(--acc)'];
  const card = (c, i) => `<div class="ck-item ${c.lvl}" style="--d:${i * 50}ms"><div class="ck-ic">${I(c.icon, 'i', 'width:18px;height:18px')}</div><div style="flex:1;min-width:0"><b>${esc(c.title)}</b>${c.body ? `<div class="mut" style="font-size:12.5px;margin-top:2px;line-height:1.6">${esc(c.body)}</div>` : ''}${c.fix ? `<button class="btn ${c.lvl === 'bad' ? 'btn-p' : 'btn-g'} btn-sm" style="margin-top:8px" onclick="${c.fix}">${I('i-check', 'i', 'width:14px;height:14px')}${esc(c.fixLbl)}</button>` : ''}</div></div>`;
  const mrow = (id) => { const p = PM(id), m = mins[id]; const L = m?.lvl ? MIN_LBL[m.lvl] : null; return `<div class="row tap" onclick="openPlayer(${id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${tShort(p.team)} · ${m?.n ? tt(`أساسي ${m.starts} من آخر ${m.n} · معدل ${m.mins}′`, `Started ${m.starts}/${m.n} · avg ${m.mins}′`) : tt('جارِ التحميل…', 'Loading…')}</span></div>${m?.seq ? `<div class="ck-seq" title="${tt('آخر 5 مباريات', 'Last 5')}">${m.seq.map((s) => `<i class="s${s}"></i>`).join('')}</div>` : ''}${L ? `<span class="ck-lvl" style="--c:${L[1]}">${L[0]}</span>` : ''}</div>`; };
  const risky = P.squad.filter((id) => mins[id] && ['rotation', 'bench', 'out'].includes(mins[id].lvl));
  return `<div class="card ck-hero ${st[0]}"><div class="flex" style="gap:14px;align-items:center"><div class="ck-big" style="--c:${st[2]}">${bad ? I('i-alert', 'i', 'width:28px;height:28px') : warn ? I('i-alert', 'i', 'width:28px;height:28px') : I('i-check', 'i', 'width:28px;height:28px')}</div><div style="flex:1"><b style="font-size:16px">${st[1]}</b><div class="mut" style="font-size:12.5px">${tt('الجولة', 'GW')} ${G.next}${dl ? ' · ' + dl : ''}</div></div></div>
     <div class="ck-counts"><span class="bad">${bad} ${tt('مشاكل', 'issues')}</span><span class="warn">${warn} ${tt('تنبيهات', 'warnings')}</span><span class="info">${C.length - bad - warn} ${tt('اقتراحات', 'tips')}</span></div></div>
   <div class="ck-list">${C.map(card).join('') || `<div class="empty">${I('i-check', 'i', 'width:40px;height:40px;color:var(--acc)')}<b>${tt('ماكو أي مشكلة', 'No issues')}</b></div>`}</div>
   <div class="note" style="margin-top:10px">${I('i-info', 'i', 'color:var(--info)')}<span>${tt('التصليحات تتطبق على خطتك بالتطبيق — طبّقها بنفس الشكل بتطبيق الفانتازي الرسمي قبل الإغلاق.', 'Fixes apply to your plan here — mirror them in the official FPL app before the deadline.')}</span></div>
   <div class="sec"><h2>${I('i-clock')}${tt('ضمان المشاركة', 'Minutes security')}</h2><span class="mut" style="font-size:12px">${tt('آخر 5 مباريات', 'last 5 matches')}</span></div>
   ${risky.length ? `<div class="ck-item warn" style="margin-bottom:8px"><div class="ck-ic">${I('i-alert', 'i', 'width:18px;height:18px')}</div><div><b>${tt(`${risky.length} لاعبين بفريقك دقائقهم مو مضمونة`, `${risky.length} players with minutes risk`)}</b><div class="mut" style="font-size:12.5px">${risky.map((id) => esc(PM(id).name)).join('، ')}</div></div></div>` : ''}
   <div class="list">${[...P.xi, ...P.bench].map(mrow).join('')}</div>
   <p class="mut" style="font-size:11px;margin:10px 4px;line-height:1.7"><span class="ck-seq" style="display:inline-flex"><i class="s2"></i></span> ${tt('أساسي (60+ دقيقة)', 'Started 60+')} · <span class="ck-seq" style="display:inline-flex"><i class="s1"></i></span> ${tt('شارك قليل', 'Cameo')} · <span class="ck-seq" style="display:inline-flex"><i class="s0"></i></span> ${tt('ما لعب', 'Did not play')}</p>`;
}
Object.assign(window, {
  chkSwap: (outId, inId) => { const P = ST.plan; P.xi = P.xi.map((x) => (x === outId ? inId : x)); P.bench = P.bench.map((x) => (x === inId ? outId : x)); if (P.cap === outId) P.cap = inId; if (P.vc === outId) P.vc = inId; savePlan(); toast(`✓ ${PM(inId).name} ⇄ ${PM(outId).name}`); window.render(); },
  chkCap: (id) => { const P = ST.plan; if (P.vc === id) P.vc = P.cap; P.cap = id; savePlan(); toast(`© ${PM(id).name}`); window.render(); },
  chkVC: (id) => { const P = ST.plan; if (P.cap === id) return; P.vc = id; savePlan(); toast(`V ${PM(id).name}`); window.render(); },
  chkBench: () => { const P = ST.plan, gw = ST.G.next, gk = P.bench.filter((id) => PM(id).pos === 'GK'), o = P.bench.filter((id) => PM(id).pos !== 'GK').sort((a, b) => xp(PM(b), gw) - xp(PM(a), gw)); P.bench = [...gk, ...o]; savePlan(); toast(tt('رتّبنا الدكة ✓', 'Bench sorted ✓')); window.render(); },
  chkBest: () => { const P = ST.plan; Object.assign(P, bestXI(P.squad, ST.G.next)); savePlan(); toast(tt('طبّقنا أفضل تشكيلة ✓', 'Best XI applied ✓')); window.render(); },
});
