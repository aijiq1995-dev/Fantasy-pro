/* لوحة الإدارة — تظهر فقط للمشرفين (admins/{uid} بـ Firestore، أو حساب admin بالوضع التجريبي) */
import { ST, PM } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, toast, timeAgo, fmtTime, openSheet, sheetHead, closeSheet, askConfirm } from '../ui.js';
import * as AU from '../auth.js';
import * as FPL from '../fpl.js';

let tab = 'overview', D = null, busy = false, q = '';
async function load() {
  busy = true;
  const [users, leagues, logs, status, season] = await Promise.all([AU.adminUsers().catch(() => []), AU.allLeagues().catch(() => []), AU.readLogs().catch(() => []), FPL.serverStatus().catch((e) => ({ error: e.message })), AU.getConfig('season', {})]);
  D = { users, leagues, logs, status, season: season || {} }; busy = false; if (ST.view === 'admin') window.render();
}
const TABS = [['overview', tt('نظرة عامة', 'Overview')], ['users', tt('المستخدمين', 'Users')], ['leagues', tt('الدوريات', 'Leagues')], ['data', tt('البيانات', 'Data')], ['season', tt('الموسم والجولات', 'Season & GWs')], ['scoring', tt('قواعد النقاط', 'Scoring')], ['players', tt('اللاعبين', 'Players')], ['notify', tt('الإشعارات', 'Broadcast')], ['logs', tt('الأخطاء', 'Errors')]];
export function vAdmin() {
  if (!ST.admin) return `<div class="empty">${I('i-shield', 'i', 'width:42px;height:42px')}<b>${tt('غير مصرح', 'Not authorised')}</b></div>`;
  if (!D && !busy) load();
  const body = !D ? `<div class="card mut">${t('loading')}</div>` : ({ overview, users, leagues, data, season, scoring, players, notify, logs }[tab] || overview)();
  return `<div class="note" style="margin-bottom:10px">${I('i-shield')} ${AU.firebaseOn ? tt('صلاحيات الإدارة محمية بقواعد Firestore (مجموعة admins).', 'Admin rights enforced by Firestore rules (admins collection).') : tt('وضع تجريبي: البيانات محلية بهذا المتصفح فقط.', 'Demo mode: data is local to this browser only.')}</div>
   <div class="seg" style="overflow-x:auto;flex-wrap:nowrap">${TABS.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" onclick="adTab('${k}')" style="white-space:nowrap">${l}</button>`).join('')}</div><div style="margin-top:12px">${body}</div>`;
}
const k = (v, l, ic) => `<div class="card stat"><span class="k">${I(ic, 'i', 'width:15px;height:15px')} ${l}</span><span class="v num">${v}</span></div>`;
function overview() {
  const u = D.users, now = Date.now(), act = (d) => u.filter((x) => x.lastSeen && now - x.lastSeen < d * 864e5).length;
  const st = D.status || {};
  return `<div class="grid g4">${k(u.length, tt('المستخدمين', 'Users'), 'i-users')}${k(act(1), tt('نشط اليوم', 'Active today'), 'i-fire')}${k(act(7), tt('نشط بالأسبوع', 'Active 7d'), 'i-chart')}${k(D.leagues.length, tt('دوريات خاصة', 'Private leagues'), 'i-trophy')}</div>
   <div class="grid g4" style="margin-top:8px">${k(u.filter((x) => x.banned).length, tt('محظورين', 'Banned'), 'i-x')}${k(D.logs.length, tt('أخطاء مسجلة', 'Logged errors'), 'i-alert')}${k(st.cache?.size ?? '—', tt('عناصر الكاش', 'Cache entries'), 'i-db')}${k(st.cache ? Math.round(st.cache.hits / Math.max(1, st.cache.hits + st.cache.misses) * 100) + '%' : '—', tt('نسبة الكاش', 'Cache hit rate'), 'i-bolt')}</div>
   <div class="card" style="margin-top:10px"><div class="set-row"><span>${tt('الجولة الحالية / القادمة', 'Current / next GW')}</span><b>${ST.G.cur} / ${ST.G.next}</b></div><div class="set-row"><span>${tt('عدد اللاعبين بالفانتازي', 'FPL managers')}</span><b>${fmt(ST.G.totalPlayers)}</b></div><div class="set-row"><span>${tt('مدة تشغيل السيرفر', 'Server uptime')}</span><b>${st.uptime != null ? Math.round(st.uptime / 60) + ' min' : '—'}</b></div><div class="set-row"><span>${tt('بيانات تجريبية بالسيرفر', 'Server mock data')}</span><b>${st.mock ? tt('نعم', 'Yes') : tt('لا', 'No')}</b></div><div class="set-row"><span>${tt('المدرب الذكي (مفتاح API)', 'AI coach key')}</span><b>${st.aiCoach ? tt('مفعّل', 'On') : tt('غير مفعّل', 'Off')}</b></div></div>
   <p class="mut" style="font-size:11.5px">${tt('إحصاءات الاستخدام محسوبة من آخر ظهور لكل مستخدم (lastSeen).', 'Usage based on each user\'s lastSeen.')}</p>`;
}
function users() {
  const list = D.users.filter((u) => !q || JSON.stringify(u).toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  return `<div class="searchbox" style="margin-bottom:10px">${I('i-search', 'sicon')}<input id="adq" value="${esc(q)}" placeholder="${tt('بحث بالاسم أو الفريق', 'Search')}" oninput="adSearch(this.value)"></div>
   <div class="card scroll-x"><table class="tbl"><thead><tr><th>${tt('المستخدم', 'User')}</th><th>Team ID</th><th>${tt('آخر ظهور', 'Last seen')}</th><th></th></tr></thead><tbody>${list.map((u) => `<tr><td><b>${esc(u.name || u.uid.slice(0, 8))}</b><br><small class="mut">${esc(u.teamName || '')}</small></td><td class="num">${u.teamId || '—'}</td><td>${u.lastSeen ? timeAgo(u.lastSeen) : '—'}</td><td>${u.uid === ST.user.uid ? `<span class="tag">${tt('أنت', 'You')}</span>` : `<button class="btn btn-sm ${u.banned ? 'btn-g' : 'btn-r'}" onclick="adBan('${u.uid}',${!u.banned})">${u.banned ? tt('رفع الحظر', 'Unban') : tt('حظر', 'Ban')}</button>`}</td></tr>`).join('') || `<tr><td colspan="4" class="mut">${t('noData')}</td></tr>`}</tbody></table></div>`;
}
function leagues() {
  return D.leagues.length ? `<div class="card scroll-x"><table class="tbl"><thead><tr><th>${tt('الدوري', 'League')}</th><th>${tt('الرمز', 'Code')}</th><th>${tt('الأعضاء', 'Members')}</th><th></th></tr></thead><tbody>${D.leagues.map((l) => `<tr><td><b>${esc(l.name)}</b><br><small class="mut">${esc(l.ownerName || '')}</small></td><td class="num">${esc(l.code)}</td><td>${Object.keys(l.members || {}).length}</td><td><button class="btn btn-r btn-sm" onclick="adDelL('${esc(l.code)}')">${I('i-trash')}</button></td></tr>`).join('')}</tbody></table></div>` : `<div class="card mut">${tt('ما في دوريات خاصة بعد', 'No private leagues yet')}</div>`;
}
function data() {
  const st = D.status || {};
  return `<div class="card"><div class="set-row"><span>${tt('آخر جلب لبيانات اللعبة', 'Last bootstrap fetch')}</span><b class="num" style="font-size:12px">${fmtTime(new Date(ST.G.fetchedAt).toISOString())}</b></div>
    ${(st.cache?.entries || []).slice(0, 12).map((c) => `<div class="set-row"><span style="font-size:12px;direction:ltr">${esc(c.path)}</span><span class="mut" style="font-size:12px">${c.age}s</span></div>`).join('')}
    <button class="btn btn-p btn-b" style="margin-top:10px" onclick="adRefresh()">${I('i-refresh')}${tt('تحديث كل البيانات من المصدر', 'Force refresh from source')}</button>
    <p class="mut" style="font-size:11.5px;margin:8px 0 0">${tt('السيرفر يسمح بتحديث قسري كل 30 ثانية كحد أقصى حتى ما ينحظر من المصدر.', 'Server throttles forced refresh to once per 30s.')}</p></div>
   <div class="sec"><h2>${I('i-alert')}${tt('أخطاء المصدر بالسيرفر', 'Upstream errors')}</h2></div>
   <div class="card">${(st.errors || []).length ? st.errors.map((e) => `<div class="set-row"><span style="font-size:12px">${esc(e.path)}: ${esc(e.msg)}</span><span class="mut" style="font-size:11px">${timeAgo(e.t)}</span></div>`).join('') : `<span class="mut">${tt('ما في أخطاء', 'No errors')}</span>`}</div>`;
}
function season() {
  const S = D.season, ev = ST.G.events;
  return `<div class="card"><div class="set-row"><span>${tt('اسم الموسم', 'Season name')}</span><input id="sName" class="sel" value="${esc(S.name || '2026/27')}" style="max-width:150px"></div>
    <div class="set-row"><span>${tt('إيقاف المزامنة مؤقتاً (صيانة)', 'Maintenance mode')}</span><button class="switch ${S.maintenance ? 'on' : ''}" onclick="adMaint()"><i></i></button></div>
    <button class="btn btn-p btn-b" style="margin-top:10px" onclick="adSaveSeason()">${tt('حفظ', 'Save')}</button></div>
   <div class="sec"><h2>${I('i-cal')}${tt('الجولات (من المصدر الرسمي)', 'Gameweeks (official)')}</h2></div>
   <div class="card scroll-x"><table class="tbl"><thead><tr><th>${t('gw')}</th><th>${tt('الإغلاق', 'Deadline')}</th><th>${t('avg')}</th><th>${t('highest')}</th><th>${tt('الحالة', 'Status')}</th></tr></thead><tbody>${ev.map((e) => `<tr><td>${e.id}</td><td style="font-size:12px">${fmtTime(e.deadline)}</td><td>${e.avg ?? '—'}</td><td>${e.top ?? '—'}</td><td>${e.finished ? `<span class="tag">${tt('منتهية', 'Done')}</span>` : e.id === ST.G.cur ? `<span class="tag lime">${tt('حالية', 'Current')}</span>` : e.id === ST.G.next ? `<span class="tag cyan">${tt('القادمة', 'Next')}</span>` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
}
const SC_DEF = [['goalGK', tt('هدف حارس', 'GK goal'), 10], ['goalDEF', tt('هدف مدافع', 'DEF goal'), 6], ['goalMID', tt('هدف وسط', 'MID goal'), 5], ['goalFWD', tt('هدف مهاجم', 'FWD goal'), 4], ['assist', tt('صناعة', 'Assist'), 3], ['csGKDEF', tt('شباك نظيفة حارس/مدافع', 'CS GK/DEF'), 4], ['csMID', tt('شباك نظيفة وسط', 'CS MID'), 1], ['yc', tt('بطاقة صفراء', 'Yellow'), -1], ['rc', tt('بطاقة حمراء', 'Red'), -3], ['pensv', tt('صد ركلة جزاء', 'Pen save'), 5], ['penms', tt('إضاعة جزاء', 'Pen miss'), -2], ['og', tt('هدف عكسي', 'Own goal'), -2]];
function scoring() {
  const S = ST.scoring || {};
  return `<div class="note">${tt('هذي القيم تُستخدم لشرح تفاصيل نقاط اللاعب بالتطبيق. النقاط الرسمية نفسها تجي من الفانتازي ولا تتغير.', 'Used to explain point breakdowns in-app. Official totals always come from FPL.')}</div>
   <div class="card" style="margin-top:10px">${SC_DEF.map(([key, l, d]) => `<div class="set-row"><span>${l}</span><input type="number" class="sel sc-in" data-k="${key}" value="${S[key] ?? d}" style="width:80px;text-align:center"></div>`).join('')}
    <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-p" style="flex:1" onclick="adSaveSc()">${tt('حفظ', 'Save')}</button><button class="btn btn-g" onclick="adResetSc()">${I('i-reset')}${tt('الافتراضي', 'Defaults')}</button></div></div>`;
}
function players() {
  const ov = ST.overrides || {}, ids = Object.keys(ov);
  const res = q.length > 1 ? ST.G.players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  return `<div class="note">${tt('ملاحظات الإدارة تظهر بصفحة اللاعب (مثلاً خبر إصابة مؤكد قبل ما يتحدث المصدر). ما تغيّر البيانات الرسمية.', 'Admin notes show on player pages; they never alter official data.')}</div>
   <div class="searchbox" style="margin:10px 0">${I('i-search', 'sicon')}<input id="adq" value="${esc(q)}" placeholder="${tt('ابحث عن لاعب', 'Find a player')}" oninput="adSearch(this.value)"></div>
   ${res.map((p) => `<div class="card row tap" onclick="adNote(${p.id})" style="margin-bottom:6px"><div class="info"><b>${esc(p.name)}</b><span>${p.pos} · £${p.price}</span></div>${I('i-note')}</div>`).join('')}
   <div class="sec"><h2>${I('i-note')}${tt('الملاحظات الحالية', 'Current notes')}</h2></div>
   <div class="card">${ids.length ? ids.map((id) => `<div class="set-row"><span><b>${esc(PM(id)?.name || id)}</b><br><small class="mut">${esc(ov[id].note)}</small></span><button class="btn btn-r btn-sm" onclick="adDelNote(${id})">${I('i-trash')}</button></div>`).join('') : `<span class="mut">${t('noData')}</span>`}</div>`;
}
function notify() {
  const b = ST.broadcast || {};
  return `<div class="card"><label class="mut" style="font-size:12px">${tt('رسالة لكل المستخدمين (تظهر بمركز الإشعارات)', 'Message to all users')}</label><textarea id="bcText" rows="4" style="width:100%;margin-top:6px">${esc(b.text || '')}</textarea>
   <div class="set-row"><span>${tt('مدة الظهور (ساعات، 0 = دائم)', 'Duration in hours (0 = forever)')}</span><input id="bcH" type="number" class="sel" value="24" style="width:80px;text-align:center"></div>
   <div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-p" style="flex:1" onclick="adBroadcast()">${I('i-msg')}${tt('إرسال', 'Send')}</button><button class="btn btn-g" onclick="adBroadcast(true)">${tt('إلغاء الرسالة', 'Clear')}</button></div>
   ${b.text ? `<p class="mut" style="font-size:12px;margin:10px 0 0">${tt('الرسالة الحالية أُرسلت', 'Current message sent')} ${timeAgo(b.updatedAt)}</p>` : ''}</div>`;
}
function logs() {
  return `<div style="display:flex;gap:8px;margin-bottom:10px"><button class="btn btn-g btn-sm" onclick="adReload()">${I('i-refresh')}${tt('تحديث', 'Reload')}</button></div>
   <div class="card">${D.logs.length ? D.logs.slice(0, 60).map((l) => `<div class="set-row" style="align-items:flex-start"><span style="font-size:12px;direction:ltr;text-align:left"><b>${esc(l.where || '')}</b> ${esc(l.msg)}</span><span class="mut" style="font-size:11px;white-space:nowrap">${timeAgo(l.t)}</span></div>`).join('') : `<span class="mut">${tt('ما في أخطاء مسجلة', 'No errors logged')}</span>`}</div>`;
}
Object.assign(window, {
  adTab: (k2) => { tab = k2; q = ''; window.render(); },
  adSearch: (v) => { q = v; window.render(); const el = document.getElementById('adq'); if (el) { el.focus(); el.setSelectionRange(v.length, v.length); } },
  adReload: () => { D = null; window.render(); },
  adBan: (uid, ban) => askConfirm(ban ? tt('حظر هذا المستخدم؟', 'Ban this user?') : tt('رفع الحظر؟', 'Unban?'), async () => { try { await AU.adminSetUser(uid, { banned: ban }); D.users.find((u) => u.uid === uid).banned = ban; toast(tt('تم', 'Done')); window.render(); } catch (e) { toast(e.message); } }, ban),
  adDelL: (code) => askConfirm(tt('حذف الدوري نهائياً؟', 'Delete league?'), async () => { try { await AU.deleteLeague(code); D.leagues = D.leagues.filter((l) => l.code !== code); toast(tt('تم الحذف', 'Deleted')); window.render(); } catch (e) { toast(e.message); } }),
  adRefresh: async () => { D = null; await window.loadAll(true); },
  adMaint: () => { D.season.maintenance = !D.season.maintenance; window.render(); },
  adSaveSeason: async () => { D.season.name = document.getElementById('sName').value.trim(); try { await AU.setConfig('season', D.season); ST.season = D.season; toast(tt('تم الحفظ', 'Saved')); } catch (e) { toast(e.message); } },
  adSaveSc: async () => { const o = {}; document.querySelectorAll('.sc-in').forEach((i) => (o[i.dataset.k] = +i.value)); try { await AU.setConfig('scoring', o); ST.scoring = o; toast(tt('تم الحفظ', 'Saved')); } catch (e) { toast(e.message); } },
  adResetSc: async () => { try { await AU.setConfig('scoring', {}); ST.scoring = {}; window.render(); toast(tt('رجعت القيم الافتراضية', 'Defaults restored')); } catch (e) { toast(e.message); } },
  adNote: (id) => { const p = PM(id), cur = ST.overrides?.[id]?.note || ''; openSheet(`${sheetHead(I('i-note'), esc(p.name), tt('ملاحظة إدارية', 'Admin note'))}<textarea id="ovN" rows="4" style="width:100%">${esc(cur)}</textarea><button class="btn btn-p btn-b" style="margin-top:10px" onclick="adSaveNote(${id})">${tt('حفظ', 'Save')}</button>`); },
  adSaveNote: async (id) => { const n = document.getElementById('ovN').value.trim(); const ov = { ...(ST.overrides || {}) }; if (n) ov[id] = { note: n, t: Date.now() }; else delete ov[id]; try { await AU.setConfig('overrides', ov); ST.overrides = ov; closeSheet(); toast(tt('تم الحفظ', 'Saved')); window.render(); } catch (e) { toast(e.message); } },
  adDelNote: async (id) => { const ov = { ...(ST.overrides || {}) }; delete ov[id]; try { await AU.setConfig('overrides', ov); ST.overrides = ov; window.render(); } catch (e) { toast(e.message); } },
  adBroadcast: async (clear) => { const text = clear ? '' : document.getElementById('bcText').value.trim(); const h = +document.getElementById('bcH').value || 0; const b = { text, updatedAt: Date.now(), until: h ? Date.now() + h * 36e5 : 0 }; try { await AU.setConfig('broadcast', b); ST.broadcast = b; toast(clear ? tt('أُلغيت', 'Cleared') : tt('أُرسلت لكل المستخدمين', 'Sent to all users')); window.render(); } catch (e) { toast(e.message); } },
});
