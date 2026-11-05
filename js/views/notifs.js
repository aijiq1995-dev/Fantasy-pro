/* مركز الإشعارات + الإعدادات + شاشة "المزيد" */
import { ST, saveNotifs } from '../store.js';
import { t, tt, lang } from '../i18n.js';
import { esc, I, toast, timeAgo, fmtTime, LS, CLUB_AR, crest } from '../ui.js';
import * as AU from '../auth.js';
import * as FPL from '../fpl.js';
import { updateBadge, loadAll } from '../app.js';

let filter = 'all';
const TYPES = [['all', tt('الكل', 'All')], ['deadline', tt('الإغلاق', 'Deadline')], ['injury', tt('الإصابات', 'Injuries')], ['price', tt('الأسعار', 'Prices')], ['goals', tt('الأهداف', 'Goals')], ['league', tt('الدوريات', 'Leagues')]];
const GROUP = { deadline: 'deadline', injury: 'injury', absent: 'injury', price: 'price', transfer: 'price', goal: 'goals', assist: 'goals', red: 'goals', start: 'goals', league: 'league', admin: 'all' };
const COL = { deadline: '#34D399', injury: '#F59E0B', absent: '#EF4444', price: '#60A5FA', transfer: '#60A5FA', goal: '#10B981', assist: '#10B981', red: '#EF4444', start: '#A78BFA', league: '#34D399', admin: '#A78BFA' };

