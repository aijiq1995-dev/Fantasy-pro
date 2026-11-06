/* إشعارات الجوال (Web Push): تسجيل الـ Service Worker والاشتراك ومزامنة التفضيلات */
import { ST } from './store.js';
import { srvToken } from './auth.js';
import { lang } from './i18n.js';

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let regP = null;
export function registerSW() {
  if (!('serviceWorker' in navigator)) return null;
  if (!regP) regP = navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => null);
  navigator.serviceWorker.addEventListener?.('message', (e) => { if (e.data?.type === 'push') window.dispatchEvent(new CustomEvent('fp-push', { detail: e.data.d })); });
  return regP;
}
const b64ToU8 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
async function api(action, body = {}) {
  const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token: srvToken(), ...body }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'خطأ ' + r.status);
  return d;
}
const ctx = () => ({ teamId: ST.profile?.teamId, prefs: ST.prefs, lang: lang(), watch: [...(ST.watch || [])] });

/** حالة الإشعارات: unsupported | need-install | need-account | denied | off | on */
export async function pushState() {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'need-install' : 'unsupported';
  if (isIOS() && !isStandalone()) return 'need-install';
  if (!srvToken()) return 'need-account';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registerSW(); if (!reg) return 'unsupported';
  const sub = await reg.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}
export async function enablePush() {
  const cfg = await (await fetch('/api/push')).json();
  if (!cfg.enabled) throw new Error('السيرفر غير مهيأ للإشعارات');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('ما انعطى إذن الإشعارات');
  const reg = await registerSW(); await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(cfg.key) });
  return api('subscribe', { sub: sub.toJSON(), ...ctx() });
}
export async function disablePush() {
  const reg = await registerSW(); const sub = await reg?.pushManager.getSubscription();
  if (sub) { await api('unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); }
}
export const testPush = () => api('test');
let syncT = 0;
/** يرسل التفضيلات وقائمة المراقبة للسيرفر (مؤخَّر حتى ما يتكرر) */
export function syncPush() {
  if (!srvToken() || !pushSupported() || Notification.permission !== 'granted') return;
  clearTimeout(syncT); syncT = setTimeout(() => api('prefs', ctx()).catch(() => {}), 800);
}
