/* نسبة الكبتنة لكل جولة — عيّنة حقيقية (أفضل 100 عالمياً أو دورياتك) */
import { ST, PM, tShort, tName } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, fmtTime } from '../ui.js';
import * as FPL from '../fpl.js';
import { pShirt } from './common.js';
import { xp, captainRank } from '../engine.js';

let gw = null, src = 'top', lid = null;
const cache = {};
const keyOf = () => `${src}:${src === 'league' ? lid : 0}:${gw}`;

async function load() {
  const k = keyOf(); if (cache[k]) return;
  cache[k] = { loading: true };
  const ev = ST.G.events.find((e) => e.id === gw), fin = ev?.fin ? 1 : 0;
  try {
    const r = await fetch(`/api/captains?gw=${gw}&src=${src}${src === 'league' ? `&id=${lid}` : ''}&fin=${fin}`);
    const d = await r.json().catch(() => ({}));
    cache[k] = r.ok ? d : { err: d.error || 'HTTP ' + r.status };
  } catch (e) { cache[k] = { err: e.message }; }
  if (ST.view === 'captains' && keyOf() === k) { window.__recount = true; window.render(); }
}
function gwStrip() {
  const G = ST.G, last = Math.max(1, G.cur || 1);
  return `<div class="gwstrip" id="cpstrip">${G.events.filter((e) => e.id <= last + 1).map((e) => `<button class="${e.id <= last ? 'past' : 'fut'} ${e.id === gw ? 'on' : ''}" onclick="cpGW(${e.id})"><small>${tt('ج', 'GW')}</small><b>${e.id}</b></button>`).join('')}</div>`;
}
/* الجولة الجاية: ما في تشكيلات منشورة، فنعرض توقع الكبتنة من المحرك */
function upcoming() {
  const G = ST.G, g = gw, P = ST.G.players.filter((p) => p.st !== 'u');
  const top = [...P].sort((a, b) => xp(b, g) * (1 + b.own / 60) - xp(a, g) * (1 + a.own / 60)).slice(0, 10);
  const score = top.map((p) => xp(p, g) * (1 + p.own / 60)), sum = score.reduce((a, x) => a + x, 0);
  const rows = top.map((p, i) => ({ p, pct: Math.round((score[i] / sum) * 1000) / 10 }));
  return `<div class="note" style="margin:10px 0">${I('i-info', 'i', 'color:var(--info)')}<span>${tt(`الجولة ${g} بعدها ما سكّرت، فهذي <b>توقعات</b> محسوبة من النقاط المتوقعة ونسبة الملكية. النسب الحقيقية تطلع بعد الإغلاق.`, `GW${g} hasn't locked — these are <b>projections</b>; real picks appear after the deadline.`)}</span></div>${board(rows, null, true)}`;
}
function board(rows, d, proj = false) {
  const mine = ST.plan?.cap, myIds = new Set(ST.plan?.squad || []), live = ST.live && ST.liveRawGW === gw ? ST.live : null;
  const max = Math.max(...rows.map((r) => r.pct), 1);
  const pod = rows.slice(0, 3), rest = rows.slice(3, 20);
  const medal = ['#FBBF24', '#CBD5E1', '#D97706'];
  return `<div class="cp-podium">${[1, 0, 2].filter((i) => pod[i]).map((i) => { const r = pod[i], p = PM(r.id ?? r.p.id) || r.p; const pts = live?.[p.id]?.total_points; return `<button class="cp-pod p${i + 1}" style="--m:${medal[i]};--d:${i * 90}ms" onclick="openPlayer(${p.id})"><span class="cp-rank">${i + 1}</span><div class="cp-sh">${pShirt(p)}</div><b class="cp-name">${esc(p.name)}</b><span class="cp-club">${tShort(p.team)}</span><span class="cp-pct"><span class="count" data-v="${r.pct}">${r.pct}</span>%</span>${pts != null ? `<small class="cp-pts">${pts * 2} ${tt('نقطة ككابتن', 'pts as C')}</small>` : ''}${myIds.has(p.id) ? `<i class="cp-mine">${mine === p.id ? 'C' : tt('عندك', 'Yours')}</i>` : ''}</button>`; }).join('')}</div>
   <div class="list cp-list">${rest.map((r, k) => { const p = PM(r.id ?? r.p.id) || r.p, i = k + 3; const pts = live?.[p.id]?.total_points; return `<div class="row tap cp-row" style="--d:${k * 40}ms" onclick="openPlayer(${p.id})"><span class="cp-n">${i + 1}</span><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${myIds.has(p.id) ? `<span class="tag lime">${mine === p.id ? tt('كابتنك', 'Your C') : tt('عندك', 'Yours')}</span>` : ''}</b><div class="cp-bar"><i style="width:${(r.pct / max) * 100}%"></i></div><span>${tName(p.team)}${r.vc ? ` · ${tt('نائب', 'VC')} ${r.vc}%` : ''}${r.tc ? ` · ${tt('ثلاثي', 'TC')} ${r.tc}` : ''}${pts != null ? ` · ${pts * 2} ${tt('ككابتن', 'as C')}` : ''}</span></div><div class="col cp-val"><span class="count" data-v="${r.pct}">${r.pct}</span><small>%</small></div></div>`; }).join('')}</div>
   ${d ? `<div class="cp-foot">${I('i-users', 'i', 'width:14px;height:14px')}${tt(`عيّنة: ${d.sample} مدرب`, `Sample: ${d.sample} managers`)} ${d.src === 'top' ? tt('(أفضل 100 بالترتيب العام)', '(overall top 100)') : `(${esc(d.label)})`}${Object.keys(d.chips || {}).length ? ` · ${tt('أوراق', 'Chips')}: ${Object.entries(d.chips).map(([c, n]) => `${{ bboost: 'BB', '3xc': 'TC', freehit: 'FH', wildcard: 'WC', manager: 'AM' }[c] || c} ${n}`).join('، ')}` : ''}<br><span class="mut">${tt('آخر حساب', 'Computed')} ${fmtTime(new Date(d.computedAt).toISOString())}</span></div>` : ''}
   ${proj ? '' : `<p class="mut" style="font-size:11.5px;text-align:center;margin-top:8px">${tt('الفانتازي ما ينشر نسب الكبتنة لكل المدربين، فهذي النسب محسوبة من تشكيلات حقيقية لعيّنة واضحة الحجم.', 'FPL does not publish full captaincy; computed from a real sample.')}</p>`}`;
}
export function vCaptains() {
  const G = ST.G; if (gw == null) gw = Math.max(1, G.cur || 1);
  const priv = (ST.E.entry.leagues?.classic || []).filter((l) => l.league_type === 'x');
  if (src === 'league' && !lid) lid = priv[0]?.id || null;
  const ev = G.events.find((e) => e.id === gw), locked = ev && new Date(ev.deadline) < new Date();
  let body;
  if (!locked) body = upcoming();
  else { const d = cache[keyOf()]; if (!d) { load(); body = skel(); } else if (d.loading) body = skel(); else if (d.err) body = `<div class="card mut" style="margin-top:10px">${esc(d.err)}</div>`; else body = board(d.players.filter((r) => r.pct > 0).map((r) => ({ ...r })), d); }
  return `<section class="cp-hero"><div class="flex" style="gap:10px"><div class="pbig" style="background:rgba(251,191,36,.14);color:var(--gold)">${I('i-crown', 'i', 'width:20px;height:20px')}</div><div><b style="font-size:16px">${tt('نسبة الكبتنة', 'Captaincy')}</b><div class="mut" style="font-size:12.5px">${tt('منو اختاروا كابتن بكل جولة', 'Who managers captained each GW')}</div></div></div></section>
   ${gwStrip()}
   <div class="seg" style="margin:8px 0 4px"><button class="${src === 'top' ? 'on' : ''}" onclick="cpSrc('top')">${I('i-globe', 'i', 'width:14px;height:14px')}${tt('أفضل 100 عالمياً', 'Top 100 overall')}</button>${priv.map((l) => `<button class="${src === 'league' && lid === l.id ? 'on' : ''}" onclick="cpSrc('league',${l.id})">${I('i-trophy', 'i', 'width:14px;height:14px')}${esc(l.name)}</button>`).join('')}</div>
   ${body}`;
}
const skel = () => `<div class="cp-podium">${[0, 1, 2].map(() => '<div class="skel" style="height:190px;flex:1"></div>').join('')}</div><div class="skel" style="height:260px;margin-top:10px"></div>`;
export function afterCaptains() { setTimeout(() => document.querySelector('#cpstrip .on')?.scrollIntoView({ inline: 'center', block: 'nearest' }), 40); }
Object.assign(window, {
  cpGW: (g) => { gw = g; window.__recount = true; window.render(); },
  cpSrc: (s, id) => { src = s; if (id) lid = id; window.__recount = true; window.render(); },
});
