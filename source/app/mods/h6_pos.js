/* h6_pos.js: positional scarcity.
   Stats tab view  order 60, k 'pos': position cards, value curves by rank, replacement level, team x position heat map,
                   multi-position flexibility, the best free agent at each position.
   Drill  pos|POS          one position: ranked players, value over replacement, scarcity, best free agents, thin and deep teams.
          pos|POS|teamId   the same, opened on one team (the heat map cells use it).
   Registers only; every computation runs at render time, memoized per model state.
   Shared helpers on window.LAB: posModel() (the whole model), posRepl(POS) (replacement value), posVor(name) (value over
   replacement at the player's best position). */
(()=>{
const LAB=window.LAB=window.LAB||{};
const POS=['PG','SG','SF','PF','C'];
const PNAME={PG:'Point guards',SG:'Shooting guards',SF:'Small forwards',PF:'Power forwards',C:'Centers'};
const PONE={PG:'point guard',SG:'shooting guard',SF:'small forward',PF:'power forward',C:'center'};
// the league's daily lineup (the core's SLOTS/ELIG), with a fallback so a core change can't break this module
const SL=()=>typeof SLOTS!=='undefined'&&Array.isArray(SLOTS)?SLOTS:['PG','SG','SF','PF','C','G','F','UT','UT','UT','UT'];
const EL=()=>typeof ELIG!=='undefined'&&ELIG?ELIG:{PG:['PG','G','UT'],SG:['SG','G','UT'],SF:['SF','F','UT'],PF:['PF','F','UT'],C:['C','UT']};
const SLN=s=>s==='UT'?'UTIL':s;
const posOf=p=>String(p&&p.pos||'').split('/').filter(x=>POS.includes(x));
const elig=(p,x)=>posOf(p).includes(x);
// the daily spots a player can fill (indices into the 11 spots), the same rule as the core's lineup optimizer
const spotsOf=p=>{const s=new Set();String(p&&p.pos||'').split('/').forEach(x=>(EL()[x]||['UT']).forEach(y=>s.add(y)));return SL().map((sl,i)=>s.has(sl)?i:-1).filter(i=>i>=0)};
const spotTypes=p=>{const s=new Set();spotsOf(p).forEach(i=>s.add(SLN(SL()[i])));return [...s]};
// best-first lineup on a day when everyone plays: each player in priority order takes a spot, moving earlier players if needed
function lineup(ro){const n=SL().length,owner=new Array(n).fill(-1),el=ro.map(spotsOf),st=[];
  const tryP=(i,seen)=>{for(const s of el[i]){if(seen[s])continue;seen[s]=1;if(owner[s]<0||tryP(owner[s],seen)){owner[s]=i;return true}}return false};
  ro.forEach((p,i)=>{if(tryP(i,{}))st.push(p)});return st}
const V=v=>v==null||!isFinite(v)?'–':f1(v);
const pn=v=>v==null||!isFinite(v)||Math.abs(v)<1e-9?'mut':v>0?'pos':'neg';
const facts=a=>`<div class="facts">${a.join('')}</div>`;
const legend=items=>`<div class="legend">${items.map(([cls,l])=>`<span><i class="${cls}"></i>${l}</span>`).join('')}</div>`;
const tlink=(t,txt)=>`<button type="button" class="tlink" data-team="${t.id}">${txt??esc(t.name)}</button>`;
const plink=(p,txt)=>`<button type="button" class="plink" data-player="${esc(p.name)}">${txt??esc(p.name)}</button>`;
const abbr=p=>p.team?esc(teamById[p.team]?teamById[p.team].abbr:'?'):'FA';
const phone=()=>{try{return matchMedia('(max-width:560px)').matches}catch(e){return false}};
const per=()=>S.mode==='season'?'full season':'per game';
const list=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
const css=()=>addCSS('h6pos-css',`
.h6-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:10px}
.h6-card{display:flex;flex-direction:column;gap:7px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:12px 14px;background:var(--panel);cursor:pointer;font:inherit;color:inherit;min-width:0}
.h6-card:hover{background:var(--soft)}
.h6-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.h6-top b{font:700 1.7rem/1 var(--display);letter-spacing:.02em}
.h6-top .pill{margin:2px 0 0}
.h6-card .h6-n{color:var(--muted);font-size:.76rem;margin-top:-4px}
.h6-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:.8rem;min-width:0}
.h6-row span{color:var(--muted);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h6-row em{font:600 .86rem var(--mono);font-style:normal;white-space:nowrap}
.h6-fa span{white-space:normal}.h6-fa b{color:var(--ink);font-weight:600}
.h6-chart{max-width:760px}
.h6-meter{position:relative;height:6px;border-radius:3px;background:var(--soft);overflow:hidden}
.h6-meter i{position:absolute;top:0;bottom:0;left:0;background:var(--pos-3)}
.h6-meter i.short{background:var(--neg-3);left:auto;right:0}
.h6-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.chip.h6c[aria-pressed="true"]{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);text-decoration:none}
.h6-sum{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:.86rem;max-width:90ch}
.h6-sum li::marker{color:var(--muted)}
table.h6-hm td.z{min-width:4.2em}
tr.h6-cut td{padding:3px 9px;font:600 .68rem var(--body);letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--raise);text-align:left}
td.h6-name{white-space:normal;overflow-wrap:anywhere;min-width:9em;max-width:15em}
td.h6-name small{display:block;color:var(--muted);font-size:.74rem}
.h6-i{display:inline-block;min-width:1.9em;color:var(--muted);font:500 .74rem var(--mono)}
td.h6-name .h6-i+.plink{max-width:calc(100% - 2em)}
tr.h6-foc td:first-child{box-shadow:inset 3px 0 0 var(--accent)}
tr.h6-foc td{background:var(--raise)}
@media (max-width:560px){td.h6-name{min-width:7.5em;max-width:10.5em}}`);

/* ---------- the model: computed once per model state ---------- */
function model(){return memo('h6pos|model',()=>{
  const pool=M.all.filter(p=>p.value!=null&&isFinite(p.value)),byV=[...pool].sort((a,b)=>b.value-a.value);
  const perTeam=SL().length,nStart=perTeam*M.teams.length,lineP=byV[Math.min(nStart,byV.length)-1]||null,line=lineP?lineP.value:0;
  // every team's best lineup on a day when all of its healthy players have games
  const starters=[],startSet=new Set();
  M.teams.forEach(t=>{const ro=t.roster.filter(p=>p.pg&&p.value!=null&&p.inj!=='OUT').sort((a,b)=>(b.prio??-99)-(a.prio??-99));
    lineup(ro).forEach(p=>{starters.push(p);startSet.add(p.name)})});
  const P={};
  POS.forEach(x=>{const lst=byV.filter(p=>elig(p,x)),N=starters.filter(p=>elig(p,x)).length,ri=Math.max(0,Math.min(Math.max(N,1),lst.length)-1),rp=lst[ri]||null;
    const repl=rp?rp.value:line,fas=lst.filter(p=>!p.team),above=lst.filter(p=>p.value>=line).length;
    const rank=new Map(lst.map((p,i)=>[p.name,i+1]));
    P[x]={x,list:lst,N,ri,rp,repl,fas,bestFA:fas[0]||null,top:lst[0]||null,above,premium:line-repl,rank,
      rostered:lst.filter(p=>p.team).length,short:N-above}});
  const order=[...POS].sort((a,b)=>P[b].premium-P[a].premium||P[b].short-P[a].short);order.forEach((x,i)=>P[x].srank=i+1);
  // team strength at each position: value above the position's replacement level, summed over eligible players
  const T={};M.teams.forEach(t=>{const o={};POS.forEach(x=>{const el=t.roster.filter(p=>p.value!=null&&elig(p,x)).sort((a,b)=>b.value-a.value);
    o[x]={el,n:el.length,sur:el.reduce((s,p)=>s+Math.max(0,p.value-P[x].repl),0),nAbove:el.filter(p=>p.value>P[x].repl+1e-9).length,
      inLineup:el.filter(p=>startSet.has(p.name)).length,noData:t.roster.filter(p=>p.value==null&&elig(p,x)).length}});T[t.id]=o});
  POS.forEach(x=>{const arr=M.teams.map(t=>T[t.id][x].sur);M.teams.forEach(t=>{T[t.id][x].rank=rankIn(arr,T[t.id][x].sur)})});
  // category shape of each position: average per-game z of the players who start there, against the average starter
  const zAvg=arr=>{const o={};CATS.forEach(c=>{const v=arr.filter(p=>p.zpg&&p.zpg[c.k]!=null).map(p=>p.zpg[c.k]);o[c.k]=v.length?mean(v):0});return o};
  const top=byV.slice(0,nStart),base=zAvg(top);
  POS.forEach(x=>{const g=P[x].list.slice(0,Math.max(1,P[x].N)),z=zAvg(g);P[x].shape={};CATS.forEach(c=>P[x].shape[c.k]=z[c.k]-base[c.k])});
  const noData=M.all.filter(p=>p.value==null).length;
  return {pool,byV,nStart,perTeam,line,lineP,starters,startSet,P,T,order,noData}})}
// value over replacement at the player's best position (the one with the lowest replacement level)
function vorOf(p,m){m=m||model();const ps=posOf(p);if(p.value==null||!ps.length)return null;
  const best=ps.reduce((b,x)=>m.P[x].repl<m.P[b].repl?x:b,ps[0]);return {x:best,v:p.value-m.P[best].repl}}
// games that sat on a bench over the rest of the regular season: because no eligible spot was open (positions),
// or because more than 11 had games (the cap). From the core's day-by-day projection (real NBA schedule).
function benchSplit(){return memo('h6pos|bench',()=>{const cap=SL().length,o={},cw=Math.max(1,curWeek),ws=cw<=REGW?WEEKS.filter(w=>w<=REGW&&w>=cw):PO_WEEKS.filter(w=>w>=cw);
  M.teams.forEach(t=>{let pos=0,capL=0,days=0;ws.forEach(w=>projTeam(t.id,w,0).days.forEach(d=>{const lost=Math.max(0,Math.min(cap,d.playing)-d.started);pos+=lost;capL+=Math.max(0,d.playing-cap);days++}));
    o[t.id]={pos,cap:capL,days}});return {o,weeks:ws,po:cw>REGW}})}
LAB.posModel=model;
LAB.posRepl=x=>{const m=model(),k=String(x||'').toUpperCase();return m.P[k]?m.P[k].repl:null};
LAB.posVor=name=>{const p=findP(name);return p?vorOf(p):null};

const scarceTag=m=>x=>{const r=m.P[x].srank;return r===1?['Scarcest','n2']:r===2?['Scarce','n1']:r===5?['Deepest','p2']:r===4?['Deep','p1']:['Average','']};
// CH.line draws its own tooltips from the series name and x; point tooltips with player names are swapped in afterwards
function lineChart(series,o,tips){let h=CH.line(series,o);const n=(h.match(/<circle [^>]*data-tip="/g)||[]).length;
  if(tips&&n===tips.length){let i=0;h=h.replace(/(<circle [^>]*?)data-tip="[^"]*"/g,(_,a)=>`${a}data-tip="${esc(tips[i++])}"`)}return h}
const curvePts=(x,P,max)=>P.list.slice(0,max).map((p,i)=>[i+1,p.value,'pv|'+p.name]);
const curveTips=(x,P,max)=>P.list.slice(0,max).map((p,i)=>`${x} #${i+1}: ${p.name} (${p.team?(teamById[p.team]||{}).abbr||'?':'free agent'}) ${f1(p.value)}${i===P.ri?' · replacement level':''}`);

/* ---------- the Stats view ---------- */
function card(x,m){const P=m.P[x],[tg,cl]=scarceTag(m)(x),fa=P.bestFA,ok=Math.min(P.above,P.N),fr=P.N?ok/P.N:1;
  const tip=`${PNAME[x]}: ${P.N} of the league's ${m.nStart} starters can play ${x}; ${P.above} ${x}-eligible players are at or above the league's starter line (${V(m.line)}).`;
  return `<button type="button" class="h6-card" data-stat="${esc('pos|'+x)}" aria-label="${esc(PNAME[x]+' details')}">
    <span class="h6-top"><b>${x}</b><span class="pill ${cl}">${tg}</span></span><span class="h6-n">${PNAME[x]}</span>
    <span class="h6-row"><span>Replacement level</span><em>${V(P.repl)}</em></span>
    <span class="h6-meter" data-tip="${esc(tip)}"><i style="width:${(fr*100).toFixed(0)}%"></i>${P.short>0?`<i class="short" style="width:${(P.short/Math.max(P.N,1)*100).toFixed(0)}%"></i>`:''}</span>
    <span class="h6-row"><span>Above the line</span><em>${P.above} of ${P.N}</em></span>
    <span class="h6-row h6-fa"><span>Best FA <b>${fa?esc(fa.name):'none'}</b></span><em>${fa?V(fa.value):'–'}</em></span></button>`}

function vPos(){css();const m=model(),P=m.P,me=tm(ME),scarce=m.order[0],deep=m.order[POS.length-1],sp=P[scarce],dp=P[deep];
  const myT=m.T[ME],myBest=[...POS].sort((a,b)=>myT[a].rank-myT[b].rank||myT[b].sur-myT[a].sur)[0],myWorst=[...POS].sort((a,b)=>myT[b].rank-myT[a].rank||myT[a].sur-myT[b].sur)[0];
  const faBeats=x=>{const f=P[x].bestFA;return f?P[x].list.filter(p=>p.team&&p.value<f.value).length:0};
  const sum=[`<b>${scarce}</b> is the scarcest position: ${P[scarce].N} of the league's ${m.nStart} daily starters can play it, but only ${sp.above} ${scarce}-eligible players sit above the league's starter line, so replacement is ${V(sp.repl)} (${sp.rp?esc(sp.rp.name):'–'}).`,
    `<b>${deep}</b> runs deepest: ${dp.above} above the line for ${dp.N} spots${dp.bestFA?`, and the best free agent there, ${esc(dp.bestFA.name)} (${V(dp.bestFA.value)}), is better than ${plural(faBeats(deep),'rostered '+deep)}`:''}.`,
    `Your team is deepest at <b>${myBest}</b> (#${myT[myBest].rank} of 10) and thinnest at <b>${myWorst}</b> (#${myT[myWorst].rank}).`];
  let h=`<section class="panel">${head('Positions',`Where talent runs out. ${m.nStart} players start each day (11 per team), and this is how each position fills them. Tap any card or number for the details.`)}
    <div class="h6-cards">${POS.map(x=>card(x,m)).join('')}</div>
    <ul class="h6-sum">${sum.map(s=>`<li>${s}</li>`).join('')}</ul>
    ${legend([['pos','Spots filled by players above the line'],['neg','Spots the league fills from below it']])}</section>`;

  // value curves
  const def=[m.order[0],m.order[POS.length-1]];
  let sel=String(S_X('pos.cmp',def.join(','))).split(',').filter((x,i,a)=>POS.includes(x)&&a.indexOf(x)===i).slice(0,3);if(!sel.length)sel=def;
  const chip=x=>{const on=sel.includes(x);let nx=on?sel.filter(y=>y!==x):[...sel,x];if(nx.length>3)nx=nx.slice(1);if(!nx.length)nx=[x];
    return `<button type="button" class="chip h6c" data-set="pos.cmp=${nx.join(',')}" aria-pressed="${on}">${x}</button>`};
  const maxLen=Math.max(...sel.map(x=>P[x].list.length)),cls=['s1','s2','s3'];
  const series=sel.map((x,i)=>({name:PNAME[x],cls:cls[i],pts:curvePts(x,P[x])})),tips=sel.flatMap(x=>curveTips(x,P[x]));
  h+=`<section class="panel">${head('Value by rank within each position',`Each line ranks every player eligible at a position, rostered or free agent, by value (${per()}, your build). The dashed line is the league's starter line: the ${ord(m.nStart)}-best player overall (${m.lineP?esc(m.lineP.name):'–'}, ${V(m.line)}). The further right a line stays above it, the deeper the position. Tap a dot for that player's value.`)}
    <div class="h6-chips"><span class="lbl">Compare up to three</span>${POS.map(chip).join('')}</div>
    <div class="h6-chart">${lineChart(series,{h:phone()?330:230,ref:m.line,xl:x=>'#'+x,fmt:v=>String(Math.round(v*10)/10),label:'Value by rank within position'},tips)}</div>
    <p class="note">Across: rank within the position (#1 is the best there). Up: value. ${maxLen} players in the longest list.</p>
    <h3>Replacement level by position</h3>
    <div class="scroll"><table><thead><tr><th class="l stick" scope="col">Position</th><th scope="col" title="Starters in the league's best lineups who are eligible here">Start each day</th><th scope="col" title="Eligible players at or above the league's starter line">Above the line</th><th scope="col">Replacement</th><th class="l" scope="col">The replacement player</th><th scope="col" title="How far below the league's starter line the replacement sits; higher means scarcer">Scarcity</th><th class="l" scope="col">Best player</th></tr></thead><tbody>
    ${POS.map(x=>{const Q=P[x],[tg,cl]=scarceTag(m)(x);return `<tr><td class="l stick"><button type="button" class="sx" data-stat="${esc('pos|'+x)}"><b>${x}</b></button> <span class="pill ${cl}">${tg}</span></td>
      <td class="num" ${sx('pos|'+x)}>${Q.N}</td><td class="num ${Q.short>0?'down':'up'}" ${sx('pos|'+x)}>${Q.above}</td>
      <td class="num" ${Q.rp?sx('pv|'+Q.rp.name):''}><b>${V(Q.repl)}</b></td><td class="l">${Q.rp?`${plink(Q.rp)} <span class="rk" style="display:inline">${ord(Q.ri+1)} · ${abbr(Q.rp)}</span>`:'–'}</td>
      <td class="num" ${sx('pos|'+x)} data-tip="${esc(`${x} replacement ${V(Q.repl)} vs the starter line ${V(m.line)}`)}">${V(Q.premium)}</td>
      <td class="l">${Q.top?`${plink(Q.top)} <button type="button" class="sx" data-stat="${esc('pv|'+Q.top.name)}">${V(Q.top.value)}</button>`:'–'}</td></tr>`}).join('')}</tbody></table></div>
    ${how([`Each team starts 11 players a day: PG, SG, SF, PF, C, G (a PG or SG), F (an SF or PF) and four UTIL spots that take anyone. To count how many starters each position supplies, the board fills every team's lineup for a day when all of its players have games, best first by value across all nine categories (the same order the matchup projections use), with players listed out set aside. A player eligible at two positions counts toward both, the same way the position filters elsewhere on the board work.`,
      `Replacement level is the value of the Nth-best player eligible at the position, rostered or free agent, where N is how many of the league's ${m.nStart} starters are eligible there. The starter line is the ${ord(m.nStart)}-best player overall. Scarcity is how far a position's replacement sits below that line: the league has to dig that much deeper to fill it. It is a property of how this league's rosters are built, not a fixed rule of fantasy basketball.`,
      `Value is the board's usual number: z-scores summed over the categories you haven't punted, ${S.mode==='season'?'scaled by projected games (season mode)':'per game'}. Free agents use their 2025-26 stats.${m.noData?` ${plural(m.noData,'player')} with no stats are left out.`:''}`])}</section>`;

  // team x position heat map
  const ts=[...M.teams].sort((a,b)=>a.pr-b.pr);
  h+=`<section class="panel">${head('Team strength by position',`Value above each position's replacement level, added up over the players eligible there. Green is deep, red is thin; the small number is the league rank. Tap a cell for that team at that position.`)}
    <div class="scroll"><table class="h6-hm"><thead><tr><th class="l stick" scope="col">Team</th>${POS.map(x=>`<th scope="col"><button type="button" class="sx" data-stat="${esc('pos|'+x)}">${x}</button></th>`).join('')}<th class="l" scope="col" title="Positions where the team ranks in the top three">Deep at</th><th class="l" scope="col" title="Positions where the team ranks 8th or worse">Thin at</th></tr></thead><tbody>
    ${ts.map(t=>{const o=m.T[t.id],deepA=POS.filter(x=>o[x].rank<=3),thinA=POS.filter(x=>o[x].rank>=8);
      return `<tr class="${t.id===ME?'me':''}"><td class="l stick tname">${tlink(t)}<small>${esc(t.mgr)}</small></td>${POS.map(x=>{const c=o[x];
        return `<td class="z ${rc(c.rank)}" ${sx('pos|'+x+'|'+t.id)} data-tip="${esc(`${t.name} at ${x}: ${plural(c.n,'eligible player')}, ${c.nAbove} above replacement, ${V(c.sur)} above replacement in all. #${c.rank} of 10.`)}">${c.sur.toFixed(1)}<span class="rk">#${c.rank}</span></td>`}).join('')}
        <td class="l">${deepA.join(', ')||'–'}</td><td class="l">${thinA.join(', ')||'–'}</td></tr>`}).join('')}</tbody></table></div>
    <p class="note">You: deepest at ${myBest} (#${myT[myBest].rank}), thinnest at ${myWorst} (#${myT[myWorst].rank}). ${(()=>{const thin=ts.filter(t=>t.id!==ME&&m.T[t.id][myBest].rank>=8);return thin.length?`Teams thin where you are deep, so likely trade partners at ${myBest}: ${list(thin.map(t=>tlink(t)))}.`:''})()}</p>
    ${how(['A cell adds up how far each of the team\'s eligible players sits above the position\'s replacement level. Players at or below replacement add nothing, because a team could find someone as good on waivers or at the end of another bench. A player with two positions counts in both columns, so the columns are not meant to be added across.','Ranks run 1 (deepest) to 10 (thinnest). Thin is not the same as weak: a team can be thin at a position and still be strong overall, but it has less to spare there and more to gain from a trade.'])}</section>`;

  // flexibility
  const combos=new Map();m.pool.forEach(p=>{const k=posOf(p).join('/')||String(p.pos||'?');if(!combos.has(k))combos.set(k,[]);combos.get(k).push(p)});
  const crow=[...combos.entries()].map(([k,ps])=>({k,ps,spots:spotsOf(ps[0]).length,types:spotTypes(ps[0]),ro:ps.filter(p=>p.team).length,fa:ps.filter(p=>!p.team).length,best:[...ps].sort((a,b)=>b.value-a.value)[0]}))
    .sort((a,b)=>b.spots-a.spots||b.ps.length-a.ps.length);
  const B=benchSplit(),bt=ts.map(t=>({t,b:B.o[t.id],multi:t.roster.filter(p=>posOf(p).length>1).length,cOnly:t.roster.filter(p=>posOf(p).join('/')==='C').length,avgS:mean(t.roster.map(p=>spotsOf(p).length))}));
  const totPos=bt.reduce((s,x)=>s+x.b.pos,0),totCap=bt.reduce((s,x)=>s+x.b.cap,0);
  const flexTop=m.pool.filter(p=>spotsOf(p).length>=8).sort((a,b)=>b.value-a.value).slice(0,6);
  h+=`<section class="panel">${head('Multi-position flexibility',`Who fills the most of the ${m.perTeam} daily spots, and what positions actually cost each team.`)}
    <div class="scroll"><table><thead><tr><th class="l stick" scope="col">Eligible at</th><th scope="col">Daily spots</th><th class="l" scope="col">Which spots</th><th scope="col">Rostered</th><th scope="col">Free agents</th><th class="l" scope="col">Best of them</th></tr></thead><tbody>
    ${crow.map(r=>`<tr><td class="l stick"><b>${esc(r.k)}</b></td><td class="num"><b>${r.spots}</b> of ${m.perTeam}</td><td class="l">${r.types.join(', ')}</td><td class="num">${r.ro}</td><td class="num">${r.fa}</td><td class="l">${r.best?`${plink(r.best)} <button type="button" class="sx" data-stat="${esc('pv|'+r.best.name)}">${V(r.best.value)}</button>`:'–'}</td></tr>`).join('')}</tbody></table></div>
    ${flexTop.length?`<p class="note">Most flexible players worth knowing (8 of ${m.perTeam} spots): ${flexTop.map(p=>`${sbtn('pv|'+p.name,esc(p.name))} (${p.pos}, ${abbr(p)}, ${V(p.value)})`).join(', ')}.</p>`:''}
    <h3>What positions cost each team</h3>
    <p class="note">Over ${B.po?'the playoff weeks left':'the rest of the regular season'} (${plural(B.weeks.length,'week')}), on the real NBA schedule: games that sat only because no eligible spot was open, against games that sat because more than ${m.perTeam} players had games. League-wide, positions cost <b>${totPos}</b> player-game${totPos===1?'':'s'}; the ${m.perTeam}-starter cap costs <b>${totCap}</b>. ${totPos<=totCap/10?'In this league, games and value matter far more than position eligibility.':'Position balance matters here: some rosters leave real games on the bench.'}</p>
    <div class="scroll"><table><thead><tr><th class="l stick" scope="col">Team</th><th scope="col" title="Games benched because no eligible spot was open">Lost to positions</th><th scope="col" title="Games benched because more than 11 players had games">Lost to the cap</th><th scope="col">Two-position players</th><th scope="col">Pure centers</th><th scope="col" title="Average number of the 11 daily spots each rostered player can fill">Spots per player</th></tr></thead><tbody>
    ${bt.map(x=>`<tr class="${x.t.id===ME?'me':''}"><td class="l stick tname">${tlink(x.t)}</td><td class="num ${x.b.pos>0?'warnc':''}" ${sx('tgm|'+x.t.id)}><b>${x.b.pos}</b></td><td class="num" ${sx('tgm|'+x.t.id)}>${x.b.cap}</td><td class="num">${x.multi} of ${x.t.roster.length}</td><td class="num">${x.cOnly}</td><td class="num">${x.avgS.toFixed(1)}</td></tr>`).join('')}</tbody></table></div>
    ${how([`Daily spots: a PG or SG also fits G, an SF or PF also fits F, and everyone fits the four UTIL spots. So a pure center can fill ${spotsOf({pos:'C'}).length} of the ${m.perTeam} spots, a single-position guard or forward ${spotsOf({pos:'PG'}).length}, and an SG/SF or PG/PF ${spotsOf({pos:'SG/SF'}).length}.`,
      `The lost-games columns replay each remaining day with the board's lineup logic (best players first, real NBA games, expected rest and injuries). A game lost to positions is one where fewer than ${m.perTeam} players had games but a player still sat because every spot they fit was taken. Everything else on the bench is the cap. The numbers are whole expected games, so small differences are noise.`])}</section>`;

  // best free agent at each position
  const mine=me.roster;
  h+=`<section class="panel">${head('Best free agent at each position',`The top unrostered player eligible at each spot, measured against replacement level and against your weakest player there.`,`<button type="button" class="btn ghost" data-go="waivers" data-wmode="ros">Waivers</button>`)}
    <div class="scroll"><table><thead><tr><th class="l stick" scope="col">Pos</th><th class="l" scope="col">Best free agent</th><th scope="col">Value</th><th scope="col" title="Value minus the position's replacement level">Vs replacement</th><th scope="col" title="Rostered players eligible here with lower value">Beats</th><th class="l" scope="col">Your weakest there</th><th scope="col" title="The free agent's value minus your weakest eligible player's value">Swap gain</th></tr></thead><tbody>
    ${POS.map(x=>{const Q=P[x],f=Q.bestFA,w=mine.filter(p=>p.value!=null&&elig(p,x)).sort((a,b)=>a.value-b.value)[0]||null,g=f&&w?f.value-w.value:null,beats=f?Q.list.filter(p=>p.team&&p.value<f.value).length:0;
      return `<tr><td class="l stick"><button type="button" class="sx" data-stat="${esc('pos|'+x)}"><b>${x}</b></button></td>
      <td class="l h6-name">${f?`${plink(f)}${pills(f)}<small>${f.nba==='?'?'Unsigned':esc(f.nba)} · ${f.pos}</small>`:'<span class="note">None with stats</span>'}</td>
      <td class="num" ${f?sx('pv|'+f.name):''}><b>${f?V(f.value):'–'}</b></td><td class="num ${f&&f.value>=Q.repl?'up':'down'}" ${f?sx('pos|'+x):''}>${f?V(f.value-Q.repl):'–'}</td>
      <td class="num" ${sx('pos|'+x)}>${f?`${beats} of ${Q.rostered}`:'–'}</td>
      <td class="l h6-name">${w?`${plink(w)}<small>${w.pos} · ${V(w.value)}</small>`:'<span class="note">None</span>'}</td>
      <td class="num ${g==null?'':g>0?'up':'down'}" ${sx('pos|'+x+'|'+ME)}><b>${V(g)}</b></td></tr>`}).join('')}</tbody></table></div>
    ${how(['Free agents use their 2025-26 per-game stats; rostered players use ESPN\'s 2026-27 projection, with the season so far blended in once games start. Swap gain compares values only. The Waivers tab runs a real swap through your schedule, opponents and daily lineup, which is the better guide before you make a move.'])}</section>`;
  return h}

/* ---------- the drill: one position ---------- */
function teamFocus(t,x,m){const P=m.P[x],c=m.T[t.id][x],mine=t.id===ME;
  const others=M.teams.filter(o=>o.id!==t.id).sort((a,b)=>m.T[b.id][x].sur-m.T[a.id][x].sur);
  const weakest=[...c.el].sort((a,b)=>a.value-b.value)[0]||null,fa=P.bestFA,gain=fa&&weakest?fa.value-weakest.value:null;
  // trade targets: above-replacement players at this position on the deepest other teams, skipping each team's best one there
  const targets=others.slice(0,4).flatMap(o=>m.T[o.id][x].el.slice(1).filter(p=>p.value>P.repl).map(p=>({p,o})))
    .sort((a,b)=>b.p.value-a.p.value).slice(0,4);
  let h=facts([fact(`${mine?'Your':'Their'} rank at ${x}`,`#${c.rank}`,`of 10 · ${V(c.sur)} above replacement`),
    fact('Eligible players',c.n,`${c.nAbove} above replacement${c.noData?` · ${c.noData} with no stats`:''}`),
    fact('In the full-slate lineup',c.inLineup,`of their ${m.perTeam} starters can play ${x}`),
    weakest?fact(`Weakest ${x}`,V(weakest.value),esc(weakest.name),'pv|'+weakest.name):fact(`Weakest ${x}`,'–','no eligible players')]);
  h+=c.el.length?CH.hbars(c.el.map(p=>{const v=p.value-P.repl;return {label:`${esc(p.name)}<small>${p.pos}</small>`,v,txt:V(v),cls:pn(v),stat:'pv|'+p.name,
      tip:`${p.name}: value ${V(p.value)}, ${V(v)} against ${x} replacement (${V(P.repl)}). #${P.rank.get(p.name)} of ${P.list.length} at ${x}.`}}),{center:true,stack:true,label:`${t.name} at ${x}, value over replacement`})
    +legend([['pos','Above replacement'],['neg','At or below it']])
    :`<div class="empty">${esc(t.name)} has no ${x}-eligible players with stats.</div>`;
  const moves=[];
  if(fa&&weakest&&gain>0)moves.push(`Swap ${plink(weakest)} (${V(weakest.value)}) for the best free-agent ${x}, ${plink(fa)} (${V(fa.value)}): ${sbtn('pv|'+fa.name,V(gain))} value.`);
  else if(fa&&weakest)moves.push(`No free agent at ${x} beats ${mine?'your':'their'} weakest ${x}; the best one, ${plink(fa)}, is ${V(fa.value)}.`);
  if(targets.length)moves.push(`Spare ${x}s on the deepest teams (not their best one there): ${targets.map(({p,o})=>`${sbtn('ptv|'+p.name,esc(p.name))} (${esc(o.abbr)}, ${V(p.value)})`).join(', ')}.`);
  if(moves.length)h+=`<ul class="h6-sum">${moves.map(s=>`<li>${s}</li>`).join('')}</ul>`;
  return drillSec(`${esc(t.name)} at ${x}`,`Each bar is one eligible player's value minus the ${x} replacement level (${V(P.repl)}). Tap a bar for the player's value breakdown.`,h)}

DRILL.pos=(X,tid)=>{const x=String(X||'').trim().toUpperCase();if(!POS.includes(x))return null;css();
  const m=model(),P=m.P[x],t=tid!=null&&String(tid).trim()!==''?tm(parseInt(tid,10)):null;
  if(tid!=null&&String(tid).trim()!==''&&!t)return null;
  const me=tm(ME),myC=m.T[ME][x],[tg,cl]=scarceTag(m)(x),lst=P.list;
  let h='';
  if(t)h+=teamFocus(t,x,m);
  h+=facts([fact('Start each day',P.N,`of ${m.nStart} league-wide starters can play ${x}`),
    fact('Above the starter line',P.above,P.short>0?`${P.short} short of the ${P.N} spots`:`${-P.short} to spare for ${P.N} spots`),
    P.rp?fact('Replacement level',V(P.repl),`${esc(P.rp.name)}, ${ord(P.ri+1)} at ${x}`,'pv|'+P.rp.name):fact('Replacement level','–',''),
    fact('Scarcity',`<span class="pill ${cl}" style="margin:0;font-size:.8rem">${tg}</span>`,`${V(P.premium)} vs the starter line (${V(m.line)})`),
    P.bestFA?fact('Best free agent',V(P.bestFA.value),esc(P.bestFA.name),'pv|'+P.bestFA.name):fact('Best free agent','–','none with stats'),
    t&&t.id===ME?'':fact(`Your rank at ${x}`,`#${myC.rank}`,`${V(myC.sur)} above replacement`,`pos|${x}|${ME}`)]);
  // value curve against the other positions at the same rank
  const otherAvg=lst.map((_,i)=>{const v=POS.filter(y=>y!==x&&m.P[y].list[i]).map(y=>m.P[y].list[i].value);return v.length?mean(v):null});
  const s2=otherAvg.map((v,i)=>v==null?null:[i+1,v]).filter(Boolean);
  const tips=[...curveTips(x,P),...s2.map(([r,v])=>`Other positions, #${r} on average: ${f1(v)}`)];
  h+=drillSec('Value by rank',`Every ${x}-eligible player, best first, against the average of the other four positions at the same rank. The dashed line is ${x} replacement level (${V(P.repl)}).`,
    lineChart([{name:PNAME[x],cls:'s1',pts:curvePts(x,P)},{name:'Other positions (average)',cls:'s2',pts:s2}],{h:phone()?300:200,ref:P.repl,xl:r=>'#'+r,fmt:v=>String(Math.round(v*10)/10),label:`${PNAME[x]} value by rank`},tips));
  // what the position brings
  const shape=CATS.map(c=>({c,v:P.shape[c.k]}));
  const plus=shape.filter(s=>s.v>=.15).sort((a,b)=>b.v-a.v).map(s=>s.c.l),minus=shape.filter(s=>s.v<=-.15).sort((a,b)=>a.v-b.v).map(s=>s.c.l);
  h+=drillSec('What this position brings',`The ${P.N} best ${x}-eligible players (the league's starting share) against the average starter, per game, in z-scores. ${plus.length?`They add ${list(plus)}`:'They add nothing special'}${minus.length?`; they cost ${list(minus)}`:''}. Tap a category for the league picture.`,
    CH.hbars(shape.map(s=>({label:s.c.l,v:s.v,txt:f2(s.v),cls:S.punt.has(s.c.k)?'mut':pn(s.v),stat:'lc|'+s.c.k,
      tip:`${s.c.n}: ${x} starters average ${f2(s.v)} z against the average starter${s.c.neg?' (fewer turnovers is better, so plus means fewer)':''}${S.punt.has(s.c.k)?'. You punt this one.':''}`})),{center:true,label:`${x} category shape`})
    +legend([['pos','Better than the average starter'],['neg','Worse'],...(S.punt.size?[['mut','Punted']]:[])]));
  // ranked list
  const cutAt=P.ri;
  h+=drillSec(`Every ${PONE[x]}, ranked`,`${lst.length} eligible: ${P.rostered} rostered, ${lst.length-P.rostered} free agents. Over repl. is value minus replacement (${V(P.repl)}). Your players are highlighted.`,
    `<div class="scroll tall"><table><thead><tr><th class="l stick" scope="col">Player</th><th class="l" scope="col">Team</th><th scope="col">Value</th><th scope="col">Over repl.</th><th scope="col">Trade value</th><th scope="col" title="Daily spots this player can fill">Spots</th></tr></thead><tbody>
    ${lst.map((p,i)=>`${i===cutAt+1?`<tr class="h6-cut"><td colspan="6">Replacement level: ${V(P.repl)} · the ${P.N} who would start are above</td></tr>`:''}<tr class="${p.team===ME?'me':''} ${t&&p.team===t.id&&t.id!==ME?'h6-foc':''}">
      <td class="l stick h6-name"><span class="h6-i">${i+1}</span>${plink(p)}${pills(p)}<small>${p.nba==='?'?'Unsigned':esc(p.nba)} · ${p.pos}</small></td>
      <td class="l">${p.team&&teamById[p.team]?`<button type="button" class="tlink" data-team="${p.team}">${abbr(p)}</button>`:'FA'}</td>
      <td class="num" ${sx('pv|'+p.name)}><b>${V(p.value)}</b></td><td class="num ${p.value-P.repl>0?'up':p.value-P.repl<0?'down':''}" ${sx('pv|'+p.name)}>${V(p.value-P.repl)}</td>
      <td class="num" ${sx('ptv|'+p.name)}>${p.tv!=null?p.tv.toFixed(0):'–'}</td><td class="num">${spotsOf(p).length}</td></tr>`).join('')}</tbody></table></div>`);
  // free agents
  const fas=P.fas.slice(0,5),myW=me.roster.filter(p=>p.value!=null&&elig(p,x)).sort((a,b)=>a.value-b.value)[0]||null;
  h+=drillSec(`Best free agents at ${x}`,fas.length?`Each free agent's value against ${x} replacement. ${myW?`Your weakest ${x} is ${plink(myW)} (${V(myW.value)}).`:`You have no ${x}-eligible players.`}`:'',
    fas.length?CH.hbars(fas.map(p=>{const v=p.value-P.repl,beats=lst.filter(q=>q.team&&q.value<p.value).length;return {label:`${esc(p.name)}<small>${p.pos}</small>`,v,txt:V(v),cls:pn(v),stat:'pv|'+p.name,
      tip:`${p.name}: value ${V(p.value)}, better than ${beats} of ${P.rostered} rostered ${x}s${myW?`; ${V(p.value-myW.value)} against your ${myW.name}`:''}`}}),{center:true,stack:true,label:`Best free agents at ${x}`})
      :`<div class="empty">No free agent eligible at ${x} has stats right now.</div>`);
  // teams
  const ts=[...M.teams].sort((a,b)=>m.T[b.id][x].sur-m.T[a.id][x].sur),thin=ts.slice(-3).reverse(),deepT=ts[0];
  h+=drillSec('Deep and thin teams',`Value above ${x} replacement, added up over each team's eligible players. Thinnest: ${list(thin.map(o=>`${tlink(o)} (${V(m.T[o.id][x].sur)}, ${plural(m.T[o.id][x].nAbove,'player')} above)`))}. Deepest: ${tlink(deepT)}. Tap a team for its ${x} group.`,
    CH.hbars(ts.map(o=>{const c=m.T[o.id][x];return {label:`${esc(o.name)}<small>${c.n} eligible</small>`,v:c.sur,txt:c.sur.toFixed(1),hi:t&&o.id===t.id,me:o.id===ME&&!(t&&o.id===t.id),stat:`pos|${x}|${o.id}`,
      tip:`${o.name}: ${plural(c.n,'eligible player')}, ${c.nAbove} above replacement, ${V(c.sur)} in all, #${c.rank} of 10`}}),{stack:true,label:`Teams at ${x}`})
    +legend([...(t?[['hi',esc(t.abbr)]]:[]),...(!t||t.id!==ME?[['me','Your team']]:[]),['mut','Other teams']]));
  h+=how([`Replacement level is the value of the ${ord(Math.max(1,P.N))}-best ${x}-eligible player, rostered or free agent, because ${P.N} of the league's ${m.nStart} daily starters can play ${x}. That count comes from filling every team's lineup (PG, SG, SF, PF, C, G, F and four UTIL) for a day when all of its healthy players have games, best players first. Multi-position players count at every position they can play.`,
    `The starter line is the ${ord(m.nStart)}-best player overall (${V(m.line)}). A position whose replacement sits below it is scarce: the league has to dig deeper there than anywhere else. Values follow your build (${S.punt.size?'punts left out, ':''}${per()}); free agents use their 2025-26 stats, so their numbers are a little less certain.`]);
  return {eyebrow:`Position · ${x}${t?' · '+esc(t.name):''}`,title:PNAME[x],back:x+(t?' · '+t.abbr:''),
    sub:`${P.rostered} rostered and ${lst.length-P.rostered} free agents eligible. Replacement level ${V(P.repl)}; ${tg.toLowerCase()} of the five positions.`,html:h}};

/* ---------- registration ---------- */
HUB.push({k:'pos',label:'Positions',order:60,note:'Positional scarcity: how deep each position runs, where replacement level sits, and which teams are thin where.',render:vPos});
CMDS.push({label:'Positional scarcity',sub:'Stats lab: replacement level, value curves and team strength by position',kw:'positions position scarcity replacement depth thin guard forward center',tag:'Stats',act:()=>go('stats',{hub:'pos'})});
POS.forEach(x=>CMDS.push({label:`${PNAME[x]} (${x})`,sub:'Ranked by value, replacement level, best free agents, thin teams',kw:`${x} position ${PONE[x]} scarcity`,tag:'Drill',act:()=>openStat('pos|'+x)}));
CMDS.push({label:'My team by position',sub:'Where your roster is deep or thin',kw:'my team position depth thin weakest position',tag:'Drill',act:()=>{const m=model(),o=m.T[ME],x=[...POS].sort((a,b)=>o[b].rank-o[a].rank)[0];openStat('pos|'+x+'|'+ME)}});
})();
