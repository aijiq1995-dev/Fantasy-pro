/* =========================================================
   فانتازي برو v2 — نقطة البداية: الدخول، ربط الفريق، التنقل
========================================================= */
import { CONFIG } from './config.js';
import * as AU from './auth.js';
import * as FPL from './fpl.js';
import { setGame } from './engine.js';
import { SPRITE } from './sprite.js';
import { t, tt, setLang, applyDir, lang } from './i18n.js';
import { $, $$, esc, I, toast, openSheet, closeSheet, LS, fmt } from './ui.js';
import { countAll } from './motion.js';
import { ST, loadLocal, planKey } from './store.js';
import { scanStatic, unreadCount } from './notify.js';
import { VIEWS, AFTER, startLivePolling } from './views/index.js';

document.body.insertAdjacentHTML('afterbegin', SPRITE);
applyDir();

/* ---------- الشاشات ---------- */
const show = (id) => ['#splash', '#auth', '#link', '#app'].forEach((s) => $(s).classList.toggle('hidden', s !== id));
function splash(msg) { $('#splashMsg').innerHTML = msg || t('loading'); show('#splash'); }

const GOOGLE = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const PROV = { apple: ['Apple', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-4.1zM14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z"/></svg>'], facebook: ['Facebook', '<svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/></svg>'], x: ['X', '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.8 2.3h7l4.8 6.4 5.6-6.4zm-1.2 17.9h1.9L7 4.2H5l12 16z"/></svg>'] };

let authMode = 'login';
function renderAuth(err = '') {
  const provs = Object.keys(PROV).filter((k) => CONFIG.providers[k]);
  $('#auth').innerHTML = `<div class="auth-box"><div style="display:flex;justify-content:center"><div class="logo-ic">F</div></div><h1>${tt('فانتازي', 'Fantasy')} <span class="gt">${tt('برو', 'Pro')}</span></h1>
   <p class="auth-sub">${tt('منصتك الاحترافية للفانتازي ببيانات حقيقية', 'Your pro fantasy platform with real data')}</p>
   ${AU.firebaseOn || AU.srvEnabled() ? '' : `<div class="demo-bar">${tt('وضع التجربة: Firebase غير مربوط — الحسابات على هذا الجهاز فقط', 'Demo mode: Firebase not configured — local accounts only')}</div>`}
   ${CONFIG.providers.google ? `<button class="gbtn" data-prov="google">${GOOGLE}${tt('المتابعة باستخدام Google', 'Continue with Google')}</button>` : ''}
   ${provs.length ? `<div class="prov">${provs.map((p) => `<button data-prov="${p}">${PROV[p][1]}${PROV[p][0]}</button>`).join('')}</div>` : ''}
   <div class="or">${tt('أو بالحساب', 'or with account')}</div>
   <div class="tabs2"><button class="${authMode === 'login' ? 'on' : ''}" data-at="login">${tt('تسجيل الدخول', 'Log in')}</button><button class="${authMode === 'signup' ? 'on' : ''}" data-at="signup">${tt('حساب جديد', 'Sign up')}</button></div>
   <form id="authForm" novalidate>${authMode === 'signup' ? `<div class="field"><label>${tt('اسمك', 'Your name')}</label><input id="aName" maxlength="30"></div>` : ''}
    <div class="field"><label>${tt('اسم المستخدم أو الإيميل', 'Username or email')}</label><input id="aUser" dir="ltr" autocomplete="username"></div>
    <div class="field"><label>${tt('كلمة المرور', 'Password')}</label><input id="aPass" type="password" dir="ltr" autocomplete="${authMode === 'signup' ? 'new-password' : 'current-password'}"></div>
    ${authMode === 'signup' ? `<div class="field"><label>${tt('تأكيد كلمة المرور', 'Confirm password')}</label><input id="aPass2" type="password" dir="ltr"></div>` : `<div style="text-align:end;margin-bottom:6px"><button type="button" class="more" id="forgot" style="display:inline">${tt('نسيت كلمة المرور؟', 'Forgot password?')}</button></div>`}
    <div class="err" id="aErr">${esc(err)}</div><button class="btn btn-p btn-b" id="aSubmit">${authMode === 'signup' ? tt('إنشاء الحساب', 'Create account') : tt('دخول', 'Log in')}</button></form>
   <div style="display:flex;justify-content:center;margin-top:14px"><button class="chips2" onclick="toggleLang()" style="display:flex"><span class="tag">${I('i-globe', 'i', 'width:14px;height:14px')} ${lang() === 'ar' ? 'English' : 'العربية'}</span></button></div></div>`;
  $$('[data-at]').forEach((b) => (b.onclick = () => { authMode = b.dataset.at; renderAuth(); }));
  $$('[data-prov]').forEach((b) => (b.onclick = async () => {
    if (!AU.firebaseOn) return toast(tt('يشتغل بعد ربط Firebase (شوف README)', 'Requires Firebase setup (see README)'));
    b.disabled = true; try { await AU.socialSignIn(b.dataset.prov); } catch (e) { $('#aErr').textContent = AU.authError(e); } b.disabled = false;
  }));
  $('#forgot') && ($('#forgot').onclick = () => openSheet(`<h3 style="font-size:18px;margin-bottom:8px">${tt('استعادة كلمة المرور', 'Reset password')}</h3><div class="field"><input id="fpE" dir="ltr" placeholder="email@example.com"></div><button class="btn btn-p btn-b" id="fpGo">${tt('إرسال الرابط', 'Send link')}</button>`, () => {
    $('#fpGo').onclick = async () => { if (!AU.firebaseOn) return toast(tt('يشتغل بعد ربط Firebase', 'Requires Firebase')); try { await AU.resetPassword($('#fpE').value); closeSheet(); toast(tt('تم إرسال الرابط ✓', 'Link sent ✓')); } catch (e) { toast(AU.authError(e)); } };
  }));
  $('#authForm').onsubmit = submitAuth;
  show('#auth');
}
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
async function submitAuth(e) {
  e.preventDefault(); const err = $('#aErr'); err.textContent = '';
  const id = $('#aUser').value.trim(), pw = $('#aPass').value, isEmail = id.includes('@');
  if (!isEmail && !/^[a-zA-Z0-9_.]{3,20}$/.test(id)) return (err.textContent = tt('اسم المستخدم: 3–20 حرف إنجليزي أو أرقام', 'Username: 3–20 letters/digits'));
  if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) return (err.textContent = tt('الإيميل غير صالح', 'Invalid email'));
  if (pw.length < 6) return (err.textContent = tt('كلمة المرور 6 أحرف على الأقل', 'Password must be 6+ characters'));
  if (authMode === 'signup' && pw !== $('#aPass2').value) return (err.textContent = tt('كلمتا المرور غير متطابقتين', 'Passwords do not match'));
  const b = $('#aSubmit'); b.disabled = true;
  try {
    if (AU.firebaseOn) { authMode === 'signup' ? await AU.signUp({ id, password: pw, name: ($('#aName')?.value || '').trim() }) : await AU.signIn(id, pw); }
    else if (await AU.serverAccounts()) {
      const u = await AU.srvAuth(authMode, { id, password: pw, name: ($('#aName')?.value || '').trim() });
      onSignedIn(u);
    }
    else {
      const acc = LS.get('fp_local_accounts', {}), key = id.toLowerCase();
      // وضع محلي: إذا الحساب مو موجود على هذا الجهاز (مثلاً أيقونة الشاشة الرئيسية تخزينها منفصل عن سفاري) ننشئه تلقائياً
      if (authMode === 'login' && !acc[key]) authMode = 'signup';
      if (authMode === 'signup') { if (acc[key]) throw { local: tt('الحساب موجود', 'Account exists') }; const salt = Math.random().toString(36).slice(2); acc[key] = { salt, hash: await sha(salt + pw), name: ($('#aName')?.value || '').trim() || key.split('@')[0] }; LS.set('fp_local_accounts', acc); }
      else { if (!acc[key]) throw { local: tt('الحساب غير موجود', 'No such account') }; if ((await sha(acc[key].salt + pw)) !== acc[key].hash) throw { local: tt('كلمة المرور غير صحيحة', 'Wrong password') }; }
      const u = { uid: 'local_' + key.replace(/[^a-z0-9]/g, '_'), name: acc[key].name, email: isEmail ? key : '', provider: 'password', username: isEmail ? '' : key };
      LS.set('fp_local_session', u); authMode = 'login'; onSignedIn(u);
    }
  } catch (ex) { err.textContent = ex.local || AU.authError(ex); b.disabled = false; }
}

/* ---------- ربط الفريق ---------- */
function renderLink(prefill = '') {
  $('#link').innerHTML = `<div class="auth-box"><div style="display:flex;justify-content:center"><div class="logo-ic">${I('i-users', 'i', 'width:30px;height:30px')}</div></div><h1>${tt('ربط فريقك', 'Link your team')}</h1>
   <p class="auth-sub">${tt(`أهلاً ${esc(ST.user.name.split(' ')[0])}! اربط فريقك برقم الفريق مرة وحدة`, `Hi ${esc(ST.user.name.split(' ')[0])}! Link your team once by Team ID`)}</p>
   <div class="card" style="margin-bottom:12px;font-size:13.5px;line-height:1.9">${tt('افتح <b>fantasy.premierleague.com</b> ← صفحة <b>Points</b> ← الرابط يكون <code dir="ltr">/entry/<b style="color:#34D399">1234567</b>/event/10</code> ← الرقم بعد entry هو رقم فريقك.', 'Open <b>fantasy.premierleague.com</b> → <b>Points</b> → URL looks like <code>/entry/<b style="color:#34D399">1234567</b>/event/10</code> → that number is your Team ID.')}</div>
   <form id="linkForm"><div class="field"><label>${tt('رقم الفريق', 'Team ID')}</label><input id="tid" inputmode="numeric" dir="ltr" value="${esc(prefill)}" placeholder="1234567"></div><div class="err" id="lErr"></div><button class="btn btn-p btn-b" id="lBtn">${tt('تحقّق', 'Verify')}</button></form><div id="lPrev"></div>
   <div style="display:flex;justify-content:space-between;margin-top:14px">${ST.profile?.teamId ? `<button class="more" onclick="cancelLink()">${t('back')}</button>` : '<span></span>'}<button class="more" style="color:var(--mut)" onclick="doLogout()">${t('logout')}</button></div></div>`;
  $('#linkForm').onsubmit = async (e) => {
    e.preventDefault(); const id = $('#tid').value.replace(/\D/g, ''); $('#lErr').textContent = ''; $('#lPrev').innerHTML = '';
    if (!id || id.length > 10) return ($('#lErr').textContent = tt('اكتب رقم صحيح', 'Enter a valid ID'));
    try {
      const en = await FPL.fetchEntry(id);
      $('#lPrev').innerHTML = `<div class="row" style="margin-top:12px;border-color:rgba(52,211,153,.45)"><div class="mini" style="display:grid;place-items:center;font-weight:700;font-size:20px;border-radius:14px;background:var(--g2)">${esc((en.name || '?')[0])}</div><div class="info"><b>${esc(en.name)}</b><span>${esc(en.player_first_name)} ${esc(en.player_last_name)} · ${fmt(en.summary_overall_points)} ${t('points')} · ${t('rank')} ${fmt(en.summary_overall_rank)}</span></div></div><button class="btn btn-p btn-b" id="lOk">${tt('نعم، هذا فريقي ✓', 'Yes, this is my team ✓')}</button>`;
      $('#lOk').onclick = async () => { await AU.saveProfile(ST.user.uid, { teamId: +id, teamName: en.name, displayName: ST.user.name, linkedAt: Date.now() }); ST.profile = { ...(ST.profile || {}), teamId: +id, teamName: en.name }; loadAll(); };
    } catch (ex) { $('#lErr').textContent = ex.status === 404 ? tt('ما لگيت فريق بهذا الرقم', 'Team not found') : ex.message; }
  };
  show('#link');
}

/* ---------- تحميل البيانات ---------- */
async function onSignedIn(u) {
  ST.user = u; splash(tt('جارِ تحميل حسابك…', 'Loading your account…'));
  try { ST.profile = await AU.loadProfile(u.uid); } catch { ST.profile = null; }
  if (ST.profile?.banned) { splash(tt('تم إيقاف هذا الحساب من الإدارة.', 'This account was suspended by admin.') + `<br><button class="btn btn-g btn-sm" style="margin-top:12px" onclick="doLogout()">${t('logout')}</button>`); return; }
  if (ST.profile?.lang && ST.profile.lang !== lang()) setLang(ST.profile.lang);
  ST.admin = await AU.isAdmin(u);
  if (!ST.profile?.teamId) return renderLink();
  loadAll();
}
export async function loadAll(fresh = false) {
  const silent = !!ST.G; if (silent) { toast(tt('جارِ التحديث…', 'Refreshing…')); document.body.classList.add('busy'); } else splash(tt('جارِ جلب بيانات فريقك من الفانتازي…', 'Fetching your FPL data…'));
  try {
    const [G, E] = await Promise.all([FPL.loadGame(fresh), FPL.loadEntry(ST.profile.teamId, fresh)]);
    if (!G.next) G.next = G.cur || 1;
    ST.G = G; ST.E = E; setGame(G);
    ST.plan = loadPlan();
    loadLocal();
    const [bc, ov, sc] = await Promise.all([AU.getConfig('broadcast'), AU.getConfig('overrides', {}), AU.getConfig('scoring')]);
    ST.broadcast = bc; ST.overrides = ov || {}; ST.scoring = sc;
    AU.touchProfile(ST.user.uid, { teamName: E.entry.name });
    scanStatic();
    buildNav(); show('#app'); document.body.classList.remove('busy'); if (silent) { render(); toast(tt('تم التحديث', 'Updated')); } else go(location.hash.slice(1) || 'home'); startLivePolling();
  } catch (ex) {
    document.body.classList.remove('busy');
    if (silent) { toast(ex.message); return; }
    AU.logError(ST.user?.uid, ex.message, 'loadAll');
    splash(`${esc(ex.message)}<br><button class="btn btn-p btn-sm" style="margin-top:12px" onclick="loadAll(true)">${tt('إعادة المحاولة', 'Retry')}</button> <button class="btn btn-g btn-sm" style="margin-top:12px" onclick="changeTeam()">${tt('تغيير رقم الفريق', 'Change Team ID')}</button>`);
  }
}
export function basePlan() {
  const { E, G } = ST; const src = E.basePicks || E.picks; if (!src) return null;
  const ps = [...src.picks].sort((a, b) => a.position - b.position).map((p) => ({ ...p }));
  let bank = (src.entry_history?.bank ?? 0) / 10;
  (E.pending || []).forEach((t) => { const slot = ps.find((p) => p.element === t.element_out); if (!slot) return; slot.element = t.element_in; bank += ((t.element_out_cost || 0) - (t.element_in_cost || 0)) / 10; });
  const okP = ps.filter((p) => G.PM[p.element]); if (okP.length < 15) return null;
  const ft = Math.max(0, (window.__EMBED?.ft ?? FPL.estimateFT(E.hist)) - (E.pending || []).length);
  return { squad: okP.map((p) => p.element), xi: okP.filter((p) => p.position <= 11).map((p) => p.element), bench: okP.filter((p) => p.position > 11).map((p) => p.element),
    cap: (okP.find((p) => p.is_captain) || okP[0]).element, vc: (okP.find((p) => p.is_vice_captain) || okP[1]).element,
    bank: Math.round(bank * 10) / 10, ft, transfers: [], chip: '' };
}
function loadPlan() { const s = LS.get(planKey()); return s && s.squad?.length === 15 && s.squad.every((id) => ST.G.PM[id]) ? s : basePlan(); }

/* ---------- التنقل ---------- */
const NAV = [
  ['g_main', [['home', 'i-home'], ['team', 'i-pitch'], ['season', 'i-season'], ['live', 'i-live'], ['search', 'i-sparkle']]],
  ['g_players', [['players', 'i-users'], ['market', 'i-swap'], ['prices', 'i-coin'], ['lab', 'i-lab'], ['compare', 'i-compare']]],
  ['g_comp', [['leagues', 'i-trophy'], ['captains', 'i-crown'], ['chips', 'i-bolt'], ['stats', 'i-history'], ['achievements', 'i-medal']]],
  ['g_more', [['notifs', 'i-bell'], ['settings', 'i-settings']]],
];
const BNAV = [['home', 'i-home'], ['team', 'i-pitch'], ['season', 'i-season'], ['players', 'i-users'], ['more', 'i-grid']];
export function buildNav() {
  const nav = NAV.map(([g, items]) => [g, g === 'g_more' && ST.admin ? [...items, ['admin', 'i-admin']] : items]);
  $('#side').innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin:4px 8px 14px"><div class="logo-ic" style="width:34px;height:34px;font-size:16px;border-radius:10px">F</div><b style="font-size:16px">${tt('فانتازي', 'Fantasy')} <span class="gt">${tt('برو', 'Pro')}</span></b></div>${nav.map(([g, items]) => `<div class="grp">${t(g)}</div>${items.map((n) => `<button class="nb" data-v="${n[0]}" onclick="go('${n[0]}')">${I(n[1])}<span style="flex:1">${t(n[0])}</span>${n[0] === 'notifs' ? '<span class="tag lime" id="sideBadge"></span>' : ''}</button>`).join('')}`).join('')}`;
  $('#bnav').innerHTML = BNAV.map((n) => `<button data-v="${n[0]}" onclick="go('${n[0]}')" aria-label="${t(n[0])}">${I(n[1])}${t(n[0])}</button>`).join('');
  $('#tbTitle').textContent = ST.E.entry.name; $('#tbAv').textContent = (ST.E.entry.name || ST.user.name || '?').trim()[0].toUpperCase();
  const ph = document.querySelector('.sbar [data-ph]'); if (ph) ph.textContent = tt('ابحث أو اسأل أي شي…', 'Search or ask anything…');
  updateBadge();
}
window.addEventListener('keydown', (e) => { if (e.key === '/' && ST.G && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) { e.preventDefault(); go('search'); } });
export function updateBadge() { const n = unreadCount(); $('#bellDot').classList.toggle('hidden', !n); const sb = $('#sideBadge'); if (sb) sb.textContent = n || ''; }
window.addEventListener('fp-notif', updateBadge);
/* تنقّل بسجل حقيقي: زر رجوع بكل صفحة + سحب الرجوع بالآيفون وزر الرجوع بالأندرويد */
const NAV_STACK = [];
export function go(v, opts = {}) {
  if (v === 'coach') v = 'search';
  if (!VIEWS[v]) v = 'home';
  if (v === 'admin' && !ST.admin) v = 'home';
  const prev = ST.view;
  if (!opts.back && prev && prev !== v) { NAV_STACK.push({ v: prev, y: window.scrollY }); if (NAV_STACK.length > 30) NAV_STACK.shift(); try { history.pushState({ v }, '', '#' + v); } catch {} }
  else if (!prev) { try { history.replaceState({ v }, '', '#' + v); } catch {} }
  ST.view = v;
  $('#tbSubT').textContent = t(v === 'more' ? 'more' : v) + (ST.G ? ` · ${t('gw')} ${ST.G.next}` : '');
  updateBack();
  render(); window.scrollTo({ top: opts.y || 0 });
}
function updateBack() { const b = $('#tbBack'); if (b) b.classList.toggle('hidden', !NAV_STACK.length && ST.view === 'home'); }
export function goBack() {
  if (document.querySelector('.ov')) return window.closeSheet();
  if (window.__backHook && window.__backHook()) return;
  if (NAV_STACK.length) return history.back();
  if (ST.view !== 'home') go('home', { back: true });
}
window.addEventListener('popstate', () => {
  if (!ST.G) return;
  if (document.querySelector('.ov')) { window.closeSheet(); try { history.pushState({ v: ST.view }, '', '#' + ST.view); } catch {} return; }
  if (window.__backHook && window.__backHook()) { try { history.pushState({ v: ST.view }, '', '#' + ST.view); } catch {} return; }
  const e = NAV_STACK.pop(); const v = e?.v || location.hash.slice(1) || 'home';
  go(v, { back: true, y: e?.y || 0 });
});
window.goBack = goBack;
let lastCount = '';
function countUp() { const first = lastCount !== ST.view || window.__recount; window.__recount = false; lastCount = ST.view; countAll(document.getElementById('view'), first); }
window.__canPull = () => ['home', 'team', 'live', 'season', 'leagues', 'prices'].includes(ST.view);
export function render() {
  if (!ST.G) return;
  $$('.nb').forEach((b) => b.classList.toggle('on', b.dataset.v === ST.view));
  const inMore = !['home', 'team', 'players', 'season'].includes(ST.view);
  $$('#bnav button').forEach((b) => b.classList.toggle('on', b.dataset.v === ST.view || (b.dataset.v === 'more' && inMore)));
  try { $('#view').innerHTML = (window.__EMBED && ST.view === 'home' ? window.__EMBED.note : '') + VIEWS[ST.view](); AFTER[ST.view] && AFTER[ST.view](); countUp(); }
  catch (e) { console.error(e); AU.logError(ST.user?.uid, e.message, 'render:' + ST.view); $('#view').innerHTML = `<div class="empty">${I('i-alert', 'i', 'width:40px;height:40px')}<b>${tt('صار خطأ بهذا القسم', 'Something went wrong')}</b><p class="mut">${esc(e.message)}</p></div>`; }
}
window.addEventListener('error', (e) => AU.logError(ST.user?.uid, e.message, e.filename + ':' + e.lineno));

/* ---------- أفعال عامة ---------- */
async function doLogout() { closeSheet(); LS.del('fp_local_session'); AU.srvLogout(); await AU.signOutUser(); Object.assign(ST, { user: null, profile: null, G: null, E: null, plan: null, admin: false }); try { history.replaceState(null, '', ' '); } catch {} renderAuth(); }
function toggleLang() { setLang(lang() === 'ar' ? 'en' : 'ar'); if (ST.user) AU.saveProfile(ST.user.uid, { lang: lang() }).catch(() => {}); if (ST.G) { buildNav(); go(ST.view); } else renderAuth(); }
Object.assign(window, { go, render, closeSheet, doLogout, toggleLang, loadAll, changeTeam: () => renderLink(String(ST.profile?.teamId || '')), cancelLink: () => (ST.G ? show('#app') : loadAll()) });

/* ---------- الإقلاع ---------- */
(async function boot() {
  splash();
  if (AU.firebaseOn) {
    try { let first = true; await AU.watchAuth((u, err) => { if (err) return renderAuth(AU.authError(err)); if (u) { if (!ST.user || ST.user.uid !== u.uid) onSignedIn(u); } else if (first || ST.user) { ST.user = null; renderAuth(); } first = false; }); }
    catch { splash(tt('تعذّر تحميل Firebase — تأكد من الإنترنت وإعدادات js/config.js', 'Could not load Firebase')); }
  } else {
    try { navigator.storage?.persist?.(); } catch {}
    await AU.serverAccounts();
    const su = await AU.srvResume();
    if (su) return onSignedIn(su);
    const s = LS.get('fp_local_session'); s ? onSignedIn(s) : renderAuth();
  }
})();
