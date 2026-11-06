/* =========================================================
   حسابات على السيرفر — حتى يشتغل الحساب من أي جهاز أو متصفح
   التخزين: Upstash Redis / Vercel KV عبر REST (بدون مكتبات)
   متغيرات البيئة: KV_REST_API_URL + KV_REST_API_TOKEN
   (أو UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
========================================================= */
import crypto from 'node:crypto';

// يقبل أي بادئة يختارها Vercel (KV_ / STORAGE_ / UPSTASH_REDIS_ ...)
function findEnv() {
  const E = process.env;
  if (E.KV_REST_API_URL && E.KV_REST_API_TOKEN) return [E.KV_REST_API_URL, E.KV_REST_API_TOKEN];
  if (E.UPSTASH_REDIS_REST_URL && E.UPSTASH_REDIS_REST_TOKEN) return [E.UPSTASH_REDIS_REST_URL, E.UPSTASH_REDIS_REST_TOKEN];
  for (const k of Object.keys(E)) {
    const m = k.match(/^(.*)_REST_API_URL$/) || k.match(/^(.*)_REDIS_REST_URL$/);
    if (!m) continue;
    const t = E[m[1] + '_REST_API_TOKEN'] || E[m[1] + '_REDIS_REST_TOKEN'];
    if (t && /^https:/.test(E[k])) return [E[k], t];
  }
  return ['', ''];
}
const [URL_, TOK] = findEnv();
const SECRET = process.env.ACCOUNT_SECRET || TOK;
const enabled = !!(URL_ && TOK);
const TOKEN_DAYS = 365;

function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
async function kv(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('kv: ' + (d.error || r.status));
  return d.result;
}
const getJ = async (k) => { const v = await kv('GET', k); return v ? JSON.parse(v) : null; };
const setJ = (k, v) => kv('SET', k, JSON.stringify(v));

const hashPw = (salt, pw) => new Promise((ok, no) => crypto.scrypt(pw, salt, 32, (e, k) => (e ? no(e) : ok(k.toString('hex')))));
const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(uid) {
  const p = b64(JSON.stringify({ uid, exp: Date.now() + TOKEN_DAYS * 864e5 }));
  return p + '.' + crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
}
function verify(tok) {
  const [p, s] = String(tok || '').split('.');
  if (!p || !s) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  if (s.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp))) return null;
  try { const d = JSON.parse(Buffer.from(p, 'base64url').toString()); return d.exp > Date.now() ? d.uid : null; } catch { return null; }
}
const userOut = (a) => ({ uid: a.uid, name: a.name, email: a.email || '', username: a.username || '', provider: 'password' });

// حد بسيط ضد التخمين
const tries = new Map();
function limited(ip) { const now = Date.now(), l = (tries.get(ip) || []).filter((t) => now - t < 600e3); l.push(now); tries.set(ip, l); return l.length > 30; }

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'GET' || u.searchParams.get('status')) return send(res, 200, { enabled });
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!enabled) return send(res, 503, { error: 'not_configured' });
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && host && !origin.includes(host)) return send(res, 403, { error: 'forbidden' });

  let b; try { b = await readBody(req); } catch { return send(res, 400, { error: 'bad json' }); }
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || 'ip';
  try {
    if (b.action === 'signup' || b.action === 'login') {
      if (limited(ip)) return send(res, 429, { error: 'محاولات كثيرة — انتظر شوية' });
      const id = String(b.id || '').trim().toLowerCase(), pw = String(b.pw || '');
      const isEmail = id.includes('@');
      if (!(isEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) : /^[a-z0-9_.]{3,20}$/.test(id))) return send(res, 400, { error: 'اسم المستخدم أو الإيميل غير صالح' });
      if (pw.length < 6 || pw.length > 200) return send(res, 400, { error: 'كلمة المرور 6 أحرف على الأقل' });
      const key = 'acc:' + id;
      if (b.action === 'signup') {
        const salt = crypto.randomBytes(16).toString('hex');
        const acc = { uid: 'u_' + crypto.randomBytes(9).toString('base64url'), salt, hash: await hashPw(salt, pw), name: String(b.name || '').trim().slice(0, 30) || id.split('@')[0], email: isEmail ? id : '', username: isEmail ? '' : id, created: Date.now() };
        const ok = await kv('SET', key, JSON.stringify(acc), 'NX');
        if (!ok) return send(res, 409, { error: 'اسم المستخدم مستخدم مسبقاً — اختار تسجيل الدخول' });
        await kv('SET', 'uid:' + acc.uid, key);
        if (b.profile && typeof b.profile === 'object') await setJ('prof:' + acc.uid, b.profile);
        return send(res, 200, { token: sign(acc.uid), user: userOut(acc), profile: b.profile || null });
      }
      const acc = await getJ(key);
      if (!acc) return send(res, 404, { error: 'الحساب غير موجود — سوّي حساب جديد أول مرة' });
      if ((await hashPw(acc.salt, pw)) !== acc.hash) return send(res, 401, { error: 'كلمة المرور غير صحيحة' });
      await kv('SET', 'uid:' + acc.uid, key);
      return send(res, 200, { token: sign(acc.uid), user: userOut(acc), profile: await getJ('prof:' + acc.uid) });
    }
    const uid = verify(b.token);
    if (!uid) return send(res, 401, { error: 'unauthorized' });
    if (b.action === 'me') {
      const key = await kv('GET', 'uid:' + uid); const acc = key ? await getJ(key) : null;
      return send(res, 200, { user: acc ? userOut(acc) : { uid, name: 'لاعب', provider: 'password' }, profile: await getJ('prof:' + uid) });
    }
    if (b.action === 'save') {
      const data = b.data && typeof b.data === 'object' ? b.data : {};
      if (JSON.stringify(data).length > 20000) return send(res, 413, { error: 'too big' });
      const cur = (await getJ('prof:' + uid)) || {};
      delete data.banned;
      const next = { ...cur, ...data, updatedAt: Date.now() };
      await setJ('prof:' + uid, next);
      return send(res, 200, { profile: next });
    }
    return send(res, 400, { error: 'unknown action' });
  } catch (e) {
    return send(res, 502, { error: 'خطأ بالسيرفر: ' + e.message });
  }
}
