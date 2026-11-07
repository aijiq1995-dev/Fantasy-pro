/* الجولات: كل جولة من 1 لحد 38 + مصفوفة صعوبة المباريات */
import { ST, PM, tShort, tName } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, fmt, crest, fmtTime, scoreHTML, fxMin } from '../ui.js';
import * as FPL from '../fpl.js';
import { xp, projected, fixturesFor, avgFdr, dgwBgw } from '../engine.js';
import { pShirt, playerSummary } from './common.js';

let gwSel = null, tab = 'gw', span = 6;
const cache = {};
const histOf = (g) => (ST.E.hist.current || []).find((h) => h.event === g);
const chipOf = (g) => (ST.E.hist.chips || []).find((c) => c.event === g);
const CHIP = () => ({ wildcard: tt('وايلد كارد', 'Wildcard'), freehit: tt('فري هيت', 'Free Hit'), bboost: tt('بنش بوست', 'Bench Boost'), '3xc': tt('كابتن ثلاثي', 'Triple Captain') });

export function vSeason() {
  const G = ST.G; if (gwSel == null) gwSel = G.next || G.cur || 1;
  const dg = Object.fromEntries(dgwBgw(1, G.lastGW).map((x) => [x.gw, x]));
  const strip = `<div class="gwstrip" id="gwstrip">${G.events.map((e) => { const h = histOf(e.id), past = e.id <= G.cur; return `<button class="${past ? 'past' : 'fut'} ${e.id === G.cur ? 'cur' : ''} ${e.id === gwSel ? 'on' : ''}" onclick="seasonGo(${e.id})" aria-label="GW${e.id}"><small>${e.id}</small><b>${past ? (h ? h.points : '—') : dg[e.id]?.dbl.length ? '×2' : '·'}</b>${chipOf(e.id) ? '<span class="flag"></span>' : ''}</button>`; }).join('')}</div>`;
  return `<div class="tabs2"><button class="${tab === 'gw' ? 'on' : ''}" onclick="seasonTab('gw')">${tt('الجولات', 'Gameweeks')}</button><button class="${tab === 'mx' ? 'on' : ''}" onclick="seasonTab('mx')">${tt('مصفوفة الصعوبة', 'Fixture matrix')}</button></div>
   ${tab === 'gw' ? strip + (gwSel <= G.cur ? pastGW(gwSel) : futureGW(gwSel, dg[gwSel])) : matrix()}`;
}

