/* =========================================================
   تسجيل الدخول والحسابات (Firebase Auth + Firestore)
   يتحمّل Firebase مباشرة من سيرفرات Google — بدون npm
========================================================= */
import { CONFIG } from './config.js';

const FB_VER = '11.0.2';
const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
const USER_DOMAIN = 'users.fantasypro.app'; // حسابات اسم المستخدم تتحول لإيميل داخلي

export const firebaseOn = !!(CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
let fb = null;

export async function initFirebase() {
  if (!firebaseOn) return null;
  if (fb) return fb;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB_BASE + 'firebase-app.js'),
    import(FB_BASE + 'firebase-auth.js'),
    import(FB_BASE + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(CONFIG.firebase);
  const auth = A.getAuth(app);
  auth.languageCode = 'ar';
  await A.setPersistence(auth, A.browserLocalPersistence);
  fb = { A, F, auth, db: F.getFirestore(app) };
  return fb;
}

export const toEmail = (id) => (id.includes('@') ? id.trim().toLowerCase() : `${id.trim().toLowerCase()}@${USER_DOMAIN}`);
export const isUsernameAccount = (email) => !!email && email.endsWith('@' + USER_DOMAIN);
export const usernameOf = (email) => (isUsernameAccount(email) ? email.split('@')[0] : '');

function provider(name) {
  const { A } = fb;
  switch (name) {
    case 'google': { const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return p; }
    case 'apple': { const p = new A.OAuthProvider('apple.com'); p.addScope('email'); p.addScope('name'); p.setCustomParameters({ locale: 'ar' }); return p; }
    case 'facebook': { const p = new A.FacebookAuthProvider(); p.addScope('email'); return p; }
    case 'x': return new A.TwitterAuthProvider();
  }
  throw new Error('unknown provider');
}

/** دخول بحساب خارجي — Google يعرض نافذة اختيار الحساب دائماً */
export async function socialSignIn(name) {
  await initFirebase();
  const p = provider(name);
  try {
    return await fb.A.signInWithPopup(fb.auth, p);
  } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) {
      return fb.A.signInWithRedirect(fb.auth, p); // للمتصفحات اللي تمنع النوافذ المنبثقة
    }
    throw e;
  }
}

export async function signUp({ id, password, name }) {
  await initFirebase();
  const cred = await fb.A.createUserWithEmailAndPassword(fb.auth, toEmail(id), password);
  await fb.A.updateProfile(cred.user, { displayName: name || id.split('@')[0] });
  return cred;
}
export async function signIn(id, password) { await initFirebase(); return fb.A.signInWithEmailAndPassword(fb.auth, toEmail(id), password); }
export async function resetPassword(email) { await initFirebase(); return fb.A.sendPasswordResetEmail(fb.auth, email.trim()); }
export async function signOutUser() { if (fb) await fb.A.signOut(fb.auth); }
export async function linkProvider(name) { await initFirebase(); return fb.A.linkWithPopup(fb.auth.currentUser, provider(name)); }
export function linkedProviders() { return fb?.auth.currentUser ? fb.auth.currentUser.providerData.map((p) => p.providerId) : []; }
export async function getIdToken() { return fb?.auth.currentUser ? fb.auth.currentUser.getIdToken() : ''; }

/** يراقب حالة الدخول. cb(user|null, error?) */
export async function watchAuth(cb) {
  await initFirebase();
  fb.A.getRedirectResult(fb.auth).catch((e) => cb(null, e));
  return fb.A.onAuthStateChanged(fb.auth, (u) => cb(u ? normUser(u) : null));
}
function normUser(u) {
  const prov = (u.providerData[0] || {}).providerId || 'password';
  return { uid: u.uid, name: u.displayName || usernameOf(u.email) || (u.email || '').split('@')[0] || 'لاعب', email: isUsernameAccount(u.email) ? '' : (u.email || ''), photo: u.photoURL || '', provider: prov, username: usernameOf(u.email) };
}

/* ---------- الملف الشخصي (رقم الفريق والإعدادات) ---------- */
const localKey = (uid) => 'fp_profile_' + uid;
export async function loadProfile(uid) {
  if (!fb) { try { return JSON.parse(localStorage.getItem(localKey(uid)) || 'null'); } catch { return null; } }
  const snap = await fb.F.getDoc(fb.F.doc(fb.db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}
export async function saveProfile(uid, data) {
  if (!fb) {
    const cur = (await loadProfile(uid)) || {};
    try { localStorage.setItem(localKey(uid), JSON.stringify({ ...cur, ...data })); } catch {}
    return;
  }
  return fb.F.setDoc(fb.F.doc(fb.db, 'users', uid), { ...data, updatedAt: Date.now() }, { merge: true });
}

export function authError(e) {
  const m = {
    'auth/invalid-credential': 'اسم المستخدم أو كلمة المرور غير صحيحة',
    'auth/wrong-password': 'كلمة المرور غير صحيحة',
    'auth/user-not-found': 'الحساب غير موجود',
    'auth/email-already-in-use': 'اسم المستخدم أو الإيميل مستخدم مسبقاً',
    'auth/weak-password': 'كلمة المرور ضعيفة — 6 أحرف على الأقل',
    'auth/invalid-email': 'الإيميل غير صالح',
    'auth/missing-email': 'اكتب الإيميل',
    'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
    'auth/cancelled-popup-request': 'تم إلغاء العملية',
    'auth/operation-not-allowed': 'طريقة الدخول هذي مو مفعّلة بعد في Firebase (Authentication ← Sign-in method)',
    'auth/unauthorized-domain': 'نطاق الموقع غير مضاف في Firebase (Authentication ← Settings ← Authorized domains)',
    'auth/account-exists-with-different-credential': 'عندك حساب بنفس الإيميل بطريقة دخول ثانية — ادخل بيها أولاً ثم اربط هذي من الإعدادات',
    'auth/credential-already-in-use': 'هذا الحساب مربوط بمستخدم آخر',
    'auth/provider-already-linked': 'هذي الطريقة مربوطة مسبقاً',
    'auth/network-request-failed': 'مشكلة بالاتصال بالإنترنت',
    'auth/too-many-requests': 'محاولات كثيرة — انتظر شوية وحاول مرة ثانية',
  };
  return m[e?.code] || 'صار خطأ: ' + (e?.message || 'غير معروف');
}

/* =========================================================
   قاعدة البيانات (Firestore) — مع بديل محلي بوضع التجربة
   users/{uid} · leagues/{code} · admins/{uid} · config/{doc} · logs/{id}
========================================================= */
const local = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('fpdb_' + k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem('fpdb_' + k, JSON.stringify(v)); } catch {} } };
const F = () => fb.F;
const genCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

