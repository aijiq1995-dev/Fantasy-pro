/* الدوريات: دوريات الفانتازي الرسمية + دوريات التطبيق الخاصة (Firestore) */
import { ST } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, openSheet, sheetHead, toast, lineChart, closeSheet } from '../ui.js';
import * as FPL from '../fpl.js';
import * as AU from '../auth.js';
import { PM } from '../store.js';
import { liveCalc } from '../live-engine.js';

let tab = 'fpl', appLeagues = null, open = null, lgData = null, lgPage = 1, appData = {}, lgLiveRows = null, lgLiveBusy = false;
export function vLeagues() {
  const lgs = ST.E.entry.leagues?.classic || [];
  const row = (l) => `<div class="row tap" onclick="openLg(${l.id})"><div class="mini" style="display:grid;place-items:center;border-radius:14px;background:${l.entry_rank === 1 ? 'rgba(52,211,153,.2)' : l.league_type === 'x' ? 'rgba(99,102,241,.18)' : 'rgba(96,165,250,.12)'};font-size:20px">${l.entry_rank === 1 ? I('i-crown', 'i', 'color:var(--gold)') : l.entry_rank <= 3 ? I('i-trophy', 'i', 'color:var(--acc)') : I('i-globe', 'i', 'color:var(--mut)')}</div><div class="info"><b>${esc(l.name)}</b><span>${l.rank_count ? fmt(l.rank_count) + ' ' + tt('مدرب', 'managers') : ''}</span></div><div class="col">${fmt(l.entry_rank)}<small>${l.entry_last_rank ? (l.entry_rank < l.entry_last_rank ? '<span class="up">▲</span>' : l.entry_rank > l.entry_last_rank ? '<span class="down">▼</span>' : '•') : ''}</small></div></div>`;
  let body = '';
  if (tab === 'fpl') body = open && lgData ? fplTable() : `<div class="sec"><h2>${I('i-users')}${tt('الدوريات الخاصة', 'Private leagues')}</h2></div>${lgs.filter((l) => l.league_type !== 's').map(row).join('') || `<p class="mut">—</p>`}<div class="sec"><h2>${I('i-globe')}${tt('الدوريات العامة', 'Public leagues')}</h2></div>${lgs.filter((l) => l.league_type === 's').map(row).join('')}`;
  else body = appBody();
  return `<div class="seg" style="margin-bottom:12px"><button class="${tab === 'fpl' ? 'on' : ''}" onclick="lgTab('fpl')">${tt('دورياتي بالفانتازي', 'My FPL leagues')}</button><button class="${tab === 'app' ? 'on' : ''}" onclick="lgTab('app')">${tt('دوريات التطبيق', 'App leagues')}</button></div>${body}`;
}
function fplTable() {
  const d = lgData, res = d.standings?.results || [], me = ST.profile.teamId;
  return `<div class="banner"><b>${I('i-trophy', 'i', 'width:17px;height:17px;vertical-align:-3px;color:var(--acc)')} ${esc(d.league?.name || '')}</b><span class="flex" style="gap:6px"><button class="btn btn-p btn-sm" onclick="lgLive()">${I('i-live', 'i', 'width:15px;height:15px')}${tt('مباشر', 'Live')}</button><button class="btn btn-g btn-sm" onclick="openLg(null)">${t('back')}</button></span></div>${liveHtml()}
   <div class="card scroll-x"><table class="tbl"><thead><tr><th>#</th><th>${tt('الفريق', 'Team')}</th><th>${t('gw')}</th><th>${t('total')}</th></tr></thead><tbody>${res.map((r) => `<tr class="${r.entry === me ? 'me' : ''}" onclick="rivalSheet(${r.entry},'${esc(r.entry_name).replace(/'/g, '')}')"><td>${r.rank <= 3 ? `<span class="rate" style="background:${['#FBBF24', '#CBD5E1', '#D97706'][r.rank - 1]};color:#111">${r.rank}</span>` : r.rank} <span class="${r.last_rank > r.rank ? 'up' : r.last_rank < r.rank ? 'down' : 'mut'}" style="font-size:10px">${r.last_rank > r.rank ? '▲' : r.last_rank < r.rank ? '▼' : ''}</span></td><td><b>${esc(r.entry_name)}</b><div class="mut" style="font-size:11px">${esc(r.player_name)}</div></td><td>${r.event_total}</td><td><b>${fmt(r.total)}</b></td></tr>`).join('')}</tbody></table></div>
   <div style="display:flex;justify-content:center;gap:8px;margin-top:10px">${lgPage > 1 ? `<button class="btn btn-g btn-sm" onclick="lgPg(-1)">${tt('السابق', 'Prev')}</button>` : ''}<span class="mut" style="align-self:center">${lgPage}</span>${d.standings?.has_next ? `<button class="btn btn-g btn-sm" onclick="lgPg(1)">${tt('التالي', 'Next')}</button>` : ''}</div>
   <p class="mut" style="font-size:11.5px;text-align:center;margin-top:8px">${tt('اضغط على أي فريق لمقارنته بفريقك جولة بجولة', 'Tap any team to compare GW by GW')}</p>`;
}
function appBody() {
  if (!appLeagues) { AU.myLeagues(ST.user.uid).then((l) => { appLeagues = l; window.render(); }).catch((e) => { appLeagues = []; toast(e.message); }); return `<div class="aiload"><i></i><i></i><i></i><span>${t('loading')}</span></div>`; }
  if (open && appData[open]) return appLeagueView(appData[open]);
  return `<div class="grid g2"><button class="btn btn-p" onclick="newLg()">${I('i-plus')}${tt('إنشاء دوري', 'Create league')}</button><button class="btn btn-g" onclick="joinLg()">${I('i-users')}${tt('انضمام برمز', 'Join with code')}</button></div>
   ${appLeagues.length ? appLeagues.map((l) => `<div class="row tap" style="margin-top:10px" onclick="openApp('${l.code}')"><div class="mini" style="display:grid;place-items:center;border-radius:14px;background:rgba(52,211,153,.14);color:#34D399">${I('i-trophy')}</div><div class="info"><b>${esc(l.name)}</b><span>${Object.keys(l.members).length} ${tt('مشارك', 'members')} · ${tt('الرمز', 'Code')} ${l.code}</span></div>${I('i-chev', 'chev')}</div>`).join('') : `<div class="empty">${I('i-trophy', 'i', 'width:44px;height:44px')}<b>${tt('ما عندك دوريات بالتطبيق', 'No app leagues yet')}</b><p class="mut">${tt('سوّي دوري وادعُ أصدقائك بالرمز. الترتيب ينحسب من نقاطهم الحقيقية بالفانتازي.', 'Create one and invite friends with the code. Standings use their real FPL points.')}</p></div>`}`;
}
async function loadApp(code) {
  const l = appLeagues.find((x) => x.code === code); if (!l) return;
  const mem = Object.entries(l.members);
  const hs = await Promise.all(mem.map(([uid, m]) => FPL.fetchHistory(m.teamId).then((h) => ({ uid, ...m, h: h.current || [] })).catch(() => ({ uid, ...m, h: [] }))));
  appData[code] = { l, hs }; window.render();
}
function appLeagueView({ l, hs }) {
  const G = ST.G, gws = [...new Set(hs.flatMap((m) => m.h.map((x) => x.event)))].sort((a, b) => a - b);
  const tot = (m) => m.h.reduce((a, x) => a + x.points - (x.event_transfers_cost || 0), 0);
  const table = hs.map((m) => ({ ...m, total: tot(m), last: m.h[m.h.length - 1]?.points ?? 0 })).sort((a, b) => b.total - a.total);
  const wins = {}; gws.forEach((g) => { const best = Math.max(...hs.map((m) => m.h.find((x) => x.event === g)?.points ?? -1)); hs.forEach((m) => { if ((m.h.find((x) => x.event === g)?.points ?? -2) === best) wins[m.uid] = (wins[m.uid] || 0) + 1; }); });
  const me = hs.find((m) => m.uid === ST.user.uid);
  const h2h = me ? hs.filter((m) => m !== me).map((m) => { let w = 0, d = 0, lo = 0; gws.forEach((g) => { const a = me.h.find((x) => x.event === g)?.points, b = m.h.find((x) => x.event === g)?.points; if (a == null || b == null) return; a > b ? w++ : a < b ? lo++ : d++; }); return { m, w, d, lo }; }) : [];
  const lastGW = gws[gws.length - 1];
  const ch = lastGW ? [[tt('أعلى نقاط بالجولة', 'Top GW score'), (m) => m.h.find((x) => x.event === lastGW)?.points ?? 0, 1], [tt('أقل نقاط ضايعة بالدكة', 'Fewest bench points'), (m) => m.h.find((x) => x.event === lastGW)?.points_on_bench ?? 99, -1], [tt('بدون خصم', 'No hits'), (m) => -(m.h.find((x) => x.event === lastGW)?.event_transfers_cost ?? 0), 1]] : [];
  return `<div class="banner"><b>${I('i-trophy', 'i', 'width:17px;height:17px;vertical-align:-3px;color:var(--acc)')} ${esc(l.name)}</b><span style="display:flex;gap:6px"><button class="btn btn-g btn-sm" onclick="copyCode('${l.code}')">${I('i-copy', 'i', 'width:14px;height:14px')}${l.code}</button><button class="btn btn-g btn-sm" onclick="openApp(null)">${t('back')}</button></span></div>
   <div class="card scroll-x"><table class="tbl"><thead><tr><th>#</th><th>${tt('المدرب', 'Manager')}</th><th>${t('gw')} ${lastGW || ''}</th><th>${t('total')}</th><th>${tt('فوز أسبوعي', 'Weekly wins')}</th></tr></thead><tbody>${table.map((m, i) => `<tr class="${m.uid === ST.user.uid ? 'me' : ''}"><td>${i < 3 ? `<span class="rate" style="background:${['#FBBF24', '#CBD5E1', '#D97706'][i]};color:#111">${i + 1}</span>` : i + 1}</td><td><b>${esc(m.name)}</b><div class="mut" style="font-size:11px">${esc(m.team || '#' + m.teamId)}</div></td><td>${m.last}</td><td><b>${fmt(m.total)}</b></td><td>${wins[m.uid] || 0}</td></tr>`).join('')}</tbody></table></div>
   ${ch.length ? `<div class="sec"><h2>${I('i-target')}${tt(`تحديات الجولة ${lastGW}`, `GW${lastGW} challenges`)}</h2></div><div class="grid g3">${ch.map(([n, f, dir]) => { const w = [...hs].sort((a, b) => dir * (f(b) - f(a)))[0]; return `<div class="card"><div class="mut" style="font-size:12px">${n}</div><b style="display:block;margin-top:4px">${esc(w.name)}</b><span class="tag lime">${Math.abs(f(w))}</span></div>`; }).join('')}</div>` : ''}
   <div class="sec"><h2>${I('i-crown')}${tt('لوحة الشرف', 'Hall of fame')}</h2></div><div class="grid g3">${table.slice().sort((a, b) => (wins[b.uid] || 0) - (wins[a.uid] || 0)).slice(0, 3).map((m, i) => `<div class="card" style="text-align:center"><div class="pbig" style="margin:0 auto 6px;background:var(--s3);color:${['#FBBF24', '#CBD5E1', '#D97706'][i]}">${I(i ? 'i-medal' : 'i-crown')}</div><b>${esc(m.name)}</b><div class="mut" style="font-size:12px">${wins[m.uid] || 0} ${tt('فوز أسبوعي', 'weekly wins')} · ${tt('أعلى جولة', 'best GW')} ${Math.max(0, ...m.h.map((x) => x.points))}</div></div>`).join('')}</div>
   ${h2h.length ? `<div class="sec"><h2>${I('i-swap')}${tt('سجل مواجهاتك', 'Your head-to-head')}</h2></div>${h2h.map((x) => `<div class="row"><div class="info"><b>${esc(x.m.name)}</b><span>${tt('جولة بجولة', 'GW by GW')}</span></div><span class="tag lime">${x.w} ${tt('فوز', 'W')}</span><span class="tag">${x.d} ${tt('تعادل', 'D')}</span><span class="tag red">${x.lo} ${tt('خسارة', 'L')}</span></div>`).join('')}` : ''}
   <div class="sec"><h2>${I('i-chart')}${tt('مقارنة النقاط', 'Points comparison')}</h2></div><div class="card">${lineChart(gws, table.slice(0, 4).map((m, i) => ({ name: m.name, color: ['#34D399', '#60A5FA', '#10B981', '#FB7185'][i], vals: gws.map((g) => m.h.find((x) => x.event === g)?.points ?? null) })))}</div>
   <div class="grid g2" style="margin-top:12px">${l.owner === ST.user.uid ? `<button class="btn btn-r" onclick="delLg('${l.code}')">${I('i-trash')}${tt('حذف الدوري', 'Delete league')}</button>` : `<button class="btn btn-r" onclick="leaveLg('${l.code}')">${I('i-logout')}${tt('مغادرة', 'Leave')}</button>`}<button class="btn btn-g" onclick="appData['${l.code}']=null;openApp('${l.code}')">${I('i-refresh')}${t('refresh')}</button></div>`;
}
async function rivalSheet(entry, name) {
  openSheet(`${sheetHead(I('i-swords'), tt('إنت ضد ', 'You vs ') + esc(name))}<div id="rv" class="aiload"><i></i><i></i><i></i></div>`);
  try {
    const [a, b] = await Promise.all([FPL.fetchHistory(ST.profile.teamId), FPL.fetchHistory(entry)]);
    const gws = a.current.map((x) => x.event); let w = 0, lo = 0, d = 0;
    gws.forEach((g) => { const x = a.current.find((y) => y.event === g)?.points, y = b.current.find((z) => z.event === g)?.points; if (x == null || y == null) return; x > y ? w++ : x < y ? lo++ : d++; });
    const ta = a.current.at(-1)?.total_points ?? 0, tb = b.current.at(-1)?.total_points ?? 0;
    document.getElementById('rv').outerHTML = `<div class="vs"><div><b>${tt('إنت', 'You')}</b><div class="big">${fmt(ta)}</div></div><div class="mid">VS</div><div><b>${esc(name)}</b><div class="big">${fmt(tb)}</div></div></div><div class="vsbar"><i style="width:${(ta / (ta + tb || 1)) * 100}%"></i></div>
     <div class="kv"><div><b class="up">${w}</b><span>${tt('جولات فزت', 'GWs won')}</span></div><div><b>${d}</b><span>${tt('تعادل', 'Drawn')}</span></div><div><b class="down">${lo}</b><span>${tt('خسرت', 'Lost')}</span></div></div>
     <div class="card">${lineChart(gws, [{ name: tt('إنت', 'You'), color: '#34D399', vals: gws.map((g) => a.current.find((x) => x.event === g)?.points ?? null) }, { name: esc(name), color: '#60A5FA', vals: gws.map((g) => b.current.find((x) => x.event === g)?.points ?? null) }])}</div>`;
    rivalDiff(entry, name);
  } catch (e) { document.getElementById('rv').outerHTML = `<p class="mut">${esc(e.message)}</p>`; }
}
/* الفروقات بين فريقك وفريق المنافس بالجولة الحالية */
async function rivalDiff(entry, name) {
  const gw = ST.G.cur, host = document.querySelector('.sheet'); if (!host || !gw) return;
  const box = document.createElement('div'); host.appendChild(box);
  try {
    const [a, b] = await Promise.all([FPL.fetchPicks(ST.profile.teamId, gw), FPL.fetchPicks(entry, gw)]);
    const ca = ST.live && ST.liveRawGW === gw ? liveCalc(a, gw) : null, cb = ca ? liveCalc(b, gw) : null;
    const mult = (pk, id) => pk.picks.find((x) => x.element === id)?.multiplier ?? 0;
    const ids = [...new Set([...a.picks, ...b.picks].map((x) => x.element))];
    const diff = ids.map((id) => ({ id, ma: mult(a, id), mb: mult(b, id), pts: ST.live?.[id]?.total_points ?? null })).filter((x) => x.ma !== x.mb);
    const mine = diff.filter((x) => x.ma > x.mb), theirs = diff.filter((x) => x.mb > x.ma);
    const li = (x, me) => { const p = PM(x.id); return p ? `<div class="row tap" onclick="openPlayer(${p.id})"><div class="info"><b>${esc(p.name)}</b><span>${me ? `×${x.ma} ${tt('عندك', 'you')}` : `×${x.mb} ${tt('عنده', 'them')}`}${(me ? x.mb : x.ma) ? ` · ×${me ? x.mb : x.ma} ${me ? tt('عنده', 'them') : tt('عندك', 'you')}` : ''}</span></div>${x.pts != null ? `<div class="col">${x.pts}<small>${tt('نقطة', 'pts')}</small></div>` : ''}</div>` : ''; };
    box.innerHTML = `<div class="sec"><h2>${I('i-compare')}${tt('الفروقات بالجولة', 'Differentials this GW')} ${gw}</h2></div>
     ${ca ? `<div class="kv"><div><b class="up">${ca.total}</b><span>${tt('إنت مباشر', 'You live')}</span></div><div><b>${ca.total - cb.total >= 0 ? '+' : ''}${ca.total - cb.total}</b><span>${tt('الفرق', 'Gap')}</span></div><div><b style="color:var(--info)">${cb.total}</b><span>${esc(name)}</span></div></div>` : ''}
     <div class="grid g2"><div><div class="mut" style="font-size:12px;margin:4px 2px">${tt('عندك وما عنده', 'Only you')}</div><div class="list">${mine.map((x) => li(x, true)).join('') || '<p class="mut" style="padding:10px">—</p>'}</div></div><div><div class="mut" style="font-size:12px;margin:4px 2px">${tt('عنده وما عندك', 'Only them')}</div><div class="list">${theirs.map((x) => li(x, false)).join('') || '<p class="mut" style="padding:10px">—</p>'}</div></div></div>`;
  } catch { box.innerHTML = `<p class="mut" style="font-size:12px;margin-top:10px">${tt('تشكيلة المنافس تنكشف بعد إغلاق الجولة.', 'Rival picks show after the deadline.')}</p>`; }
}
Object.assign(window, {
  lgTab: (x) => { tab = x; open = null; window.render(); },
  openLg: async (id) => { lgLiveRows = null; if (!id) { open = null; lgData = null; return window.render(); } open = id; lgPage = 1; toast(t('loading')); try { lgData = await FPL.loadLeague(id, 1); window.render(); window.scrollTo(0, 0); } catch (e) { toast(e.message); open = null; } },
  lgPg: async (d) => { lgPage += d; lgData = await FPL.loadLeague(open, lgPage); window.render(); },
  rivalSheet,
  openApp: (code) => { open = code; if (code && !appData[code]) { loadApp(code); toast(t('loading')); } window.render(); },
  newLg: () => openSheet(`${sheetHead(I('i-plus'), tt('إنشاء دوري خاص', 'Create a league'))}<div class="field"><label>${tt('اسم الدوري', 'League name')}</label><input id="lgName" maxlength="40"></div><button class="btn btn-p btn-b" id="lgGo">${tt('إنشاء', 'Create')}</button>`, () => { document.getElementById('lgGo').onclick = async () => { const n = document.getElementById('lgName').value.trim(); if (n.length < 2) return toast(tt('اكتب اسم', 'Enter a name')); try { const l = await AU.createLeague(ST.user, ST.profile, n); appLeagues = [...(appLeagues || []), l]; closeSheet(); window.render(); openSheet(`${sheetHead(I('i-check'), tt('تم إنشاء الدوري', 'League created'))}<p>${tt('شارك هذا الرمز ويا أصدقائك:', 'Share this code with friends:')}</p><div class="urlbox" onclick="copyCode('${l.code}')"><code style="font-size:24px;text-align:center">${l.code}</code>${I('i-copy')}</div>`); } catch (e) { toast(e.message); } }; }),
  joinLg: () => openSheet(`${sheetHead(I('i-users'), tt('الانضمام لدوري', 'Join a league'))}<div class="field"><label>${tt('رمز الدعوة (6 أحرف)', 'Invite code (6 chars)')}</label><input id="lgCode" dir="ltr" maxlength="6" style="text-transform:uppercase;letter-spacing:4px;font-size:20px;text-align:center"></div><button class="btn btn-p btn-b" id="lgJ">${tt('انضمام', 'Join')}</button>`, () => { document.getElementById('lgJ').onclick = async () => { try { const l = await AU.joinLeague(ST.user, ST.profile, document.getElementById('lgCode').value); appLeagues = [...(appLeagues || []).filter((x) => x.code !== l.code), l]; closeSheet(); toast(tt('تم الانضمام ✓', 'Joined ✓')); window.render(); } catch (e) { toast(e.message); } }; }),
  leaveLg: async (c) => { await AU.leaveLeague(ST.user.uid, c); appLeagues = appLeagues.filter((x) => x.code !== c); open = null; window.render(); },
  delLg: async (c) => { await AU.deleteLeague(c); appLeagues = appLeagues.filter((x) => x.code !== c); open = null; window.render(); toast(tt('تم الحذف', 'Deleted')); },
  copyCode: async (c) => { try { await navigator.clipboard.writeText(c); toast(tt('تم النسخ ✓', 'Copied ✓')); } catch { toast(c); } },
});
window.appData = appData;

