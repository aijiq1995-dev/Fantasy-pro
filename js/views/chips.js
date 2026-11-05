/* مركز الأوراق والاستراتيجية — يعتمد قوانين الموسم من الفانتازي نفسه */
import { ST, PM, tName, tShort } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, r1, openSheet, sheetHead, barChart } from '../ui.js';
import * as FPL from '../fpl.js';
import { xp, projected, dgwBgw, bestXI, counts } from '../engine.js';

const NAMES = () => ({ wildcard: [tt('وايلد كارد', 'Wildcard'), 'i-sparkle'], freehit: [tt('فري هيت', 'Free Hit'), 'i-bolt'], bboost: [tt('بنش بوست', 'Bench Boost'), 'i-bench'], '3xc': [tt('كابتن ثلاثي', 'Triple Captain'), 'i-star'], manager: [tt('المساعد', 'Assistant Manager'), 'i-users'] });
/** فريق فري هيت تقريبي: أفضل 15 حسب المتوقع ضمن الميزانية وقواعد اللعبة */
function freeHitTeam(budget, gw) {
  const need = { GK: 2, DEF: 5, MID: 5, FWD: 3 }, got = { GK: [], DEF: [], MID: [], FWD: [] }, club = {};
  const pool = ST.G.players.filter((p) => p.st === 'a').map((p) => ({ p, v: xp(p, gw) })).sort((a, b) => b.v / Math.pow(b.p.price, 0.6) - a.v / Math.pow(a.p.price, 0.6));
  let spent = 0; const cheapest = (pos) => Math.min(...ST.G.players.filter((x) => x.pos === pos).map((x) => x.price));
  for (const { p } of pool) {
    if (got[p.pos].length >= need[p.pos] || (club[p.team] || 0) >= 3) continue;
    const remainSlots = Object.keys(need).reduce((a, k) => a + (need[k] - got[k].length), 0) - 1;
    const reserve = Object.keys(need).reduce((a, k) => a + (need[k] - got[k].length - (k === p.pos ? 1 : 0)) * cheapest(k), 0);
    if (spent + p.price + reserve > budget && remainSlots >= 0) continue;
    got[p.pos].push(p.id); club[p.team] = (club[p.team] || 0) + 1; spent += p.price;
  }
  const squad = Object.values(got).flat(); if (squad.length < 15) return null;
  const b = bestXI(squad, gw); return { squad, ...b, chip: '', transfers: [], bank: r1(budget - spent), spent: r1(spent) };
}
export function vChips() {
  const G = ST.G, P = ST.plan, cs = FPL.chipStatus(G, ST.E.hist);
  const groups = {}; cs.forEach((c) => (groups[c.name] = groups[c.name] || []).push(c));
  const dg = dgwBgw(G.next, Math.min(G.lastGW, G.next + 9));
  const nextGWs = Array.from({ length: 8 }, (_, i) => G.next + i).filter((g) => g <= G.lastGW);
  const capBest = P ? nextGWs.map((g) => { const c = [...P.xi].map(PM).sort((a, b) => xp(b, g) - xp(a, g))[0]; return { g, p: c, v: xp(c, g) }; }) : [];
  const benchBest = P ? nextGWs.map((g) => ({ g, v: r1(P.bench.reduce((a, id) => a + xp(PM(id), g), 0)) })) : [];
  const base = P ? projected({ ...P, chip: '' }) : 0;
  const sim = P ? { bboost: r1(projected({ ...P, chip: 'bboost' }) - base), '3xc': r1(projected({ ...P, chip: '3xc' }) - base) } : {};
  return `<div class="grid g2 chipg">${Object.entries(groups).map(([n, arr]) => { const nm = NAMES()[n] || [n, 'i-bolt']; const left = arr.reduce((a, c) => a + (c.open ? c.left : 0), 0), total = arr.reduce((a, c) => a + c.number, 0);
    return `<div class="card tap" onclick="chipInfo('${n}')"><div style="display:flex;align-items:center;gap:10px"><span style="width:44px;height:44px;border-radius:14px;background:${left ? 'var(--g2)' : 'var(--glass2)'};display:grid;place-items:center">${I(nm[1])}</span><div style="flex:1"><b>${nm[0]}</b><div class="mut" style="font-size:12px">${arr.map((c) => `GW${c.start}–${c.stop}: ${c.used.length ? tt('استُخدمت ج', 'used GW') + c.used.map((u) => u.event).join(',') : c.expired ? tt('انتهت', 'expired') : tt('متاحة', 'available')}`).join(' · ')}</div></div><span class="tag ${left ? 'lime' : ''}">${left}/${total}</span></div>
     ${sim[n] != null ? `<div class="mut" style="font-size:12px;margin-top:8px">${tt('أثرها لو استخدمتها بالجولة', 'Impact if used in GW')} ${G.next}: <b style="color:#34D399">+${sim[n]}</b> ${tt('متوقع', 'xP')}</div>` : ''}</div>`; }).join('')}</div>
   <p class="mut" style="font-size:11.5px;margin:8px 2px">${tt('عدد الأوراق وفتراتها مأخوذة من قوانين الموسم بالفانتازي الرسمي نفسه، مو مفترضة.', 'Chip counts and windows come from the official game rules for this season.')}</p>
   <div class="sec"><h2>${I('i-cal')}${tt('جولات مزدوجة وفارغة قادمة', 'Upcoming double & blank GWs')}</h2></div>
   ${dg.length ? dg.map((x) => `<div class="row"><div class="mini" style="display:grid;place-items:center;font-weight:700;border-radius:14px;background:rgba(52,211,153,.14);color:#34D399">${x.gw}</div><div class="info"><b>${x.dbl.length ? tt('مزدوجة', 'Double') + ': ' + x.dbl.map(tShort).join('، ') : ''}${x.dbl.length && x.blank.length ? ' · ' : ''}${x.blank.length ? tt('فارغة', 'Blank') + ': ' + x.blank.map(tShort).join('، ') : ''}</b><span>${tt('من جدول المباريات الرسمي', 'From the official fixture list')}</span></div></div>`).join('') : `<div class="card mut" style="font-size:13px">${tt('ما في جولات مزدوجة أو فارغة معلنة بالـ 10 جولات الجاية. عادة تنعلن بعد مباريات الكؤوس.', 'No doubles or blanks announced in the next 10 GWs. They are usually confirmed after cup rounds.')}</div>`}
   ${P ? `<div class="sec"><h2>${I('i-star')}${tt('أفضل توقيت للكابتن الثلاثي', 'Best Triple Captain timing')}</h2></div><div class="card">${barChart(capBest.map((x) => 'GW' + x.g), capBest.map((x) => r1(x.v * 3)), { h: 130 })}<div class="mut" style="font-size:12px">${tt('أعلى قيمة', 'Peak')}: GW${[...capBest].sort((a, b) => b.v - a.v)[0].g} — ${esc([...capBest].sort((a, b) => b.v - a.v)[0].p.name)} (${r1([...capBest].sort((a, b) => b.v - a.v)[0].v * 3)} ${tt('متوقع ×3', 'xP ×3')})</div></div>
   <div class="sec"><h2>${I('i-bench')}${tt('أفضل توقيت للبنش بوست', 'Best Bench Boost timing')}</h2></div><div class="card">${barChart(benchBest.map((x) => 'GW' + x.g), benchBest.map((x) => x.v), { h: 130, color: 'linear-gradient(180deg,#60A5FA,#1D4ED8)' })}<div class="mut" style="font-size:12px">${tt('نقاط الدكة المتوقعة بكل جولة بفريقك الحالي', 'Projected bench points with current squad')}</div></div>
   <div class="sec"><h2>${I('i-bolt')}${tt('محاكاة الفري هيت', 'Free Hit simulation')}</h2></div><div class="card"><p class="mut" style="font-size:13px">${tt('يبني أفضل 15 لاعب للجولة القادمة ضمن قيمة فريقك وقواعد اللعبة، ويقارنه بفريقك.', 'Builds the best 15 for next GW within your team value and rules, compared to your team.')}</p><button class="btn btn-p btn-b" style="margin-top:8px" onclick="simFH()">${I('i-sparkle')}${tt('شغّل المحاكاة', 'Run simulation')}</button><div id="fhRes"></div></div>` : ''}`;
}
Object.assign(window, {
  chipInfo: (n) => { const nm = NAMES()[n] || [n, 'i-bolt']; const tips = { wildcard: tt('تغيير الفريق كله بدون خصم. أفضل وقت: لما يكثر عندك مصابين، أو قبل سلسلة مباريات سهلة لأندية ما عندك منها.', 'Unlimited free transfers. Best when injuries pile up or before a fixture swing.'), freehit: tt('فريق مؤقت لجولة وحدة ويرجع فريقك بعدها. الأنسب للجولات الفارغة أو المزدوجة الكبيرة.', 'One-week team; ideal for big blank or double GWs.'), bboost: tt('نقاط الدكة تنحسب. الأنسب بجولة مزدوجة لما يكون كل لاعبيك الـ15 يلعبون.', 'Bench points count; best in a double GW with 15 starters.'), '3xc': tt('الكابتن ياخذ ×3. الأنسب لهداف بمباراتين بجولة مزدوجة أو مباراة سهلة جداً بالأرض.', 'Captain scores ×3; best on a premium with a double or very easy home game.') }; openSheet(`${sheetHead(I(nm[1]), nm[0])}<p style="line-height:1.9">${tips[n] || ''}</p>`); },
  simFH: () => { const P = ST.plan, G = ST.G; const value = r1(P.squad.reduce((a, id) => a + PM(id).price, 0) + P.bank); const fh = freeHitTeam(value, G.next); const el = document.getElementById('fhRes'); if (!fh) { el.innerHTML = `<p class="mut">${tt('ما گدرت أبني فريق ضمن الميزانية', 'Could not build a team in budget')}</p>`; return; }
    const a = projected({ ...P, chip: '' }), b = projected(fh);
    el.innerHTML = `<div class="kv" style="margin-top:10px"><div><b>${a}</b><span>${tt('فريقك', 'Your team')}</span></div><div><b class="up">${b}</b><span>${tt('فريق الفري هيت', 'Free Hit team')}</span></div><div><b class="${b - a > 0 ? 'up' : 'down'}">${b - a > 0 ? '+' : ''}${r1(b - a)}</b><span>${tt('الفرق', 'Difference')}</span></div></div>${fh.xi.map((id) => `<span class="tag" style="margin:2px">${esc(PM(id).name)}${id === fh.cap ? ' ©' : ''}</span>`).join('')}<p class="mut" style="font-size:11.5px;margin-top:6px">${tt('محاكاة مبنية على النقاط المتوقعة، والنتيجة الفعلية تختلف. استخدم الفري هيت بجولة فارغة أو مزدوجة كبيرة حتى يكون الفرق يستاهل.', 'Simulation based on xP; real results vary.')}</p>`; },
});
