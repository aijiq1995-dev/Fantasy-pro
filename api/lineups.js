/* =========================================================
   /api/lineups?ko=2026-11-07T12:30:00Z&h=LEE&a=TOT
   التشكيلة الرسمية للمباراة + التبديلات الحقيقية (منو دخل بدل منو وبأي دقيقة)
   الفانتازي ما ينشر التشكيلات، فنجيبها من بيانات ESPN العامة للمباريات.
========================================================= */
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/';
const ABBR = { MCI: 'MNC', MUN: 'MAN' }; // رموز الفانتازي ← رموز ESPN
const memo = new Map();

function send(res, code, data, ttl = 0) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', ttl ? `public, s-maxage=${ttl}, stale-while-revalidate=${Math.min(ttl, 120)}` : 'no-store');
  res.end(JSON.stringify(data));
}
async function get(path) {
  const r = await fetch(BASE + path, { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; FantasyPro/2.0)' } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
const clockMin = (s) => { const m = String(s || '').match(/(\d+)'(?:\+(\d+))?/); return m ? { min: +m[1], add: m[2] ? +m[2] : 0, txt: s } : null; };

export default async function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const ko = new Date(u.searchParams.get('ko') || ''), h = (u.searchParams.get('h') || '').toUpperCase().slice(0, 4), a = (u.searchParams.get('a') || '').toUpperCase().slice(0, 4);
  if (isNaN(ko) || !/^[A-Z]{3}$/.test(h) || !/^[A-Z]{3}$/.test(a)) return send(res, 400, { error: 'bad params' });
  if (process.env.FPL_MOCK === '1') return send(res, 404, { error: 'mock' });
  const key = `${h}-${a}-${ymd(ko)}`;
  const hit = memo.get(key); if (hit && Date.now() < hit.exp) return send(res, 200, hit.d, hit.ttl);
  try {
    const H = ABBR[h] || h, A = ABBR[a] || a;
    // تاريخ ESPN حسب توقيت أمريكا الشرقي — نجرب يوم المباراة وقبله
    let ev = null;
    for (const d of [new Date(ko.getTime() - 5 * 3600e3), ko, new Date(ko.getTime() - 29 * 3600e3)]) {
      const sb = await get(`scoreboard?dates=${ymd(d)}`).catch(() => null);
      ev = (sb?.events || []).find((e) => { const c = e.competitions?.[0]?.competitors || []; const hh = c.find((x) => x.homeAway === 'home')?.team?.abbreviation, aa = c.find((x) => x.homeAway === 'away')?.team?.abbreviation; return hh === H && aa === A; });
      if (ev) break;
    }
    if (!ev) return send(res, 404, { error: 'not found' }, 300);
    const s = await get(`summary?event=${ev.id}`);
    const state = ev.status?.type?.state; // pre | in | post
    const sides = {};
    (s.rosters || []).forEach((r) => {
      const side = r.homeAway === 'home' ? 'h' : r.homeAway === 'away' ? 'a' : (r.team?.abbreviation === H ? 'h' : 'a');
      sides[side] = {
        formation: r.formation || '',
        players: (r.roster || []).map((p) => {
          const plays = p.plays || [];
          const sub = plays.filter((x) => x.substitution).map((x) => clockMin(x.clock?.displayValue));
          return {
            id: String(p.athlete?.id || ''), name: p.athlete?.displayName || '', short: p.athlete?.shortName || '', last: p.athlete?.lastName || '', first: p.athlete?.firstName || '',
            jersey: p.jersey || '', pos: p.position?.abbreviation || '', place: p.formationPlace ? +p.formationPlace : 0, starter: !!p.starter,
            subIn: !!p.subbedIn, subOut: !!p.subbedOut, subAt: sub[0] || null,
            yc: plays.filter((x) => x.yellowCard).length, rc: plays.some((x) => x.redCard) ? 1 : 0,
          };
        }),
      };
    });
    // التبديلات الحقيقية: [0] = الداخل، [1] = الخارج
    const subs = (s.keyEvents || []).filter((k) => k.type?.type === 'substitution' && (k.participants || []).length >= 2).map((k) => {
      const inId = String(k.participants[0].athlete?.id || ''), outId = String(k.participants[1].athlete?.id || '');
      const side = Object.keys(sides).find((sd) => sides[sd].players.some((p) => p.id === inId || p.id === outId)) || null;
      return { side, in: inId, out: outId, at: clockMin(k.clock?.displayValue), injury: /injury/i.test(k.text || '') };
    });
    const d = { event: ev.id, state, sides, subs, at: Date.now() };
    const ttl = state === 'post' ? 6 * 3600 : state === 'in' ? 45 : 600;
    memo.set(key, { d, exp: Date.now() + ttl * 1000, ttl });
    if (memo.size > 200) memo.delete(memo.keys().next().value);
    return send(res, 200, d, ttl);
  } catch (e) {
    return send(res, 502, { error: String(e.message || e) });
  }
}
