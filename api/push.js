/* =========================================================
   /api/push — اشتراك إشعارات الآيفون/المتصفح
   GET            → { enabled, key }  (مفتاح VAPID العام)
   POST subscribe → يحفظ الاشتراك ويا رقم الفريق والتفضيلات
   POST prefs     → يحدّث التفضيلات
   POST unsubscribe / test
========================================================= */
import { kv, getJ, setJ, kvEnabled, send, readBody } from './_kv.js';
import { getVapid, sendPush } from './_webpush.js';
import { verify } from './account.js';

export default async function handler(req, res) {
  if (!kvEnabled) return send(res, 200, { enabled: false });
  if (req.method === 'GET') { const V = await getVapid(); return send(res, 200, { enabled: true, key: V.pub }); }
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && host && !origin.includes(host)) return send(res, 403, { error: 'forbidden' });
  let b; try { b = await readBody(req); } catch { return send(res, 400, { error: 'bad json' }); }
  const uid = verify(b.token);
  if (!uid) return send(res, 401, { error: 'سجّل دخول بحساب أولاً' });
  const key = 'push:' + uid;
  const cur = (await getJ(key)) || { subs: [], prefs: {} };
  try {
    if (b.action === 'subscribe') {
      const s = b.sub;
      if (!s?.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys?.p256dh || !s.keys?.auth) return send(res, 400, { error: 'اشتراك غير صالح' });
      cur.subs = [{ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, at: Date.now() }, ...cur.subs.filter((x) => x.endpoint !== s.endpoint)].slice(0, 5);
      if (b.teamId) cur.teamId = +b.teamId;
      if (b.prefs) cur.prefs = b.prefs;
      if (b.lang) cur.lang = b.lang;
      if (Array.isArray(b.watch)) cur.watch = b.watch.slice(0, 60).map(Number);
      await setJ(key, cur); await kv('SADD', 'push:users', uid);
      return send(res, 200, { ok: true, devices: cur.subs.length });
    }
    if (b.action === 'prefs') {
      if (b.prefs) cur.prefs = b.prefs;
      if (b.teamId) cur.teamId = +b.teamId;
      if (b.lang) cur.lang = b.lang;
      if (Array.isArray(b.watch)) cur.watch = b.watch.slice(0, 60).map(Number);
      if (cur.subs.length) await setJ(key, cur);
      return send(res, 200, { ok: true });
    }
    if (b.action === 'unsubscribe') {
      cur.subs = cur.subs.filter((x) => x.endpoint !== b.endpoint);
      await setJ(key, cur);
      if (!cur.subs.length) await kv('SREM', 'push:users', uid);
      return send(res, 200, { ok: true });
    }
    if (b.action === 'test') {
      const out = await Promise.all(cur.subs.map((s) => sendPush(s, { title: 'فانتازي برو ✓', body: 'الإشعارات شغالة! راح توصلك تنبيهات فريقك هنا.', url: '/#notifs', tag: 'test' }, { urgency: 'high' })));
      const gone = new Set(cur.subs.filter((_, i) => out[i].gone).map((s) => s.endpoint));
      if (gone.size) { cur.subs = cur.subs.filter((s) => !gone.has(s.endpoint)); await setJ(key, cur); }
      return send(res, 200, { ok: out.some((o) => o.ok), sent: out.filter((o) => o.ok).length, statuses: out.map((o) => o.status) });
    }
    if (b.action === 'status') return send(res, 200, { devices: cur.subs.length, endpoints: cur.subs.map((s) => s.endpoint.slice(-12)) });
    return send(res, 400, { error: 'unknown action' });
  } catch (e) { return send(res, 502, { error: e.message }); }
}
