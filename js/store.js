/* الحالة المشتركة بين كل الأقسام */
import { LS, clubName } from './ui.js';
export const ST = {
  user: null, profile: null, admin: false, G: null, E: null, plan: null, live: null, liveFx: null, view: 'home',
  watch: new Set(), notifs: [], prefs: { deadline: true, injury: true, price: true, goals: true, start: true, league: true, browser: false },
  broadcast: null, overrides: {}, scoring: null, season: null,
};
export const tShort = (id) => ST.G?.teams[id]?.short || '—';
export const tName = (id) => { const t = ST.G?.teams[id]; return t ? clubName(t.short, t.name) : '—'; };
export const PM = (id) => ST.G.PM[id];
const k = (s) => `fp_${s}_${ST.profile?.teamId || 0}`;
export function loadLocal() {
  ST.watch = new Set(ST.profile?.watchlist || LS.get(k('watch'), []));
  ST.notifs = LS.get(k('notifs'), []);
  ST.prefs = { ...ST.prefs, ...(ST.profile?.notif || LS.get('fp_prefs', {})) };
}
export const saveNotifs = () => LS.set(k('notifs'), ST.notifs.slice(0, 120));
export const saveWatchLocal = () => LS.set(k('watch'), [...ST.watch]);
export const planKey = () => `fp_plan_${ST.profile.teamId}_${ST.G.next}_${ST.E.gw}_${(ST.E.pending || []).map((t) => t.element_in).join('-')}`;
let planT = 0;
/** يحفظ الخطة محلياً + بحسابك (حتى تلگاها بأي جهاز) */
export const savePlan = () => {
  if (!ST.plan) return; ST.plan.at = Date.now(); const key = planKey(); LS.set(key, ST.plan);
  clearTimeout(planT); planT = setTimeout(() => { try { window.__saveProfile?.({ plan: { key, data: ST.plan } }); } catch {} }, 1200);
};

/** الترتيب العام الرسمي من الفانتازي (مو تقدير) + التغيير عن الجولة اللي قبلها */
export function officialRank() {
  const en = ST.E?.entry, hist = ST.E?.hist?.current || []; if (!en) return { rank: null, move: 0 };
  const rank = en.summary_overall_rank, curGw = en.current_event || ST.G?.cur;
  const prev = hist.filter((h) => h.event < curGw && h.overall_rank).slice(-1)[0];
  return { rank, move: prev && rank ? prev.overall_rank - rank : 0 };
}
