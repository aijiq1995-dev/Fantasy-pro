/* =========================================================
   /api/notify — محرك الإشعارات (يشتغل كل ~5 دقايق من GitHub Actions)
   يقارن بيانات الفانتازي بآخر لقطة محفوظة ويرسل لكل مشترك:
   • قرب الإغلاق (24 ساعة / ساعة وحدة)   • إصابة أو غياب لاعب من فريقه
   • تغيّر سعر لاعب عنده أو بقائمة مراقبته • توقع صعود/نزول السعر الليلة
   • هدف / صناعة / طرد للاعبينه مباشرة  • بداية مباريات لاعبينه
   • نهاية الجولة: نقاطه وترتيبه
   الطلب آمن للتكرار: كل تنبيه له مفتاح ما يتكرر، وفي قفل يمنع التشغيل المتزامن
========================================================= */
import { kv, getJ, setJ, kvEnabled, send } from './_kv.js';
import { sendPush } from './_webpush.js';

export const config = { maxDuration: 60 };
const BASE = 'https://fantasy.premierleague.com/api/';
const UA = 'Mozilla/5.0 (compatible; FantasyPro/2.0)';
const fpl = async (p) => { const r = await fetch(BASE + p, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); if (!r.ok) throw new Error(`fpl ${r.status} ${p}`); return r.json(); };
const ST_AR = { i: 'مصاب', s: 'موقوف', d: 'مشكوك بمشاركته', u: 'غير متاح', n: 'غير مؤهل' };

