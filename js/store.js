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
export const savePlan = () => ST.plan && LS.set(planKey(), ST.plan);
