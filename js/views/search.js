/* المساعد الذكي: بحث فوري بكل شي + جواب بالذكاء الاصطناعي بأدوات على بيانات التطبيق */
import { ST, PM, tShort, tName } from '../store.js';
import { t, tt } from '../i18n.js';
import { esc, I, LS, crest, CLUB_AR, toast } from '../ui.js';
import { xpN } from '../engine.js';
import { parseQuery, askAI, localAnswer, md } from '../ai.js';
import { pShirt, stTag } from './common.js';

let Q = '', R = null, A = { q: '', text: '', busy: false, err: '', tools: [], src: '' }, ctrl = null, chat = [];
const SUGG = () => [tt('منو أختار كابتن الجولة الجاية؟', 'Who should I captain next GW?'), tt('أفضل مدافع تحت 5 مليون بمباريات سهلة', 'Best defender under £5m with easy fixtures'), tt('حلل فريقي وقلي أضعف نقطة', 'Analyse my team and its weakest spot'), tt('هل يستاهل أسوي انتقال بخصم 4؟', 'Is a -4 hit worth it?'), tt('شلون كان موسمي جولة بجولة؟', 'How has my season gone GW by GW?'), tt('متى أستخدم البنش بوست؟', 'When should I use Bench Boost?'), tt('قارن هالاند وإيزاك', 'Compare Haaland and Isak'), tt('شلون ألحق متصدر دوريي؟', 'How do I catch my league leader?')];
const recent = () => LS.get('fp_recent_q', []);
const addRecent = (q) => LS.set('fp_recent_q', [q, ...recent().filter((x) => x !== q)].slice(0, 6));

