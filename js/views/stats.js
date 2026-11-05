/* مركز التحليلات + الإنجازات */
import { ST, PM, tName } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, r1, lineChart, barChart, openSheet, sheetHead } from '../ui.js';
import * as FPL from '../fpl.js';
import { playerSummary, pShirt } from './common.js';

let deep = null, loading = false;
async function loadDeep() {
  loading = true; const id = ST.profile.teamId, hist = ST.E.hist.current || [];
  const gws = hist.map((h) => h.event);
  const picks = {}; for (let i = 0; i < gws.length; i += 6) { const part = await Promise.all(gws.slice(i, i + 6).map((g) => FPL.fetchPicks(id, g).then((p) => [g, p]).catch(() => [g, null]))); part.forEach(([g, p]) => (picks[g] = p)); }
  const capIds = [...new Set(Object.values(picks).filter(Boolean).map((p) => p.picks.find((x) => x.is_captain)?.element).filter(Boolean))];
  const trIds = [...new Set((ST.E.transfers || []).flatMap((x) => [x.element_in, x.element_out]))].filter((x) => PM(x));
  const ids = [...new Set([...capIds, ...trIds])]; const sums = {};
  for (let i = 0; i < ids.length; i += 6) { const part = await Promise.all(ids.slice(i, i + 6).map((x) => playerSummary(x).then((d) => [x, d]).catch(() => [x, null]))); part.forEach(([x, d]) => (sums[x] = d)); }
  const ptsOf = (pid, g) => (sums[pid]?.history || []).filter((r) => r.round === g).reduce((a, r) => a + r.total_points, 0);
  const caps = gws.map((g) => { const p = picks[g]; if (!p) return null; const c = p.picks.find((x) => x.is_captain); return c ? { g, id: c.element, pts: ptsOf(c.element, g), mult: c.multiplier, chip: p.active_chip } : null; }).filter(Boolean);
  const cur = ST.G.cur;
  const trs = (ST.E.transfers || []).filter((x) => PM(x.element_in) && PM(x.element_out)).map((x) => { let gin = 0, gout = 0; for (let g = x.event; g <= cur; g++) { gin += ptsOf(x.element_in, g); gout += ptsOf(x.element_out, g); } return { ...x, gin, gout, net: gin - gout }; });
  deep = { picks, caps, trs }; loading = false; if (ST.view === 'stats' || ST.view === 'achievements') window.render();
}
export function vStats() {
  const G = ST.G, hist = ST.E.hist.current || [];
  if (!deep && !loading) loadDeep().catch(() => { loading = false; deep = { picks: {}, caps: [], trs: [] }; });
  const labels = hist.map((h) => h.event), avg = hist.map((h) => G.events.find((e) => e.id === h.event)?.avg ?? null);
  const bench = hist.reduce((a, h) => a + (h.points_on_bench || 0), 0), hitsCost = hist.reduce((a, h) => a + (h.event_transfers_cost || 0), 0), trN = hist.reduce((a, h) => a + (h.event_transfers || 0), 0);
  const diff = hist.reduce((a, h, i) => a + (h.points - (avg[i] || 0)), 0);
  const best = [...hist].sort((a, b) => b.points - a.points)[0], worst = [...hist].sort((a, b) => a.points - b.points)[0];
  const caps = deep?.caps || [], trs = deep?.trs || [];
  const capTotal = caps.reduce((a, c) => a + c.pts * (c.mult - 1), 0);
  const goodTr = trs.filter((x) => x.net > 0).length;
  const sortedTr = [...trs].sort((a, b) => b.net - a.net);
  const k = (v, l, cls = '') => `<div class="card stat"><span class="k">${l}</span><span class="v num ${cls}">${v}</span></div>`;
  return `<div class="grid g4">${k(fmt(ST.E.entry.summary_overall_points), t('total'))}${k((diff >= 0 ? '+' : '') + Math.round(diff), tt('مقارنة بالمعدل', 'vs average'), diff >= 0 ? 'up' : 'down')}${k(bench, tt('نقاط ضاعت بالدكة', 'Bench points lost'), 'down')}${k(hitsCost ? '−' + hitsCost : 0, tt('خصم الانتقالات', 'Hit cost'))}</div>
   <div class="sec"><h2>${I('i-chart')}${tt('تطور النقاط مقابل المعدل', 'Points vs average')}</h2></div><div class="card">${lineChart(labels, [{ name: tt('نقاطك', 'You'), color: '#34D399', vals: hist.map((h) => h.points) }, { name: t('avg'), color: '#94A3B8', vals: avg }, { name: t('highest'), color: '#10B981', vals: hist.map((h) => G.events.find((e) => e.id === h.event)?.top ?? null) }])}</div>
   <div class="sec"><h2>${I('i-trophy')}${tt('تطور الترتيب', 'Rank trend')}</h2></div><div class="card">${lineChart(labels, [{ name: t('overall'), color: '#60A5FA', vals: hist.map((h) => h.overall_rank) }], { invert: true, fmtV: fmt })}</div>
   <div class="sec"><h2>${I('i-bench')}${tt('نقاط الدكة لكل جولة', 'Bench points per GW')}</h2></div><div class="card">${barChart(labels, hist.map((h) => h.points_on_bench || 0), { h: 130, color: 'linear-gradient(180deg,#F59E0B,#EF4444)' })}</div>
   <div class="sec"><h2>${I('i-star')}${tt('تحليل الكابتن', 'Captaincy analysis')}</h2>${loading ? `<span class="mut" style="font-size:12px">${t('loading')}</span>` : ''}</div>
   ${caps.length ? `<div class="card">${barChart(caps.map((c) => c.g), caps.map((c) => c.pts * c.mult), { h: 130 })}<div class="mut" style="font-size:12px">${tt('نقاط الكابتن بعد المضاعفة. مجموع النقاط الإضافية من الكابتن', 'Captain points after multiplier. Extra points from captaincy')}: <b style="color:#34D399">${capTotal}</b></div></div>
    <div class="grid g2" style="margin-top:8px">${[[tt('أفضل اختيار كابتن', 'Best captain pick'), [...caps].sort((a, b) => b.pts - a.pts)[0], 'up'], [tt('أسوأ اختيار كابتن', 'Worst captain pick'), [...caps].sort((a, b) => a.pts - b.pts)[0], 'down']].map(([l, c, cl]) => `<div class="card tap" onclick="openPlayer(${c.id})"><div class="mut" style="font-size:12px">${l}</div><b>${esc(PM(c.id)?.name || '#' + c.id)}</b> <span class="${cl}">GW${c.g}: ${c.pts * c.mult}</span></div>`).join('')}</div>` : `<div class="card mut">${loading ? t('loading') : t('noData')}</div>`}
   <div class="sec"><h2>${I('i-swap')}${tt('تحليل الانتقالات', 'Transfer analysis')}</h2></div>
   ${trs.length ? `<div class="grid g3">${k(trN, tt('عدد الانتقالات', 'Transfers'))}${k(`${goodTr}/${trs.length}`, tt('انتقالات ناجحة', 'Successful'), 'up')}${k((trs.reduce((a, x) => a + x.net, 0) >= 0 ? '+' : '') + trs.reduce((a, x) => a + x.net, 0), tt('صافي النقاط', 'Net points'))}</div>
    <div class="card scroll-x" style="margin-top:8px"><table class="tbl"><thead><tr><th>${t('gw')}</th><th>${tt('داخل', 'In')}</th><th>${tt('خارج', 'Out')}</th><th>${tt('صافي', 'Net')}</th></tr></thead><tbody>${sortedTr.map((x) => `<tr onclick="openPlayer(${x.element_in})"><td>${x.event}</td><td class="up">${esc(PM(x.element_in).name)} (${x.gin})</td><td class="down">${esc(PM(x.element_out).name)} (${x.gout})</td><td><b class="${x.net >= 0 ? 'up' : 'down'}">${x.net >= 0 ? '+' : ''}${x.net}</b></td></tr>`).join('')}</tbody></table></div>
    <div class="grid g2" style="margin-top:8px"><div class="alert"><div class="ai" style="background:rgba(16,185,129,.14);color:#10B981">${I('i-check')}</div><p><b>${tt('أفضل قرار', 'Best decision')}:</b> ${esc(PM(sortedTr[0].element_in).name)} ${tt('بدل', 'for')} ${esc(PM(sortedTr[0].element_out).name)} (GW${sortedTr[0].event}) — +${sortedTr[0].net}</p></div><div class="alert"><div class="ai" style="background:rgba(239,68,68,.14);color:#EF4444">${I('i-alert')}</div><p><b>${tt('أسوأ قرار', 'Worst decision')}:</b> ${esc(PM(sortedTr.at(-1).element_in).name)} ${tt('بدل', 'for')} ${esc(PM(sortedTr.at(-1).element_out).name)} (GW${sortedTr.at(-1).event}) — ${sortedTr.at(-1).net}</p></div></div>` : `<div class="card mut">${loading ? t('loading') : tt('ما في انتقالات مسجلة', 'No transfers recorded')}</div>`}
   <div class="grid g2" style="margin-top:12px"><div class="card"><div class="mut" style="font-size:12px">${tt('أفضل جولة', 'Best GW')}</div><b style="font-size:24px">${best?.points ?? '—'}</b> <span class="mut">GW${best?.event ?? ''}</span></div><div class="card"><div class="mut" style="font-size:12px">${tt('أسوأ جولة', 'Worst GW')}</div><b style="font-size:24px">${worst?.points ?? '—'}</b> <span class="mut">GW${worst?.event ?? ''}</span></div></div>
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:10px">${tt('صافي الانتقال = نقاط اللاعب الداخل ناقص نقاط الخارج من جولة الانتقال لحد هسه.', 'Transfer net = points of player in minus player out since that GW.')}</p>`;
}

