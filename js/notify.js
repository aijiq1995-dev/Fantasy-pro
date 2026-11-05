/* مركز الإشعارات: يولّد التنبيهات من البيانات الحقيقية (بدون تنبيهات وهمية) */
import { ST, saveNotifs, PM, tName } from './store.js';
import { tt } from './i18n.js';

const PREF = { deadline: 'deadline', injury: 'injury', absent: 'injury', price: 'price', goal: 'goals', assist: 'goals', red: 'goals', start: 'start', league: 'league', transfer: 'price', admin: null };
export function pushNotif(n) {
  const pref = PREF[n.type];
  if (pref && ST.prefs[pref] === false) return;
  if (ST.notifs.some((x) => x.key === n.key)) return;
  ST.notifs.unshift({ ...n, t: Date.now(), read: false });
  saveNotifs();
  if (ST.prefs.browser && 'Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try { new Notification(n.title, { body: n.body || '', icon: '/assets/icon.svg', tag: n.key }); } catch {}
  }
  window.dispatchEvent(new Event('fp-notif'));
}
export const unreadCount = () => ST.notifs.filter((n) => !n.read).length;

export function scanStatic() {
  const { G, E, plan } = ST; if (!G || !E) return;
  // قرب إغلاق الجولة
  if (G.deadline) {
    const h = (new Date(G.deadline) - Date.now()) / 36e5;
    if (h > 0 && h <= 24) pushNotif({ key: `dl24_${G.next}`, type: 'deadline', title: tt(`باقي أقل من 24 ساعة على إغلاق الجولة ${G.next}`, `Less than 24h to GW${G.next} deadline`), body: tt('راجع تشكيلتك والكابتن', 'Check your lineup and captain'), icon: 'i-clock' });
    if (h > 0 && h <= 2) pushNotif({ key: `dl2_${G.next}`, type: 'deadline', title: tt(`باقي أقل من ساعتين على إغلاق الجولة ${G.next}!`, `Under 2 hours to GW${G.next} deadline!`), icon: 'i-clock' });
  }
  const squad = plan ? [...plan.xi, ...plan.bench] : [];
  squad.forEach((id) => {
    const p = PM(id); if (!p) return;
    if (p.st !== 'a') pushNotif({ key: `inj_${id}_${p.st}_${p.chance}`, type: p.st === 'i' || p.st === 's' || p.st === 'u' ? 'absent' : 'injury', title: tt(`${p.name}: ${p.st === 's' ? 'موقوف' : p.st === 'i' ? 'مصاب' : 'مشكوك بمشاركته'}`, `${p.name}: ${p.st === 's' ? 'suspended' : p.st === 'i' ? 'injured' : 'doubtful'}`), body: p.news, icon: 'i-alert', act: `openPlayer(${id})` });
    if (p.cc) pushNotif({ key: `pr_${id}_${G.cur}_${p.price}`, type: 'price', title: tt(`سعر ${p.name} ${p.cc > 0 ? 'صعد' : 'نزل'} إلى ${p.price.toFixed(1)}م`, `${p.name} price ${p.cc > 0 ? 'rose' : 'fell'} to £${p.price.toFixed(1)}m`), icon: 'i-coin', act: `openPlayer(${id})` });
  });
  [...ST.watch].forEach((id) => { const p = PM(id); if (p && p.cc && !squad.includes(id)) pushNotif({ key: `wpr_${id}_${G.cur}_${p.price}`, type: 'transfer', title: tt(`قائمة المراقبة: سعر ${p.name} ${p.cc > 0 ? 'صعد' : 'نزل'}`, `Watchlist: ${p.name} price ${p.cc > 0 ? 'rose' : 'fell'}`), body: `${p.price.toFixed(1)}م`, icon: 'i-eye', act: `openPlayer(${id})` }); });
  (E.entry.leagues?.classic || []).filter((l) => l.league_type === 'x' && l.entry_last_rank && l.entry_rank !== l.entry_last_rank).forEach((l) => pushNotif({ key: `lg_${l.id}_${G.cur}_${l.entry_rank}`, type: 'league', title: tt(`${l.name}: صرت بالمركز ${l.entry_rank}`, `${l.name}: you are now ${l.entry_rank}`), body: tt(`كنت ${l.entry_last_rank}`, `was ${l.entry_last_rank}`), icon: 'i-trophy', act: `go('leagues')` }));
  if (ST.broadcast?.text && (!ST.broadcast.until || ST.broadcast.until > Date.now())) pushNotif({ key: `bc_${ST.broadcast.updatedAt}`, type: 'admin', title: tt('رسالة من إدارة التطبيق', 'Message from admin'), body: ST.broadcast.text, icon: 'i-msg' });
}

/** يقارن لقطتين من البيانات المباشرة ويطلق تنبيهات الأهداف والصناعات والطرد وبداية المباريات */
export function scanLive(prev, next, fxPrev, fxNext) {
  if (!ST.plan) return;
  const squad = [...ST.plan.xi, ...ST.plan.bench];
  if (prev) squad.forEach((id) => {
    const a = prev[id] || {}, b = next[id] || {}, p = PM(id); if (!p) return;
    if ((b.goals_scored || 0) > (a.goals_scored || 0)) pushNotif({ key: `g_${id}_${ST.G.cur}_${b.goals_scored}`, type: 'goal', title: tt(`⚽ هدف! ${p.name}`, `⚽ Goal! ${p.name}`), body: tt(`${b.total_points} نقطة لحد هسه`, `${b.total_points} pts so far`), icon: 'i-fire', act: `go('live')` });
    if ((b.assists || 0) > (a.assists || 0)) pushNotif({ key: `a_${id}_${ST.G.cur}_${b.assists}`, type: 'assist', title: tt(`🅰️ صناعة: ${p.name}`, `🅰️ Assist: ${p.name}`), icon: 'i-star', act: `go('live')` });
    if ((b.red_cards || 0) > (a.red_cards || 0)) pushNotif({ key: `r_${id}_${ST.G.cur}`, type: 'red', title: tt(`🟥 طرد: ${p.name}`, `🟥 Red card: ${p.name}`), icon: 'i-alert', act: `go('live')` });
  });
  if (fxPrev && fxNext) {
    const teams = new Set(squad.map((id) => PM(id)?.team));
    fxNext.forEach((f) => { const o = fxPrev.find((x) => x.id === f.id); if (f.started && o && !o.started && (teams.has(f.h) || teams.has(f.a))) pushNotif({ key: `st_${f.id}`, type: 'start', title: tt(`بدأت مباراة ${tName(f.h)} × ${tName(f.a)}`, `Kick-off: ${tName(f.h)} v ${tName(f.a)}`), body: tt('بيها لاعبين من تشكيلتك', 'Your players are involved'), icon: 'i-live', act: `go('live')` }); });
  }
}
