/* الرئيسية: المهم بس — وضعك الحالي + خطواتك الجاية */
import { runChecks } from './check.js';
import { ST, PM, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, fmtTime } from '../ui.js';
import { projected, analyze, captainRank, suggestions, xp, avail, dgwBgw, fixturesFor } from '../engine.js';
import * as FPL from '../fpl.js';
import { pShirt } from './common.js';
import { pricePredict, liveRankEstimate } from '../predict.js';
import { liveCalc, rankImpact } from '../live-engine.js';

let cdT = null;
function tick() {
  const el = document.getElementById('cd'); if (!el) return clearInterval(cdT);
  const d = ST.G.deadline ? new Date(ST.G.deadline) : null; if (!d) { el.innerHTML = '<div><b>—</b></div>'; return; }
  let ms = Math.max(0, d - new Date()); const D = Math.floor(ms / 864e5); ms %= 864e5; const H = Math.floor(ms / 36e5); ms %= 36e5; const M = Math.floor(ms / 6e4), S = Math.floor((ms % 6e4) / 1e3);
  const vals = [D, H, M, S].map((x) => String(x).padStart(2, '0'));
  if (el.children.length !== 4) el.innerHTML = [t('days'), t('hours'), t('mins'), t('secs')].map((l) => `<div><b></b><span>${l}</span></div>`).join('');
  [...el.querySelectorAll('b')].forEach((b, i) => { if (b.textContent !== vals[i]) { b.textContent = vals[i]; b.classList.remove('tick'); void b.offsetWidth; b.classList.add('tick'); } });
}
export function liveTeamPoints() {
  const { E, live } = ST; if (!live || !E.picks || E.gw !== ST.G.cur) return null;
  const evCur = ST.G.events.find((e) => e.id === ST.G.cur); if (evCur?.fin) return null;
  return liveCalc(E.picks, ST.G.cur)?.total ?? null;
}
function actions() {
  const P = ST.plan, G = ST.G; if (!P) return [];
  const out = [], a = analyze(P, esc), cap = captainRank(P, 1)[0];
  if (cap && cap.id !== P.cap) out.push({ ic: 'i-crown', col: 'var(--gold)', h: tt('غيّر الكابتن', 'Change captain'), d: `${esc(cap.name)} ${xp(cap)} xP ${tt('بدل', 'vs')} ${esc(PM(P.cap).name)} ${xp(PM(P.cap))}`, b: [tt('اجعله كابتن', 'Make captain'), `setCap(${cap.id});render()`] });
  else if (cap) out.push({ ic: 'i-crown', col: 'var(--gold)', h: tt('الكابتن مضبوط', 'Captain set'), d: `${esc(cap.name)} — ${tt('أعلى متوقع بفريقك', 'highest xP in your team')} (${xp(cap)})`, ok: 1 });
  if (a.opt - a.cur >= 1) out.push({ ic: 'i-pitch', col: 'var(--info)', h: tt(`تشكيلتك تضيّع ${(a.opt - a.cur).toFixed(1)} نقطة`, `Lineup leaves ${(a.opt - a.cur).toFixed(1)} pts`), d: tt('في لاعبين بالدكة متوقعهم أعلى من الأساسيين', 'Bench players project higher than starters'), b: [tt('رتّبها', 'Fix it'), "bestLineup();go('team')"] });
  const risk = P.xi.map(PM).filter((p) => avail(p) < 1);
  if (risk.length) out.push({ ic: 'i-alert', col: 'var(--warn)', h: tt(`${risk.length} لاعب أساسي غير مضمون`, `${risk.length} doubtful starters`), d: risk.map((p) => `${esc(p.name)} ${Math.round(avail(p) * 100)}%`).join(' · '), b: [tt('شوف الفريق', 'View team'), "go('team')"] });
  const s = suggestions(P, 1)[0];
  if (s) out.push({ ic: 'i-swap', col: 'var(--acc)', h: tt('أفضل انتقال متاح', 'Best transfer'), d: `${esc(s.o.name)} ← <b>${esc(s.c.name)}</b> · +${s.g} xP/3`, b: [tt('جرّبه بالمختبر', 'Test in lab'), `labPreset(${s.o.id},${s.c.id})`] });
  const pf = P.squad.map(PM).map((p) => [p, pricePredict(p)]).filter((x) => x[1].prog <= -70).sort((a, b) => a[1].prog - b[1].prog);
  if (pf.length) out.push({ ic: 'i-down', col: 'var(--bad)', h: tt(`${pf.length} من لاعبينك سعره ممكن ينزل`, `${pf.length} of your players may drop in price`), d: pf.slice(0, 3).map(([p, r]) => `${esc(p.name)} ${r.prog}%`).join(' · ') + tt(' (تقدير)', ' (estimate)'), b: [t('prices'), "go('prices')"] });
  const dg = dgwBgw(G.next, Math.min(G.lastGW, G.next + 3)).find((x) => x.dbl.length);
  if (dg) out.push({ ic: 'i-bolt', col: 'var(--violet)', h: tt(`جولة مزدوجة GW${dg.gw}`, `Double GW${dg.gw}`), d: dg.dbl.map(tShort).join('، ') + tt(' — وقت مناسب للأوراق', ' — chip opportunity'), b: [t('chips'), "go('chips')"] });
  return out.slice(0, 4);
}
export function vHome() {
  const { G, E, plan } = ST, en = E.entry, hist = E.hist.current || [], last = hist[hist.length - 1], prev = hist[hist.length - 2];
  const ev = G.events.find((e) => e.id === G.cur), livePts = liveTeamPoints();
  const gwPts = livePts ?? last?.points ?? en.summary_event_points, diff = ev?.avg ? gwPts - ev.avg : null;
  const mv = last && prev ? prev.overall_rank - last.overall_rank : 0;
  const priv = (en.leagues?.classic || []).filter((l) => l.league_type === 'x').sort((x, y) => x.entry_rank / x.rank_count - y.entry_rank / y.rank_count);
  const news = plan ? plan.squad.map(PM).filter((p) => p.news) : [];
  const A = actions(), recent = hist.slice(-10), mx = Math.max(1, ...recent.map((h) => Math.max(h.points, G.events.find((e) => e.id === h.event)?.avg || 0)));
  let ckBanner = '';
  try { const C = runChecks(), bad = C.filter((c) => c.lvl === 'bad').length, warn = C.filter((c) => c.lvl === 'warn').length, hrs = G.deadline ? (new Date(G.deadline) - Date.now()) / 36e5 : 99;
    if (bad || warn || hrs < 48) ckBanner = `<button class="ck-banner ${bad ? 'bad' : warn ? 'warn' : 'ok'}" onclick="go('check')">${I(bad || warn ? 'i-alert' : 'i-check', 'i', 'width:18px;height:18px')}<span><b>${bad ? tt(`${bad} مشاكل بفريقك قبل الإغلاق`, `${bad} issues before deadline`) : warn ? tt(`${warn} تنبيهات تحتاج انتباهك`, `${warn} warnings`) : tt('فريقك جاهز للجولة', 'Team ready')}</b><small>${tt('فحص قبل الإغلاق', 'Deadline check')}${hrs > 0 && hrs < 48 ? ' · ' + tt(`باقي ${Math.floor(hrs)} ساعة`, `${Math.floor(hrs)}h left`) : ''}</small></span>${I('i-chev', 'chev')}</button>`; } catch {}
  return ckBanner + `<section class="hero">
    <div class="flex between"><div style="min-width:0"><div class="mut" style="font-size:13px">${t('gw')} ${G.cur} ${livePts != null ? `<span class="livebadge">${tt('مباشر', 'Live')}</span>` : ''}</div><div class="big-num" style="font-size:44px;line-height:1.1"><span class="count" data-v="${gwPts ?? ''}">${gwPts ?? '—'}</span><span class="mut" style="font-size:14px;font-weight:500"> ${tt('نقطة', 'pts')}</span></div>${diff != null ? `<div class="${diff >= 0 ? 'up' : 'down'}" style="font-size:13px">${diff >= 0 ? '+' : ''}${diff} ${tt('عن المعدل', 'vs average')} (${ev.avg})</div>` : ''}</div>
    <button class="btn btn-g btn-sm" onclick="seasonGo(${G.cur})">${tt('تفاصيل', 'Details')}${I('i-chev', 'chev')}</button></div>
    <div class="kpis"><div><small>${t('total')}</small><b>${fmt(en.summary_overall_points)}</b></div>${(() => { const lr = livePts != null ? liveRankEstimate(livePts, rankImpact(liveCalc(E.picks, G.cur)).safety) : null; return lr ? `<div><small>${tt('الترتيب المباشر (تقدير)', 'Live rank (est.)')}</small><b style="font-size:18px">${fmt(lr.rank)}</b><em class="${lr.move >= 0 ? 'up' : 'down'}"> ${lr.move >= 0 ? '▲' : '▼'} ${fmt(Math.abs(lr.move))}</em></div>` : `<div><small>${t('overall')}</small><b style="font-size:18px">${fmt(en.summary_overall_rank)}</b>${mv ? `<em class="${mv > 0 ? 'up' : 'down'}"> ${mv > 0 ? '▲' : '▼'} ${fmt(Math.abs(mv))}</em>` : ''}</div>`; })()}<div><small>${tt('المتوقع GW', 'Proj. GW')}${G.next}</small><b>${plan ? projected(plan) : '—'}</b></div></div>
   </section>
   <div class="card tap" style="margin-top:10px;padding:12px 14px" onclick="go('team')"><div class="flex between"><span class="flex" style="font-size:13.5px">${I('i-clock', 'i', 'width:17px;height:17px;color:var(--acc)')}${t('deadline')} ${t('gw')} ${G.next}<span class="mut" style="font-size:12px">${fmtTime(G.deadline)}</span></span></div><div class="cd" id="cd" style="margin-top:8px"></div></div>

   <div class="sec"><h2>${I('i-target')}${tt('خطوتك الجاية', 'Your next moves')}</h2></div>
   <div class="list">${A.map((x) => `<div class="row"><div class="pbig" style="background:color-mix(in srgb, ${x.col} 14%, transparent);color:${x.col}">${I(x.ok ? 'i-check' : x.ic, 'i', 'width:19px;height:19px')}</div><div class="info"><b>${x.h}</b><span style="white-space:normal">${x.d}</span></div>${x.b ? `<button class="btn btn-g btn-sm" onclick="${x.b[1]}">${x.b[0]}</button>` : ''}</div>`).join('')}</div>

   <button class="sbar" style="width:100%;max-width:none;margin-top:12px;height:48px" onclick="go('search')">${I('i-sparkle')}<span>${tt('اسأل المساعد: منو أكابتن؟ شنو أبيع؟ شلون موسمي؟', 'Ask: who to captain? who to sell? how is my season?')}</span></button>

   <div class="sec"><h2>${I('i-history')}${tt('آخر الجولات', 'Recent gameweeks')}</h2><button class="more" onclick="go('season')">${t('season')}${I('i-chev', 'chev')}</button></div>
   <div class="card"><div style="display:flex;align-items:flex-end;gap:6px;height:110px;direction:ltr">${recent.map((h) => { const a = G.events.find((e) => e.id === h.event)?.avg || 0; return `<button onclick="seasonGo(${h.event})" style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px;position:relative" aria-label="GW${h.event}"><span class="num" style="font-size:11px;font-weight:600">${h.points}</span><i style="width:100%;max-width:26px;height:${(h.points / mx) * 72}%;border-radius:5px 5px 2px 2px;background:${h.points >= a ? 'var(--acc)' : 'var(--s3)'}"></i><span class="num mut" style="font-size:10.5px">${h.event}</span></button>`; }).join('')}</div><div class="flex" style="gap:12px;font-size:12px;margin-top:8px;color:var(--mut)"><span class="flex" style="gap:5px"><i style="width:10px;height:10px;border-radius:3px;background:var(--acc)"></i>${tt('فوق المعدل', 'Above avg')}</span><span class="flex" style="gap:5px"><i style="width:10px;height:10px;border-radius:3px;background:var(--s3)"></i>${tt('تحت المعدل', 'Below avg')}</span></div></div>

   ${priv.length ? `<div class="sec"><h2>${I('i-trophy')}${t('leagues')}</h2><button class="more" onclick="go('leagues')">${tt('الكل', 'All')}${I('i-chev', 'chev')}</button></div><div class="list">${priv.slice(0, 3).map((l) => `<div class="row tap" onclick="go('leagues')"><div class="pbig" style="background:var(--s3);font-family:var(--num)">${l.entry_rank}</div><div class="info"><b>${esc(l.name)}</b><span>${tt('من', 'of')} ${fmt(l.rank_count)}</span></div>${l.entry_last_rank && l.entry_rank !== l.entry_last_rank ? `<span class="${l.entry_rank < l.entry_last_rank ? 'up' : 'down'}" style="font-size:13px">${l.entry_rank < l.entry_last_rank ? '▲' : '▼'} ${Math.abs(l.entry_last_rank - l.entry_rank)}</span>` : ''}</div>`).join('')}</div>` : ''}

   ${news.length ? `<div class="sec"><h2>${I('i-alert')}${tt('أخبار لاعبينك', 'Your player news')}</h2></div><div class="list">${news.map((p) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span style="white-space:normal;color:var(--warn)">${esc(p.news)}</span></div></div>`).join('')}</div>` : ''}
   <div class="updated">${t('updated')}: ${fmtTime(new Date(ST.G.fetchedAt).toISOString())}</div>`;
}
export function afterHome() {
  clearInterval(cdT); tick(); cdT = setInterval(tick, 1000);
  if (!ST.live && ST.G.cur) FPL.loadLive(ST.G.cur).then((l) => { ST.live = Object.fromEntries(l.elements.map((x) => [x.id, x.stats])); ST.liveRaw = l.elements; ST.liveRawGW = ST.G.cur; if (ST.view === 'home' && liveTeamPoints() != null) window.render(); }).catch(() => {});
}
