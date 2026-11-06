/* =========================================================
   Web Push بدون مكتبات: VAPID (ES256) + تشفير aes128gcm (RFC 8291)
   مفاتيح VAPID تتولد مرة وحدة وتنحفظ بقاعدة البيانات
========================================================= */
import crypto from 'node:crypto';
import { kv, getJ } from './_kv.js';

const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s).replace(/=+$/, ''), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

let VAPID = null;
export async function getVapid() {
  if (VAPID) return VAPID;
  let v = await getJ('vapid');
  if (!v) {
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = privateKey.export({ format: 'jwk' });
    const cand = { jwk, pub: b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)])) };
    await kv('SET', 'vapid', JSON.stringify(cand), 'NX');
    v = await getJ('vapid');
  }
  VAPID = { ...v, key: crypto.createPrivateKey({ key: v.jwk, format: 'jwk' }) };
  return VAPID;
}

function vapidJWT(aud, V) {
  const h = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const p = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://fantasy-pro-aijo0.vercel.app' }));
  const sig = crypto.sign('sha256', Buffer.from(`${h}.${p}`), { key: V.key, dsaEncoding: 'ieee-p1363' });
  return `${h}.${p}.${b64u(sig)}`;
}

export function encrypt(sub, payload) {
  const uaPub = fromB64u(sub.keys.p256dh), auth = fromB64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPub);
  const prkKey = hmac(auth, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const salt = crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = asPub.length;
  return Buffer.concat([head, asPub, body]);
}

/** يرسل إشعار. يرجّع {ok, gone} — gone=true يعني الاشتراك انتهى وينحذف */
export async function sendPush(sub, data, { ttl = 3600, urgency = 'normal' } = {}) {
  const V = await getVapid();
  const aud = new URL(sub.endpoint).origin;
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: urgency, Authorization: `vapid t=${vapidJWT(aud, V)}, k=${V.pub}` },
    body: encrypt(sub, JSON.stringify(data)),
  });
  return { ok: r.ok, status: r.status, gone: r.status === 404 || r.status === 410 };
}
