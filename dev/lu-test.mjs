import handler from '../api/lineups.js';
const nrm = (x) => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ø/g, 'o').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z]/g, '');
const lastTok = (x) => nrm(String(x || '').trim().split(/\s+/).pop());
function loadLU(f, ev, force = false) {
  const c = LU[f.id]; if (c?.busy) return; if (!force && c && (c.d === null || !(f.started && !f.fin) || Date.now() - c.at < 55e3)) return;
  LU[f.id] = { ...(c || {}), busy: true };
  fetch(`/api/lineups?ko=${encodeURIComponent(f.ko)}&h=${tShort(f.h)}&a=${tShort(f.a)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
    LU[f.id] = { d: d?.sides && Object.keys(d.sides).length ? d : c?.d || null, at: Date.now() };
    const el = document.getElementById('mcBody'); if (el && el.dataset.fid == f.id) el.innerHTML = mcBody(f, ev);
  });
}
/** ربط لاعبي ESPN بلاعبي الفانتازي بالاسم */
function mapFPL(players, team) {
  const pool = PLAYERS.filter((p) => p.team === team), used = new Set(), out = {};
  const tests = [
    (e, p) => nrm(p.full) === nrm(e.name),
    (e, p) => nrm(p.name) === nrm(e.name) || nrm(p.name) === nrm(e.last) || nrm(p.name) === nrm(e.short),
    (e, p) => lastTok(p.full) === lastTok(e.name) && nrm(p.full)[0] === nrm(e.name)[0],
    (e, p) => nrm(e.name).endsWith(nrm(p.name)) && nrm(p.name).length >= 4,
    (e, p) => lastTok(p.full) === lastTok(e.name),
    (e, p) => nrm(e.name).includes(nrm(p.name)) && nrm(p.name).length >= 4,
  ];
  tests.forEach((t) => players.forEach((e) => { if (out[e.id]) return; const m = pool.filter((p) => !used.has(p.id) && t(e, p)); if (m.length === 1) { out[e.id] = m[0]; used.add(m[0].id); } }));
  return out;
}

const POS={1:'GK',2:'DEF',3:'MID',4:'FWD'};
const b=await (await fetch('https://fantasy.premierleague.com/api/bootstrap-static/',{headers:{'User-Agent':'Mozilla/5.0'}})).json();
const PLAYERS=b.elements.map(e=>({id:e.id,name:e.web_name,full:`${e.first_name} ${e.second_name}`,team:e.team,pos:POS[e.element_type]}));
const T=Object.fromEntries(b.teams.map(t=>[t.short_name,t.id]));
const fx=await (await fetch('https://fantasy.premierleague.com/api/fixtures/?event=10',{headers:{'User-Agent':'Mozilla/5.0'}})).json();
let miss=0,tot=0;
for (const f of fx) {
  const h=b.teams.find(t=>t.id===f.team_h).short_name,a=b.teams.find(t=>t.id===f.team_a).short_name;
  let out; const res={setHeader(){},end(x){out=x}}; await handler({url:`/api/lineups?ko=${f.kickoff_time}&h=${h}&a=${a}`},res);
  const d=JSON.parse(out); if(!d.sides){console.log(h,a,'->',res.statusCode,d.error);continue;}
  for (const [sd,team] of [['h',f.team_h],['a',f.team_a]]) { const S=d.sides[sd]; if(!S) continue; const M=mapFPL(S.players,team); const un=S.players.filter(p=>!M[p.id]); tot+=S.players.length; miss+=un.length; console.log(h,a,sd,S.formation,'players',S.players.length,'unmatched:',un.map(p=>p.name).join(', ')); }
  if (h==='LEE') console.log('JSONLEE'+out);
}
console.log('TOTAL',tot,'MISS',miss);