export function vNotifs() {
  const list = ST.notifs.filter((n) => filter === 'all' || GROUP[n.type] === filter);
  return `<div class="seg" style="overflow-x:auto">${TYPES.map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" onclick="nFilter('${k}')">${l}</button>`).join('')}</div>
   <div style="display:flex;gap:8px;margin:12px 0"><button class="btn btn-g btn-sm" onclick="nReadAll()">${I('i-check')}${tt('تعليم الكل كمقروء', 'Mark all read')}</button><button class="btn btn-g btn-sm" onclick="nClear()">${I('i-trash')}${tt('مسح', 'Clear')}</button><button class="btn btn-g btn-sm" onclick="go('settings')" style="margin-inline-start:auto">${I('i-settings')}</button></div>
   ${list.length ? `<div class="card" style="padding:4px 0">${list.map((n, i) => `<div class="ntf row tap ${n.read ? '' : 'unread'}" onclick="nOpen(${ST.notifs.indexOf(n)})" style="padding:12px 14px;${i ? 'border-top:1px solid var(--line)' : ''}">
      <div class="ai" style="background:${COL[n.type] || '#60A5FA'}22;color:${COL[n.type] || '#60A5FA'}">${I(n.icon || 'i-bell')}</div>
      <div class="info"><b style="font-size:13.5px">${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<span style="font-size:11px">${timeAgo(n.t)}</span></div>${n.read ? '' : '<i style="width:8px;height:8px;border-radius:50%;background:#34D399;flex:none"></i>'}</div>`).join('')}</div>`
    : `<div class="empty">${I('i-bell', 'i', 'width:42px;height:42px')}<b>${tt('ما في إشعارات', 'No notifications')}</b><p class="mut">${tt('الإشعارات تتولد من بيانات حقيقية: قرب الإغلاق، إصابات لاعبينك، تغير الأسعار، أهداف لاعبينك أثناء المباريات، وتغير ترتيبك.', 'Generated from real data: deadlines, injuries, price changes, live goals and rank changes.')}</p></div>`}`;
}
Object.assign(window, {
  nFilter: (k) => { filter = k; window.render(); },
  nReadAll: () => { ST.notifs.forEach((n) => (n.read = true)); saveNotifs(); updateBadge(); window.render(); },
  nClear: () => { ST.notifs = []; saveNotifs(); updateBadge(); window.render(); },
  nOpen: (i) => { const n = ST.notifs[i]; if (!n) return; n.read = true; saveNotifs(); updateBadge(); if (n.act) { try { new Function(n.act)(); } catch {} } else window.render(); },
});

/* ---------- الإعدادات ---------- */
const PREFS = [['deadline', tt('قرب إغلاق الجولة', 'Deadline reminders')], ['injury', tt('إصابات وغيابات لاعبيني', 'Injuries & absences')], ['price', tt('تغير الأسعار (فريقي وقائمة المراقبة)', 'Price changes')], ['goals', tt('أهداف وصناعات وطرد لاعبيني (مباشر)', 'Live goals/assists/reds')], ['start', tt('بداية المباريات', 'Kick-offs')], ['league', tt('تغير ترتيبي بالدوريات', 'League rank changes')]];
export function vSettings() {
  const U = ST.user, P = ST.profile, prov = AU.linkedProviders();
  const sw = (on, fn) => `<button class="switch ${on ? 'on' : ''}" onclick="${fn}" aria-pressed="${on}"><i></i></button>`;
  const lu = ST.G.fetchedAt || Date.now();
  return `<div class="card row"><div class="tm" style="width:52px;height:52px;border-radius:16px;background:var(--g1);color:#052E1F;display:grid;place-items:center;font-weight:700;font-size:22px">${esc((U.name || '?').trim()[0])}</div><div class="info"><b>${esc(U.name || '')}</b><span>${esc(U.email || U.username || '')} · ${AU.firebaseOn ? tt('حساب سحابي', 'Cloud account') : tt('وضع تجريبي محلي (بدون Firebase)', 'Local demo mode (no Firebase)')}</span></div>${ST.admin ? '<span class="tag violet">Admin</span>' : ''}</div>
   <div class="sec"><h2>${I('i-pitch')}${tt('فريق الفانتازي', 'FPL team')}</h2></div>
   <div class="card"><div class="set-row"><span>${tt('اسم الفريق', 'Team')}</span><b>${esc(ST.E.entry.name)}</b></div><div class="set-row"><span>Team ID</span><b class="num">${P.teamId}</b></div><div class="set-row"><span>${tt('النادي المفضل', 'Favourite club')}</span><select class="sel" onchange="setFav(this.value)"><option value="">—</option>${Object.values(ST.G.teams).map((tm) => `<option value="${tm.id}" ${String(P.fav) === String(tm.id) ? 'selected' : ''}>${lang() === 'en' ? tm.name : CLUB_AR[tm.short] || tm.name}</option>`).join('')}</select></div>
    <button class="btn btn-g btn-b" style="margin-top:10px" onclick="changeTeam()">${I('i-swap')}${tt('تغيير رقم الفريق', 'Change Team ID')}</button></div>
   <div class="sec"><h2>${I('i-shield')}${tt('طرق الدخول المرتبطة', 'Linked sign-in methods')}</h2></div>
   <div class="card">${AU.firebaseOn ? [['google', 'google.com', 'Google'], ['apple', 'apple.com', 'Apple'], ['facebook', 'facebook.com', 'Facebook'], ['twitter', 'twitter.com', 'X']].map(([k, id, n]) => `<div class="set-row"><span>${n}</span>${prov.includes(id) ? `<span class="tag lime">${I('i-check')}${tt('مرتبط', 'Linked')}</span>` : `<button class="btn btn-g btn-sm" onclick="linkP('${k}')">${tt('ربط', 'Link')}</button>`}</div>`).join('') : `<p class="mut" style="font-size:13px;margin:0">${tt('ربط Google/Apple/Facebook يحتاج إعداد Firebase (شوف README).', 'Linking providers requires Firebase setup (see README).')}</p>`}</div>
   <div class="sec"><h2>${I('i-bell')}${tt('الإشعارات', 'Notifications')}</h2></div>
   <div class="card">${PREFS.map(([k, l]) => `<div class="set-row"><span>${l}</span>${sw(ST.prefs[k] !== false, `setPref('${k}')`)}</div>`).join('')}
    <div class="set-row"><span>${tt('إشعارات المتصفح', 'Browser notifications')}<br><small class="mut">${'Notification' in window ? tt('تشتغل والتطبيق مفتوح بالخلفية', 'Works while the app is open in background') : tt('المتصفح لا يدعمها', 'Not supported')}</small></span>${sw(ST.prefs.browser && 'Notification' in window && Notification.permission === 'granted', 'setBrowserN()')}</div></div>
   <div class="sec"><h2>${I('i-globe')}${tt('عام', 'General')}</h2></div>
   <div class="card"><div class="set-row"><span>${tt('اللغة', 'Language')}</span><button class="btn btn-g btn-sm" onclick="toggleLang()">${lang() === 'ar' ? 'English' : 'العربية'}</button></div>
    <div class="set-row"><span>${tt('آخر تحديث للبيانات', 'Last data update')}</span><b class="num" style="font-size:12px">${fmtTime(new Date(lu).toISOString())}</b></div>
    <div class="set-row"><span>${tt('مصدر البيانات', 'Data source')}</span><span class="mut" style="font-size:12px">fantasy.premierleague.com (API)</span></div>
    <button class="btn btn-g btn-b" style="margin-top:10px" onclick="loadAll(true)">${I('i-refresh')}${tt('تحديث البيانات الآن', 'Refresh data now')}</button>
    <button class="btn btn-g btn-b" style="margin-top:8px" onclick="clearCache()">${I('i-trash')}${tt('مسح الكاش المحلي', 'Clear local cache')}</button></div>
   <button class="btn btn-r btn-b" style="margin-top:14px" onclick="doLogout()">${I('i-logout')}${tt('تسجيل الخروج', 'Sign out')}</button>
   <p class="mut" style="text-align:center;font-size:11px;margin-top:12px">${tt('تطبيق مستقل غير تابع للدوري الإنجليزي. البيانات من واجهة الفانتازي العامة.', 'Independent app, not affiliated with the Premier League.')}</p>`;
}
const persistPrefs = () => { LS.set('fp_prefs', ST.prefs); ST.profile.notif = ST.prefs; AU.saveProfile(ST.user.uid, { notif: ST.prefs }).catch(() => {}); };
Object.assign(window, {
  setPref: (k) => { ST.prefs[k] = ST.prefs[k] === false; persistPrefs(); window.render(); },
  setBrowserN: async () => {
    if (!('Notification' in window)) return toast(tt('المتصفح لا يدعم الإشعارات', 'Not supported'));
    if (ST.prefs.browser && Notification.permission === 'granted') { ST.prefs.browser = false; persistPrefs(); return window.render(); }
    const r = await Notification.requestPermission(); ST.prefs.browser = r === 'granted'; persistPrefs();
    toast(r === 'granted' ? tt('تم التفعيل', 'Enabled') : tt('رفض المتصفح الإذن', 'Permission denied')); window.render();
  },
  setFav: (v) => { ST.profile.fav = v ? +v : null; AU.saveProfile(ST.user.uid, { fav: ST.profile.fav }).catch(() => {}); toast(tt('تم الحفظ', 'Saved')); },
  linkP: async (k) => { try { await AU.linkProvider(k); toast(tt('تم الربط', 'Linked')); window.render(); } catch (e) { toast(AU.authError(e)); } },
  clearCache: () => { Object.keys(localStorage).filter((k) => k.startsWith('fpc_')).forEach((k) => localStorage.removeItem(k)); toast(tt('تم مسح الكاش', 'Cache cleared')); },
});

/* ---------- المزيد (موبايل) ---------- */
export function vMore() {
  const G = [[t('g_main'), [['search', 'i-sparkle', tt('اسأل عن أي شي بالفانتازي', 'Ask anything')], ['live', 'i-live', tt('النتائج والنقاط لحظة بلحظة', 'Live scores & points')]]],
    [t('g_players'), [['market', 'i-swap', tt('بدلاء ضمن ميزانيتك', 'Replacements in budget')], ['lab', 'i-lab', tt('هل الانتقال يستاهل؟', 'Is the move worth it?')], ['compare', 'i-compare', tt('لحد 3 لاعبين', 'Up to 3 players')]]],
    [t('g_comp'), [['leagues', 'i-trophy', tt('الترتيب والمنافسين', 'Standings & rivals')], ['chips', 'i-bolt', tt('أفضل توقيت للأوراق', 'Best chip timing')], ['stats', 'i-history', tt('قراراتك ونتائجها', 'Your decisions')], ['achievements', 'i-medal', tt('شاراتك', 'Badges')]]],
    [t('g_more'), [['notifs', 'i-bell', tt('التنبيهات', 'Alerts')], ['settings', 'i-settings', tt('الحساب والتفضيلات', 'Account')], ...(ST.admin ? [['admin', 'i-admin', tt('إدارة التطبيق', 'Admin')]] : [])]]];
  return G.map(([g, items]) => `<div class="sec" style="margin-top:14px"><h2 style="font-size:13px;color:var(--mut);font-weight:600">${g}</h2></div><div class="list">${items.map(([v, ic, d]) => `<button class="row tap" style="width:100%;text-align:start" onclick="go('${v}')"><div class="pbig" style="background:var(--s3);color:var(--acc)">${I(ic, 'i', 'width:19px;height:19px')}</div><div class="info"><b>${t(v)}</b><span>${d}</span></div>${I('i-chev', 'chev')}</button>`).join('')}</div>`).join('');
}
export { loadAll };
