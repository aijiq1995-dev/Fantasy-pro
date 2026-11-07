/* =========================================================
   /api/captains?gw=10&src=top|league&id=123&fin=1
   نسبة الكبتنة لكل لاعب بجولة معيّنة — محسوبة من عيّنة حقيقية:
   - top: أفضل 100 مدرب بالترتيب العام (الدوري العام 314)
   - league/h2h: كل فرق الدوري (لحد 200 فريق) + أسماء اللي اختاروا كل كابتن
   - أفضل 10,000 عالمياً تنحسب بـ GitHub Actions (scripts/captains10k.mjs) وتنحفظ بـ /data/captains/
   الفانتازي ما ينشر نسب الكبتنة الكاملة، فهذي عيّنة موضّحة الحجم.
========================================================= */
export const config = { maxDuration: 60 };
const BASE = 'https://fantasy.premierleague.com/api/';
const UA = 'Mozilla/5.0 (compatible; FantasyPro/2.0)';
const memo = new Map();

function send(res, code, data, ttl = 0) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl, 600)}` : 'no-store');
  res.end(JSON.stringify(data));
}
let SELF = '', blocked = 0;
/* الفانتازي أحياناً يرد 403 على هذي الدالة (حماية Cloudflare) — نعيد المحاولة عبر وسيطنا /api/fpl اللي يشتغل وعنده كاش */
async function viaProxy(path, params) {
  const q = new URLSearchParams({ path, ...(params.page_standings ? { page: params.page_standings } : {}) });
  const r = await fetch(`${SELF}/api/fpl?${q}`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function get(path, params = {}) {
  if (process.env.FPL_MOCK === '1') { const { mockFPL } = await import('./_mock.js'); const d = mockFPL(path, params); if (!d) throw new Error('not found'); return d; }
  if (SELF && Date.now() - blocked < 10 * 60e3) return viaProxy(path, params);
  const qs = new URLSearchParams(params).toString();
  let r;
  try { r = await fetch(BASE + path + (qs ? '?' + qs : ''), { headers: { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-GB,en;q=0.9' } }); } catch (e) { if (SELF) return viaProxy(path, params); throw e; }
  if ((r.status === 403 || r.status === 429) && SELF) { blocked = Date.now(); return viaProxy(path, params); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (host && !SELF) SELF = (/^(localhost|127\.)/.test(host) ? 'http://' : 'https://') + host;
  const gw = parseInt(u.searchParams.get('gw') || '0', 10), src = ['league', 'h2h'].includes(u.searchParams.get('src')) ? u.searchParams.get('src') : 'top';
  const id = parseInt(u.searchParams.get('id') || '0', 10), fin = u.searchParams.get('fin') === '1';
  if (!(gw >= 1 && gw <= 38)) return send(res, 400, { error: 'bad gw' });
  if (src !== 'top' && !(id > 0 && id < 1e10)) return send(res, 400, { error: 'bad league' });
  const key = `${src}:${id}:${gw}`, ttl = fin ? 86400 : 600;
  const hit = memo.get(key); if (hit && Date.now() - hit.t < ttl * 1000) return send(res, 200, hit.d, ttl);

  try {
    let entries = [], label = ''; const names = {};
    if (src === 'top') {
      for (const page of [1, 2]) { const d = await get('leagues-classic/314/standings/', page > 1 ? { page_standings: page } : {}); entries.push(...(d.standings?.results || []).map((r) => r.entry)); label = 'top100'; }
    } else {
      const path = `${src === 'h2h' ? 'leagues-h2h' : 'leagues-classic'}/${id}/standings/`;
      for (let page = 1; page <= 4; page++) {
        const d = await get(path, page > 1 ? { page_standings: page } : {}); label = d.league?.name || label;
        (d.standings?.results || []).forEach((r) => { entries.push(r.entry); names[r.entry] = [r.entry_name, r.player_name, r.rank]; });
        if (!d.standings?.has_next) break;
      }
    }
    entries = [...new Set(entries)].slice(0, src === 'top' ? 100 : 200);
    const cap = {}, vice = {}, tc = {}, who = {}; let n = 0, chips = {};
    for (let i = 0; i < entries.length; i += 8) {
      const part = await Promise.all(entries.slice(i, i + 8).map((e) => get(`entry/${e}/event/${gw}/picks/`).catch(() => null)));
      part.forEach((pk, j) => {
        if (!pk?.picks) return; n++;
        const e = entries[i + j], c = pk.picks.find((x) => x.is_captain), v = pk.picks.find((x) => x.is_vice_captain);
        if (c && src !== 'top' && names[e]) (who[c.element] = who[c.element] || []).push({ e, n: names[e][0], m: names[e][1], r: names[e][2], tc: pk.active_chip === '3xc' ? 1 : 0 });
        if (c) { cap[c.element] = (cap[c.element] || 0) + 1; if (pk.active_chip === '3xc') tc[c.element] = (tc[c.element] || 0) + 1; }
        if (v) vice[v.element] = (vice[v.element] || 0) + 1;
        if (pk.active_chip) chips[pk.active_chip] = (chips[pk.active_chip] || 0) + 1;
      });
    }
    if (!n) return send(res, 404, { error: 'تشكيلات هذي الجولة ما متاحة بعد (تنكشف بعد الإغلاق)' });
    const ids = [...new Set([...Object.keys(cap), ...Object.keys(vice)])].map(Number);
    const players = ids.map((pid) => ({ id: pid, c: cap[pid] || 0, pct: Math.round(((cap[pid] || 0) / n) * 1000) / 10, vc: Math.round(((vice[pid] || 0) / n) * 1000) / 10, tc: tc[pid] || 0, ...(who[pid] ? { who: who[pid].sort((a, b) => a.r - b.r) } : {}) }))
      .sort((a, b) => b.c - a.c || b.vc - a.vc);
    const d = { gw, src, label, sample: n, players, chips, computedAt: Date.now() };
    memo.set(key, { t: Date.now(), d });
    return send(res, 200, d, ttl);
  } catch (e) {
    return send(res, 502, { error: 'تعذّر جلب التشكيلات من الفانتازي: ' + e.message });
  }
}