/* ---------- الترتيب المباشر للدوري (نقاط كل منافس لحظياً مع البونص المؤقت والتبديلات) ---------- */
function liveHtml() {
  if (lgLiveBusy) return `<div class="card aiload" style="margin-bottom:10px"><i></i><i></i><i></i><span>${tt('يحسب نقاط المنافسين المباشرة…', 'Computing rivals\' live points…')}</span></div>`;
  if (!lgLiveRows) return '';
  if (lgLiveRows.err) return `<div class="note" style="margin:0 0 10px">${I('i-info', 'i', 'color:var(--info)')}<span>${esc(lgLiveRows.err)}</span></div>`;
  const me = ST.profile.teamId;
  return `<div class="card scroll-x" style="margin-bottom:10px"><div class="flex between" style="margin-bottom:6px"><b>${I('i-live', 'i', 'width:16px;height:16px;vertical-align:-3px;color:var(--bad)')} ${tt('الترتيب المباشر', 'Live table')} · ${t('gw')} ${ST.G.cur}</b><span class="mut" style="font-size:11.5px">${tt('تقديري', 'estimate')}</span></div><table class="tbl"><thead><tr><th>#</th><th>${tt('الفريق', 'Team')}</th><th class="n">${tt('مباشر', 'Live')}</th><th class="n">${t('total')}</th><th class="n">${tt('الكابتن', 'C')}</th></tr></thead><tbody>${lgLiveRows.map((r, i) => `<tr class="${r.entry === me ? 'me' : ''}" onclick="rivalSheet(${r.entry},'${esc(r.name).replace(/'/g, '')}')"><td>${i + 1} ${r.rank !== i + 1 ? `<span class="${r.rank > i + 1 ? 'up' : 'down'}" style="font-size:11px">${r.rank > i + 1 ? '▲' : '▼'}${Math.abs(r.rank - i - 1)}</span>` : ''}</td><td><b>${esc(r.name)}</b><br><small class="mut">${esc(r.mgr)}</small></td><td class="n" style="color:var(--acc);font-weight:600">${r.live ?? '—'}</td><td class="n"><b>${r.total}</b></td><td class="n" style="font-size:12px">${esc(r.cap || '—')}</td></tr>`).join('')}</tbody></table></div>`;
}
window.lgLive = async () => {
  if (!lgData) return; const G = ST.G, gw = G.cur;
  const ev = G.events.find((e) => e.id === gw);
  if (!ev || new Date(ev.deadline) > new Date()) { lgLiveRows = { err: tt('الترتيب المباشر يشتغل بعد إغلاق الجولة، لأن تشكيلات المنافسين تنكشف بعدها.', 'Live table works after the deadline, when rivals\' teams are revealed.') }; return window.render(); }
  lgLiveBusy = true; window.render();
  try {
    if (!ST.live || ST.liveRawGW !== gw) { const l = await FPL.loadLive(gw); ST.live = Object.fromEntries(l.elements.map((x) => [x.id, x.stats])); ST.liveRaw = l.elements; ST.liveRawGW = gw; }
    const rows = (lgData.standings?.results || []).slice(0, 30), out = [];
    for (let i = 0; i < rows.length; i += 6) {
      const part = await Promise.all(rows.slice(i, i + 6).map(async (r) => { try { const pk = await FPL.fetchPicks(r.entry, gw); const c = liveCalc(pk, gw); const cap = pk.picks.find((x) => x.is_captain); return { entry: r.entry, name: r.entry_name, mgr: r.player_name, rank: r.rank, live: c.total, total: r.total - r.event_total + c.total, cap: PM(cap?.element)?.name }; } catch { return { entry: r.entry, name: r.entry_name, mgr: r.player_name, rank: r.rank, live: null, total: r.total }; } }));
      out.push(...part);
    }
    lgLiveRows = out.sort((a, b) => b.total - a.total);
  } catch (e) { lgLiveRows = { err: e.message }; }
  lgLiveBusy = false; window.render();
};
