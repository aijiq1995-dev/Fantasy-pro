/* يحسب نسبة الكبتنة لأفضل 10,000 مدير بالترتيب العام لجولة معيّنة ويحفظها كـ data/captains/gw{N}.json
   يشتغل من GitHub Actions بعد الإغلاق (الطلبات بهدوء حتى ما نضغط على سيرفر الفانتازي) */
import fs from 'node:fs';
const BASE = 'https://fantasy.premierleague.com/api/', UA = 'Mozilla/5.0 (compatible; FantasyPro/2.0)';
const N = +(process.env.TOP_N || 10000), CONC = 8;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(path, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(BASE + path, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); if (r.status === 404) return null; if (r.ok) return await r.json(); if (r.status === 503) throw new Error('updating'); }
    catch (e) { if (e.message === 'updating' && i === tries - 1) throw e; }
    await sleep(800 * (i + 1));
  }
  return null;
}
async function pool(items, fn) { const out = new Array(items.length); let k = 0; await Promise.all(Array.from({ length: CONC }, async () => { while (k < items.length) { const i = k++; out[i] = await fn(items[i]); await sleep(40); } })); return out; }

const boot = await get('bootstrap-static/');
if (!boot) { console.log('bootstrap unavailable (FPL updating?)'); process.exit(0); }
const cur = boot.events.find((e) => e.is_current);
const gw = +(process.env.GW || cur?.id || 0);
if (!gw || new Date(boot.events.find((e) => e.id === gw).deadline_time) > new Date()) { console.log('no locked gameweek'); process.exit(0); }
const file = `data/captains/gw${gw}.json`;
if (fs.existsSync(file) && !process.env.FORCE) { const old = JSON.parse(fs.readFileSync(file, 'utf8')); if (old.sample >= N * 0.95) { console.log('already done', file, old.sample); process.exit(0); } }

const pages = Array.from({ length: Math.ceil(N / 50) }, (_, i) => i + 1);
const st = await pool(pages, (p) => get(`leagues-classic/314/standings/?page_standings=${p}`));
const entries = [...new Set(st.flatMap((d) => (d?.standings?.results || []).map((r) => r.entry)))].slice(0, N);
console.log('entries', entries.length);
if (entries.length < N * 0.5) { console.log('standings unavailable — try later'); process.exit(0); }

const cap = {}, vice = {}, tc = {}, chips = {}; let n = 0;
const picks = await pool(entries, (e) => get(`entry/${e}/event/${gw}/picks/`, 3));
for (const pk of picks) {
  if (!pk?.picks) continue; n++;
  const c = pk.picks.find((x) => x.is_captain), v = pk.picks.find((x) => x.is_vice_captain);
  if (c) { cap[c.element] = (cap[c.element] || 0) + 1; if (pk.active_chip === '3xc') tc[c.element] = (tc[c.element] || 0) + 1; }
  if (v) vice[v.element] = (vice[v.element] || 0) + 1;
  if (pk.active_chip) chips[pk.active_chip] = (chips[pk.active_chip] || 0) + 1;
}
console.log('picks', n);
if (n < N * 0.5) { console.log('picks unavailable — try later'); process.exit(0); }
const ids = [...new Set([...Object.keys(cap), ...Object.keys(vice)])].map(Number);
const players = ids.map((id) => ({ id, c: cap[id] || 0, pct: Math.round(((cap[id] || 0) / n) * 1000) / 10, vc: Math.round(((vice[id] || 0) / n) * 1000) / 10, tc: tc[id] || 0 })).sort((a, b) => b.c - a.c || b.vc - a.vc);
fs.mkdirSync('data/captains', { recursive: true });
fs.writeFileSync(file, JSON.stringify({ gw, src: 'top', label: 'top10k', sample: n, players, chips, computedAt: Date.now() }));
console.log('saved', file);
