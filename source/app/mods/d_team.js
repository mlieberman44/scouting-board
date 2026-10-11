/* d_team.js: team drill-downs.
   tc|id|cat    one team in one category      tval|id   team value and grade     tpr|id   power rank breakdown
   tpo|id       playoff odds                  trec|id   category record vs field tgm|id   games by week
   h2h|a|b      roster against roster, category by category, with the players driving each edge and their real weeks
   Registers only; every computation runs at render time. Shared helpers go on window.LAB (catGap, h2hEdges, tprParts). */
(()=>{
const LAB=window.LAB=window.LAB||{};

/* ---------- small helpers ---------- */
const SEA=()=>S.mode==='season';
const per=()=>SEA()?'over the season':'a game';
const perC=c=>c.pct?'':' '+per();                                  // a percentage is made over attempted, never "a game"
const mult=p=>SEA()?(p.gp||0):1;
const pv=(p,key)=>p&&p.pg?(+p.pg[key]||0)*mult(p):0;           // a player's number, per game or season (S.mode)
const TM=id=>{const s=String(id??'').trim(),n=parseInt(s,10);return Number.isFinite(n)&&String(n)===s?(tm(n)||null):null};
const CT=k=>catOf(String(k||'').toLowerCase())||null;
const dp=()=>SEA()?0:1;
const fv=(c,v)=>v==null||!isFinite(v)?'–':c.pct?f3(v):v.toFixed(dp());
const up=(x,d)=>{const m=Math.pow(10,d);return Math.max(Math.ceil(x*m-1e-9),1)/m};  // round up (at least one step), so "passes" really passes
const nf=(x,d)=>x.toFixed(d);
const sf=(x,d)=>{const s=Math.abs(x).toFixed(d);return +s===0?s:(x>0?'+':'−')+s};  // signed, never "-0.0"
const NOUN={pts:'PTS',reb:'REB',ast:'AST',stl:'STL',blk:'BLK',to:'TO',fg:'made field goals',ft:'made free throws',tp:'made threes'};
const ATT={fg:'FGA',ft:'FTA',tp:'3PA'};
const lastName=n=>{const w=String(n).split(' ');return w.length>1?w.slice(1).join(' '):String(n)};
// a short name for tight spots: the last name, or the full name when a teammate shares it (two Georges on one roster)
const shortName=(p,ro)=>{const l=lastName(p.name);return ro.some(q=>q!==p&&lastName(q.name)===l)?p.name:l};
const done=w=>!!(PER[w]&&PER[w][PER[w].length-1]<todaySP);
const left=()=>WEEKS.filter(w=>w<=REGW&&w>=Math.max(1,curWeek));     // the weeks the season sim still plays
const hasRec=t=>!!(t.record&&(t.record.w+t.record.l+t.record.t)>0);
const meetings=(a,b)=>DATA.schedule.filter(m=>(m[1]===a&&m[2]===b)||(m[1]===b&&m[2]===a)).map(m=>m[0]).sort((x,y)=>x-y);
const byCat=k=>[...M.teams].sort((a,b)=>a.catRank[k]-b.catRank[k]);
const tlink=(t,txt)=>`<button type="button" class="tlink" data-team="${t.id}">${txt??esc(t.name)}</button>`;
const wkShort=w=>w>REGW?'P'+(w-REGW):'W'+w;
const legend=items=>`<div class="legend">${items.map(([cls,l])=>`<span><i class="${cls}"></i>${l}</span>`).join('')}</div>`;
const facts=a=>`<div class="facts">${a.join('')}</div>`;
const pctOf=(a,b)=>b?Math.round(a/b*100)+'%':'–';
// two values that would print the same get one more decimal, so a near tie still shows who leads
const fvPair=(c,a,b)=>{const x=fv(c,a),y=fv(c,b);if(x!==y||a===b)return [x,y];
  if(c.pct){const g=v=>v.toFixed(4).replace(/^0/,'');return [g(a),g(b)]}return [a.toFixed(dp()+1),b.toFixed(dp()+1)]};
// colour for a signed bar, set explicitly so a chart with no negative values keeps its meaning
const pn=v=>v==null||!isFinite(v)||Math.abs(v)<1e-9?'mut':v>0?'pos':'neg';
const listAnd=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
// the league-wide number to compare a team with: the average team total, or for a percentage every made shot over every attempt
const lgAvg=c=>c.pct?(()=>{let m=0,a=0;M.teams.forEach(t=>{const s=sums(t,c);m+=s.m;a+=s.a});return a?m/a:0})():mean(M.teams.map(x=>x.line[c.k]));

// rank of a hypothetical line among the other nine teams in one category
const rankAs=(line,id,k)=>ranksOf(line,id)[k];
// layout only (theme tokens untouched): tighter drill tables whose headers may wrap; on desktop, bar charts labelled with
// team names get a wider label column (CH.hbars {stack:true} already puts long labels on their own line on phones)
function css(){addCSS('dteam-css','.dt-tight th,.dt-tight td{padding-left:6px;padding-right:6px}.dt-tight th{white-space:normal;vertical-align:bottom}@media (min-width:561px){.dt-wide .hb-r{grid-template-columns:minmax(0,15em) minmax(0,1fr) 4.6em}}.dt-sched .wp{min-width:96px}.dt-sched td{vertical-align:middle}.dt-sched td:last-child{width:36%}.dt-sched .tname{font-size:.92rem}')}
const wide=html=>`<div class="dt-wide">${html}</div>`;
// a compact player cell for drill tables (the whole row opens a drill)
const ncell=(p,sub)=>`<td class="l stick" style="white-space:normal;min-width:8em;max-width:12em"><b style="font-weight:600;font-size:.92rem">${esc(p.name)}</b>${pills(p)}<small style="display:block;color:var(--muted);font-size:.74rem">${sub}</small></td>`;
const psub=p=>`${p.nba==='?'?'Unsigned':esc(p.nba)} · ${p.pos}`;
// a 3px share bar under a number
const micro=f=>`<div style="height:3px;border-radius:2px;background:var(--soft);margin-top:4px;min-width:34px"><div style="height:3px;border-radius:2px;background:var(--accent);width:${Math.max(0,Math.min(100,f*100)).toFixed(0)}%"></div></div>`;

/* ---------- gaps: how much of a stat passes the team above, and the cushion over the team below ---------- */
function sums(t,c){const ro=t.roster.filter(p=>p.pg);return c.pct?{m:ro.reduce((s,p)=>s+pv(p,c.pct[0]),0),a:ro.reduce((s,p)=>s+pv(p,c.pct[1]),0)}:null}
// amount t needs to draw level with o: >0 means o is ahead. Counting stats in the stat's own units (fewer, for TO);
// percentages in made shots at the same attempts.
function needVs(t,o,c){if(c.pct){const s=sums(t,c);return o.line[c.k]*s.a-s.m}
  return c.neg?t.line[c.k]-o.line[c.k]:o.line[c.k]-t.line[c.k]}
const avgPlayer=c=>memo('dteam|avgp|'+c.k+'|'+S.mode,()=>mean(M.players.filter(p=>p.pg).map(p=>pv(p,c.pct?c.pct[0]:c.k))));
function catGap(id,k){const t=TM(id),c=CT(k);if(!t||!c)return null;const s=byCat(c.k),r=t.catRank[c.k],ab=s[r-2]||null,be=s[r]||null;
  return {rank:r,above:ab?{id:ab.id,need:needVs(t,ab,c)}:null,below:be?{id:be.id,cushion:-needVs(t,be,c)}:null}}
LAB.catGap=catGap;
function passTxt(c,need){const d=c.pct?1:dp(),x=up(Math.max(need,0),d);
  if(c.pct)return `${nf(x,1)} more ${NOUN[c.k]} ${per()}`;
  return c.neg?`${nf(x,d)} fewer TO ${per()}`:`+${nf(x,d)} ${c.l} ${per()}`}
function cushTxt(c,cu){const x=Math.max(cu,0),d=x>0&&x<.1&&!SEA()?2:c.pct?1:dp();return c.pct?`${nf(x,d)} ${NOUN[c.k]} ${per()}`:`${nf(x,d)} ${c.l} ${per()}`}

/* ---------- roster contributions in one category ---------- */
// the average rostered player's numbers (per game, or per season in season mode)
const avgLine=()=>memo('dteam|avgline|'+S.mode,()=>{const q=M.players.filter(p=>p.pg),o={};KEYS.forEach(k=>o[k]=mean(q.map(p=>pv(p,k))));return o});
// the team's rank in a category if one player were swapped for an average rostered player: isolates what that player adds
function rankIfAvg(t,c,p){const A=avgLine();let v;
  if(c.pct){const s=sums(t,c),[mk,ak]=c.pct,den=s.a-pv(p,ak)+A[ak];v=den?(s.m-pv(p,mk)+A[mk])/den:0}
  else v=t.line[c.k]-pv(p,c.k)+A[c.k];
  return 1+M.teams.filter(o=>o.id!==t.id&&better(c,o.line[c.k],v)).length}
function contrib(t,c,noRank){const ro=t.roster.filter(p=>p.pg),tot=t.line[c.k],s=c.pct?sums(t,c):null;
  return ro.map(p=>{const ifAvg=noRank?null:rankIfAvg(t,c,p);
    if(c.pct){const m=pv(p,c.pct[0]),a=pv(p,c.pct[1]);return {p,v:a?m/a:null,m,a,share:s.a?a/s.a:0,imp:a?(m/a-M.lg[c.k])*a:0,ifAvg}}
    const v=pv(p,c.k);return {p,v,share:tot?v/tot:0,ifAvg}})
  .sort((x,y)=>c.pct?y.imp-x.imp:y.v-x.v)}
// the players on a roster who matter most in a category (for TO: the ones who commit the most)
function drivers(t,c,n){return contrib(t,c,true).slice(0,n)}

/* ---------- the clickable category strip (current category ringed) ---------- */
const catNav=(t,cur,type)=>`<div class="rkstrip" role="group" aria-label="Categories">${CATS.map(c=>{const r=t.catRank[c.k],on=c.k===cur;
  return `<button type="button" class="rkc ${rc(r)} ${t.id===ME&&S.punt.has(c.k)?'punted':''}" data-stat="${esc(type+'|'+t.id+'|'+c.k)}" ${on?'aria-current="true"':''} data-tip="${esc(c.n+': rank '+r+' of 10')}" style="border:0;cursor:pointer;${on?'box-shadow:inset 0 0 0 2px var(--accent)':''}"><span>${c.l}</span><b>#${r}</b></button>`}).join('')}</div>`;

/* =====================================================================================
   tc|<teamId>|<cat>: one team in one category
   ===================================================================================== */
DRILL.tc=(id,k)=>{const t=TM(id),c=CT(k);if(!t||!c)return null;css();
  const K=c.k,r=t.catRank[K],sorted=byCat(K),ab=sorted[r-2]||null,be=sorted[r]||null,avg=lgAvg(c);
  const me=t.id===ME,punted=me&&S.punt.has(K),unit=c.pct?'':` ${c.l}`;
  const diff=c.neg?avg-t.line[K]:t.line[K]-avg;   // >0 better than average
  const adiff=c.pct?f3(Math.abs(diff)):nf(Math.abs(diff),dp()),zero=+adiff.replace(/[^\d.]/g,'')===0;
  // for turnovers a plus sign would read as "more turnovers", so say fewer or more
  const diffTxt=zero?'Even':c.neg?`${adiff} ${diff>0?'fewer':'more'}`:`${diff>0?'+':'−'}${adiff}`;
  const beaten=M.teams.filter(o=>o.id!==t.id&&better(c,t.line[K],o.line[K])&&Math.abs(t.line[K]-o.line[K])>1e-9).length;
  // this week's chance in the category and the average over the weeks left
  const w=Math.min(curWeek,REGW),opp=curWeek<=REGW?oppOf(t.id,w):null,o=opp!=null?mp(t.id,opp,w):null;
  const lw=left().map(x=>{const op=oppOf(t.id,x);return op==null?null:mp(t.id,op,x).p[K]}).filter(x=>x!=null),avgP=lw.length?mean(lw):null;
  let h=catNav(t,K,'tc');
  h+=facts([
    fact(c.pct?'Team total':`Team total, ${per()}`,fv(c,t.line[K]),`#${r} of 10 in ${c.l}`,'lc|'+K),
    fact('Against the average',diffTxt,`League average ${fv(c,avg)}${c.neg?' (fewer is better)':''}`),
    fact('Teams beaten',`${beaten} of 9`,'Roster against roster','trec|'+t.id),
    fact('Category z',f1(t.catZ[K]),'Summed player z-scores','tval|'+t.id),
    o?fact(`${weekName(w)} chance`,pc(o.p[K]),`vs ${esc(teamById[opp].name)}`,`mc|${t.id}|${opp}|${w}|${K}`):'',
    avgP!=null?fact('Average weekly chance',pc(avgP),`Over the ${lw.length} week${lw.length===1?'':'s'} left`):''].filter(Boolean));
  if(punted)h+=`<p class="note">You are punting ${c.n.toLowerCase()}, so it is left out of your player values. Matchups still count it.</p>`;

  // gaps above and below, in plain numbers
  const avgP1=avgPlayer(c),gapLi=[];
  const ppTxt=o=>{const x=Math.abs(o.line[K]-t.line[K])*100;return `${x<.1?nf(x,2):nf(x,1)} percentage points`};
  if(ab){const need=needVs(t,ab,c);
    const ctx=c.pct?` That is ${ppTxt(ab)} of ${c.l}, at the same attempts.`:avgP1?` That is about ${pctOf(Math.max(need,0),avgP1)} of ${c.neg?'an average rostered player\'s turnovers':'what an average rostered player adds'}.`:'';
    gapLi.push(['move',`${passTxt(c,need)} passes ${esc(ab.name)}`,`They are #${r-1} at ${fv(c,ab.line[K])}.${ctx}`,`h2h|${t.id}|${ab.id}`])}
  if(r>2){const top=sorted[0],need=needVs(t,top,c);gapLi.push(['info',`${passTxt(c,need)} catches ${esc(top.name)} for #1`,`They lead the league at ${fv(c,top.line[K])}${c.pct?`, ${ppTxt(top)} ahead`:''}.`,`tc|${top.id}|${K}`])}
  if(be){const cu=-needVs(t,be,c);gapLi.push(['warn',`A cushion of ${cushTxt(c,cu)} over ${esc(be.name)}`,`They are #${r+1} at ${fv(c,be.line[K])}. Lose about that much and they pass ${me?'you':'this team'}.`,`h2h|${t.id}|${be.id}`])}
  if(!ab)gapLi.unshift(['move','First in the league','Nobody is ahead in this category.','']);
  h+=drillSec('The race around them',`Plain-number gaps to the teams just above and below${c.pct?', counted in made shots at the same number of attempts':''}.`,
    `<ul class="todo">${gapLi.map(([cls,a,b,st])=>`<li class="${cls}"><span class="dot" aria-hidden="true"></span><div><b>${a}</b><p>${b}</p></div>${st?`<div class="act"><button type="button" class="btn sm ghost" data-stat="${esc(st)}">${st.startsWith('h2h')?'Head to head':'Their breakdown'}</button></div>`:''}</li>`).join('')}</ul>`);

  // all ten teams, centred on the league average
  const rows=sorted.map(x=>{const d=c.neg?avg-x.line[K]:x.line[K]-avg,hi=x.id===t.id,mine=x.id===ME&&!hi;
    return {label:`${esc(x.name)}`,v:c.pct?d*100:d,txt:fv(c,x.line[K]),hi,me:mine,cls:hi||mine?undefined:'mut',stat:`tc|${x.id}|${K}`,
      tip:`#${x.catRank[K]} ${x.name}: ${fv(c,x.line[K])}${unit}${perC(c)}, ${c.pct?f3(Math.abs(d)):nf(Math.abs(d),dp())} ${d>=0?'better':'worse'} than average`}});
  h+=drillSec('All ten teams',`Bars show the distance from the league average of ${fv(c,avg)}${c.pct?` (every made shot over every attempt)`:''}; right of the line is better${c.neg?' (fewer turnovers)':''}. The number is the team total. Tap a team for its own breakdown.`,
    wide(CH.hbars(rows,{label:`${c.n} by team`,center:true,stack:true}))+legend([['hi',esc(t.name)],...(me?[]:[['me','Your team']]),['mut','Other teams']]));

  // every roster player's part
  const con=contrib(t,c),noData=t.roster.filter(p=>!p.pg);
  const rk=x=>{const d=x.ifAvg-r;return `<td class="num ${d>0?'down':d<0?'up':''}">${d?`#${x.ifAvg}`:'same'}</td>`};
  const carry=con.filter(x=>x.ifAvg>r),drag=con.filter(x=>x.ifAvg<r);
  const thW=`<th scope="col" title="The team's rank in ${c.l} if this player were swapped for an average rostered player (now #${r})">If average</th>`;
  const avgNote=`"If average" is the team's rank if that player were swapped for an average rostered player (now #${r}). Red: the team would fall, so they carry it. Green: it would climb, so they hold it back.`;
  let tb;
  if(c.pct){const s=sums(t,c);
    tb=`<div class="scroll dt-tight"><table><thead><tr><th class="l stick" scope="col">Player</th><th scope="col" title="Their ${c.l} and attempts ${per()}">${c.l}</th><th scope="col" title="Made shots above or below what a league-average shooter makes on the same attempts, and their share of the team's attempts">Impact</th>${thW}</tr></thead><tbody>
      ${con.map(x=>`<tr class="click" data-stat="${esc('pc|'+x.p.name+'|'+K)}" tabindex="0">${ncell(x.p,psub(x.p))}<td class="num"><b>${x.v==null?'–':f3(x.v)}</b><span class="rk">${nf(x.a,dp())} ${ATT[K]}</span></td><td class="num"><span class="${x.imp>0.05?'up':x.imp<-0.05?'down':''}" style="color:var(${x.imp>0.05?'--pos-fg':x.imp<-0.05?'--neg-fg':'--ink'})">${sf(x.imp,SEA()?0:2)}</span><span class="rk">${pc(x.share)} of ${ATT[K]}</span></td>${rk(x)}</tr>`).join('')}</tbody></table></div>`;
    h+=drillSec('Who makes the percentage',`The roster shoots ${f3(t.line[K])} on ${nf(s.a,dp())} ${ATT[K]} ${per()} (every player's attempts added up). Impact is made shots above or below a league-average shooter (${f3(M.lg[K])}) on the same attempts, so volume counts. ${avgNote} Tap a player for their breakdown.`,tb)}
  else{tb=`<div class="scroll dt-tight"><table><thead><tr><th class="l stick" scope="col">Player</th><th scope="col">${c.l}${SEA()?'':'&nbsp;/&nbsp;g'}</th><th scope="col">Share</th>${thW}</tr></thead><tbody>
      ${con.map(x=>`<tr class="click" data-stat="${esc('pc|'+x.p.name+'|'+K)}" tabindex="0">${ncell(x.p,psub(x.p))}<td class="num"><b>${nf(x.v,dp())}</b></td><td class="num">${pc(x.share)}${micro(x.share/.25)}</td>${rk(x)}</tr>`).join('')}</tbody></table></div>`;
    h+=drillSec(c.neg?'Who commits them':'Who produces it',`Each player's ${c.n.toLowerCase()} ${per()} and their share of the team's ${fv(c,t.line[K])} (the bar fills at 25%). ${avgNote} Tap a player for their breakdown.`,tb)}
  const nm=a=>listAnd(a.slice(0,3).map(x=>esc(x.p.name)))+(a.length>3?` (and ${a.length-3} more)`:'');
  h+=`<p class="note">${carry.length?`${nm(carry)} ${carry.length===1?'carries':'carry'} the team in ${c.l}: swap ${carry.length===1?'them':'any one of them'} for an average player and the rank drops.`:r===10?`The team is last in ${c.l}, so no single swap can drop it further.`:`No single player carries the team in ${c.l}: swapping any one of them for an average player leaves the rank at #${r}${r>1?' or better':''}.`}${drag.length?` ${nm(drag)} ${drag.length===1?'holds':'hold'} it back${c.neg?' with more turnovers than average':c.pct?' by shooting below league average on real volume':''}.`:''}</p>`;
  if(noData.length)h+=`<p class="note">No projection yet for ${noData.map(p=>esc(p.name)).join(', ')}; they count as zero.</p>`;

  // best free agents for this category, run through the roster
  const drop=dropDefault(t.id),kept=t.roster.filter(p=>p.pg&&p.name!==drop);
  const fas=M.fas.filter(f=>f.pg&&f.zpg&&f.zpg[K]!=null).sort((a,b)=>b.zpg[K]-a.zpg[K]).slice(0,6).map(f=>({f,nr:rankAs(lineOf([...kept,f]),t.id,K)}));
  if(fas.length){const fcell=f=>c.pct?`<b>${f3(catV(f.pg,c))}</b><span class="rk">${nf(f.pg[c.pct[1]],1)} ${ATT[K]}</span>`:`<b>${nf(f.pg[K],1)}</b>`;
    const srcs=[...new Set(fas.map(x=>x.f.src).filter(Boolean))],srcTxt=srcs.length===1?` Their numbers: ${esc(srcs[0])}.`:'';
    h+=drillSec('Best free agents for it',`Ranked by their z-score in ${c.l} (the shading). "If added" swaps them in for ${drop==='none'?'nobody':esc(drop)}, ${me?'your':'the team\'s'} lowest-value player, and re-ranks the team (now #${r}). Value is their overall value.${srcTxt}`,
      `<div class="scroll dt-tight"><table><thead><tr><th class="l stick" scope="col">Player</th><th scope="col">${c.l}${c.pct?'':'&nbsp;/&nbsp;g'}</th><th scope="col">If added</th><th scope="col">Value</th></tr></thead><tbody>
      ${fas.map(({f,nr})=>{const d=r-nr;return `<tr class="click" data-stat="${esc('pc|'+f.name+'|'+K)}" tabindex="0">${ncell(f,psub(f))}<td class="z ${zc(f.zpg[K])}" data-tip="${esc(`${f.name}: z ${f1(f.zpg[K])} in ${c.l}`)}">${fcell(f)}</td><td class="num ${d>0?'up':d<0?'down':''}">${d?`#${nr}`:'same'}</td><td class="num">${f.value==null?'–':f1(f.value)}</td></tr>`}).join('')}</tbody></table></div>`)}
  h+=`<div class="filters">${sbtn('lc|'+K,`The whole league in ${c.l}`,'linkbtn')}${sbtn('trec|'+t.id,'Category record vs the field','linkbtn')}</div>`;
  h+=how([`The team total adds up every rostered player's ${SEA()?'projected season':'per-game'} numbers (${c.pct?`made ${ATT[K].slice(0,-1)} divided by attempted, so high-volume shooters move it most`:'a roster-wide total, not one night\'s box score'}). This is how the board compares rosters head to head; the weekly matchup model adds the real NBA schedule and the 11-starter daily limit on top.`,
    `Gaps are the plain difference between the two team totals${c.pct?', turned into made shots: how many more makes, at the same attempts, would lift the percentage past the other team':''}. The amount to pass is rounded up so the number shown really passes; the cushion is rounded to the nearest step. Other teams are held fixed, which is assumed.`,
    '"If average" swaps one player for an average rostered player (the league-wide mean in every stat) and re-ranks the team, which isolates what that player adds; removing a player outright would mostly measure roster size, since every player adds to a counting total. "If added" swaps the free agent in for the lowest-value player on the roster; the other categories move too, so check the player\'s full value before adding them.',
    'Weekly chances come from the matchup model: projected totals for that week and how much the category usually swings.'] );
  return {eyebrow:esc(t.name),title:c.n,back:`${c.n} · ${t.abbr}`,sub:`#${r} of 10 · ${fv(c,t.line[K])}${unit}${perC(c)}${punted?' · punted':''}`,html:h}};

/* =====================================================================================
   tval|<teamId>: team value and grade
   ===================================================================================== */
const POS=['PG','SG','SF','PF','C'];
const posVal=()=>memo('dteam|pos',()=>{const o={};M.teams.forEach(t=>{const v={},n={};POS.forEach(x=>{v[x]=0;n[x]=0});
  t.roster.filter(p=>p.value!=null).forEach(p=>{const ps=p.pos.split('/').filter(x=>POS.includes(x));ps.forEach(x=>{v[x]+=p.value/ps.length;n[x]+=1})});o[t.id]={v,n}});
  const avg={},rank={};POS.forEach(x=>{avg[x]=mean(M.teams.map(t=>o[t.id].v[x]));const s=[...M.teams].sort((a,b)=>o[b.id].v[x]-o[a.id].v[x]);s.forEach((t,i)=>{(rank[t.id]=rank[t.id]||{})[x]=i+1})});
  return {o,avg,rank}});
const stars=()=>memo('dteam|stars',()=>{const o={};M.teams.forEach(t=>{const tv=t.roster.map(p=>p.tv||0).sort((a,b)=>b-a),sum=tv.reduce((s,x)=>s+x,0);
  o[t.id]={share:sum?(tv[0]+(tv[1]||0)+(tv[2]||0))/sum:0,solid:tv.filter(x=>x>=30).length,sum}});return o});
DRILL.tval=id=>{const t=TM(id);if(!t)return null;css();
  const byV=[...M.teams].sort((a,b)=>b.value-a.value),vr=byV.indexOf(t)+1,nvr=[...M.teams].sort((a,b)=>b.nv-a.nv).indexOf(t)+1,tvr=[...M.teams].sort((a,b)=>b.tvSum-a.tvSum).indexOf(t)+1;
  const st=stars(),my=st[t.id],avgShare=mean(M.teams.map(x=>st[x.id].share)),avgSolid=mean(M.teams.map(x=>st[x.id].solid));
  const punts=[...S.punt].map(k=>catOf(k).l);
  let h=facts([
    fact(punts.length?'Value, your punts':'Value',f1(t.value),`#${vr} of 10${punts.length?' · without '+punts.join(', '):' · all nine categories'}`),
    punts.length?fact('Value, all nine',f1(t.nv),`#${nvr} of 10`):'',
    fact('Grade',t.grade,`From the power score · power rank #${t.pr}`,'tpr|'+t.id),
    fact('Trade value, total',t.tvSum.toFixed(0),`#${tvr} of 10 · league avg ${mean(M.teams.map(x=>x.tvSum)).toFixed(0)}`),
    fact('Top three share',pc(my.share),`League average ${pc(avgShare)}`),
    fact('Solid starters or better',String(my.solid),`Trade value 30+ · avg ${avgSolid.toFixed(1)}`),
    ...(()=>{const b=[...t.roster].filter(p=>p.value!=null).sort((x,y)=>y.value-x.value)[0];return b?[fact('Most valuable',esc(lastName(b.name)),`${esc(b.name)} · value ${f1(b.value)}`,'pv|'+b.name)]:[]})()].filter(Boolean));

  const ro=[...t.roster].sort((a,b)=>(b.value??-99)-(a.value??-99));
  h+=drillSec('Value by player',`Each player's value (summed z-scores${punts.length?' without your punts':''}, ${SEA()?'scaled by games played':'per game'}). Right of the line helps. Tap a player to see where it comes from.`,
    wide(CH.hbars(ro.map(p=>({label:`${esc(p.name)}<small>${esc(p.pos)}</small>`,v:p.value,txt:p.value==null?'No data':f1(p.value),cls:pn(p.value),stat:'pv|'+p.name,
      tip:`${p.name}: value ${p.value==null?'none':f1(p.value)}${p.rank?', #'+p.rank+' of '+M.players.length+' rostered':''}, trade value ${p.tv.toFixed(0)}`})),{label:'Value by player',center:true,stack:true})));

  const srt=[...M.teams].sort((a,b)=>st[b.id].share-st[a.id].share);
  h+=drillSec('Stars or depth',`Share of each team's total trade value held by its three most valuable players. High means a star-led roster; low means value spread through the depth chart.`,
    wide(CH.hbars(srt.map(x=>{const hi=x.id===t.id,mine=x.id===ME&&!hi;return {label:esc(x.name),v:st[x.id].share,txt:pc(st[x.id].share),hi,me:mine,cls:hi||mine?undefined:'mut',stat:'tval|'+x.id,
      tip:`${x.name}: top three hold ${pc(st[x.id].share)} of ${st[x.id].sum.toFixed(0)} trade value; ${st[x.id].solid} players at 30+`}}),{label:'Top three share by team',max:1,stack:true}))+legend([['hi',esc(t.name)],...(t.id===ME?[]:[['me','Your team']]),['mut','Other teams']]));

  const P=posVal(),pvT=P.o[t.id];
  h+=drillSec('Value by position',`Value from the players eligible at each spot (a multi-position player's value is split evenly), shown as the difference from the league-average team. The small number is the league rank. Tap a position for scarcity across the league.`,
    CH.hbars(POS.map(x=>({label:`${x}<small>#${P.rank[t.id][x]}</small>`,v:pvT.v[x]-P.avg[x],txt:f1(pvT.v[x]-P.avg[x]),cls:pn(pvT.v[x]-P.avg[x]),stat:'pos|'+x,
      tip:`${x}: ${f1(pvT.v[x])} value from ${pvT.n[x]} eligible player${pvT.n[x]===1?'':'s'}, league average ${f1(P.avg[x])}, rank #${P.rank[t.id][x]}`})),{label:'Value by position vs average',center:true}));

  h+=drillSec('Category z totals',`Summed z-scores by category, with the league rank. ${punts.length?'Punted categories are grey. ':''}Tap one to see the players behind it.`,
    CH.hbars(CATS.map(c=>({label:`${c.l}<small>#${t.catRank[c.k]}</small>`,v:t.catZ[c.k],txt:f1(t.catZ[c.k]),cls:S.punt.has(c.k)?'mut':pn(t.catZ[c.k]),stat:`tc|${t.id}|${c.k}`,
      tip:`${c.n}: z ${f1(t.catZ[c.k])}, rank #${t.catRank[c.k]}, team total ${fv(c,t.line[c.k])}${perC(c)}`})),{label:'Category z totals',center:true}));
  h+=`<div class="filters">${sbtn('tdr|'+t.id,'Their draft','linkbtn')}${sbtn('tpr|'+t.id,'Power rank breakdown','linkbtn')}${sbtn('trec|'+t.id,'Category record vs the field','linkbtn')}</div>`;
  h+=how([`A player's value adds up their z-scores: how far above or below an average rostered player they are in each category, in standard deviations, with turnovers flipped so fewer is better and the percentages weighted by attempts. Team value is the sum over the roster${punts.length?', leaving out the categories you punt':''}.`,
    'Trade value (0 to 100) is the league-wide chart from the Trades tab: it ignores punts and blends the model with draft slot'+(BLEND.hasRos?' and rest-of-season rank':'')+'. Top three share and the 30+ count use it because it is never negative.',
    'The grade comes from the power score, not value alone: A is a score of 0.9 or more, B+ 0.35, B −0.3, C+ −0.9, C below that. See the power rank breakdown for the score.']);
  return {eyebrow:esc(t.name),title:'Team value',back:`Team value · ${t.abbr}`,sub:`Value ${f1(t.value)} (#${vr} of 10) · grade ${t.grade} · ${t.count} players`,html:h}};

/* =====================================================================================
   tpr|<teamId>: power rank breakdown
   ===================================================================================== */
function tprParts(){return memo('dteam|tpr',()=>{const ts=M.teams,zs=a=>{const m=mean(a),s=sdev(a);return {z:a.map(x=>(x-m)/s),m,s}};
  const V=zs(ts.map(t=>t.nv)),R=zs(ts.map(t=>t.rr)),played=ts.some(hasRec),alpha=played?weeksDone/(weeksDone+3):0;
  const wp=ts.map(t=>{const r=t.record||{w:0,l:0,t:0},n=r.w+r.l+r.t;return n?(r.w+r.t/2)/n:.5}),A=played?zs(wp):{z:ts.map(()=>0),m:.5,s:1};
  const o={};ts.forEach((t,i)=>o[t.id]={v:(1-alpha)*V.z[i]/3,r:(1-alpha)*R.z[i]*2/3,a:alpha*A.z[i],wp:wp[i],score:t.score});
  const rrRank={},nvRank={};[...ts].sort((a,b)=>b.rr-a.rr).forEach((t,i)=>rrRank[t.id]=i+1);[...ts].sort((a,b)=>b.nv-a.nv).forEach((t,i)=>nvRank[t.id]=i+1);
  return {o,alpha,V,R,A,played,rrRank,nvRank}})}
LAB.tprParts=tprParts;
DRILL.tpr=id=>{const t=TM(id);if(!t)return null;css();
  const P=tprParts(),me=P.o[t.id],al=P.alpha,ts=[...M.teams].sort((a,b)=>a.pr-b.pr),ab=ts[t.pr-2]||null,be=ts[t.pr]||null;
  let h=facts([
    fact('Power rank',`#${t.pr}`,`Score ${f2(t.score)} · grade ${t.grade}`),
    fact('Weekly strength',t.rr.toFixed(2),`Categories won in an average week · #${P.rrRank[t.id]}`,'trec|'+t.id),
    fact('Roster value',f1(t.nv),`All nine categories · #${P.nvRank[t.id]}`,'tval|'+t.id),
    fact('Real results weight',pc(al),P.played?`${weeksDone} week${weeksDone===1?'':'s'} played`:'No games yet')]);
  h+=drillSec('What the score is made of',`Each part is the team's distance from the league average in standard deviations, times its weight. They add up to the score of ${f2(t.score)}.`,
    CH.hbars([
      {label:`Weekly strength <small>×${(2/3*(1-al)).toFixed(2)}</small>`,v:me.r,txt:f2(me.r),cls:pn(me.r),stat:'trec|'+t.id,tip:`${t.rr.toFixed(2)} categories a week vs a league average of ${P.R.m.toFixed(2)}`},
      {label:`Roster value <small>×${(1/3*(1-al)).toFixed(2)}</small>`,v:me.v,txt:f2(me.v),cls:pn(me.v),stat:'tval|'+t.id,tip:`Roster value ${f1(t.nv)} vs a league average of ${sf(P.V.m,1)}`},
      {label:`Real record <small>×${al.toFixed(2)}</small>`,v:me.a,txt:f2(me.a),cls:pn(me.a),stat:'trec|'+t.id,tip:P.played?`Categories won ${pc(me.wp)} vs a league average of ${pc(P.A.m)}`:'Counts once games are played'}],{label:'Power score parts',center:true,stack:true}));
  h+=drillSec('Power score, all ten teams','Tap a team for its own breakdown.',
    wide(CH.hbars(ts.map(x=>{const hi=x.id===t.id,mine=x.id===ME&&!hi;return {label:`${x.pr}. ${esc(x.name)}`,v:x.score,txt:f2(x.score),hi,me:mine,cls:hi||mine?undefined:'mut',stat:'tpr|'+x.id,
      tip:`#${x.pr} ${x.name}: score ${f2(x.score)}, ${x.rr.toFixed(2)} categories a week, roster value ${f1(x.nv)}`}}),{label:'Power score by team',center:true,stack:true}))+legend([['hi',esc(t.name)],...(t.id===ME?[]:[['me','Your team']]),['mut','Other teams']]));
  // the teams just above and below: who leads, by how much, and which part of the score makes the difference
  const card=(o,dir)=>{if(!o)return '';const q=P.o[o.id],L=dir>0?o:t,F=dir>0?t:o,lq=dir>0?q:me,fq=dir>0?me:q,gap=Math.abs(o.score-t.score),mx=M.mx[t.id][o.id];
    const kR=(1-al)*(2/3)/P.R.s,kV=(1-al)/3/P.V.s;
    const parts=[[lq.r-fq.r,'Weekly strength',`${L.rr.toFixed(2)} vs ${F.rr.toFixed(2)} categories a week`],[lq.v-fq.v,'Roster value',`${f1(L.nv)} vs ${f1(F.nv)}`],...(al?[[lq.a-fq.a,'Real record',`${pc(lq.wp)} vs ${pc(fq.wp)} of categories won`]]:[])].sort((a,b)=>Math.abs(b[0])-Math.abs(a[0]));
    const kA=al/P.A.s,recAmt=al&&P.played?`, or a real record ${up(gap/kA*100,0).toFixed(0)} percentage points better`:'';
    const amt=`about ${up(gap/kR,2).toFixed(2)} more categories won a week, or ${up(gap/kV,1).toFixed(1)} more roster value${recAmt} (${recAmt?'any':'either'} one alone)`;
    const pass=kR>0?(dir>0?`${t.id===ME?'You':'This team'} would pass them with ${amt}.`:`They would pass ${t.id===ME?'you':'this team'} with ${amt}.`):'';
    const res=mx.w>mx.l?`wins ${scoreStr(mx)}`:mx.w<mx.l?`loses ${scoreStr(mx)}`:`ties ${scoreStr(mx)}`;
    return `<div class="sub"><span class="lbl">${dir>0?'Just above':'Just below'} · #${o.pr}</span><h3>${tlink(o)}</h3>
      <p class="note" style="margin:0">${esc(L.name)} leads by ${gap.toFixed(2)}.</p>
      <ul class="note" style="margin:0;padding-left:18px">${parts.map(([d,l,raw])=>`<li>${l}: ${d>=0?'+':'−'}${Math.abs(d).toFixed(2)} for ${esc(L.name)} (${raw})</li>`).join('')}</ul>
      ${pass?`<p class="note" style="margin:0">${pass}</p>`:''}
      <p class="note" style="margin:0">Roster against roster, ${esc(t.name)} ${res} in categories.</p>
      <div class="filters"><button type="button" class="btn sm ghost" data-stat="${esc(`h2h|${t.id}|${o.id}`)}">Head to head</button><button type="button" class="btn sm ghost" data-stat="${esc('tpr|'+o.id)}">Their breakdown</button></div></div>`};
  if(ab||be)h+=drillSec('The teams around them','',`<div class="cols">${card(ab,1)}${card(be,-1)}</div>`);
  h+=how(['Power rank sorts teams by a score with two parts before games start. Weekly strength (two thirds) is the number of categories a team is expected to win in a week, against every other team, averaged over the weeks left; it runs through the real NBA schedule and the 11-starter daily limit and ignores who the team happens to draw. Roster value (one third) adds up every player\'s value across all nine categories, which rewards depth and trade assets.',
    `Each part is turned into standard deviations from the league average before weighting, so the parts are comparable. Once weeks are played, the real win rate takes a share of weeks played ÷ (weeks played + 3)${P.played?`, ${pc(al)} now`:''}, and the two model parts shrink to make room.`,
    'The "to pass them" amounts hold every other team fixed and ignore that one team\'s change also moves the league average a little, so treat them as close estimates.']);
  return {eyebrow:esc(t.name),title:`Power rank #${t.pr}`,back:`Power rank · ${t.abbr}`,sub:`Score ${f2(t.score)} · ${t.rr.toFixed(2)} categories a week · roster value ${f1(t.nv)}`,html:h}};

/* =====================================================================================
   tpo|<teamId>: playoff odds from seasonSim()
   ===================================================================================== */
DRILL.tpo=id=>{const t=TM(id);if(!t)return null;css();
  const SS=seasonSim(),s=SS[t.id];if(!s)return null;
  const bye=s.seed.slice(0,3).reduce((a,x)=>a+x,0),avgS=avgSeed(s),mostI=s.seed.indexOf(Math.max(...s.seed));
  const lw=left(),rows=lw.map(w=>{const op=oppOf(t.id,w);if(op==null)return null;const q=mp(t.id,op,w);return {w,op,q}}).filter(Boolean);
  const expMw=rows.reduce((a,r)=>a+r.q.win,0),fav=rows.filter(r=>r.q.win>=.5).length;
  const wR=Math.round(s.w),lR=Math.round(s.w+s.l)-wR,recTxt=`${wR}-${lR}`;   // rounded so the two still add up to every category played
  const stand=[...M.teams].sort((a,b)=>SS[b.id].w-SS[a.id].w),place=stand.indexOf(t)+1,fifth=stand[4],sixth=stand[5];
  const line=place<=5?`Projected ${ord(place)} by category wins. Cushion over ${esc(sixth.name)} (6th): ${(s.w-SS[sixth.id].w).toFixed(1)} category wins.`
    :`Projected ${ord(place)} by category wins, ${(SS[fifth.id].w-s.w).toFixed(1)} behind ${esc(fifth.name)} in 5th, the last playoff spot.`;
  let h=facts([
    fact('Playoff odds',pc(s.po),'Top five make it','ttl|'+t.id),
    fact('First-round bye',pc(bye),'Seeds 1 to 3 (assumed format)','ttl|'+t.id),
    fact('#1 seed',pc(s.top),`Most likely seed: ${mostI+1}`,'ttl|'+t.id),
    fact('Average finish',avgS.toFixed(1),'Of 10'),
    fact('Projected final record',recTxt,hasRec(t)?`Category wins and losses · now ${scoreStr(t.record)}${t.record.t?' (ties count half)':''}`:'Category wins and losses','trec|'+t.id),
    rows.length?fact('Matchups won, expected',`${expMw.toFixed(1)} of ${rows.length}`,`Favored in ${fav} of the ${rows.length} week${rows.length===1?'':'s'} left`):'']);
  h+=`<p class="note">${line}</p>`;
  h+=drillSec('Where they finish',`Share of 4,000 simulated seasons ending in each seed. Green seeds make the playoffs.`,
    CH.dist(s.seed.map((p,i)=>({x:i+1,p,cls:i<5?'bar-w':'bar-n',tip:`Seed ${i+1}`,em:i===mostI})),{label:'Seed probabilities',legend:legend([['w','Makes the playoffs'],['mut','Misses']])}));
  if(rows.length){const cls=t.id===ME?'s2':'s1';
    h+=drillSec('Win chance, week by week',`Chance to win each remaining regular-season week (5 or more of the 9 categories). The dashed line is a coin flip. Tap a point for the matchup.`,
      CH.line([{name:esc(t.name),cls,pts:rows.map(r=>[r.w,r.q.win,`mw|${t.id}|${r.op}|${r.w}`])}],{y0:0,y1:1,ref:.5,fmt:pc,xl:x=>'W'+x,label:'Weekly win chance'}));
    const srt=[...rows].sort((a,b)=>a.q.win-b.q.win),n2=rows.length>=4?2:1,pick=[...srt.slice(0,n2).map(r=>['Hardest',r]),...srt.slice(-n2).reverse().map(r=>['Easiest',r])];
    const wf=([lab,r])=>fact(`${lab}: ${weekName(r.w)}`,pc(r.q.win),`vs ${esc(teamById[r.op].name)} · ${r.q.exp.toFixed(1)}–${r.q.expL.toFixed(1)} categories`,`mw|${t.id}|${r.op}|${r.w}`);
    if(rows.length>=2)h+=facts(pick.map(wf));
    h+=drillSec('The schedule left','Win chance and expected categories (for–against) for every week. Tap a week for the full matchup.',
      `<div class="scroll dt-tight dt-sched"><table><thead><tr><th scope="col">Wk</th><th class="l" scope="col">Opponent</th><th class="l" scope="col">Win chance · categories</th></tr></thead><tbody>
      ${rows.map(r=>`<tr class="click ${r.op===ME?'me':''}" data-stat="${esc(`mw|${t.id}|${r.op}|${r.w}`)}" tabindex="0"><td class="num">${r.w}</td><td class="l tname" style="white-space:normal">${esc(teamById[r.op].name)}<small>${weekLabel(r.w)} · power&nbsp;#${tm(r.op).pr}</small></td><td class="l"><div class="wp" data-tip="${esc(`${weekName(r.w)} vs ${teamById[r.op].name}: ${pc(r.q.win)} to win, ${r.q.exp.toFixed(1)} to ${r.q.expL.toFixed(1)} categories expected`)}"><span style="width:${pc(r.q.win)}"></span><em>${pc(r.q.win)} · ${r.q.exp.toFixed(1)}–${r.q.expL.toFixed(1)}</em></div></td></tr>`).join('')}</tbody></table></div>`)}
  else h+=`<div class="empty">The regular season is over; the seeds are set.</div>`;
  h+=how(['The board plays out the rest of the regular season 4,000 times. In each simulated week, every category of every matchup goes to one team or the other with the chance from the matchup model (projected totals through the real NBA schedule and the 11-starter limit, and how much each category usually swings). Categories are drawn independently, which is assumed; real weeks have some streakiness.',
    `Standings rank teams by category win percentage, the way this league keeps them, and the top five make the playoffs. Ties are broken at random (ESPN's tiebreakers are not modelled). ${hasRec(t)?'Results already played are locked in. ':''}The projected final record is the average over all simulations.`,
    'The bye assumes the ESPN format for a 5-team bracket over weeks 21 to 23: seeds 4 and 5 meet in round one while seeds 1 to 3 rest, then 1 plays the lowest seed left and 2 plays 3, then the final.']);
  return {eyebrow:esc(t.name),title:`Playoff odds ${pc(s.po)}`,back:`Playoff odds · ${t.abbr}`,sub:`Average finish ${avgS.toFixed(1)} · projected ${recTxt} in categories`,html:h}};

/* =====================================================================================
   trec|<teamId>: category record vs the field
   ===================================================================================== */
DRILL.trec=id=>{const t=TM(id);if(!t)return null;css();
  const others=[...M.teams].filter(x=>x.id!==t.id).sort((a,b)=>a.pr-b.pr),recRank=[...M.teams].sort((a,b)=>(b.rec.w-b.rec.l)-(a.rec.w-a.rec.l)).indexOf(t)+1;
  const byC=CATS.map(c=>{let w=0,l=0,tt=0;others.forEach(o=>{const x=t.line[c.k],y=o.line[c.k];if(Math.abs(x-y)<1e-9)tt++;else if(better(c,x,y))w++;else l++});return {c,w,l,t:tt}});
  const pool=byC.filter(x=>!(t.id===ME&&S.punt.has(x.c.k))),cand=pool.length?pool:byC;   // Matt's punted categories are not his weakest by choice
  const best=[...cand].sort((a,b)=>b.w-a.w)[0],worst=[...cand].sort((a,b)=>a.w-b.w)[0],R=t.record||{w:0,l:0,t:0},n=R.w+R.l+R.t;
  const proj=t.rec.w+t.rec.l+t.rec.t?(t.rec.w+t.rec.t/2)/(t.rec.w+t.rec.l+t.rec.t):.5,real=n?(R.w+R.t/2)/n:null;
  const stRank=n?[...M.teams].sort((a,b)=>{const ra=a.record||{w:0,l:0,t:0},rb=b.record||{w:0,l:0,t:0},na=ra.w+ra.l+ra.t,nb=rb.w+rb.l+rb.t;return (nb?(rb.w+rb.t/2)/nb:0)-(na?(ra.w+ra.t/2)/na:0)}).indexOf(t)+1:null;
  let h=facts([
    fact('Vs the field',scoreStr(t.rec),`#${recRank} of 10 · favored against ${t.rec.mw} of 9`),
    fact('Best category',best.c.l,`Beats ${best.w} of 9`,`tc|${t.id}|${best.c.k}`),
    fact('Weakest category',worst.c.l,`Beats ${worst.w} of 9`,`tc|${t.id}|${worst.c.k}`),
    fact('Real record',n?scoreStr(R):'0-0',n?`${pc(real)} of categories · #${stRank} in standings`:'No games played yet','tpo|'+t.id)]);
  if(n){const d=real-proj;h+=`<p class="note">Real results run ${Math.abs(d)<.02?'right in line with':`${Math.round(Math.abs(d)*100)} percentage points ${d>0?'above':'below'}`} what the rosters suggest (${pc(proj)} of categories against the field).${Math.abs(d)>=.05?(d>0?' Part of that is the schedule and luck, so some of it may even out.':' Part of that is the schedule and bad luck, so some of it may even out.'):''}</p>`}
  h+=drillSec('Against each team','Categories won of the nine, roster against roster. Green bars win more categories than they lose. Tap a team for the full head to head.',
    wide(CH.hbars(others.map(o=>{const r=M.mx[t.id][o.id],wc=CATS.filter(c=>better(c,t.line[c.k],o.line[c.k])).map(c=>c.l);
      return {label:`${esc(o.name)}`,v:r.w,txt:scoreStr(r),cls:r.w>r.l?'pos':r.w<r.l?'neg':'mut',stat:`h2h|${t.id}|${o.id}`,tip:`vs ${o.name}: ${scoreStr(r)}. Wins ${wc.join(', ')||'nothing'}`}}).sort((a,b)=>b.v-a.v),{label:'Categories won by opponent',max:9,stack:true}))
    +legend([['pos','Wins more categories'],['neg','Loses more']]));
  h+=drillSec('By category','How many of the nine other teams they beat in each category; green when they beat more teams than they lose to. Tap a category for the team\'s breakdown.',
    CH.hbars(byC.map(x=>({label:`${x.c.l}<small>#${t.catRank[x.c.k]}</small>`,v:x.w,txt:`${x.w}-${x.l}${x.t?'-'+x.t:''}`,cls:S.punt.has(x.c.k)&&t.id===ME?'mut':x.w>x.l?'pos':x.w<x.l?'neg':'mut',stat:`tc|${t.id}|${x.c.k}`,
      tip:`${x.c.n}: beats ${x.w} of 9 teams, rank #${t.catRank[x.c.k]}`})),{label:'Teams beaten by category',max:9}));
  h+=drillSec('Every result','Each cell is this roster against that one in a category: W, L or T. Hover or focus a cell for both totals.',
    `<div class="scroll"><table class="hm"><thead><tr><th class="l stick" scope="col">Opponent</th>${CATS.map(c=>`<th scope="col" class="${S.punt.has(c.k)&&t.id===ME?'punted':''}">${sbtn(`tc|${t.id}|${c.k}`,c.l)}</th>`).join('')}<th scope="col">Result</th></tr></thead><tbody>
    ${others.map(o=>{const r=M.mx[t.id][o.id];return `<tr class="${o.id===ME?'me':''}"><td class="l stick" style="text-align:left;font-family:var(--body)"><button type="button" class="sx" data-stat="${esc(`h2h|${t.id}|${o.id}`)}" data-tip="${esc(o.name)}" style="display:block;max-width:9.5em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.name)}</button></td>${CATS.map(c=>{const x=t.line[c.k],y=o.line[c.k],tie=Math.abs(x-y)<1e-9,win=better(c,x,y);
      const [sx_,sy_]=fvPair(c,x,y);
      return `<td class="${tie?'':win?'p1':'n1'} ${S.punt.has(c.k)&&t.id===ME?'punted':''}" data-tip="${esc(`${c.l}: ${sx_} vs ${sy_} (${o.name})`)}" data-stat="${esc(`h2h|${t.id}|${o.id}`)}" tabindex="0">${tie?'T':win?'W':'L'}</td>`}).join('')}<td><b>${scoreStr(r)}</b></td></tr>`}).join('')}</tbody></table></div>`);
  h+=how([`"Vs the field" compares this roster's category totals (${SEA()?'over the season':'per game'}, every rostered player added up) with each other team's, one category at a time. It ignores the weekly schedule, so it measures the roster, not the luck of the draw.`,
    'A favored matchup is one where the roster wins more of the nine categories than it loses. The real record counts category wins, losses and ties from games played, the way this league keeps standings.']);
  return {eyebrow:esc(t.name),title:'Category record',back:`Category record · ${t.abbr}`,sub:`${scoreStr(t.rec)} against the field · favored against ${t.rec.mw} of 9${n?' · real '+scoreStr(R):''}`,html:h}};

/* =====================================================================================
   tgm|<teamId>: games by week
   ===================================================================================== */
const gmAll=()=>memo('dteam|gm',()=>{const per={};M.teams.forEach(t=>per[t.id]=WEEKS.map(w=>{const P=projTeam(t.id,w,0);return {g:P.games,b:P.bench}}));
  const avg=WEEKS.map((_,i)=>mean(M.teams.map(t=>per[t.id][i].g))),avgB=WEEKS.map((_,i)=>mean(M.teams.map(t=>per[t.id][i].b)));
  // regular-season totals cover the weeks not yet finished (a finished week's projection is not what happened)
  const regI=WEEKS.map((w,i)=>w<=REGW&&!done(w)?i:-1).filter(i=>i>=0);
  const tot={};M.teams.forEach(t=>{const a=per[t.id];tot[t.id]={reg:regI.reduce((s,i)=>s+a[i].g,0),po:a.filter((_,i)=>WEEKS[i]>REGW).reduce((s,x)=>s+x.g,0),bench:regI.reduce((s,i)=>s+a[i].b,0)}});
  const rk=f=>{const o={};[...M.teams].sort((a,b)=>f(b)-f(a)).forEach((t,i)=>o[t.id]=i+1);return o};
  return {per,avg,avgB,tot,rReg:rk(t=>tot[t.id].reg),rPo:rk(t=>tot[t.id].po),rBench:rk(t=>-tot[t.id].bench)}});
DRILL.tgm=id=>{const t=TM(id);if(!t)return null;css();
  const G=gmAll(),a=G.per[t.id],T=G.tot[t.id],lgReg=mean(M.teams.map(x=>G.tot[x.id].reg)),lgPo=mean(M.teams.map(x=>G.tot[x.id].po)),lgB=mean(M.teams.map(x=>G.tot[x.id].bench));
  const diffs=WEEKS.map((w,i)=>({w,i,d:a[i].g-G.avg[i]})).filter(x=>x.w<=REGW&&!done(x.w)),bestW=[...diffs].sort((x,y)=>y.d-x.d)[0],worstW=[...diffs].sort((x,y)=>x.d-y.d)[0];
  const mwOf=w=>{const op=oppOf(t.id,w);return op==null?null:`mw|${t.id}|${op}|${w}`};
  const regLeft=WEEKS.some(w=>w<=REGW&&!done(w)),some=weeksDone>0,odd=WEEKS.filter(w=>(PER[w]||[]).length!==7).map(w=>`${weekName(w).toLowerCase()} is ${PER[w].length} days`);
  let h=facts([
    regLeft?fact(some?'Regular-season games left':'Regular-season games',T.reg.toFixed(0),`#${G.rReg[t.id]} of 10 · ${sf(Math.round(T.reg-lgReg),0)} vs average`):'',
    (()=>{const w=Math.min(curWeek,REGW),i=WEEKS.indexOf(w);return i<0||curWeek>REGW?'':fact(`${weekName(w)} games`,a[i].g.toFixed(0),`League average ${G.avg[i].toFixed(1)}${a[i].b?` · ${a[i].b} benched`:''}`,mwOf(w))})(),
    fact('Playoff games',T.po.toFixed(0),`Weeks ${PO_WEEKS.join(', ')} · #${G.rPo[t.id]} of 10 · ${sf(Math.round(T.po-lgPo),0)} vs average`),
    regLeft?fact('Benched games',String(T.bench),`A game but no open slot${some?', weeks left':''} · league avg ${lgB.toFixed(0)}`):'',
    bestW?fact('Best week',`${weekName(bestW.w)}`,`${sf(bestW.d,1)} games vs average`,mwOf(bestW.w)):'',
    worstW?fact('Thinnest week',`${weekName(worstW.w)}`,`${sf(worstW.d,1)} games vs average`,mwOf(worstW.w)):'']);
  const me=t.id===ME,series=[{name:esc(t.name),cls:me?'s2':'s1',pts:WEEKS.map((w,i)=>[w,a[i].g,w<=REGW?mwOf(w):null])}];
  if(!me)series.push({name:'Your team',cls:'s2',pts:WEEKS.map((w,i)=>[w,G.per[ME][i].g])});
  series.push({name:'League average',cls:'s3',pts:WEEKS.map((w,i)=>[w,G.avg[i]])});
  h+=drillSec('Player-games by week',`Expected games that count each week, after the daily 11-starter limit and expected rest. ${PO_WEEKS.map(wkShort).join(', ')} are the fantasy playoffs.${odd.length?' '+listAnd(odd).replace(/^./,x=>x.toUpperCase())+'.':''}`,
    CH.line(series,{xl:wkShort,fmt:v=>v.toFixed(0),label:'Games by week'}));
  const cell=d=>d>=2.5?'p3':d>=1?'p2':d>=.4?'p1':d<=-2.5?'n3':d<=-1?'n2':d<=-.4?'n1':'';
  h+=drillSec('Week by week',`Green weeks give this roster more games than the league average that week, red fewer${some?'; faded weeks are finished':''}. Tap a regular-season week for the matchup; point at any week for the league average and benched games.`,
    `<div class="gchips">${WEEKS.map((w,i)=>{const d=a[i].g-G.avg[i],st=w<=REGW?mwOf(w):null,tip=`${weekName(w)} (${weekLabel(w)}): ${a[i].g.toFixed(1)} games, league average ${G.avg[i].toFixed(1)}${a[i].b?`, ${a[i].b} benched`:''}`;
      const inner=`<b>${a[i].g.toFixed(0)}</b><small>${wkShort(w)}</small>`;
      return st?`<button type="button" class="gc ${cell(d)}" data-stat="${esc(st)}" data-tip="${esc(tip)}" style="border:0;font:inherit;cursor:pointer;${done(w)?'opacity:.55':''}">${inner}</button>`:`<span class="gc ${cell(d)}" data-tip="${esc(tip)}" tabindex="0"${done(w)?' style="opacity:.55"':''}>${inner}</span>`}).join('')}</div>`);
  const ro=t.roster.filter(p=>p.pg).map(p=>({p,g:poGames(p)})).sort((x,y)=>y.g-x.g),avgPo=mean(M.players.filter(p=>p.pg).map(poGames));
  const groups=[...new Set(ro.map(x=>x.g))].sort((a,b)=>b-a).map(g=>({g,ps:ro.filter(x=>x.g===g)}));
  h+=drillSec('Playoff games by player',`NBA games in weeks ${PO_WEEKS[0]} to ${PO_WEEKS[PO_WEEKS.length-1]} for each player's team. An average rostered player has ${avgPo.toFixed(1)}; green is more, red fewer. Tap a player for their week-by-week schedule.`,
    `<div style="display:flex;flex-direction:column">${groups.map(({g,ps})=>{const d=g-avgPo;return `<div style="display:grid;grid-template-columns:3.4em minmax(0,1fr);gap:12px;align-items:center;padding:8px 0;border-top:1px solid var(--soft)">
      <span class="gc ${d>=.5?'p2':d<=-.5?'n2':''}" data-tip="${esc(`${g} playoff games, ${sf(d,1)} vs an average rostered player`)}" tabindex="0"><b>${g}</b><small>games</small></span>
      <div style="display:flex;flex-wrap:wrap;gap:4px 12px;min-width:0">${ps.map(x=>`<button type="button" class="sx" data-stat="${esc('pgm|'+x.p.name)}" data-tip="${esc(`${x.p.name} (${x.p.nba}): ${PO_WEEKS.map(w=>gamesIn(x.p.nba,w)).join(' + ')} games in ${PO_WEEKS.map(wkShort).join(', ')}`)}" style="font-size:.86rem">${esc(x.p.name)}</button>`).join('')}</div></div>`}).join('')}</div>`);
  h+=how(['Each week is played out day by day on the real NBA schedule. On each day, the players with games fill the 11 starting slots (PG, SG, SF, PF, C, G, F and four UTIL) in order of value; extra players with games that day sit, and those are the benched games. Each started game is weighted by how often the player is expected to play (projected games out of 82, capped between 25% and 97%), so the totals are expected games, not raw games.',
    `Benched games are raw games: a player had a game that day but all the slots they fit were taken.${some?' Finished weeks are faded in the chips and left out of the season totals, since a projection for a week already played is not what happened.':''} Players listed out are discounted in the current and next week. The playoff weeks assume today\'s roster stays together.`]);
  return {eyebrow:esc(t.name),title:'Games by week',back:`Games by week · ${t.abbr}`,sub:`${regLeft?`${T.reg.toFixed(0)} regular-season games${some?' left':''} (#${G.rReg[t.id]}) · `:''}${T.po.toFixed(0)} in the playoffs (#${G.rPo[t.id]})`,html:h}};

/* =====================================================================================
   h2h|<teamA>|<teamB>: roster against roster
   ===================================================================================== */
function h2hEdges(a,b){const A=TM(a),B=TM(b);if(!A||!B)return null;
  return CATS.map(c=>{const x=A.line[c.k],y=B.line[c.k],sd=sdev(M.teams.map(t=>t.line[c.k]))||1,d=(c.neg?y-x:x-y);
    return {c,a:x,b:y,edge:d/sd,win:Math.abs(x-y)<1e-9?0:d>0?1:-1}})}
LAB.h2hEdges=h2hEdges;
DRILL.h2h=(ia,ib)=>{const A=TM(ia),B=TM(ib);if(!A||!B||A.id===B.id)return null;
  const E=h2hEdges(A.id,B.id),r=M.mx[A.id][B.id],weeks=meetings(A.id,B.id),nextW=weeks.find(w=>!done(w)&&w>=Math.max(1,curWeek))??null;
  const nx=nextW!=null?mp(A.id,B.id,nextW):null,up_=weeks.filter(w=>!done(w)),avgWin=up_.length?mean(up_.map(w=>mp(A.id,B.id,w).win)):null;
  const aw=E.filter(e=>e.win>0).map(e=>e.c.l),bw=E.filter(e=>e.win<0).map(e=>e.c.l),close=E.filter(e=>Math.abs(e.edge)<.25&&e.win!==0).map(e=>e.c.l);
  const link=e=>nextW!=null?`mc|${A.id}|${B.id}|${nextW}|${e.c.k}`:`tc|${A.id}|${e.c.k}`;
  let h=facts([
    fact('Roster against roster',scoreStr(r),r.w>r.l?`${esc(A.name)} ahead`:r.w<r.l?`${esc(B.name)} ahead`:'Dead even','trec|'+A.id),
    fact('Regular-season meetings',String(weeks.length),weeks.length?'Weeks '+weeks.join(', '):'None scheduled'),
    nx?fact(`Next: ${weekName(nextW)}`,pc(nx.win),`Chance ${esc(A.name)} wins it · ${nx.exp.toFixed(1)}–${nx.expL.toFixed(1)} categories`,`mw|${A.id}|${B.id}|${nextW}`):'',
    avgWin!=null&&up_.length>1?fact('Average chance left',pc(avgWin),`Over ${up_.length} meetings`):'',
    fact('Power rank',`#${A.pr} vs #${B.pr}`,`${A.rr.toFixed(2)} vs ${B.rr.toFixed(2)} categories a week`,'tpr|'+A.id),
    (()=>{const e=[...E].sort((x,y)=>Math.abs(x.edge)-Math.abs(y.edge))[0];const [sa,sb]=fvPair(e.c,e.a,e.b);return fact('Closest category',e.c.l,`${sa} vs ${sb}`,link(e))})()]);
  h+=`<p class="note">${aw.length?`${esc(A.name)} wins ${aw.join(', ')}.`:''} ${bw.length?`${esc(B.name)} wins ${bw.join(', ')}.`:''} ${close.length?`Closest: ${close.join(', ')}.`:''}</p>`;
  h+=drillSec('The edge in each category',`Bars to the right are categories ${esc(A.name)} wins, to the left ${esc(B.name)}. Bar length is the margin in league spreads (one spread is the typical gap between teams in that category); the number is the plain margin${SEA()?' over the season':' (a game, for the counting stats)'}. ${nextW!=null?`Tap a category for ${weekName(nextW)}, their next meeting.`:'Tap a category for the team\'s breakdown.'}`,
    CH.hbars(E.map(e=>{const dd=Math.abs(e.a-e.b),txt=e.c.pct?(dd<.001?dd.toFixed(4).replace(/^0/,''):f3(dd)):nf(dd,dp()),who=e.win>0?A.name:e.win<0?B.name:'Nobody';
      return {label:`${e.c.l}`,v:e.edge,txt,cls:pn(e.win),stat:link(e),tip:`${e.c.n}: ${fvPair(e.c,e.a,e.b).join(' vs ')}. ${who} by ${txt}${e.c.neg?' (fewer)':''}${Math.abs(e.edge)<.25?' · close':''}`}}),{label:'Category edges',center:true})
    +legend([['pos',`${esc(A.name)} wins it`],['neg',`${esc(B.name)} wins it`]]));
  // the players behind each edge
  const side=(t,c,win)=>{const d=drivers(t,c,2),pr=fvPair(c,A.line[c.k],B.line[c.k]);return `<div style="min-width:0"><div class="num" style="font:${win?'700':'500'} .9rem var(--mono);${win?'color:var(--pos-fg)':''}">${t===A?pr[0]:pr[1]}${win?' ✓':''}</div><div style="display:flex;flex-direction:column;gap:1px;margin-top:2px">${d.map(x=>`<button type="button" class="sx" data-stat="${esc('pc|'+x.p.name+'|'+c.k)}" data-tip="${esc(x.p.name+': '+(c.pct?(x.v==null?'–':f3(x.v))+' on '+nf(x.a,1)+' '+ATT[c.k]+', impact '+f2(x.imp):nf(x.v,dp())+' '+c.l+' '+per())+', '+pc(x.share)+' of the team'+(c.pct?'\'s attempts':''))}" style="font-size:.76rem;color:var(--muted);text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${esc(shortName(x.p,t.roster))} ${c.pct?(x.v==null?'–':f3(x.v)):nf(x.v,dp())}</button>`).join('')}</div></div>`};
  h+=drillSec('Who drives each edge',`The two biggest contributors on each side${E.some(e=>e.c.pct)?'; for the percentages, the shooters who lift it most once volume is counted':''}${E.some(e=>e.c.neg)?'; for TO, the players who commit the most':''}. A tick marks the winner. Tap a name for that player in that category.`,
    `<div style="display:grid;grid-template-columns:3.2em minmax(0,1fr) minmax(0,1fr);gap:0 12px;align-items:start">
      <span></span><span class="lbl" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(A.name)}</span><span class="lbl" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(B.name)}</span>
      ${E.map(e=>`<div style="grid-column:1/-1;border-top:1px solid var(--soft);margin:7px 0"></div>${sbtn(`tc|${A.id}|${e.c.k}`,`<b style="font:600 .9rem var(--display);letter-spacing:.05em">${e.c.l}</b>`)}${side(A,e.c,e.win>0)}${side(B,e.c,e.win<0)}`).join('')}</div>`);
  // their real weeks on the schedule
  if(weeks.length)h+=drillSec('Their weeks on the schedule',`Every regular-season week these two meet. ${preseason?'No games have been played yet.':''} Tap a week for the full matchup.`,
    `<div class="weeks">${weeks.map(w=>{const q=mp(A.id,B.id,w),past=done(w);return `<button type="button" class="wk" data-stat="${esc(`mw|${A.id}|${B.id}|${w}`)}"${past?' style="opacity:.6"':''}><span class="lbl">${weekName(w)} · ${weekLabel(w)}${past?' · played':''}${w===curWeek&&!preseason&&!past?' · now':''}</span><b>${pc(q.win)} win chance</b><div class="wp"><span style="width:${pc(q.win)}"></span><em>${q.exp.toFixed(1)}–${q.expL.toFixed(1)} categories</em></div><small>For ${esc(A.name)} · ${q.Pa.games.toFixed(0)} vs ${q.Pb.games.toFixed(0)} player-games</small></button>`}).join('')}</div>`);
  // trade angle: what each side has that the other lacks
  const need=(x,y)=>CATS.filter(c=>!(x.id===ME&&S.punt.has(c.k))&&x.catRank[c.k]>=7&&y.catRank[c.k]<=4).map(c=>sbtn(`tc|${y.id}|${c.k}`,c.l));
  const nA=need(A,B),nB=need(B,A),me=A.id===ME?B:B.id===ME?A:null;
  if(nA.length||nB.length)h+=`<div class="sub"><span class="lbl">Trade angle</span><p class="note" style="margin:0">${nA.length?`${esc(B.name)} is strong where ${esc(A.name)} is weak: ${nA.join(', ')}. `:''}${nB.length?`${esc(A.name)} is strong where ${esc(B.name)} is weak: ${nB.join(', ')}.`:''}</p>${me?`<div class="filters"><button type="button" class="btn sm ghost" data-go="trades" data-partner="${me.id}">Open the trade machine</button></div>`:''}</div>`;
  // the two managers' real history, when the history module knows them both
  try{const hp=typeof LAB.histPerson==='function'?LAB.histPerson:null,pa=hp&&hp(A.id),pb=hp&&hp(B.id);
    if(pa&&pb&&pa.id&&pb.id&&pa.id!==pb.id)h+=`<div class="filters">${sbtn(`hh|${pa.id}|${pb.id}`,`${esc(A.mgr)} vs ${esc(B.mgr)} in past seasons`,'linkbtn')}</div>`}catch(e){}
  h+=how([`The top of this drill compares the two full rosters' category totals (${SEA()?'over the season':'per game'}), with no schedule, so it is the same result in every meeting. The weekly cards use the matchup model instead: the real NBA games in that week, the 11-starter daily limit and how much each category swings, so a team can be favored on paper and still an underdog in a light week.`,
    `A league spread is the standard deviation of the ten team totals in that category; it puts points and steals on the same scale, so a long bar means a decisive edge and a short one a coin flip. Drivers are the two biggest contributors on each side: ${SEA()?'season':'per-game'} totals for counting stats, and for FG%, FT% and 3P% the made shots above a league-average shooter on the same attempts.`]);
  return {eyebrow:`${esc(A.name)} vs ${esc(B.name)}`,title:'Head to head',back:`${A.abbr} v ${B.abbr}`,sub:`Roster against roster ${scoreStr(r)}${weeks.length?` · they meet in week${weeks.length>1?'s':''} ${weeks.join(', ')}`:''}`,html:h}};

/* ---------- search shortcuts for your team ---------- */
CMDS.push({label:'My playoff odds',sub:'Seed chances, final record and the schedule left',kw:'playoffs odds seed chance standings sim',tag:'Drill',act:()=>openStat('tpo|'+ME)});
CMDS.push({label:'My power rank breakdown',sub:'What the score is made of and who is around you',kw:'power rank score grade',tag:'Drill',act:()=>openStat('tpr|'+ME)});
CMDS.push({label:'My games by week',sub:'Player-games each week and in the playoffs',kw:'games schedule weeks bench playoffs',tag:'Drill',act:()=>openStat('tgm|'+ME)});
CMDS.push({label:'My category record',sub:'Every category against every team',kw:'category record vs field results',tag:'Drill',act:()=>openStat('trec|'+ME)});
CMDS.push({label:'My weakest category',sub:'How far from the next team and the free agents who fix it',kw:'weak category gap free agents need',tag:'Drill',act:()=>{const t=tm(ME),c=CATS.filter(x=>!S.punt.has(x.k)).sort((a,b)=>t.catRank[b.k]-t.catRank[a.k])[0]||CATS[0];openStat(`tc|${ME}|${c.k}`)}});
CMDS.push({label:'Head to head with this week\'s opponent',sub:'Category by category, and the players behind each edge',kw:'h2h head to head opponent compare rosters',tag:'Drill',act:()=>{const o=curWeek<=REGW?oppOf(ME,Math.max(1,curWeek)):null;if(o!=null)openStat(`h2h|${ME}|${o}`);else go('matchup')}});
})();
