/* =========================================================
   /api/coach — المدرب الذكي (Claude)
   متغيرات البيئة بـ Vercel:
     ANTHROPIC_API_KEY   (Claude — مدفوع حسب الاستخدام)
     GEMINI_API_KEY      (بديل مجاني: Google AI Studio — حدود يومية)
     GEMINI_MODEL        (اختياري، الافتراضي gemini-flash-latest)
     FIREBASE_API_KEY    (اختياري لكن منصوح: يتأكد إن الطلب من مستخدم مسجّل)
     CLAUDE_MODEL        (اختياري، الافتراضي claude-sonnet-5-5)
========================================================= */
export const config = { maxDuration: 60 };
const SYSTEM = `أنت مدرب فانتازي الدوري الإنجليزي خبير داخل تطبيق "فانتازي برو".
- أجب بالعربية، وتكدر تستخدم لهجة عراقية خفيفة.
- كن مختصراً وعملياً: نقاط واضحة، أرقام من البيانات، وتوصية نهائية.
- اعتمد على بيانات فريق المستخدم المرفقة فقط، ولا تخترع إصابات أو أخبار غير موجودة.
- إذا السؤال مو عن الفانتازي، رجّع الحديث للفانتازي بلطف.

بيانات فريق المستخدم الحالية:
`;
const hits = new Map(); // حد بسيط للطلبات لكل مستخدم

function send(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  if (req.body) return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY, gkey = process.env.GEMINI_API_KEY;
  if (!key && !gkey) return send(res, 503, { error: 'no_key', env: process.env.VERCEL_ENV || 'local', commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) });
  // يقبل الطلبات من نفس موقع التطبيق فقط (حتى ما يستخدم أحد مفتاحك من برا)
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = req.headers.origin || req.headers.referer || '';
  if (origin && host && !origin.includes(host)) return send(res, 403, { error: 'forbidden' });

  // التحقق من مستخدم Firebase
  let uid = 'anon:' + (req.headers['x-forwarded-for'] || '').split(',')[0];
  if (process.env.FIREBASE_API_KEY) {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return send(res, 401, { error: 'unauthorized' });
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
    });
    const vd = await v.json().catch(() => ({}));
    if (!v.ok || !vd.users?.length) return send(res, 401, { error: 'unauthorized' });
    uid = vd.users[0].localId;
  }
  const now = Date.now(), list = (hits.get(uid) || []).filter((t) => now - t < 3600e3);
  if (list.length >= 40) return send(res, 429, { error: 'وصلت الحد (40 سؤال بالساعة) — جرّب بعد شوية' });
  list.push(now); hits.set(uid, list);

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'bad json' }); }
  const question = String(body.question || '').slice(0, 800);
  const context = String(body.context || '').slice(0, 30000);
  if (!question) return send(res, 400, { error: 'empty' });
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (history.length && history[0].role !== 'user') history.shift();

  if (!key) {
    // Gemini (مجاني ضمن حدود Google AI Studio) — إذا موديل مضغوط ينتقل للي بعده تلقائياً
    const models = [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'].filter(Boolean))];
    const payload = JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM + context }] }, contents: [...history, { role: 'user', content: question }].map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), generationConfig: { maxOutputTokens: 1500, temperature: 0.5 } });
    let last = 'AI error', limited = false; const t0 = Date.now();
    for (const model of models) {
      if (Date.now() - t0 > 40000) break;
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 25000);
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': gkey, 'content-type': 'application/json' }, body: payload, signal: ctl.signal });
        clearTimeout(to);
        const d = await r.json().catch(() => ({}));
        if (r.ok) { const text = (d.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('').trim(); if (text) return send(res, 200, { text, provider: 'gemini', model }); last = 'empty answer'; continue; }
        last = d?.error?.message || `HTTP ${r.status}`;
        if (r.status === 429) limited = true;
        // 503/500/429/404 → جرّب الموديل اللي بعده
        if (![429, 500, 503, 404, 400].includes(r.status)) break;
      } catch (e) { last = e.name === 'AbortError' ? 'timeout' : 'network'; }
    }
    if (limited) return send(res, 429, { error: 'وصلت حد Gemini المجاني لهالفترة — جرّب بعد شوية' });
    return send(res, 502, { error: last });
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5', max_tokens: 1500, system: SYSTEM + context, messages: [...history, { role: 'user', content: question }] }),
    });
    const d = await r.json();
    if (!r.ok) return send(res, 502, { error: d?.error?.message || 'AI error' });
    return send(res, 200, { text: (d.content || []).map((c) => c.text || '').join('').trim() });
  } catch {
    return send(res, 502, { error: 'تعذّر الاتصال بالذكاء الاصطناعي' });
  }
}