function pastGW(g) {
  const G = ST.G, ev = G.events.find((e) => e.id === g), h = histOf(g), c = chipOf(g), prev = histOf(g - 1);
  const mv = h && prev && prev.overall_rank ? prev.overall_rank - h.overall_rank : 0;
  const head = `<div class="hero"><div class="flex between"><div><div class="mut" style="font-size:13px">${t('gw')} ${g} · ${ev.fin ? tt('منتهية', 'Finished') : `<span class="livebadge">${tt('جارية', 'Live')}</span>`}</div><div class="big-num" style="font-size:40px">${h ? h.points : '—'} <span class="mut" style="font-size:14px">${tt('نقطة', 'pts')}</span></div></div>${c ? `<span class="tag violet">${I('i-bolt')}${CHIP()[c.name] || c.name}</span>` : ''}</div>
   <div class="kpis"><div><small>${t('avg')}</small><b>${ev.avg ?? '—'}</b>${h && ev.avg ? `<em class="${h.points >= ev.avg ? 'up' : 'down'}"> ${h.points >= ev.avg ? '+' : ''}${h.points - ev.avg}</em>` : ''}</div><div><small>${t('highest')}</small><b>${ev.top ?? '—'}</b></div><div><small>${t('overall')}</small><b style="font-size:17px">${h ? fmt(h.overall_rank) : '—'}</b>${mv ? `<em class="${mv > 0 ? 'up' : 'down'}"> ${mv > 0 ? '▲' : '▼'}${fmt(Math.abs(mv))}</em>` : ''}</div></div>
   ${h ? `<div class="flex wrap" style="margin-top:10px;gap:6px"><span class="tag">${I('i-swap')}${h.event_transfers} ${tt('انتقال', 'transfers')}${h.event_transfers_cost ? ` (−${h.event_transfers_cost})` : ''}</span><span class="tag">${I('i-bench')}${tt('الدكة', 'Bench')} ${h.points_on_bench}</span></div>` : ''}</div>`;
  return head + `<div class="sec"><h2>${I('i-pitch')}${tt('فريقك بهالجولة', 'Your team this GW')}</h2></div><div id="gwTeam">${teamBlock(g)}</div>
   <div class="sec"><h2>${I('i-cal')}${tt('نتائج الجولة', 'Results')}</h2><span class="mut" style="font-size:12px">${(G.fx[g] || []).length} ${tt('مباراة', 'matches')}</span></div>${fixtures(g)}`;
}
function teamBlock(g) {
  const c = cache[g];
  if (!c) return `<div class="card mut">${t('loading')}</div>`;
  if (c.rows) return `<div class="list">${c.rows.map((r) => { const p = PM(r.id); return p ? `<div class="row tap" onclick="playerGW(${p.id},${g},${r.cap ? 2 : 1})" style="${r.bench ? 'opacity:.6' : ''}"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${r.cap ? `<span class="tag" style="background:var(--gold);color:#1C1404">C</span>` : r.vc ? '<span class="tag">V</span>' : ''}${r.bench ? ` <span class="tag">${t('bench')}</span>` : ''}</b><span>${r.line || ''}</span></div><div class="col" style="font-size:16px">${r.pts ?? '—'}<small>${tt('نقطة', 'pts')}</small></div></div>` : ''; }).join('')}</div>${c.note ? `<p class="mut" style="font-size:12px;margin:8px 2px">${c.note}</p>` : ''}`;
  return `<div class="card mut">${esc(c.err || t('noData'))}</div>`;
}
async function loadTeam(g) {
  if (cache[g]) return; cache[g] = null;
  const id = ST.profile.teamId;
  try {
    const [pk, lv] = await Promise.all([FPL.fetchPicks(id, g), FPL.loadLive(g)]);
    const L = Object.fromEntries(lv.elements.map((x) => [x.id, x.stats]));
    cache[g] = { rows: pk.picks.sort((a, b) => a.position - b.position).map((x) => { const s = L[x.element] || {}; return { id: x.element, pts: (s.total_points || 0) * (x.multiplier || 1), cap: x.is_captain, vc: x.is_vice_captain, bench: x.position > 11, line: `${s.minutes ?? 0}' · ${tt('أهداف', 'G')} ${s.goals_scored || 0} · ${tt('صناعة', 'A')} ${s.assists || 0}${s.bonus ? ` · ${tt('بونص', 'B')} ${s.bonus}` : ''}` }; }) };
  } catch {
    // بديل: نقاط لاعبينك الحاليين بهذي الجولة من سجل كل لاعب
    try {
      const sq = ST.plan ? [...ST.plan.xi, ...ST.plan.bench] : [];
      const rows = await Promise.all(sq.map(async (pid) => { const d = await playerSummary(pid).catch(() => null); const hs = (d?.history || []).filter((x) => x.round === g); return { id: pid, pts: hs.length ? hs.reduce((a, x) => a + x.total_points, 0) : null, line: hs.length ? hs.map((x) => `${tShort(x.opponent_team)} (${x.was_home ? t('home_s') : t('away_s')}) · ${x.minutes}'`).join(' + ') : tt('ما لعب أو بيانات غير متوفرة', 'No data') }; }));
      cache[g] = { rows: rows.sort((a, b) => (b.pts ?? -1) - (a.pts ?? -1)), note: tt('تشكيلتك الرسمية لهالجولة غير متاحة هنا، فهذي نقاط لاعبينك الحاليين بنفس الجولة.', 'Official picks for this GW unavailable — showing your current players\' points that GW.') };
    } catch (e) { cache[g] = { err: e.message }; }
  }
  if (ST.view === 'season' && gwSel === g) { const el = document.getElementById('gwTeam'); if (el) el.innerHTML = teamBlock(g); }
}
function fixtures(g) {
  const fx = (ST.G.fx[g] || []).slice().sort((a, b) => (a.ko || '').localeCompare(b.ko || ''));
  if (!fx.length) return `<div class="card mut">${tt('مباريات هذي الجولة غير متوفرة', 'No fixtures available')}</div>`;
  const mine = new Set((ST.plan?.squad || []).map((id) => PM(id)?.team));
  let day = '';
  return `<div class="list">${fx.map((f) => { const d = f.ko ? new Date(f.ko).toLocaleDateString(document.dir === 'ltr' ? 'en-GB' : 'ar-IQ', { weekday: 'long', day: 'numeric', month: 'long' }) : tt('موعد غير محدد', 'TBC'); const hd = d !== day ? `<div class="mut" style="font-size:12px;padding:10px 12px 4px;background:var(--bg2)">${(day = d)}</div>` : '';
    return hd + `<div class="row tap" onclick="${window.openMatchC ? `openMatchC(${f.id},${f.ev})` : `go('live')`}"><div class="flex" style="flex:1;justify-content:flex-end;gap:8px;min-width:0"><b style="font-size:13.5px;${mine.has(f.h) ? 'color:var(--acc)' : ''}">${tName(f.h)}</b>${crest(tShort(f.h), 26)}</div><div style="min-width:64px;text-align:center">${f.started ? `${scoreHTML(f.hs, f.as, 'score', 'font-size:17px')}${f.fin ? '' : '<div class="livebadge" style="font-size:10px">' + fxMin(f, true) + '</div>'}` : `<span class="num mut" style="font-size:13px">${f.ko ? new Date(f.ko).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>`}</div><div class="flex" style="flex:1;gap:8px;min-width:0">${crest(tShort(f.a), 26)}<b style="font-size:13.5px;${mine.has(f.a) ? 'color:var(--acc)' : ''}">${tName(f.a)}</b></div></div>`; }).join('')}</div>`;
}
function futureGW(g, d) {
  const G = ST.G, ev = G.events.find((e) => e.id === g), P = ST.plan;
  const sq = P ? [...P.xi, ...P.bench].map(PM) : [];
  const cap = [...(P?.xi || [])].map(PM).sort((a, b) => xp(b, g) - xp(a, g))[0];
  const playing = sq.filter((p) => fixturesFor(p.team, g).length).length;
  return `<div class="hero"><div class="flex between"><div><div class="mut" style="font-size:13px">${t('gw')} ${g} · ${tt('الإغلاق', 'Deadline')} ${fmtTime(ev.deadline)}</div><div class="big-num" style="font-size:36px">${P ? projected(P, g) : '—'} <span class="mut" style="font-size:14px">${tt('متوقع لفريقك', 'projected')}</span></div></div>${d?.dbl.length ? `<span class="tag violet">${tt('جولة مزدوجة', 'Double GW')}</span>` : d?.blank.length && (G.fx[g] || []).length ? `<span class="tag amber">${tt('جولة فارغة', 'Blank GW')}</span>` : ''}</div>
   <div class="kpis"><div><small>${tt('لاعبينك يلعبون', 'Your players playing')}</small><b>${playing}/15</b></div><div><small>${tt('الكابتن المقترح', 'Suggested captain')}</small><b style="font-size:15px">${cap ? esc(cap.name) : '—'}</b>${cap ? `<em class="up"> ${xp(cap, g)} xP</em>` : ''}</div><div><small>${tt('مزدوجة/فارغة', 'Double/blank')}</small><b style="font-size:15px">${d ? `${d.dbl.length}/${d.blank.length}` : '0/0'}</b></div></div></div>
   <div class="sec"><h2>${I('i-users')}${tt('لاعبينك بهالجولة', 'Your players')}</h2></div>
   <div class="list">${sq.sort((a, b) => xp(b, g) - xp(a, g)).map((p) => { const f = fixturesFor(p.team, g); return `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)}</b><span>${f.length ? f.map((x) => `<span class="rate f${x.fdr}">${tShort(x.opp)} ${x.home ? t('home_s') : t('away_s')}</span>`).join(' ') : `<span class="tag amber">${tt('ما يلعب', 'Blank')}</span>`}</span></div><div class="col" style="color:var(--acc)">${xp(p, g)}<small>xP</small></div></div>`; }).join('')}</div>
   <div class="sec"><h2>${I('i-cal')}${tt('مباريات الجولة', 'Fixtures')}</h2></div>${fixtures(g)}`;
}
function matrix() {
  const G = ST.G, from = G.next || G.cur, to = Math.min(G.lastGW, from + span - 1), gws = []; for (let g = from; g <= to; g++) gws.push(g);
  const myCount = {}; (ST.plan?.squad || []).forEach((id) => { const tm = PM(id).team; myCount[tm] = (myCount[tm] || 0) + 1; });
  const rows = Object.values(G.teams).map((tm) => ({ tm, avg: avgFdr(tm.id, from, gws.length) })).sort((a, b) => a.avg - b.avg);
  return `<div class="flex between wrap" style="margin-bottom:10px"><div class="seg">${[4, 6, 8, 12, 38].map((n) => `<button class="${span === n ? 'on' : ''}" onclick="seasonSpan(${n})">${n === 38 ? tt('للنهاية', 'To end') : n + ' ' + tt('جولات', 'GWs')}</button>`).join('')}</div></div>
   <div class="card scroll-x" dir="ltr" style="padding:10px"><table class="mx"><thead><tr><th style="text-align:left">${tt('النادي', 'Club')}</th><th>${tt('المعدل', 'Avg')}</th>${gws.map((g) => `<th>${g}</th>`).join('')}</tr></thead><tbody>
   ${rows.map(({ tm, avg }) => `<tr><td class="tn" onclick="openClub(${tm.id})">${myCount[tm.id] ? `<span class="tag lime" style="padding:0 5px;margin-left:4px">${myCount[tm.id]}</span>` : ''}${tm.short}</td><td class="c" style="background:var(--s2)">${avg.toFixed(1)}</td>${gws.map((g) => { const f = fixturesFor(tm.id, g); return f.length ? `<td class="c f${Math.round(f.reduce((a, x) => a + x.fdr, 0) / f.length)}">${f.map((x) => `${tShort(x.opp)}<small>${x.home ? 'H' : 'A'}</small>`).join('')}</td>` : '<td class="c blank">—</td>'; }).join('')}</tr>`).join('')}
   </tbody></table></div>
   <div class="flex wrap" style="gap:6px;margin-top:10px;font-size:12px"><span class="mut">${tt('الصعوبة', 'Difficulty')}:</span>${[1, 2, 3, 4, 5].map((d) => `<span class="rate f${d}">${d}</span>`).join('')}<span class="mut">· ${tt('مرتبة من الأسهل · الرقم الأخضر = عدد لاعبينك', 'Sorted easiest first · green = your players')}</span></div>`;
}
export function afterSeason() {
  if (tab === 'gw' && gwSel <= ST.G.cur) loadTeam(gwSel);
  const on = document.querySelector('#gwstrip .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}
Object.assign(window, {
  seasonGo: (g) => { gwSel = g; tab = 'gw'; if (ST.view !== 'season') window.go('season'); else window.render(); },
  seasonTab: (x) => { tab = x; window.render(); },
  seasonSpan: (n) => { span = n; window.render(); },
});