export function vSearch() {
  const r = R;
  return `<div class="omni">
   <form class="searchbox" onsubmit="event.preventDefault();omniAsk()" role="search"><span class="sicon">${I('i-sparkle')}</span><input id="oq" type="search" value="${esc(Q)}" placeholder="${tt('ابحث عن لاعب، نادي، جولة… أو اسأل أي سؤال', 'Search players, clubs, gameweeks… or ask anything')}" autocomplete="off" enterkeyhint="search" aria-label="search">${Q ? `<button type="button" class="sclear" onclick="omniClear()" aria-label="clear">${I('i-x', 'i', 'width:16px;height:16px')}</button>` : ''}<button class="btn btn-p btn-sm" style="margin-inline-start:4px" aria-label="ask">${I('i-send', 'i', 'width:17px;height:17px')}</button></form>
   ${A.q ? ansBox() : ''}
   ${r ? results(r) : idle()}
  </div>`;
}
function ansBox() {
  return `<div class="ansbox" aria-live="polite"><div class="ansh"><div class="ic">${I('i-sparkle', 'i', 'width:17px;height:17px')}</div><div style="flex:1;min-width:0"><b style="font-size:14px">${esc(A.q)}</b><div class="mut" style="font-size:12px">${A.busy ? tt('يحلل البيانات…', 'Analysing…') : A.src === 'ai' ? tt('جواب الذكاء الاصطناعي من بيانات التطبيق', 'AI answer from app data') : tt('تحليل محلي', 'Local analysis')}</div></div>${A.busy ? `<button class="btn btn-g btn-sm" onclick="omniStop()">${I('i-stop', 'i', 'width:14px;height:14px')}${tt('إيقاف', 'Stop')}</button>` : `<button class="icon-btn" style="width:36px;height:36px" onclick="omniCopy()" aria-label="copy">${I('i-copy', 'i', 'width:16px;height:16px')}</button>`}</div>
   <div class="md" id="ansTxt">${A.text ? md(A.text) : A.busy ? `<div class="aiload"><i></i><i></i><i></i><span>${tt('يجمع الأرقام', 'Gathering numbers')}</span></div>` : ''}</div>
   ${A.err ? `<div class="note" style="border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.06)">${I('i-info', 'i', 'color:var(--warn)')}<span>${esc(A.err)}</span></div>` : ''}
   ${A.tools.length ? `<div class="tools">${A.tools.map((x) => `<span>${I('i-db', 'i', 'width:11px;height:11px')}${esc(x)}</span>`).join('')}</div>` : ''}
   ${!A.busy && A.text ? `<form class="flex" style="margin-top:12px" onsubmit="event.preventDefault();omniFollow(this.f.value)"><input name="f" placeholder="${tt('سؤال متابعة…', 'Follow-up…')}" style="padding:9px 12px;font-size:15px"><button class="btn btn-g btn-sm">${I('i-send', 'i', 'width:16px;height:16px')}</button></form>` : ''}</div>`;
}
function idle() {
  const rc = recent();
  return `<div><div class="grp">${I('i-sparkle', 'i', 'width:14px;height:14px')}${tt('جرّب تسأل', 'Try asking')}</div><div class="chips2">${SUGG().map((s) => `<button onclick="omniAsk(${esc(JSON.stringify(s))})">${esc(s)}</button>`).join('')}</div></div>
   ${rc.length ? `<div><div class="grp">${I('i-clock', 'i', 'width:14px;height:14px')}${tt('آخر عمليات البحث', 'Recent')}</div><div class="chips2">${rc.map((s) => `<button onclick="omniSet(${esc(JSON.stringify(s))})">${esc(s)}</button>`).join('')}</div></div>` : ''}
   <div><div class="grp">${I('i-filter', 'i', 'width:14px;height:14px')}${tt('بحث ذكي سريع', 'Smart filters')}</div><div class="chips2">${[tt('مهاجم تحت 7', 'forward under 7'), tt('وسط فورم', 'midfielder form'), tt('مدافع مفاجآت', 'defender differential'), tt('حارس ارخص', 'goalkeeper cheap'), tt('مباريات سهله', 'easy fixtures'), tt('جولة 20', 'gw 20')].map((s) => `<button onclick="omniSet(${esc(JSON.stringify(s))})">${I('i-search')}${esc(s)}</button>`).join('')}</div></div>
   <p class="kbdhint">${tt('اكتب للبحث الفوري، واضغط إرسال حتى يجاوبك الذكاء الاصطناعي من بيانات التطبيق', 'Type to search instantly; press send for an AI answer from app data')}</p>`;
}
function results(r) {
  const G = ST.G, nx = G.next || G.cur, out = [];
  if (r.view) out.push(`<button class="row tap" onclick="go('${r.view}')" style="width:100%;text-align:start"><div class="pbig" style="background:var(--acc-soft);color:var(--acc)">${I('i-arrow')}</div><div class="info"><b>${tt('افتح', 'Open')} ${t(r.view)}</b><span>${tt('قسم بالتطبيق', 'App section')}</span></div>${I('i-chev', 'chev')}</button>`);
  if (r.gw) out.push(`<button class="row tap" onclick="seasonGo(${r.gw})" style="width:100%;text-align:start"><div class="pbig" style="background:var(--s3)">${r.gw}</div><div class="info"><b>${t('gw')} ${r.gw}</b><span>${r.gw <= G.cur ? tt('نتائج ونقاطك', 'Results & your points') : tt('المباريات والصعوبة والمتوقع', 'Fixtures, difficulty, projection')}</span></div>${I('i-chev', 'chev')}</button>`);
  if (r.club) out.push(`<button class="row tap" onclick="openClub(${r.club.id})" style="width:100%;text-align:start"><div class="mini">${crest(r.club.short, 38)}</div><div class="info"><b>${tName(r.club.id)}</b><span>${tt('لاعبين النادي ومبارياته', 'Squad & fixtures')}</span></div>${I('i-chev', 'chev')}</button>`);
  const row = (p) => `<div class="row tap" onclick="openPlayer(${p.id})"><div class="mini">${pShirt(p)}</div><div class="info"><b>${esc(p.name)} ${stTag(p)}</b><span><span class="pos ${p.pos}">${t({ GK: 'gk', DEF: 'def', MID: 'mid', FWD: 'fwd' }[p.pos])}</span>${tShort(p.team)} · ${p.price.toFixed(1)}م · ${p.own}%</span></div><div class="col">${p.total}<small>${tt('نقطة', 'pts')}</small></div><div class="col" style="color:var(--acc)">${xpN(p, nx, 5)}<small>xP/5</small></div></div>`;
  const s = [];
  if (out.length) s.push(`<div>${out.join('')}</div>`);
  if (r.players.length) s.push(`<div><div class="grp">${I('i-users', 'i', 'width:14px;height:14px')}${tt('لاعبين', 'Players')}</div><div class="list">${r.players.map(row).join('')}</div></div>`);
  if (r.smart) s.push(`<div><div class="grp">${I('i-filter', 'i', 'width:14px;height:14px')}${tt('فلتر ذكي', 'Smart filter')}: ${[r.smart.pos && t({ GK: 'gk', DEF: 'def', MID: 'mid', FWD: 'fwd' }[r.smart.pos]), r.smart.club && tName(r.smart.club.id), r.smart.maxPrice && `≤ ${r.smart.maxPrice}م`, { xp5: tt('حسب المتوقع', 'by xP'), form: tt('حسب الفورم', 'by form'), total: tt('حسب النقاط', 'by points'), cheap: tt('الأرخص', 'cheapest'), own: tt('الأكثر ملكية', 'most owned'), diff: tt('مفاجآت', 'differentials'), gls: tt('أهداف', 'goals'), xg: 'xG', tin: tt('الأكثر شراءً', 'most bought'), value: tt('القيمة', 'value'), fix: tt('أسهل مباريات', 'easiest fixtures') }[r.smart.sort]].filter(Boolean).join(' · ')}</div><div class="list">${r.smart.list.map(row).join('')}</div></div>`);
  if (!s.length && !r.isQuestion) s.push(`<div class="empty">${I('i-search', 'i', 'width:36px;height:36px')}<b>${tt('ما لگيت نتيجة مباشرة', 'No direct match')}</b><p>${tt('اضغط إرسال وخلّي الذكاء الاصطناعي يجاوبك', 'Press send to ask the AI')}</p></div>`);
  if (r.isQuestion && !A.q) s.unshift(`<button class="btn btn-p btn-b" onclick="omniAsk()">${I('i-sparkle')}${tt('اسأل الذكاء الاصطناعي', 'Ask the AI')}</button>`);
  return s.join('');
}
let tmr;
export function afterSearch() {
  const i = document.getElementById('oq'); if (!i) return;
  if (!A.q && !Q) setTimeout(() => i.focus(), 60);
  i.oninput = () => { clearTimeout(tmr); tmr = setTimeout(() => { Q = i.value; R = Q.trim() ? parseQuery(Q) : null; const pos = i.selectionStart; window.render(); const n = document.getElementById('oq'); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} }, 160); };
}
async function run(q, follow = false) {
  if (!q || A.busy) return; addRecent(q);
  if (!follow) chat = [];
  A = { q, text: '', busy: true, err: '', tools: [], src: '' }; ctrl = new AbortController(); window.render();
  const TN = { find_players: tt('بحث اللاعبين', 'players'), player_detail: tt('تفاصيل لاعب', 'player'), my_team: tt('فريقك', 'your team'), my_season: tt('موسمك', 'season'), gameweek: tt('جولة', 'gameweek'), fixture_run: tt('المباريات', 'fixtures'), simulate_transfer: tt('محاكاة انتقال', 'transfer sim'), league_standings: tt('الدوري', 'league'), chips_and_calendar: tt('الأوراق', 'chips'), price_predictions: tt('توقع الأسعار', 'prices'), live_rank: tt('الترتيب المباشر', 'live rank') };
  try {
    const r = await askAI(q, { signal: ctrl.signal, history: chat, onTool: (n) => { if (!A.tools.includes(TN[n] || n)) { A.tools.push(TN[n] || n); if (ST.view === 'search') window.render(); } }, onText: (txt) => { A.text = txt; const b = document.getElementById('ansTxt'); if (b) b.innerHTML = md(txt); } });
    A.text = r.text || A.text; A.src = 'ai'; chat.push({ role: 'user', content: q }, { role: 'assistant', content: A.text });
  } catch (e) {
    if (e?.name !== 'AbortError') { A.text = localAnswer(q); A.src = 'local'; A.err = e?.code === 'rate_limited' ? tt('وصلت الحد المؤقت للأسئلة، هذا تحليل محلي لحد ما ترجع.', 'Rate limited — showing local analysis.') : e?.code === 'no_key' ? tt('الذكاء الاصطناعي ما مفعّل بالموقع بعد: يحتاج مفتاح ANTHROPIC_API_KEY بإعدادات Vercel. هذا تحليل محلي من بيانات التطبيق.', 'AI not configured: add ANTHROPIC_API_KEY in Vercel settings. Local analysis shown.') : e?.code === 'not_granted' ? tt('لازم توافق على استخدام الذكاء الاصطناعي حتى يجاوب. هذا تحليل محلي.', 'AI permission needed — local analysis shown.') : tt('الذكاء الاصطناعي غير متاح هسه، هذا تحليل محلي من بيانات التطبيق.', 'AI unavailable — local analysis shown.'); }
  }
  A.busy = false; if (ST.view === 'search') window.render();
}
Object.assign(window, {
  omniAsk: (q) => { q = (q ?? document.getElementById('oq')?.value ?? '').trim(); if (!q) return; Q = q; R = parseQuery(q); run(q); },
  omniFollow: (q) => run((q || '').trim(), true),
  omniSet: (q) => { Q = q; R = parseQuery(q); A = { q: '', text: '', busy: false, err: '', tools: [], src: '' }; window.render(); },
  omniClear: () => { Q = ''; R = null; A = { q: '', text: '', busy: false, err: '', tools: [], src: '' }; window.render(); },
  omniStop: () => { try { ctrl?.abort(); } catch {} A.busy = false; window.render(); },
  omniCopy: async () => { try { await navigator.clipboard.writeText(A.text); toast(tt('تم النسخ', 'Copied')); } catch { toast(tt('ما گدرت أنسخ', 'Copy failed')); } },
  goClub: (id) => { window.__clubFilter = id; window.go('players'); },
});