export async function touchProfile(uid, extra = {}) { try { await saveProfile(uid, { lastSeen: Date.now(), ...extra }); } catch {} }

/* ---------- دوريات التطبيق الخاصة ---------- */
export async function createLeague(user, profile, name) {
  const code = genCode();
  const data = { code, name: name.slice(0, 40), owner: user.uid, created: Date.now(), members: { [user.uid]: { teamId: profile.teamId, name: user.name, team: profile.teamName || '', joined: Date.now() } } };
  if (!fb) { const all = local.get('leagues', {}); all[code] = data; local.set('leagues', all); return data; }
  await F().setDoc(F().doc(fb.db, 'leagues', code), data);
  return data;
}
export async function joinLeague(user, profile, code) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error('رمز غير صالح');
  const me = { teamId: profile.teamId, name: user.name, team: profile.teamName || '', joined: Date.now() };
  if (!fb) { const all = local.get('leagues', {}); if (!all[code]) throw new Error('ما لگيت دوري بهذا الرمز'); all[code].members[user.uid] = me; local.set('leagues', all); return all[code]; }
  const ref = F().doc(fb.db, 'leagues', code); const s = await F().getDoc(ref);
  if (!s.exists()) throw new Error('ما لگيت دوري بهذا الرمز');
  await F().updateDoc(ref, { ['members.' + user.uid]: me });
  return { ...s.data(), members: { ...s.data().members, [user.uid]: me } };
}
export async function myLeagues(uid) {
  if (!fb) return Object.values(local.get('leagues', {})).filter((l) => l.members[uid]);
  const q = F().query(F().collection(fb.db, 'leagues'), F().where('members.' + uid + '.joined', '>', 0));
  const s = await F().getDocs(q); return s.docs.map((d) => d.data());
}
export async function leaveLeague(uid, code) {
  if (!fb) { const all = local.get('leagues', {}); if (all[code]) { delete all[code].members[uid]; local.set('leagues', all); } return; }
  await F().updateDoc(F().doc(fb.db, 'leagues', code), { ['members.' + uid]: F().deleteField() });
}
export async function deleteLeague(code) {
  if (!fb) { const all = local.get('leagues', {}); delete all[code]; local.set('leagues', all); return; }
  await F().deleteDoc(F().doc(fb.db, 'leagues', code));
}

/* ---------- الإدارة ---------- */
export async function isAdmin(user) {
  if (!user) return false;
  if (!fb) return local.get('admin', false) || user.username === 'admin';
  try { const s = await F().getDoc(F().doc(fb.db, 'admins', user.uid)); return s.exists(); } catch { return false; }
}
export async function adminUsers() {
  if (!fb) { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('fp_profile_')) out.push({ uid: k.slice(11), ...JSON.parse(localStorage.getItem(k)) }); } return out; }
  const s = await F().getDocs(F().query(F().collection(fb.db, 'users'), F().limit(500))); return s.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
export async function adminSetUser(uid, data) {
  if (!fb) { const k = 'fp_profile_' + uid; const cur = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...cur, ...data })); return; }
  await F().setDoc(F().doc(fb.db, 'users', uid), data, { merge: true });
}
export async function allLeagues() {
  if (!fb) return Object.values(local.get('leagues', {}));
  const s = await F().getDocs(F().query(F().collection(fb.db, 'leagues'), F().limit(500))); return s.docs.map((d) => d.data());
}
export async function getConfig(name, def = null) {
  if (!fb) return local.get('cfg_' + name, def);
  try { const s = await F().getDoc(F().doc(fb.db, 'config', name)); return s.exists() ? s.data() : def; } catch { return def; }
}
export async function setConfig(name, data) {
  if (!fb) return local.set('cfg_' + name, data);
  await F().setDoc(F().doc(fb.db, 'config', name), { ...data, updatedAt: Date.now() });
}
export async function logError(uid, msg, where = '') {
  const row = { uid: uid || null, msg: String(msg).slice(0, 500), where: String(where).slice(0, 200), t: Date.now(), ua: navigator.userAgent.slice(0, 120) };
  if (!fb) { const l = local.get('logs', []); l.unshift(row); local.set('logs', l.slice(0, 100)); return; }
  try { await F().addDoc(F().collection(fb.db, 'logs'), row); } catch {}
}
export async function readLogs() {
  if (!fb) return local.get('logs', []);
  const s = await F().getDocs(F().query(F().collection(fb.db, 'logs'), F().orderBy('t', 'desc'), F().limit(100))); return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
