/* =========================================================
   /api/news — مركز الأخبار (أخبار حقيقية، مو تحليلات)
   1) أخبار الفانتازي الرسمية: إصابات، إيقافات، احتمال المشاركة (مع وقت الخبر)
   2) أخبار الدوري من مصادر موثوقة عبر RSS: BBC Sport · The Guardian · Sky Sports
      (عنوان + ملخص قصير + رابط للمصدر) — مصنّفة: إصابات / إيقافات / تصريحات / أخبار الفرق
   العناوين تتترجم للعربي (Gemini/Claude إذا متوفر) وتنحفظ بالكاش
========================================================= */
import crypto from 'node:crypto';
import { newsAr } from '../js/newsar.js';
import { kv, kvEnabled } from './_kv.js';

export const config = { maxDuration: 30 };
const UA = 'Mozilla/5.0 (compatible; FantasyPro/2.0)';
export const FEEDS = [
  { src: 'BBC Sport', url: 'https://feeds.bbci.co.uk/sport/football/premier-league/rss.xml' },
  { src: 'The Guardian', url: 'https://www.theguardian.com/football/premierleague/rss' },
  { src: 'Sky Sports', url: 'https://www.skysports.com/rss/12040' },
];
const CAT = [
  ['ban', /\b(suspen\w*|ban(?:ned)?|red card|sent off|appeal|disciplinary|charged)\b/i],
  ['injury', /\b(injur\w*|hamstring|knee|ankle|groin|calf|thigh|muscle|ruled out|sidelined|setback|surgery|scan|fitness|doubt\w*|knock|fracture|ligament|out for|blow|absence|miss(?:es|ing)? .{0,20}(game|match|clash|weeks|months))\b/i],
  ['press', /\b(press conference|says|said|insists|admits|reveals|claims|warns|explains|confirms|believes|told|boss|manager|head coach|interview)\b|['‘’"“”]/i],
  ['team', /\b(team news|line-?up|starting|available|return(?:s|ed)?|back in training|squad|fit again|boost|selection|predicted)\b/i],
];
const decode = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/\s+/g, ' ').trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i')); return m ? decode(m[1]) : ''; };

export function parseRSS(xml, src) {
  const out = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const it = m[0], title = tag(it, 'title'), link = tag(it, 'link') || (it.match(/<guid[^>]*>(https?:[^<]+)<\/guid>/i) || [])[1] || '';
    if (!title || !/^https:\/\//.test(link)) continue;
    let desc = tag(it, 'description'); if (desc.length > 240) desc = desc.slice(0, 237).replace(/\s+\S*$/, '') + '…';
    const at = Date.parse(tag(it, 'pubDate') || tag(it, 'dc:date')) || 0;
    out.push({ src, title, desc, link, at });
  }
  return out;
}
async function fetchText(url, ms = 6000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: ctl.signal }); if (!r.ok) throw new Error(r.status); return await r.text(); } finally { clearTimeout(to); }
}
export async function fetchFeeds() {
  const res = await Promise.allSettled(FEEDS.map(async (f) => parseRSS(await fetchText(f.url), f.src)));
  const seen = new Set(), items = [];
  res.forEach((r) => r.status === 'fulfilled' && r.value.forEach((x) => { const k = x.title.toLowerCase().replace(/\W+/g, ''); if (!seen.has(k)) { seen.add(k); items.push(x); } }));
  items.forEach((x) => { const txt = `${x.title} ${x.desc}`; x.cat = (CAT.find(([, re]) => re.test(txt)) || ['other'])[0]; });
  return { items: items.filter((x) => Date.now() - x.at < 5 * 864e5).sort((a, b) => b.at - a.at).slice(0, 70), ok: res.map((r, i) => [FEEDS[i].src, r.status === 'fulfilled']) };
}
/** يربط الخبر بلاعبين محددين (حتى تفلتر «فريقي») */
function mentions(items, elements) {
  const names = elements.filter((e) => (e.web_name || '').length >= 4).map((e) => [e.id, new RegExp(`\\b${e.web_name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')]);
  items.forEach((x) => { const txt = `${x.title} ${x.desc}`.normalize('NFD').replace(/[̀-ͯ]/g, ''); x.players = names.filter(([, re]) => re.test(txt)).map(([id]) => id).slice(0, 5); });
}

/* ---------- الترجمة (مع كاش) ---------- */
export const h = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
async function aiTranslate(list) {
  const prompt = `ترجم أخبار كرة القدم التالية للعربية الفصحى المبسّطة (أسلوب عناوين رياضية). خلّي أسماء اللاعبين والأندية مكتوبة بالعربي بالطريقة الشائعة. رجّع JSON فقط بنفس الترتيب: [{"t":"العنوان","d":"الملخص"}].\n${JSON.stringify(list.map((x) => ({ t: x.title, d: x.desc })))}`;
  const gkey = process.env.GEMINI_API_KEY, akey = process.env.ANTHROPIC_API_KEY;
  if (akey) {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': akey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
    if (r.ok) { const d = await r.json(); const txt = d.content?.map((c) => c.text || '').join('') || ''; const j = txt.match(/\[[\s\S]*\]/); if (j) return JSON.parse(j[0]); }
  }
  if (gkey) {
    for (const model of [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest'].filter(Boolean))]) {
      try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'x-goog-api-key': gkey, 'content-type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }) });
        if (!r.ok) continue;
        const d = await r.json(); const txt = d.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || ''; const j = txt.match(/\[[\s\S]*\]/); if (j) return JSON.parse(j[0]);
      } catch {}
    }
  }
  return null;
}
async function translate(items) {
  if (!items.length) return;
  const keys = items.map((x) => 'tr:' + h(x.title));
  let cached = [];
  if (kvEnabled) { try { cached = (await kv('MGET', ...keys)) || []; } catch { cached = []; } }
  const need = [];
  items.forEach((x, i) => { if (cached[i]) { try { const c = JSON.parse(cached[i]); x.titleAr = c.t; x.descAr = c.d; } catch {} } else need.push(x); });
  for (let i = 0; i < need.length && i < 40; i += 20) {
    const chunk = need.slice(i, i + 20);
    let out = null; try { out = await aiTranslate(chunk); } catch {}
    if (!Array.isArray(out)) break;
    await Promise.all(chunk.map(async (x, j) => { const o = out[j]; if (!o?.t) return; x.titleAr = String(o.t).slice(0, 300); x.descAr = String(o.d || '').slice(0, 400); if (kvEnabled) await kv('SET', 'tr:' + h(x.title), JSON.stringify({ t: x.titleAr, d: x.descAr }), 'EX', 14 * 86400).catch(() => {}); }));
  }
}

let memo = null;
export default async function handler(req, res) {
  const send = (code, obj, ttl = 0) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=300` : 'no-store'); res.end(JSON.stringify(obj)); };
  if (memo && Date.now() - memo.t < 90e3) return send(200, memo.d, 120);
  try {
    if (process.env.FPL_MOCK === '1') return send(200, await mockNews(), 0);
    const [boot, feeds] = await Promise.all([
      fetch('https://fantasy.premierleague.com/api/bootstrap-static/', { headers: { 'User-Agent': UA } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetchFeeds().catch(() => ({ items: [], ok: [] })),
    ]);
    const els = boot?.elements || [], T = Object.fromEntries((boot?.teams || []).map((t) => [t.id, t.short_name]));
    const fpl = els.filter((e) => e.news && e.news_added && Date.now() - Date.parse(e.news_added) < 21 * 864e5)
      .map((e) => ({ id: e.id, name: e.web_name, team: T[e.team] || '', pos: e.element_type, st: e.status, chance: e.chance_of_playing_next_round, news: e.news, newsAr: newsAr(e.news), at: Date.parse(e.news_added), own: +e.selected_by_percent || 0 }))
      .sort((a, b) => b.at - a.at).slice(0, 160);
    mentions(feeds.items, els);
    await translate(feeds.items.filter((x) => x.cat !== 'other').concat(feeds.items.filter((x) => x.cat === 'other')).slice(0, 40));
    const d = { at: Date.now(), fpl, feed: feeds.items, sources: feeds.ok };
    memo = { t: Date.now(), d };
    return send(200, d, 120);
  } catch (e) { return send(502, { error: e.message }); }
}

/* بيانات تجريبية للتطوير المحلي فقط */
async function mockNews() {
  const { mockFPL } = await import('./_mock.js');
  const b = mockFPL('bootstrap-static/'), T = Object.fromEntries(b.teams.map((t) => [t.id, t.short_name]));
  const fpl = b.elements.filter((e) => e.news).map((e, i) => ({ id: e.id, name: e.web_name, team: T[e.team], pos: e.element_type, st: e.status, chance: e.chance_of_playing_next_round, news: e.news, newsAr: newsAr(e.news), at: Date.now() - i * 47e5, own: +e.selected_by_percent || 0 }));
  const xml = `<rss><channel>${[
    ['Gvardiol ruled out for three weeks with knee injury', 'Manchester City defender Josko Gvardiol will miss the next three matches after sustaining a knee injury in training, Pep Guardiola has confirmed.'],
    ['Arteta: Saka is fit and ready to start against Chelsea', 'Mikel Arteta says Bukayo Saka has fully recovered and is available for Sunday\'s game.'],
    ['Wan-Bissaka handed three-match ban after red card appeal fails', 'The FA has rejected the appeal and the defender will miss three games.'],
    ['Team news: Salah returns to Liverpool squad', 'Mohamed Salah is back in training and could start this weekend.'],
    ['Premier League clubs vote on new spending rules', 'Clubs met on Thursday to discuss financial regulations.'],
  ].map(([t, d], i) => `<item><title><![CDATA[${t}]]></title><link>https://www.bbc.co.uk/sport/football/${i}</link><description><![CDATA[<p>${d}</p>]]></description><pubDate>${new Date(Date.now() - i * 33e5).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
  const items = parseRSS(xml, 'BBC Sport'); items.forEach((x) => { const txt = `${x.title} ${x.desc}`; x.cat = (CAT.find(([, re]) => re.test(txt)) || ['other'])[0]; });
  mentions(items, b.elements);
  return { at: Date.now(), fpl, feed: items, sources: [['BBC Sport', true], ['The Guardian', true], ['Sky Sports', false]] };
}
