/* h3_teams.js: the Teams view in the Stats tab (HUB k 'teams', order 30) and a "Team DNA" panel on every team page (PANELS.team).
   Teams view: radar comparison of up to three teams (selects teams.a/b/c), team x category rank heat map, team archetypes,
   stars vs depth, position balance, injuries and games outlook. Registers only; everything is computed at render time.
   Shared helpers on window.LAB: teamDNA(id) -> {pct,s,rank,arch,built,punt,weak,core,twin,top3,...}, teamDNAAll(). */
(()=>{
const LAB=window.LAB=window.LAB||{};
S.sort.h3heat=S.sort.h3heat||['pr','asc'];

/* ---------- small helpers ---------- */
const SEA=()=>S.mode==='season';
const per=()=>SEA()?'over the season':'a game';
const fv=(c,v)=>v==null||!isFinite(v)?'–':c.pct?f3(v):v.toFixed(SEA()?0:1);
const TM=id=>{const n=parseInt(id,10);return Number.isFinite(n)?(tm(n)||null):null};
const byPr=()=>[...M.teams].sort((a,b)=>a.pr-b.pr);
const lst=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const tlink=t=>`<button type="button" class="tlink" data-team="${t.id}">${esc(t.name)}</button>`;
const nm=t=>`<span class="h3-full">${esc(t.name)}</span><span class="h3-short">${esc(t.abbr)}</span>`;
const neu=c=>c||'h3-n';
const fd=x=>Math.abs(x)<.05?'0.0':f1(x);
const safe=(f,title)=>{try{return f()}catch(e){console.error('h3_teams',title,e);return `<section class="panel">${head(title,'')}<div class="empty">This section hit an error.</div></section>`}};
const thisWeek=()=>Math.min(curWeek,REGW);
const oppNow=id=>curWeek<=REGW?oppOf(id,thisWeek()):null;
function css(){addCSS('h3teams-css',`
.h3-radar{max-width:430px;margin:0 auto;width:100%}
.ch g.h3-ax{cursor:pointer}
.ch g.h3-ax rect{fill:var(--panel);fill-opacity:0;stroke:none}
.ch g.h3-ax:hover{stroke:none}
.ch g.h3-ax:hover rect{stroke:var(--accent);stroke-width:1}
.ch g.h3-ax:hover text{fill:var(--accent)}
.legend i.h3-md{background:none;border:1.5px dashed var(--muted);border-radius:50%}
.h3-sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;flex:none}
.h3-sw.s1{background:var(--s1)}.h3-sw.s2{background:var(--s2)}.h3-sw.s3{background:var(--s3)}
.h3-pick{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.h3-pick label{display:inline-flex;align-items:center;min-width:0;max-width:100%}
.h3-pick select{max-width:min(100%,16em)}
td.h3-me{background:var(--me)}
.h3-short{display:none}
@media (max-width:560px){.h3-full{display:none}.h3-short{display:inline}}
.h3-n{background:var(--soft)}
.h3-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:10px}
.h3-card{gap:8px}
.h3-card p{margin:0}
.h3-ch{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 8px}
.h3-ch .pill{margin:0}
.h3-strip{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:3px}
.h3-strip button{border:0;border-radius:6px;padding:5px 0;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;font:inherit;min-width:0}
.h3-strip span{font:600 .6rem var(--body);letter-spacing:.02em}
.h3-strip b{font:700 1rem/1 var(--display)}
.h3-stk i.t3{background:var(--s1);opacity:.9;border-radius:0}
.h3-stk i.dp{background:var(--s3);opacity:.8}
.h3-heat td{white-space:nowrap}
.h3-heat td[data-stat]{cursor:pointer}
.h3-inj td.l{white-space:normal;min-width:12em}
.h3-inj .plist{display:flex;flex-wrap:wrap;gap:4px 10px;max-height:none;overflow:visible;padding:0}
.h3-words{display:flex;flex-direction:column;gap:12px;min-width:0}
.hm td.l,.hm th.l{text-align:left}
.h3-inj .plist>span{white-space:nowrap}
.h3-cmpt th,.h3-cmpt td{padding:6px 7px}
@media (min-width:561px){.h3-stk .hb-r{grid-template-columns:minmax(0,15em) minmax(0,1fr) 4.6em}}
`)}

/* ---------- the DNA of every team: category percentiles, shape, archetype ---------- */
// six common builds as category weights (positive = strong there); a team's shape is compared with each (cosine)
const ARCH=[
  {k:'big',name:'Big-man build',what:'rebounds, blocks and field-goal percentage',w:{reb:1,blk:1,fg:1,ft:-.6,tp:-.4,ast:-.6,stl:-.2,to:.2,pts:0}},
  {k:'guard',name:'Guard build',what:'assists, steals and the outside shot',w:{ast:1,stl:.7,tp:.7,ft:.7,pts:.2,reb:-1,blk:-1,fg:-.6,to:-.5}},
  {k:'shoot',name:'Shooting build',what:'free-throw and three-point percentage',w:{ft:1,tp:1,pts:.5,fg:-.3,reb:-.5,blk:-.5,ast:0,stl:0,to:0}},
  {k:'usage',name:'High-usage build',what:'points and assists, paid for in turnovers',w:{pts:1,ast:.8,ft:.3,to:-1,fg:-.2,reb:0,blk:-.2,stl:.1,tp:.2}},
  {k:'eff',name:'Low-turnover build',what:'few turnovers and efficient shots, light on volume',w:{to:1,fg:.8,ft:.3,pts:-.7,ast:-.6,reb:0,blk:0,stl:-.2,tp:0}},
  {k:'def',name:'Defense build',what:'steals and blocks',w:{stl:1,blk:1,pts:-.5,ast:-.2,ft:-.2,reb:.2,fg:0,to:0,tp:-.2}}];
const dnaAll=()=>memo('h3|dna|'+S.mode,()=>{
  const ts=M.teams,st={},out={};
  CATS.forEach(c=>{const a=ts.map(t=>t.line[c.k]).filter(v=>isFinite(v));st[c.k]={m:mean(a),s:sdev(a)}});
  ts.forEach(t=>{const s={},pct={},rank={};
    CATS.forEach(c=>{const v=t.line[c.k],ok=isFinite(v);let z=ok?(v-st[c.k].m)/st[c.k].s:0;if(c.neg)z=-z;s[c.k]=z;
      pct[c.k]=ok?(pctl(ts.map(x=>x.line[c.k]).filter(x=>isFinite(x)),v,c.neg)??0):0;rank[c.k]=t.catRank[c.k]});
    const lvl=mean(CATS.map(c=>s[c.k])),sh={};CATS.forEach(c=>sh[c.k]=s[c.k]-lvl);
    const mag=Math.sqrt(mean(CATS.map(c=>sh[c.k]**2)));
    const fits=ARCH.map(a=>{const wm=mean(CATS.map(c=>a.w[c.k]||0));let dot=0,nw=0,ns=0;
      CATS.forEach(c=>{const w=(a.w[c.k]||0)-wm;dot+=w*sh[c.k];nw+=w*w;ns+=sh[c.k]**2});return {a,cos:ns&&nw?dot/Math.sqrt(nw*ns):0}}).sort((x,y)=>y.cos-x.cos);
    const order=[...CATS].sort((a,b)=>s[b.k]-s[a.k]);
    let built=order.filter(c=>rank[c.k]<=3&&s[c.k]>=.4).slice(0,4);const builtTop=built.length>0;
    if(!built.length)built=order.filter(c=>rank[c.k]<=5&&s[c.k]>0).slice(0,2);
    const rest=k=>mean(CATS.filter(c=>c.k!==k).map(c=>s[c.k]));
    const punt=CATS.filter(c=>rank[c.k]>=9&&s[c.k]<=-1&&rest(c.k)>=-.15);
    const weak=CATS.filter(c=>rank[c.k]>=8&&!punt.includes(c)).sort((a,b)=>rank[b.k]-rank[a.k]);
    const arch=fits[0].cos>=.5&&mag>=.45?fits[0].a:null;
    const archName=arch?arch.name:built.length>=4&&builtTop?'All-around build':'Balanced build';
    const core=t.roster.filter(p=>p.pg&&p.zpg).map(p=>({p,f:built.reduce((a,c)=>a+(p.zpg[c.k]||0),0)})).sort((a,b)=>b.f-a.f).filter(x=>x.f>0).slice(0,2).map(x=>x.p);
    const tv=t.roster.map(p=>({p,v:p.tv||0})).sort((a,b)=>b.v-a.v),sum=tv.reduce((a,x)=>a+x.v,0),top=tv.slice(0,3);
    out[t.id]={id:t.id,s,pct,rank,lvl,mag,fits,arch,archName,built,builtTop,punt,weak,core,
      half:CATS.filter(c=>rank[c.k]<=5).length,avgRank:mean(CATS.map(c=>rank[c.k])),
      top3:{share:sum?top.reduce((a,x)=>a+x.v,0)/sum:0,top:top.reduce((a,x)=>a+x.v,0),sum,names:top.map(x=>x.p.name),solid:tv.filter(x=>x.v>=30).length,n:tv.length}}});
  // closest team in category shape (distance between the standardized profiles)
  ts.forEach(t=>{let best=null,bd=1e9;ts.forEach(o=>{if(o.id===t.id)return;const d=Math.sqrt(CATS.reduce((a,c)=>a+(out[t.id].s[c.k]-out[o.id].s[c.k])**2,0));if(d<bd){bd=d;best=o.id}});out[t.id].twin=best;out[t.id].twinD=bd});
  return out});
LAB.teamDNA=id=>{const n=parseInt(id,10);return M&&dnaAll()[n]||null};
LAB.teamDNAAll=()=>M?dnaAll():null;

/* the DNA in words; link=true makes category names and players open their drills */
function dnaWords(t,d){const L=c=>sbtn(`tc|${t.id}|${c.k}`,c.l),out=[];
  if(d.builtTop)out.push(`Built for ${lst(d.built.map(L))}${d.built.length>1?', top three in each':', top three'}.`);
  else if(d.built.length)out.push(`No top-three category. Best at ${lst(d.built.map(c=>`${L(c)} (${ord(d.rank[c.k])})`))}.`);
  else out.push('No category in the top half: this roster trails the league across the board.');
  if(d.punt.length)out.push(`Looks like a punt of ${lst(d.punt.map(c=>`${L(c)} (${ord(d.rank[c.k])})`))}: well behind the pack while the rest of the roster holds up.`);
  if(d.weak.length)out.push(`${d.punt.length?'Also low in':'Neglecting'} ${lst(d.weak.map(c=>`${L(c)} (${ord(d.rank[c.k])})`))}.`);
  if(d.core.length)out.push(`Built around ${lst(d.core.map(p=>sbtn('pv|'+p.name,esc(p.name))))}.`);
  if(t.id===ME&&S.punt.size)out.push(`Your build settings punt ${lst([...S.punt].map(k=>catOf(k).l))}.`);
  return out.join(' ')}

/* ---------- radar: CH.radar geometry, plus a dashed league-median ring and clickable axis labels ---------- */
function radar(series,axes,o={}){const W=360,cx=180,cy=180,R=128,n=axes.length,ang=i=>-Math.PI/2+i*2*Math.PI/n,pt=(i,v)=>[cx+Math.cos(ang(i))*R*v,cy+Math.sin(ang(i))*R*v],r1=x=>Math.round(x*10)/10;
  const ring=(t,cls)=>`<polygon class="${cls}" fill="none" points="${axes.map((_,i)=>pt(i,t).map(r1).join(',')).join(' ')}"/>`;
  const grid=[.25,.75,1].map(t=>ring(t,'gr')).join('')+axes.map((_,i)=>{const [x,y]=pt(i,1);return `<line class="gr" x1="${cx}" y1="${cy}" x2="${r1(x)}" y2="${r1(y)}"/>`}).join('')+ring(.5,'md');
  const vv=v=>Math.max(.03,v||0);
  const areas=series.map(s=>`<polygon class="area ${s.cls}" points="${s.vals.map((v,i)=>pt(i,vv(v)).map(r1).join(',')).join(' ')}"/>`).join('');
  const dots=series.map(s=>s.vals.map((v,i)=>{const [x,y]=pt(i,vv(v));return `<circle class="${s.cls}" cx="${r1(x)}" cy="${r1(y)}" r="4.5" stroke="var(--panel)" stroke-width="1.5" data-tip="${esc(s.tips[i])}"${s.stats?` data-stat="${esc(s.stats[i])}"`:''}/>`}).join('')).join('');
  const labels=axes.map((a,i)=>{const [x,y]=pt(i,1.24),yy=a.sub?y-3:y+5;
    return `<g class="h3-ax" data-stat="${esc(a.stat)}" data-tip="${esc(a.tip)}"><rect x="${r1(x-22)}" y="${r1(yy-15)}" width="44" height="${a.sub?36:22}" rx="6"/><text class="ink" x="${r1(x)}" y="${r1(yy)}" text-anchor="middle">${esc(a.l)}</text>${a.sub?`<text x="${r1(x)}" y="${r1(yy+16)}" text-anchor="middle">${esc(a.sub)}</text>`:''}</g>`}).join('');
  const legend=`<div class="legend">${series.map(s=>`<span><i class="${s.cls}"></i>${esc(s.name)}</span>`).join('')}<span><i class="h3-md"></i>League median</span></div>`;
  return `<div class="chwrap h3-radar"><svg class="ch" viewBox="-40 -22 440 412" role="img" aria-label="${esc(o.label||'Category profile')}">${grid}${areas}${dots}${labels}</svg>${legend}</div>`}
// series colours: Matt's team is always s2 (blue); the others take s1 then s3 (or s2 when Matt is not shown)
const colorize=ids=>{const pool=ids.includes(ME)?['s1','s3']:['s1','s2','s3'];return ids.map(id=>id===ME?'s2':pool.shift())};
const seriesOf=(id,cls)=>{const t=tm(id),d=dnaAll()[id];return {name:t.name,cls,vals:CATS.map(c=>d.pct[c.k]),stats:CATS.map(c=>`tc|${id}|${c.k}`),
  tips:CATS.map(c=>`${t.name} · ${c.l}: ${fv(c,t.line[c.k])} ${per()}, #${d.rank[c.k]} of 10, ahead of ${Math.round(d.pct[c.k]*9)} of the other 9`)}};

/* =====================================================================================
   PANELS.team: Team DNA
   ===================================================================================== */
PANELS.team.push(id=>{const t=tm(id);if(!t)return '';css();
  const D=dnaAll(),d=D[id],w=thisWeek(),meOpp=oppNow(ME);
  const def=id!==ME?ME:(meOpp??byPr().find(x=>x.id!==ME).id);
  const sel=S_X('teams.dna','');const cid=sel==='none'?null:(TM(sel)&&+sel!==id?+sel:def);
  const ids=cid!=null?[id,cid]:[id],cls=colorize(ids);
  const axes=CATS.map(c=>({l:c.l,sub:'#'+d.rank[c.k],stat:`tc|${id}|${c.k}`,tip:`${c.n}: ${t.name} ranks #${d.rank[c.k]} of 10. Tap for the breakdown.`}));
  const opts=`<option value="none" ${cid==null?'selected':''}>League median only</option>${byPr().filter(x=>x.id!==id).map(x=>`<option value="${x.id}" ${x.id===cid?'selected':''}>${esc(x.name)}${x.id===ME?' (you)':''}</option>`).join('')}`;
  const tw=d.twin!=null?tm(d.twin):null,avgShare=mean(M.teams.map(x=>D[x.id].top3.share));
  const facts=`<div class="facts">${fact('Top half in',`${d.half} of 9`,'categories (ranked 1st to 5th)','trec|'+id)}
    ${fact('Top three share',pc(d.top3.share),`of trade value · league avg ${pc(avgShare)}`,'tval|'+id)}
    ${tw?fact('Closest in shape',esc(tw.abbr),esc(tw.name),`h2h|${id}|${tw.id}`):''}</div>`;
  return `<section class="panel" id="h3-dna">${head('Team DNA',`Where ${esc(t.name)} ranks in each category against the other nine rosters. Further out is better; the dashed ring is the league median.`,`<label class="h3-pick"><span class="lbl" style="margin-right:6px">Compare with</span><select data-setk="teams.dna" aria-label="Compare with">${opts}</select></label>`)}
    <div class="cols"><div>${radar(ids.map((x,i)=>seriesOf(x,cls[i])),axes,{label:`${t.name} category profile`})}</div>
    <div class="h3-words"><div class="h3-ch" style="justify-content:flex-start"><span class="pill ${d.arch?'star':''}">${esc(d.archName)}</span><span class="note">${d.arch?'Strong in '+esc(d.arch.what):'No single build stands out'}</span></div><p class="note" style="color:var(--ink);font-size:.9rem">${dnaWords(t,d)}</p>${facts}
    <p class="note">More in the <a class="linkbtn" href="#stats-teams" data-go="stats">Teams lab</a>: every roster side by side.</p></div></div>
    ${how([`Each spoke is a category. A point's distance from the centre is the share of the other nine teams this roster beats in it, from roster totals ${SEA()?'over the season':'per game'} (all nine categories, whatever you punt). Fewer turnovers counts as better. The dashed ring is the league median: inside it means the bottom half. Tap a label or a point for that category's breakdown.`,
      'The build name compares the profile\'s shape (which categories sit above or below the team\'s own average) with six common builds: big men, guards, shooters, high usage, low turnover and defense. When none fits well, the roster is called balanced. A punt here means ranking 9th or 10th by a wide margin while the rest of the roster is about average or better. This describes the roster; it is not the manager\'s stated plan.',
      '"Closest in shape" is the team whose category profile is nearest to this one. Top three share is the part of the roster\'s total trade value held by its three most valuable players.'])}</section>`});

/* =====================================================================================
   HUB: Teams view
   ===================================================================================== */
function pickIds(){const pr=byPr(),opp=oppNow(ME),val=k=>{const v=S_X(k,'');return v==='none'?'none':(TM(v)?+v:null)};
  const a=val('teams.a'),b=val('teams.b'),c=val('teams.c');
  const A=a&&a!=='none'?a:ME,B=b==='none'?null:(b??(opp!=null&&opp!==A?opp:pr.find(t=>t.id!==A).id));
  const C=c==='none'?null:(c??pr.find(t=>t.id!==A&&t.id!==B).id);
  return {slots:[A,B,C],ids:[...new Set([A,B,C].filter(x=>x!=null))]}}

function secCompare(){const {slots,ids}=pickIds(),cls=colorize(ids),ts=ids.map(id=>tm(id)),D=dnaAll(),ss=seasonSim();
  const clsOf=id=>id==null?'':cls[ids.indexOf(id)];
  const sel=(k,cur,i)=>`<label><i class="h3-sw ${clsOf(cur)}" aria-hidden="true"></i><select data-setk="${k}" aria-label="Team ${i+1}">${i?`<option value="none" ${cur==null?'selected':''}>No team</option>`:''}${byPr().map(t=>`<option value="${t.id}" ${t.id===cur?'selected':''}>${esc(t.name)}${t.id===ME?' (you)':''}</option>`).join('')}</select></label>`;
  const axes=CATS.map(c=>({l:c.l,stat:'lc|'+c.k,tip:`${c.n} across the league`}));
  const hd=ts.map((t,i)=>`<th scope="col" title="${esc(t.name)}"><span style="display:inline-flex;align-items:center"><i class="h3-sw ${cls[i]}"></i>${esc(t.abbr)}</span></th>`).join('');
  const rows=CATS.map(c=>{const vals=ts.map(t=>t.line[c.k]),ok=vals.filter(v=>isFinite(v)),bv=ok.length?(c.neg?Math.min(...ok):Math.max(...ok)):null;
    return `<tr><td class="l stick">${sbtn('lc|'+c.k,c.l)}</td>${ts.map(t=>{const v=t.line[c.k],r=D[t.id].rank[c.k];
      return `<td class="num ${ts.length>1&&v===bv?'best':''}" ${sx(`tc|${t.id}|${c.k}`)} data-tip="${esc(`${t.name}: ${fv(c,v)} ${c.l} ${per()}, #${r} of 10`)}">${fv(c,v)}<span class="rk">#${r}</span></td>`}).join('')}</tr>`}).join('');
  const extra=[['Power',t=>`#${t.pr}`,t=>'tpr|'+t.id],['Vs field',t=>scoreStr(t.rec),t=>'trec|'+t.id],['Playoffs',t=>pc(ss[t.id].po),t=>'tpo|'+t.id]]
    .map(([l,f,s])=>`<tr><td class="l stick">${l}</td>${ts.map(t=>`<td class="num" ${sx(s(t))}>${f(t)}</td>`).join('')}</tr>`).join('')
    +`<tr><td class="l stick">Build</td>${ts.map(t=>`<td class="num" style="white-space:normal;font-family:var(--body);font-size:.76rem" ${sx('tval|'+t.id)}>${esc(D[t.id].archName)}</td>`).join('')}</tr>`;
  let pairs='';if(ts.length>1){const ps=[];for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++)ps.push([ts[i],ts[j]]);
    pairs=`<div class="facts">${ps.map(([a,b])=>{const r=M.mx[a.id][b.id],wk=DATA.schedule.filter(m=>m[0]>=Math.max(1,curWeek)&&((m[1]===a.id&&m[2]===b.id)||(m[1]===b.id&&m[2]===a.id))).map(m=>m[0]).sort((x,y)=>x-y)[0];
      return fact(`${esc(a.abbr)} vs ${esc(b.abbr)}`,scoreStr(r),`roster against roster${wk?` · they meet in week ${wk}`:''}`,`h2h|${a.id}|${b.id}`)}).join('')}</div>`}
  let gap='';if(ts.length>1){const [a,b]=ts,da=D[a.id],db=D[b.id],c=[...CATS].sort((x,y)=>Math.abs(da.pct[y.k]-db.pct[y.k])-Math.abs(da.pct[x.k]-db.pct[x.k]))[0],r=M.mx[a.id][b.id];
    gap=`<p class="note">Roster against roster, ${esc(a.name)} wins ${r.w} of 9 categories against ${esc(b.name)}. The biggest gap is ${sbtn('lc|'+c.k,c.l)}: ${sbtn(`tc|${a.id}|${c.k}`,'#'+da.rank[c.k])} against ${sbtn(`tc|${b.id}|${c.k}`,'#'+db.rank[c.k])}.</p>`}
  return `<section class="panel" id="h3-cmp">${head('Compare teams','Up to three rosters on one radar. Further out is better in every category, turnovers included.')}
    <div class="h3-pick">${slots.map((id,i)=>sel('teams.'+'abc'[i],id,i)).join('')}</div>
    <div class="cols"><div>${radar(ids.map((id,i)=>seriesOf(id,cls[i])),axes,{label:'Category profiles compared'})}</div>
    <div style="display:flex;flex-direction:column;gap:12px;min-width:0"><div class="scroll"><table class="h3-cmpt"><thead><tr><th class="l stick" scope="col">${SEA()?'Season':'Per game'}</th>${hd}</tr></thead><tbody>${rows}${extra}</tbody></table></div>${gap}${pairs}</div></div>
    ${how([`Each spoke is a category; a point's distance from the centre is the share of the other nine teams the roster beats there, from roster totals ${SEA()?'over the season':'per game'}. The dashed ring is the league median. Tap a point or a number for that team's category breakdown, or a category label for the league view.`,
      'The defaults are your team, this week\'s opponent and the top power-ranked team left. "Vs the field" and the pair results compare whole rosters category by category, ignoring the weekly schedule; playoff odds come from the season simulation.'])}</section>`}

function secHeat(){const D=dnaAll(),[k,d]=S.sort.h3heat;
  const get=(t,key)=>key==='pr'?t.pr:key==='name'?t.name:key==='avgr'?-D[t.id].avgRank:(D[t.id].s[key]??null);
  const rows=sortRows([...M.teams],k,d,get);
  return `<section class="panel" id="h3-heat">${head('Category ranks','Every team\'s rank in every category (1 is best, 10 worst), with the roster total underneath. Tap a cell for the breakdown; sort by any column.')}
    <div class="scroll"><table class="hm h3-heat"><thead><tr>${th('h3heat','pr','#')}${th('h3heat','name','Team','l stick')}${CATS.map(c=>th('h3heat',c.k,c.l,'',c.n+(c.neg?' (fewer is better)':''))).join('')}${th('h3heat','avgr','Avg','', 'Average rank across the nine categories')}</tr></thead><tbody>
    ${rows.map(t=>{const x=D[t.id];return `<tr><td class="num" ${sx('tpr|'+t.id)} data-tip="Power rank #${t.pr}">${t.pr}</td><td class="l stick tname ${t.id===ME?'h3-me':''}"><button type="button" class="tlink" data-team="${t.id}">${nm(t)}</button></td>
      ${CATS.map(c=>`<td class="${neu(rc(x.rank[c.k]))}" ${sx(`tc|${t.id}|${c.k}`)} data-tip="${esc(`${t.name} · ${c.n}: ${fv(c,t.line[c.k])} ${per()}, #${x.rank[c.k]} of 10`)}"><b>${x.rank[c.k]}</b><span class="rk">${fv(c,t.line[c.k])}</span></td>`).join('')}
      <td class="num" ${sx('trec|'+t.id)} data-tip="${esc(`${t.name}: average rank ${x.avgRank.toFixed(1)}, top half in ${x.half} of 9`)}"><b>${x.avgRank.toFixed(1)}</b></td></tr>`}).join('')}</tbody></table></div>
    ${how([`Ranks compare roster totals ${SEA()?'over the season (games played included)':'per game'}: counting stats are summed, and FG%, FT% and 3P% are made shots over attempts for the whole roster. Turnovers rank fewest first. Green is top five, red is bottom four; the shade deepens toward 1st and 10th.`,'The small number under each rank is the roster total; "Avg" is the average of the nine ranks.'])}</section>`}

function secArch(){const D=dnaAll();
  const card=t=>{const d=D[t.id];return `<article class="sub h3-card"><div class="h3-ch"><span class="tname">${tlink(t)}${t.id===ME?' <span class="note">(you)</span>':''}</span><span class="pill ${d.arch?'star':''}">${esc(d.archName)}</span></div>
    <span class="note">Power #${t.pr} · ${esc(t.mgr)} · top half in ${d.half} of 9</span>
    <div class="h3-strip" role="group" aria-label="${esc(t.name)} category ranks">${CATS.map(c=>`<button type="button" class="${neu(rc(d.rank[c.k]))}" ${sx(`tc|${t.id}|${c.k}`)} data-tip="${esc(`${c.n}: #${d.rank[c.k]} of 10, ${fv(c,t.line[c.k])} ${per()}`)}"><span>${c.l}</span><b>${d.rank[c.k]}</b></button>`).join('')}</div>
    <p class="note" style="color:var(--ink)">${dnaWords(t,d)}</p></article>`};
  const pun=M.teams.filter(t=>D[t.id].punt.length);
  return `<section class="panel" id="h3-arch">${head('Team archetypes','What each roster is built for and what it gives up, in plain words. Tap any category for the numbers behind it.')}
    ${pun.length?`<p class="note">Rosters that look like they punt: ${pun.map(t=>`${esc(t.name)} (${D[t.id].punt.map(c=>sbtn(`tc|${t.id}|${c.k}`,c.l)).join(', ')})`).join('; ')}.</p>`:'<p class="note">No roster looks like a clear punt right now: every 9th or 10th place comes with weak categories elsewhere too.</p>'}
    <div class="h3-cards">${byPr().map(card).join('')}</div>
    ${how(['Built for: the categories where the roster ranks in the top three and is clearly above the league average. Neglecting: categories ranked 8th or worse. A punt (it looks deliberate) is a 9th or 10th place well below the pack while the rest of the roster is about average or better; the board cannot see a manager\'s intent, so this is a read of the roster only.',
      'The build name compares the shape of the nine category scores (each team\'s distance from the league average, in league spreads, minus its own average) with six common builds: big men (REB, BLK, FG%), guards (AST, STL, 3P%, FT%), shooters (FT%, 3P%), high usage (PTS and AST at the cost of TO), low turnover (TO and FG%, light on volume) and defense (STL, BLK). It needs a clear match; otherwise the roster is balanced (or all-around, when it is top three in four or more). "Built around" names the two players who add the most in the built-for categories.'])}</section>`}

function secStars(){const D=dnaAll(),mode=S_X('teams.sd','total')==='share'?'share':'total';
  const rows=[...M.teams].sort((a,b)=>mode==='share'?D[b.id].top3.share-D[a.id].top3.share:D[b.id].top3.sum-D[a.id].top3.sum);
  const mx=Math.max(...rows.map(t=>D[t.id].top3.sum),1),avg=mean(M.teams.map(t=>D[t.id].top3.share));
  const bars=rows.map(t=>{const x=D[t.id].top3,tot=mode==='share'?100:x.sum/mx*100,a=x.sum?x.top/x.sum*tot:0,b=tot-a;
    const tip=`${t.name}: top three (${x.names.join(', ')}) hold ${x.top.toFixed(0)} of ${x.sum.toFixed(0)} trade value (${pc(x.share)}); ${x.solid} players at 30 or more`;
    return `<button type="button" class="hb-r ${t.id===ME?'hi':''}" data-stat="tval|${t.id}" data-tip="${esc(tip)}" role="listitem"><span class="hb-l">${esc(t.name)}<small>${mode==='share'?x.sum.toFixed(0)+' total':x.solid+' at 30+'}</small></span><span class="hb-b"><i class="t3" style="left:0;width:${a.toFixed(1)}%"></i><i class="dp" style="left:${a.toFixed(1)}%;width:${Math.max(0,b).toFixed(1)}%"></i></span><span class="hb-v">${mode==='share'?pc(x.share):x.sum.toFixed(0)}</span></button>`}).join('');
  const hi=[...M.teams].sort((a,b)=>D[b.id].top3.share-D[a.id].top3.share),me=D[ME].top3,meR=hi.findIndex(t=>t.id===ME)+1;
  const segb=(v,l)=>`<button type="button" data-set="teams.sd=${v}" aria-pressed="${mode===v}">${l}</button>`;
  return `<section class="panel" id="h3-stars">${head('Stars or depth','How much of each roster\'s trade value sits in its three best players.',`<div class="seg" role="group" aria-label="Bar scale">${segb('total','Total value')}${segb('share','Top-three share')}</div>`)}
    <div class="facts">${fact('Most star-heavy',esc(hi[0].abbr),`${pc(D[hi[0].id].top3.share)} in the top three`,'tval|'+hi[0].id)}${fact('Deepest',esc(hi[hi.length-1].abbr),`${pc(D[hi[hi.length-1].id].top3.share)} in the top three`,'tval|'+hi[hi.length-1].id)}${fact('Your top three',pc(me.share),`${ord(meR)} most star-heavy · avg ${pc(avg)}`,'tval|'+ME)}</div>
    <div class="hb stack h3-stk" role="list" aria-label="Trade value split between the top three and the rest">${bars}</div>
    <div class="legend"><span><i class="s1"></i>Top three players</span><span><i class="s3"></i>Everyone else</span></div>
    ${how([`Trade value is the board's 0 to 100 league-wide value (the Trades tab chart): it ignores punts and is never negative, so shares add up cleanly. ${mode==='share'?'Each bar is one roster scaled to 100%.':'Bar length is the roster\'s total trade value.'} A star-heavy roster wins with a few players and is hurt most by one injury; a deep one has more trade chips and absorbs injuries better.`,'"30+" counts players with a trade value of 30 or more, about a solid starter or better. Tap a team for its full value breakdown.'])}</section>`}

const POS=['PG','SG','SF','PF','C'];
const posAll=()=>memo('h3|pos',()=>{const o={},reg=WEEKS.filter(w=>w<=REGW&&w>=Math.min(curWeek,REGW));
  M.teams.forEach(t=>{const v={},n={};POS.forEach(x=>{v[x]=0;n[x]=0});
    t.roster.forEach(p=>{const ps=String(p.pos||'').split('/').filter(x=>POS.includes(x));ps.forEach(x=>{n[x]++;if(p.value!=null)v[x]+=p.value/ps.length})});
    o[t.id]={v,n,flex:t.roster.filter(p=>String(p.pos||'').split('/').length>1).length,bench:reg.reduce((s,w)=>s+projTeam(t.id,w,0).bench,0)}});
  const st={};POS.forEach(x=>{const a=M.teams.map(t=>o[t.id].v[x]);st[x]={m:mean(a),s:sdev(a)}});
  const ba=M.teams.map(t=>o[t.id].bench);st.bench={m:mean(ba),s:Math.max(sdev(ba),1)};return {o,st,reg}});
function secPos(){const P=posAll();
  const rows=byPr().map(t=>{const x=P.o[t.id];return `<tr><td class="l stick tname ${t.id===ME?'h3-me':''}"><button type="button" class="tlink" data-team="${t.id}">${nm(t)}</button></td>
    ${POS.map(p=>{const dv=x.v[p]-P.st[p].m;return `<td class="${neu(zc(dv/P.st[p].s))}" ${sx('tval|'+t.id)} data-tip="${esc(`${t.name} at ${p}: ${x.n[p]} eligible player${x.n[p]===1?'':'s'}, value ${f1(x.v[p])} against a league average of ${f1(P.st[p].m)}`)}"><b>${fd(dv)}</b><span class="rk">${x.n[p]} elig.</span></td>`}).join('')}
    <td class="num" data-tip="${esc(`${x.flex} players eligible at two or more positions`)}">${x.flex}</td>
    <td class="${neu(zc(-(x.bench-P.st.bench.m)/P.st.bench.s))}" ${sx('tgm|'+t.id)} data-tip="${esc(`${t.name}: about ${x.bench} games left on the bench over the rest of the regular season, league average ${P.st.bench.m.toFixed(0)}`)}"><b>${x.bench}</b></td></tr>`}).join('');
  const me=P.o[ME],best=[...POS].sort((a,b)=>(me.v[b]-P.st[b].m)-(me.v[a]-P.st[a].m)),thin=[...POS].sort((a,b)=>me.n[a]-me.n[b])[0];
  return `<section class="panel" id="h3-pos">${head('Position balance','Value from the players eligible at each position, against the league-average team, and how many games a crowded roster leaves on the bench.')}
    <div class="scroll"><table class="hm"><thead><tr><th class="l stick" scope="col">Team</th>${POS.map(p=>`<th scope="col">${sbtn('pos|'+p,p)}</th>`).join('')}<th scope="col" title="Players eligible at two or more positions">Flex</th><th scope="col" title="Games left on the bench, rest of the regular season">Benched</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">Your team is strongest at ${sbtn('pos|'+best[0],best[0])} (${f1(me.v[best[0]]-P.st[best[0]].m)} against average) and weakest at ${sbtn('pos|'+best[4],best[4])} (${f1(me.v[best[4]]-P.st[best[4]].m)}); thinnest at ${thin} with ${me.n[thin]} eligible. About ${sbtn('tgm|'+ME,String(me.bench))} of your games would sit on the bench over the rest of the regular season (league average ${P.st.bench.m.toFixed(0)}).</p>
    ${how([`Each cell is the summed value${S.punt.size?' (without your punts)':''} of the players eligible there, minus the league-average team's; a player listed at two positions counts half at each. The small number is how many roster players are eligible. Green is above average, red below.`,
      'ESPN lineups have one PG, SG, SF, PF and C slot, plus G, F and four UTIL. "Benched" counts player-games with no open slot that day, from the board\'s day-by-day lineup projection over the real NBA schedule; a high number means the roster is crowded at the same positions or on the same nights. Flex counts players eligible at two or more positions.'])}</section>`}

const injAll=()=>memo('h3|inj',()=>{const ws=[curWeek,curWeek+1].filter(w=>PER[w]),o={};
  M.teams.forEach(t=>{const hurt=t.roster.filter(p=>p.inj==='DTD'||p.inj==='OUT');let lost=0;
    if(hurt.length)ws.forEach(w=>{const healthy=weekProj(t.roster.map(p=>p.inj?{...p,inj:''}:p),w,0).games;lost+=Math.max(0,healthy-projTeam(t.id,w,0).games)});
    const tv=hurt.reduce((s,p)=>s+(p.tv||0),0),sum=t.roster.reduce((s,p)=>s+(p.tv||0),0);o[t.id]={hurt,lost,tv,share:sum?tv/sum:0}});return {o,ws}});
function secInj(){const I=injAll(),rows=[...M.teams].filter(t=>I.o[t.id].hurt.length).sort((a,b)=>I.o[b.id].lost-I.o[a.id].lost||I.o[b.id].tv-I.o[a.id].tv),ok=byPr().filter(t=>!I.o[t.id].hurt.length);
  const wl=I.ws.map(w=>weekName(w).toLowerCase()).join(' and ');
  return `<section class="panel" id="h3-inj">${head('Injuries','Who is on the injury report on each roster, how much trade value that is, and the games it costs.')}
    ${rows.length?`<div class="scroll"><table class="h3-inj"><thead><tr><th class="l stick" scope="col">Team</th><th class="l" scope="col">On the report</th><th scope="col" title="Trade value of the injured players and its share of the roster">Value out</th><th scope="col" title="Expected player-games lost, ${esc(wl)}">Games lost</th></tr></thead><tbody>
      ${rows.map(t=>{const x=I.o[t.id];return `<tr><td class="l stick tname ${t.id===ME?'h3-me':''}"><button type="button" class="tlink" data-team="${t.id}">${nm(t)}</button></td>
        <td class="l"><div class="plist">${x.hurt.sort((a,b)=>b.tv-a.tv).map(p=>`<span><button type="button" class="plink" data-player="${esc(p.name)}">${esc(p.name)}</button>${p.inj==='OUT'?'<span class="pill out">OUT</span>':'<span class="pill dtd">DTD</span>'} ${sbtn('ptv|'+p.name,'<small>TV '+p.tv.toFixed(0)+'</small>')}</span>`).join('')}</div></td>
        <td class="num" ${sx('tval|'+t.id)} data-tip="${esc(`${x.tv.toFixed(0)} trade value on the report, ${pc(x.share)} of the roster's`)}"><b>${x.tv.toFixed(0)}</b><span class="rk">${pc(x.share)}</span></td>
        <td class="num ${x.lost>=3?'warnc':''}" ${sx('tgm|'+t.id)} data-tip="${esc(`About ${x.lost.toFixed(1)} expected player-games lost, ${wl}`)}"><b>${x.lost.toFixed(1)}</b></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No rostered player is on the injury report.</div>'}
    ${ok.length?`<p class="note">Healthy: ${ok.map(t=>esc(t.name)).join(', ')}.</p>`:''}
    ${how([`ESPN lists players as day-to-day (DTD) or out (OUT) but gives no return dates, so the games lost are assumed: ${preseason?'before the season, an OUT player is expected to miss 60% of week 1 and half of week 2, and day-to-day players nothing yet':'an OUT player misses all of this week and half of next week, and a day-to-day player a quarter of this week\'s games'}. "Games lost" is the roster's expected player-games for ${wl} with everyone healthy, minus the same with the injuries, after the daily lineup limit (a healthy bench player can fill some of the gap).`,
      'Value out is the trade value of the injured players and its share of the roster\'s total. Tap a name for the player, TV for their trade value breakdown.'])}</section>`}

const gamesAll=()=>memo('h3|games',()=>{const cw=curWeek,reg=WEEKS.filter(w=>w<=REGW&&w>=cw),nx=WEEKS.filter(w=>w>cw&&w<=cw+4),o={};
  M.teams.forEach(t=>{const g=w=>projTeam(t.id,w,0).games;o[t.id]={now:PER[cw]?g(cw):null,next:nx.reduce((s,w)=>s+g(w),0),reg:reg.reduce((s,w)=>s+g(w),0),po:PO_WEEKS.reduce((s,w)=>s+g(w),0)}});
  const st={};['now','next','reg','po'].forEach(k=>{const a=M.teams.map(t=>o[t.id][k]).filter(v=>v!=null);st[k]={m:mean(a),s:Math.max(sdev(a),.5)}});return {o,st,nx,reg,cw}});
function secGames(){const G=gamesAll(),cw=G.cw,cols=[['now',`${cw>REGW?'P'+(cw-REGW):'Wk '+cw}`,`${weekName(cw)}, ${weekLabel(cw)}`],['next','Next 4',G.nx.length?`${weekName(G.nx[0])} to ${weekName(G.nx[G.nx.length-1]).toLowerCase()}`:''],['reg','Rest of reg.',G.reg.length?`Weeks ${G.reg[0]} to ${REGW}`:'Regular season over'],['po','Playoffs',`Weeks ${PO_WEEKS.join(', ')}`]];
  const cell=(t,k)=>{const v=G.o[t.id][k];if(v==null||(k==='reg'&&!G.reg.length)||(k==='next'&&!G.nx.length))return '<td class="h3-n">–</td>';
    const opp=k==='now'&&cw<=REGW?oppOf(t.id,cw):null,st=opp!=null?`mw|${t.id}|${opp}|${cw}`:'tgm|'+t.id,z=(v-G.st[k].m)/G.st[k].s;
    return `<td class="${neu(zc(z))}" ${sx(st)} data-tip="${esc(`${t.name}: ${v.toFixed(0)} expected player-games, league average ${G.st[k].m.toFixed(0)}`)}"><b>${v.toFixed(0)}</b><span class="rk">${fd(v-G.st[k].m)}</span></td>`};
  const me=G.o[ME],poR=[...M.teams].sort((a,b)=>G.o[b.id].po-G.o[a.id].po).findIndex(t=>t.id===ME)+1;
  return `<section class="panel" id="h3-games">${head('Games outlook','Expected player-games that count (after the daily lineup limit and injuries), against the league average.')}
    <div class="scroll"><table class="hm"><thead><tr><th class="l stick" scope="col">Team</th>${cols.map(([,l,tip])=>`<th scope="col" title="${esc(tip)}">${l}</th>`).join('')}</tr></thead><tbody>
    ${byPr().map(t=>`<tr><td class="l stick tname ${t.id===ME?'h3-me':''}"><button type="button" class="tlink" data-team="${t.id}">${nm(t)}</button></td>${cols.map(([k])=>cell(t,k)).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="note">Your roster projects ${sbtn('tgm|'+ME,me.po.toFixed(0))} player-games in the fantasy playoffs, ${ord(poR)} of 10 (average ${G.st.po.m.toFixed(0)}).</p>
    ${how([`Each number is expected player-games: for every day, the players with an NBA game fill the 11 lineup slots by position, scaled by how often each is expected to play (injuries included). The small number is the difference from the league average. This week's cell opens the matchup; the others open the team's games by week.`,
      `The playoff column covers weeks ${PO_WEEKS.join(', ')} for every roster, whether or not the team makes the playoffs. This week counts the whole week, including days already played.`])}</section>`}

HUB.push({k:'teams',label:'Teams',order:30,note:'Every roster side by side: category shapes, archetypes, stars and depth, positions, injuries and games.',
  render:()=>{css();return [safe(secCompare,'Compare teams'),safe(secHeat,'Category ranks'),safe(secArch,'Team archetypes'),
    `<div class="cols">${safe(secStars,'Stars or depth')}${safe(secPos,'Position balance')}</div>`,`<div class="cols">${safe(secInj,'Injuries')}${safe(secGames,'Games outlook')}</div>`].join('')}});

const hubGo=id=>()=>{go('stats',{hub:'teams'});if(id)setTimeout(()=>scrollToId(id),0)};
CMDS.push({label:'Compare teams',sub:'Up to three rosters on one category radar',kw:'teams compare radar shape dna profile',tag:'Stats',act:hubGo('h3-cmp')});
CMDS.push({label:'Team archetypes',sub:'What each roster is built for and what it punts',kw:'archetype build punt punting strategy identity',tag:'Stats',act:hubGo('h3-arch')});
CMDS.push({label:'Injuries by team',sub:'Who is hurt on each roster and the games it costs',kw:'injury injuries dtd out hurt',tag:'Stats',act:hubGo('h3-inj')});
CMDS.push({label:'My team DNA',sub:'Your category radar, build and punts',kw:'dna radar build identity my team',tag:'Team',act:()=>{go('team',{team:ME});setTimeout(()=>scrollToId('h3-dna'),0)}});
})();