export default async function handler(req, res) {
  if (!kvEnabled) return send(res, 200, { ok: false, reason: 'no kv' });
  const u = new URL(req.url, 'http://x');
  const force = u.searchParams.get('force') === process.env.NOTIFY_KEY && !!process.env.NOTIFY_KEY;
  if (!force && !(await kv('SET', 'lock:notify', '1', 'NX', 'EX', 170))) return send(res, 200, { ok: true, skipped: 'locked' });
  const log = { users: 0, sent: 0, gone: 0, events: [] };
  try {
    const boot = await fpl('bootstrap-static/');
    const P = Object.fromEntries(boot.elements.map((e) => [e.id, e]));
    const T = Object.fromEntries(boot.teams.map((t) => [t.id, t.short_name]));
    const cur = boot.events.find((e) => e.is_current), next = boot.events.find((e) => e.is_next);
    const name = (id) => P[id]?.web_name || '#' + id;

    /* ---------- 1) تغيّرات اللاعبين (حالة + سعر) ---------- */
    const snapP = await getJ('snap:players');
    const nowP = Object.fromEntries(boot.elements.map((e) => [e.id, [e.status, e.chance_of_playing_next_round ?? 100, e.now_cost]]));
    const statusCh = new Map(), priceCh = new Map();
    if (snapP) for (const [id, v] of Object.entries(nowP)) {
      const o = snapP[id]; if (!o) continue;
      if ((v[0] !== o[0] || v[1] < o[1]) && v[0] !== 'a') statusCh.set(+id, v);
      if (v[0] === 'a' && o[0] !== 'a') statusCh.set(+id, v); // رجع جاهز
      if (v[2] !== o[2]) priceCh.set(+id, v[2] - o[2]);
    }
    await setJ('snap:players', nowP);
    log.events.push(`status:${statusCh.size} price:${priceCh.size}`);

    /* ---------- 2) المباشر: أهداف/صناعات/طرد + بداية المباريات ---------- */
    let liveEv = new Map(), kick = [], gwDone = false;
    if (cur) {
      const fx = await fpl(`fixtures/?event=${cur.id}`);
      const anyLive = fx.some((f) => f.started && !f.finished_provisional) || fx.some((f) => f.finished_provisional && !f.finished);
      const fxSnap = (await getJ('snap:fx:' + cur.id)) || null;
      const fxNow = Object.fromEntries(fx.map((f) => [f.id, f.started ? 1 : 0]));
      if (fxSnap) kick = fx.filter((f) => f.started && !fxSnap[f.id] && !f.finished_provisional);
      await setJ('snap:fx:' + cur.id, fxNow, 9 * 86400);
      if (anyLive || kick.length) {
        const live = await fpl(`event/${cur.id}/live/`);
        const snapL = await getJ('snap:live:' + cur.id);
        const nowL = {};
        for (const el of live.elements) { const s = el.stats; if (s.minutes || s.goals_scored || s.assists || s.red_cards) nowL[el.id] = [s.goals_scored, s.assists, s.red_cards, s.total_points]; }
        if (snapL) for (const [id, v] of Object.entries(nowL)) { const o = snapL[id] || [0, 0, 0, 0]; if (v[0] > o[0] || v[1] > o[1] || v[2] > o[2]) liveEv.set(+id, { g: v[0] - o[0], a: v[1] - o[1], r: v[2] - o[2], pts: v[3] }); }
        await setJ('snap:live:' + cur.id, nowL, 9 * 86400);
      }
      const wasDone = await kv('GET', 'snap:done:' + cur.id);
      gwDone = cur.finished && !wasDone;
      if (cur.finished) await kv('SET', 'snap:done:' + cur.id, '1', 'EX', 30 * 86400);
      log.events.push(`live:${liveEv.size} kick:${kick.length} done:${gwDone}`);
    }

    /* ---------- 3) توقع الأسعار الليلة (مرة باليوم، المسا) ---------- */
    const total = boot.total_players || 10e6;
    const hourUTC = new Date().getUTCHours();
    const predictTime = hourUTC >= 17 && hourUTC <= 22;
    const pred = new Map();
    if (predictTime) for (const e of boot.elements) {
      const owners = Math.max(1, (parseFloat(e.selected_by_percent) / 100) * total), net = (e.transfers_in_event || 0) - (e.transfers_out_event || 0);
      let thr = Math.max(15000, owners * 0.06); if (net < 0 && e.status !== 'a') thr *= 0.55; if (e.cost_change_event) thr *= 1.25;
      const prog = (net / thr) * 100; if (prog >= 95) pred.set(e.id, 1); else if (prog <= -95) pred.set(e.id, -1);
    }
    const day = new Date().toISOString().slice(0, 10);

    /* ---------- 4) لكل مستخدم ---------- */
    const uids = (await kv('SMEMBERS', 'push:users')) || [];
    const pickGW = cur?.id;
    for (const uid of uids) {
      const U = await getJ('push:' + uid); if (!U?.subs?.length || !U.teamId) continue;
      log.users++;
      const pref = U.prefs || {}, on = (k) => pref[k] !== false;
      // تشكيلة آخر جولة بدأت (الانتقالات الجديدة تبين بعد الإغلاق)
      let picks = [];
      if (pickGW) {
        const ck = `picks:${U.teamId}:${pickGW}`;
        picks = await getJ(ck);
        if (!picks) { try { const d = await fpl(`entry/${U.teamId}/event/${pickGW}/picks/`); picks = d.picks.map((p) => [p.element, p.multiplier]); await setJ(ck, picks, 3 * 86400); } catch { picks = []; } }
      }
      const squad = new Set(picks.map((p) => p[0])), mult = Object.fromEntries(picks), watch = new Set(U.watch || []);
      const msgs = [];
      // الإغلاق
      if (next && on('deadline')) {
        const h = (new Date(next.deadline_time) - Date.now()) / 36e5;
        if (h > 0 && h <= 24) msgs.push({ k: `dl24_${next.id}`, title: `⏰ باقي أقل من يوم على إغلاق الجولة ${next.id}`, body: 'راجع تشكيلتك والكابتن والانتقالات قبل الإغلاق.', url: '/#team' });
        if (h > 0 && h <= 1.25) msgs.push({ k: `dl1_${next.id}`, title: `🚨 باقي ساعة على إغلاق الجولة ${next.id}!`, body: 'آخر فرصة تثبت الكابتن والانتقالات.', url: '/#team', urg: 'high' });
      }
      // الإصابات
      if (on('injury')) for (const [id, v] of statusCh) if (squad.has(id)) {
        const back = v[0] === 'a';
        msgs.push({ k: `st_${id}_${v[0]}_${v[1]}`, title: back ? `✅ ${name(id)} رجع جاهز` : `🩹 ${name(id)}: ${ST_AR[v[0]] || 'تحديث'}${v[0] === 'd' ? ` (${v[1]}%)` : ''}`, body: back ? 'صار متاح للمشاركة.' : (P[id]?.news || ''), url: `/#players` });
      }
      // الأسعار
      if (on('price')) {
        for (const [id, d] of priceCh) if (squad.has(id) || watch.has(id)) msgs.push({ k: `pc_${id}_${nowP[id][2]}`, title: `${d > 0 ? '📈' : '📉'} سعر ${name(id)} ${d > 0 ? 'صعد' : 'نزل'} إلى ${(nowP[id][2] / 10).toFixed(1)}م`, body: watch.has(id) && !squad.has(id) ? 'من قائمة المراقبة' : 'لاعب من فريقك', url: '/#prices' });
        const mine = [...pred].filter(([id]) => squad.has(id) || watch.has(id));
        if (mine.length) {
          const up = mine.filter(([, s]) => s > 0).map(([id]) => name(id)), dn = mine.filter(([, s]) => s < 0).map(([id]) => name(id));
          msgs.push({ k: `pp_${day}`, title: '💰 توقع الأسعار الليلة', body: [up.length ? `يصعد: ${up.join('، ')}` : '', dn.length ? `ينزل: ${dn.join('، ')}` : ''].filter(Boolean).join(' · '), url: '/#prices' });
        }
      }
      // المباشر
      if (on('goals')) for (const [id, e] of liveEv) if (squad.has(id) && mult[id] > 0) {
        const cap = mult[id] >= 2 ? (mult[id] === 3 ? ' (تريبل كابتن ×3)' : ' (الكابتن ×2)') : '';
        if (e.g > 0) msgs.push({ k: `g_${pickGW}_${id}_${e.pts}_${e.g}`, title: `⚽ هدف! ${name(id)}${cap}`, body: `${e.pts * mult[id]} نقطة لحد هسة`, url: '/#live', urg: 'high' });
        else if (e.a > 0) msgs.push({ k: `a_${pickGW}_${id}_${e.pts}`, title: `🅰️ صناعة: ${name(id)}${cap}`, body: `${e.pts * mult[id]} نقطة لحد هسة`, url: '/#live', urg: 'high' });
        if (e.r > 0) msgs.push({ k: `r_${pickGW}_${id}`, title: `🟥 طرد: ${name(id)}`, body: 'خسارة نقاط للأسف', url: '/#live' });
      }
      if (on('start') && kick.length) {
        const games = kick.filter((f) => picks.some(([id, m]) => m > 0 && (P[id]?.team === f.team_h || P[id]?.team === f.team_a)));
        if (games.length) msgs.push({ k: `ko_${games.map((g) => g.id).join('_')}`, title: `▶️ بدأت: ${games.map((f) => `${T[f.team_h]}×${T[f.team_a]}`).join(' · ')}`, body: 'بيها لاعبين من تشكيلتك — تابع النقاط مباشرة.', url: '/#live' });
      }
      // نهاية الجولة
      if (gwDone && on('league')) {
        try { const h = await fpl(`entry/${U.teamId}/history/`); const g = h.current.find((x) => x.event === cur.id); if (g) msgs.push({ k: `done_${cur.id}`, title: `🏁 انتهت الجولة ${cur.id}: ${g.points} نقطة`, body: `ترتيبك العام ${Number(g.overall_rank).toLocaleString('en')} · المعدل ${cur.average_entry_score}`, url: '/#season' }); } catch {}
      }
      // الإرسال (بدون تكرار)
      for (const m of msgs.slice(0, 8)) {
        if (!(await kv('SET', `sent:${uid}:${m.k}`, '1', 'NX', 'EX', 14 * 86400))) continue;
        const gone = [];
        for (const s of U.subs) { try { const r = await sendPush(s, { title: m.title, body: m.body, url: m.url, tag: m.k }, { urgency: m.urg || 'normal' }); if (r.ok) log.sent++; if (r.gone) gone.push(s.endpoint); } catch {} }
        if (gone.length) { U.subs = U.subs.filter((s) => !gone.includes(s.endpoint)); log.gone += gone.length; await setJ('push:' + uid, U); if (!U.subs.length) { await kv('SREM', 'push:users', uid); break; } }
      }
    }
    await kv('SET', 'notify:last', JSON.stringify({ at: Date.now(), ...log }));
    return send(res, 200, { ok: true, ...log });
  } catch (e) {
    await kv('DEL', 'lock:notify').catch(() => {});
    return send(res, 500, { ok: false, error: e.message, ...log });
  }
}
