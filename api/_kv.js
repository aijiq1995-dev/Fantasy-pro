/* مساعد Upstash/Vercel KV عبر REST — مشترك بين الدوال */
function findEnv() {
  const E = process.env;
  if (E.KV_REST_API_URL && E.KV_REST_API_TOKEN) return [E.KV_REST_API_URL, E.KV_REST_API_TOKEN];
  if (E.UPSTASH_REDIS_REST_URL && E.UPSTASH_REDIS_REST_TOKEN) return [E.UPSTASH_REDIS_REST_URL, E.UPSTASH_REDIS_REST_TOKEN];
  for (const k of Object.keys(E)) {
    const m = k.match(/^(.*)_REST_API_URL$/) || k.match(/^(.*)_REDIS_REST_URL$/);
    if (!m) continue;
    const t = E[m[1] + '_REST_API_TOKEN'] || E[m[1] + '_REDIS_REST_TOKEN'];
    if (t && /^https?:/.test(E[k])) return [E[k], t];
  }
  return ['', ''];
}
export const [KV_URL, KV_TOKEN] = findEnv();
export const kvEnabled = !!(KV_URL && KV_TOKEN);
export async function kv(...cmd) {
  const r = await fetch(KV_URL, { method: 'POST', headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('kv: ' + (d.error || r.status));
  return d.result;
}
export const getJ = async (k) => { const v = await kv('GET', k); return v ? JSON.parse(v) : null; };
export const setJ = (k, v, ex) => (ex ? kv('SET', k, JSON.stringify(v), 'EX', ex) : kv('SET', k, JSON.stringify(v)));
export function send(res, code, obj) { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
  const chunks = []; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
