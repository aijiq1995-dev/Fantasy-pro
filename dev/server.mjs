/* سيرفر محلي للتجربة:  node dev/server.mjs  (بيانات حقيقية)
                         node dev/server.mjs --mock  (بيانات تجريبية بدون إنترنت، رقم الفريق 123456) */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--mock')) process.env.FPL_MOCK = '1';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = +process.env.PORT || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const fpl = (await import('../api/fpl.js')).default;
const coach = (await import('../api/coach.js')).default;
const captains = (await import('../api/captains.js')).default;
const lineups = (await import('../api/lineups.js')).default;
const account = (await import('../api/account.js')).default;
const pushApi = (await import('../api/push.js')).default;
const newsApi = (await import('../api/news.js')).default;

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://local');
  if (u.pathname === '/api/fpl') return fpl(req, res);
  if (u.pathname === '/api/coach') return coach(req, res);
  if (u.pathname === '/api/captains') return captains(req, res);
  if (u.pathname === '/api/lineups') return lineups(req, res);
  if (u.pathname === '/api/account') return account(req, res);
  if (u.pathname === '/api/push') return pushApi(req, res);
  if (u.pathname === '/api/news') return newsApi(req, res);
  let p = normalize(decodeURIComponent(u.pathname)).replace(/^([/\\])+/, '');
  if (p.startsWith('..') || p.startsWith('api') || p.startsWith('dev')) { res.statusCode = 404; return res.end(); }
  let file = join(ROOT, p || 'index.html');
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(ROOT, 'index.html'); }
  try { const data = await readFile(file); res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream'); res.end(data); }
  catch { res.statusCode = 404; res.end('Not found'); }
}).listen(PORT, () => console.log(`✓ فانتازي برو يشتغل على http://localhost:${PORT}${process.env.FPL_MOCK ? '  (بيانات تجريبية — رقم الفريق 123456)' : ''}`));