/* ---------- الإنجازات ---------- */
export function achievements() {
  const hist = ST.E.hist.current || [], G = ST.G, caps = deep?.caps || [], trs = deep?.trs || [];
  const maxPts = Math.max(0, ...hist.map((h) => h.points));
  let streak = 0, bestStreak = 0; hist.forEach((h) => { const ev = G.events.find((e) => e.id === h.event); if (ev && h.points > ev.avg) { streak++; bestStreak = Math.max(bestStreak, streak); } else streak = 0; });
  let climb = 0, cb = 0; hist.forEach((h, i) => { if (i && h.overall_rank < hist[i - 1].overall_rank) { cb++; climb = Math.max(climb, cb); } else cb = 0; });
  const rankGain = hist.length > 1 ? Math.max(0, hist[0].overall_rank - hist.at(-1).overall_rank) : 0;
  const bestCap = Math.max(0, ...caps.map((c) => c.pts * c.mult)), bestTr = Math.max(0, ...trs.map((x) => x.net));
  const leaderOf = (ST.E.entry.leagues?.classic || []).filter((l) => l.league_type === 'x' && l.entry_rank === 1).length;
  const noHits = hist.every((h) => !h.event_transfers_cost);
  const top10 = ST.E.entry.summary_overall_rank && G.totalPlayers ? ST.E.entry.summary_overall_rank / G.totalPlayers <= 0.1 : false;
  return [
    ['i-target', tt('نادي الـ90', '90 Club'), tt('90 نقطة أو أكثر بجولة', '90+ in a GW'), maxPts >= 90, `${maxPts}/90`],
    ['i-star', tt('جولة المية', 'Century'), tt('100 نقطة بجولة', '100 in a GW'), maxPts >= 100, `${maxPts}/100`],
    ['i-crown', tt('كابتن ذهبي', 'Golden captain'), tt('كابتن يجيب 20+ بعد المضاعفة', 'Captain 20+ after multiplier'), bestCap >= 20, `${bestCap}/20`],
    ['i-swap', tt('صفقة العمر', 'Transfer of the year'), tt('انتقال صافيه +15', 'A +15 net transfer'), bestTr >= 15, `${bestTr}/15`],
    ['i-fire', tt('سلسلة فوق المعدل', 'Above-average streak'), tt('4 جولات ورا بعض فوق المعدل', '4 GWs in a row above average'), bestStreak >= 4, `${bestStreak}/4`],
    ['i-up', tt('صاروخ الترتيب', 'Rank rocket'), tt('اصعد مليون مركز', 'Climb 1M places'), rankGain >= 1e6, fmt(rankGain)],
    ['i-activity', tt('صعود متواصل', 'Green arrows'), tt('5 أسهم خضراء ورا بعض', '5 green arrows in a row'), climb >= 5, `${climb}/5`],
    ['i-trophy', tt('المتصدّر', 'Leader'), tt('تصدّر دوري خاص', 'Top a private league'), leaderOf > 0, `${leaderOf}`],
    ['i-shield', tt('أعصاب باردة', 'Ice cold'), tt('ولا خصم طول الموسم', 'No hits all season'), noHits && hist.length > 3, noHits ? '✓' : '✗'],
    ['i-medal', tt('أعلى 10%', 'Top 10%'), tt('ترتيب عام ضمن أعلى 10%', 'Overall rank in top 10%'), top10, fmt(ST.E.entry.summary_overall_rank)],
  ];
}
export function vAchievements() {
  if (!deep && !loading) loadDeep().catch(() => {});
  const A = achievements(), got = A.filter((a) => a[3]).length;
  return `<div class="card" style="text-align:center"><div class="pbig" style="margin:0 auto 6px;background:var(--acc-soft);color:var(--acc)">${I('i-trophy')}</div><b style="font-size:18px">${got} / ${A.length}</b><div class="prog" style="margin-top:10px"><i style="width:${got / A.length * 100}%"></i></div><div class="mut" style="font-size:12px;margin-top:6px">${tt('محسوبة من بياناتك الحقيقية', 'Computed from your real data')}${loading ? ' · ' + t('loading') : ''}</div></div>
   <div class="grid g3" style="margin-top:12px">${A.map((a) => `<div class="card badge-c ${a[3] ? '' : 'locked'}"><div class="be">${I(a[0])}</div><b>${a[1]}</b><span class="mut" style="font-size:11px">${a[2]}</span><span class="tag ${a[3] ? 'lime' : ''}" style="font-size:10px">${a[3] ? tt('محقق', 'Unlocked') : a[4]}</span></div>`).join('')}</div>`;
}
