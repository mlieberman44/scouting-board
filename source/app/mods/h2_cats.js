/* h2_cats.js: the Categories view in the Stats tab (HUB order 20, k 'cats') and the league category drills.
   lc|cat     one category across the league: leaders (rostered and free agents), team totals and ranks, distribution,
              scarcity, who is punting it, and what comes with it
   lcx|a|b    two categories together: how they move together among rostered players, who is good at both,
              who trades one for the other, and which teams are built for both
   Search commands: one per category ("Rebounds leaders"), the punt explorer and the category correlation map.
   Registers only at load; every computation runs at render time and is memoized per model state.
   Shared helpers on window.LAB (render time only): catCorr(a,b), catBoard(k), catScarcity(k), puntSignals(k), puntRecord(id,cats). */
(()=>{
const LAB=window.LAB=window.LAB||{};
const SK='h2cats';                                      // sort state for the leaderboard table
S.sort[SK]=S.sort[SK]||['z','desc'];

/* ---------- styles (layout only, theme tokens) ---------- */
const CSS=`
.hc-pick{width:100%}
.hc-pick button{flex:1 1 0;min-width:3.2em}
.hc-lead{margin:0;font-size:.92rem;line-height:1.5;max-width:76ch}
.hc-lead b{font-weight:600}
.hc-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hc-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.hc-mini .fact b{font-size:1.15rem}
.hc-hm{border-spacing:3px;width:auto;margin:0 auto}
.hc-hm th,.hc-hm td{border:0;padding:8px 4px;text-align:center;min-width:3.4em}
.hc-hm th{position:static;background:none;font-size:.7rem;letter-spacing:.04em}
.hc-hm th.rl{text-align:right;padding-right:8px;min-width:0}
.hc-hm td{font:500 .8rem var(--mono);border-radius:5px;background:var(--soft)}
.hc-hm td.dg{background:none;color:var(--muted)}
.hc-hm td.p1,.hc-hm td.p2,.hc-hm td.p3,.hc-hm td.n1,.hc-hm td.n2,.hc-hm td.n3{font-weight:600}
.hc-hm th.on{color:var(--accent)}
.hc-hm tr.on td:not(.dg){box-shadow:inset 0 0 0 1.5px var(--ink)}
.hc-hm td[data-stat]:hover{box-shadow:inset 0 0 0 2px var(--accent)}
.hc-sw i.n3{background:var(--neg-3)}.hc-sw i.n2{background:var(--neg-2)}.hc-sw i.n1{background:var(--neg-1)}
.hc-sw i.z0{background:var(--soft)}.hc-sw i.p1{background:var(--pos-1)}.hc-sw i.p2{background:var(--pos-2)}.hc-sw i.p3{background:var(--pos-3)}
.hc-sw i{margin-right:0!important;border-radius:2px!important}
.hc-sw .gap{margin-left:6px}
.hc-pairs{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.hc-pairs li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:baseline;border-bottom:1px solid var(--soft);padding-bottom:6px}
.hc-pairs li small{display:block;color:var(--muted);font-size:.76rem}
.hc-pairs .r{font:600 .82rem var(--mono)}
.hc-chips .chip small{margin-left:3px}
.hc-tbl th,.hc-tbl td{padding-left:7px;padding-right:7px}
.hc-tbl td.l small{display:block;color:var(--muted);font-size:.74rem}
.hc-tbl .ar{color:var(--muted);padding:0 3px}
.hc-v{display:flex;flex-direction:column;gap:16px;min-width:0}
.fact b .hc-nm{display:block;color:inherit;font-size:.96rem;line-height:1.2;overflow-wrap:break-word}
.hc-nomed .ch text:not(.ink)[text-anchor="middle"]{display:none}
.hc-pun{display:flex;flex-direction:column;gap:8px}
.hc-pun .sub{gap:6px;padding:12px}
.hc-pun .sub p{margin:0}
.hc-pun .ph{align-items:center}
.hc-sec{display:flex;flex-direction:column;gap:10px;min-width:0}
.hc-tbl td.pname{min-width:9.5em;max-width:15em;white-space:normal}
.hc-tbl td.pname *{white-space:normal}
.hc-tbl td.tname{white-space:normal;min-width:8.5em;max-width:13em}
.hc-tbl td small.d{display:block;color:var(--muted);font:400 .7rem var(--body);margin-top:1px}
.hc-tbl .hc-short{display:none}
.hc-tbl tr.me td.p1{background:var(--pos-1)}.hc-tbl tr.me td.p2{background:var(--pos-2)}.hc-tbl tr.me td.p3{background:var(--pos-3)}
.hc-tbl tr.me td.n1{background:var(--neg-1)}.hc-tbl tr.me td.n2{background:var(--neg-2)}.hc-tbl tr.me td.n3{background:var(--neg-3)}
@media (min-width:561px){.hc-wl .hb-r{grid-template-columns:minmax(0,18.5em) minmax(0,1fr) 4.2em}}
@media (min-width:900px){.hc-hm th,.hc-hm td{min-width:4.1em;padding:9px 5px}.hc-hm td{font-size:.84rem}}
@media (max-width:560px){
  .hc-mini{grid-template-columns:repeat(2,minmax(0,1fr))}
  .hc-mini .fact:nth-child(3){grid-column:1/-1}
  .hc-hm{border-spacing:2px}
  .hc-hm th,.hc-hm td{min-width:2.35em;padding:7px 1px}
  .hc-hm td{font-size:.7rem}
  .hc-hm th{font-size:.62rem;letter-spacing:0}
  .hc-hm th.rl{padding-right:4px}
  .hc-pick button{min-width:0;padding:7px 2px;font-size:.76rem}
  .hc-tbl th,.hc-tbl td{padding-left:4px;padding-right:4px}
  .hc-tbl td.pname{min-width:7.4em}
  .hc-tbl td.num,.hc-tbl td.z{font-size:.78rem}
  .hc-tbl th{letter-spacing:.02em}
  .hc-tbl td small.d{font-size:.66rem}
  .hc-tbl td.tname{min-width:0}
  .hc-tbl .hc-full{display:none!important}.hc-tbl .hc-short{display:inline}
  .hc-nomed-m .ch text:not(.ink)[text-anchor="middle"]{display:none}
}`;
const css=()=>addCSS('h2c-css',CSS);

/* ---------- small helpers ---------- */
const CT=k=>catOf(String(k||'').toLowerCase())||null;
const SEA=()=>S.mode==='season';
const per=()=>SEA()?'over the season':'a game';
const dpT=()=>SEA()?0:1;
const fT=(c,v)=>v==null||!isFinite(v)?'–':c.pct?f3(v):v.toFixed(dpT());          // a team total (per game, or season)
const fV=(c,v)=>v==null||!isFinite(v)?'–':c.pct?f3(v):v.toFixed(1);               // a player's per-game number or %
const fZ=z=>z==null||!isFinite(z)?'–':Math.abs(z)<.05?'0.0':f1(z);
const fR=r=>(r<0?'−':'')+Math.abs(r).toFixed(2).replace(/^0/,'');                 // a correlation: .53, −.69
const sgnT=(v,d)=>(v>=0?'+':'−')+Math.abs(v).toFixed(d);
const ATT={fg:'FGA',ft:'FTA',tp:'3PA'}, MAKES={fg:'made field goals',ft:'made free throws',tp:'made threes'};
const nm=p=>esc(p.name);
const bigN=p=>`<span class="hc-nm">${nm(p)}</span>`;                       // a player name as a fact's big text (long names wrap)
const leadL=c=>c.neg?'Fewest turnovers':'League leader';
const ab=id=>esc(teamById[id].abbr);
const tn=id=>esc(teamById[id].name);
const tnY=id=>tn(id)+(id===ME?' (you)':'');
const tlink=id=>`<button type="button" class="tlink" data-team="${id}">${tn(id)}</button>`;
const facts=a=>`<div class="facts">${a.join('')}</div>`;
const legend=items=>`<div class="legend">${items.map(([cls,l])=>`<span><i class="${cls}"></i>${l}</span>`).join('')}</div>`;
const segX=(key,cur,opts,label,cls='')=>`<div class="seg ${cls}" role="group" aria-label="${esc(label)}">${opts.map(([v,l,t])=>`<button type="button" data-set="${esc(key+'='+v)}" aria-pressed="${String(v)===String(cur)}"${t?` title="${esc(t)}"`:''}>${l}</button>`).join('')}</div>`;
const listAnd=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
// the number the value model scores: per-game count, or for shooting, impact = (player % - league %) x attempts
const rawOf=(p,c)=>{if(!p.pg)return null;if(c.pct){const a=p.pg[c.pct[1]];return a?(p.pg[c.pct[0]]/a-M.lg[c.k])*a:0}return p.pg[c.k]};
const pctOf=(p,c)=>c.pct&&p.pg&&p.pg[c.pct[1]]?p.pg[c.pct[0]]/p.pg[c.pct[1]]:null;
const headV=(p,c)=>c.pct?pctOf(p,c):(p.pg?p.pg[c.k]:null);
const shotTxt=(p,c)=>{const a=p.pg&&p.pg[c.pct[1]];return a?`${f3(p.pg[c.pct[0]]/a)} on ${a.toFixed(1)} ${ATT[c.k]}`:`no ${ATT[c.k]}`};
const fImp=v=>v==null||!isFinite(v)?'–':(v>=0?'+':'−')+Math.abs(v).toFixed(2);
// what a player's number reads as, in words, for tooltips
const pTxt=(p,c)=>c.pct?`${shotTxt(p,c)}, ${fImp(rawOf(p,c))} ${MAKES[c.k]} a game vs a league-average shooter`:`${fV(c,p.pg[c.k])} ${c.l} a game`;
// a gap between two teams in plain units ("2.3 PTS a game", "0.4 points of FG%")
const gapTxt=(c,g)=>{const a=Math.abs(g);if(c.pct){const pt=a*100;return `${pt.toFixed(pt<.01?3:pt<1?2:1)} points of ${c.l}`}return `${a.toFixed(SEA()?(a<1?2:a<10?1:0):(a<.01?3:a<.1?2:1))} ${c.l} ${per()}`};
// a team's attempts in a shooting category (per game, or season), so a % gap can be read as made shots
const tAtt=(t,c)=>t.roster.filter(p=>p.pg).reduce((s,p)=>s+p.pg[c.pct[1]]*(SEA()?(p.gp||0):1),0);
const mkTxt=(c,n)=>`${n.toFixed(SEA()?0:1)} ${MAKES[c.k]} ${per()}`;
// the small line under a team total: "268.2 PTS a game" or ".484 on 201.3 FGA a game"
const teamSmall=(c,t)=>c.pct?`${f3(t.line[c.k])} on ${tAtt(t,c).toFixed(SEA()?0:1)} ${ATT[c.k]} ${per()}`:`${fT(c,t.line[c.k])} ${c.l} ${per()}`;
const concShort=r=>r===1?'most concentrated of 9':r===9?'least concentrated of 9':`${ord(r)} most concentrated of 9`;
const concTxt=r=>r===1?'the most concentrated of the nine categories':r===9?'the least concentrated of the nine categories':r<=3?`the ${ord(r)} most concentrated of the nine categories`:r>=7?`one of the least concentrated categories (${ord(r)} of 9)`:`in the middle for concentration (${ord(r)} of 9)`;
const goodAt=c=>c.neg?'keep turnovers low':c.pct?`help ${c.l}`:`pile up ${c.n.toLowerCase()}`;
const badAt=c=>c.neg?'turn the ball over more':c.pct?`drag ${c.l} down`:`bring fewer ${c.n.toLowerCase()}`;
const strength=r=>{const a=Math.abs(r);return a>=.5?'strong':a>=.3?'moderate':a>=.15?'weak':'almost no'};
const rCls=r=>r>=.5?'p3':r>=.3?'p2':r>=.15?'p1':r<=-.5?'n3':r<=-.3?'n2':r<=-.15?'n1':'';

/* ---------- the model, per category (memoized per model state) ---------- */
// every rostered player and free agent with numbers, ranked by per-game z-score (shooting by impact; TO flipped so up is good)
function board(k){return memo('h2c|board|'+k,()=>{const c=CT(k),K=c.k;
  const row=p=>({p,z:p.zpg[K],raw:rawOf(p,c),v:headV(p,c),att:c.pct?p.pg[c.pct[1]]:null});
  const ros=M.players.filter(p=>p.pg).map(row).sort((a,b)=>b.z-a.z),zs=ros.map(r=>r.z);
  ros.forEach((r,i)=>r.rk=i+1);
  const fas=M.fas.filter(p=>p.pg).map(row).sort((a,b)=>b.z-a.z);
  fas.forEach((r,i)=>{r.rk=i+1;r.would=rankIn(zs,r.z)});
  const all=[...ros,...fas].sort((a,b)=>b.z-a.z);all.forEach((r,i)=>r.rkAll=i+1);
  const pos=zs.filter(z=>z>0),posSum=pos.reduce((s,z)=>s+z,0),top10=zs.slice(0,10).filter(z=>z>0).reduce((s,z)=>s+z,0);
  const tot=c.pct||c.neg?null:ros.reduce((s,r)=>s+r.raw,0);
  const raws=ros.map(r=>r.raw).sort((a,b)=>a-b),med=raws.length?raws[Math.floor(raws.length/2)]:null;
  const teams=[...M.teams].sort((a,b)=>a.catRank[K]-b.catRank[K]);
  return {c,ros,fas,all,zs,nPos:pos.length,share:posSum?top10/posSum:0,even:pos.length?Math.min(1,10/pos.length):0,
    prod:tot?ros.slice(0,10).reduce((s,r)=>s+r.raw,0)/tot:null,
    avg:c.pct?M.lg[K]:mean(ros.map(r=>r.raw)),med,teams,tAvg:mean(M.teams.map(t=>t.line[K]))}})}
// how concentrated each category is, side by side
const scar=()=>memo('h2c|scar',()=>{const o={};CATS.forEach(c=>{const B=board(c.k),z=i=>B.zs[Math.min(i,B.zs.length-1)];
  o[c.k]={k:c.k,share:B.share,even:B.even,nPos:B.nPos,z1:z(0),z10:z(9),z30:z(29),z60:z(59),fa:B.fas[0]||null,prod:B.prod}});
  [...CATS].sort((a,b)=>o[b.k].share-o[a.k].share).forEach((c,i)=>o[c.k].rank=i+1);return o});
// Pearson correlation of per-game z-scores across rostered players, for every pair of categories
const corr=()=>memo('h2c|corr',()=>{const P=M.players.filter(p=>p.pg),C={},r={};
  CATS.forEach(c=>{const x=P.map(p=>p.zpg[c.k]),m=mean(x),d=x.map(v=>v-m),s=Math.sqrt(d.reduce((a,v)=>a+v*v,0))||1;C[c.k]=d.map(v=>v/s)});
  CATS.forEach(a=>{r[a.k]={};CATS.forEach(b=>{r[a.k][b.k]=a.k===b.k?1:C[a.k].reduce((s,v,i)=>s+v*C[b.k][i],0)})});return {r,n:P.length}});
const rOf=(a,b)=>corr().r[a][b];
// teams ranked 9th or 10th in a category, and whether it looks deliberate
function punters(k){return memo('h2c|punt|'+k,()=>{const c=CT(k),K=c.k,R=corr().r[K],ts=board(K).teams,v=x=>c.neg?-x:x;
  const opp=CATS.filter(o=>o.k!==K&&R[o.k]<=-.15).sort((a,b)=>R[a.k]-R[b.k]);
  const step=Math.abs(v(ts[0].line[K])-v(ts[ts.length-1].line[K]))/Math.max(1,ts.length-1);
  return ts.filter(t=>t.catRank[K]>=ts.length-1).map(t=>{const t8=ts[ts.length-3],gap=v(t8.line[K])-v(t.line[K]);
    const far=step>0&&gap>=1.5*step,oppR=opp.length?mean(opp.map(o=>t.catRank[o.k])):null,built=oppR!=null&&oppR<=4,winning=t.rec.w>=t.rec.l;
    const n=[far,built,winning].filter(Boolean).length,ratio=step>0?gap/step:0;
    return {t,rank:t.catRank[K],t8,gap,step,ratio,far,opp,oppR,built,winning,n,verdict:n>=2&&ratio>=1?'deliberate':n>=2||(n===1&&ratio>=1)?'maybe':'weak'}})})}
// a team's category record against the field if it concedes the punted categories every week (assumed), from team lines like recordOf
function puntRec(id,P){const t=tm(id);if(!t)return null;let w=0,l=0,tt=0,mw=0,cost=0,rw=0,rl=0;
  M.teams.filter(o=>o.id!==id).forEach(o=>{let a=0,b=0;CATS.forEach(c=>{const x=t.line[c.k],y=o.line[c.k],tie=Math.abs(x-y)<1e-9,win=!tie&&(c.neg?x<y:x>y);
    if(P.includes(c.k)){if(win)cost++;l++;b++;return}
    if(tie)tt++;else if(win){w++;a++;rw++}else{l++;b++;rl++}});if(a>b)mw++});
  return {w,l,t:tt,mw,cost,rate:(rw+rl+tt)?(rw+tt/2)/(rw+rl+tt):null}}
// every player's value with and without the punted categories (z summed; per game or season as the build menu says)
function risers(P){return memo('h2c|rise|'+P.join(','),()=>{const rows=M.all.filter(p=>p.pg).map(p=>{const a=CATS.reduce((s,c)=>s+p.z[c.k],0);return {p,a,b:a-P.reduce((s,k)=>s+p.z[k],0)}});
  [...rows].sort((x,y)=>y.a-x.a).forEach((r,i)=>r.ra=i+1);[...rows].sort((x,y)=>y.b-x.b).forEach((r,i)=>r.rb=i+1);
  rows.forEach(r=>{r.d=r.b-r.a;r.up=r.ra-r.rb});return rows})}

LAB.catCorr=(a,b)=>{const A=CT(a),B=CT(b);return A&&B?rOf(A.k,B.k):null};
LAB.catBoard=k=>CT(k)?board(CT(k).k):null;
LAB.catScarcity=k=>CT(k)?scar()[CT(k).k]:null;
LAB.puntSignals=k=>CT(k)?punters(CT(k).k):null;
LAB.puntRecord=(id,cats)=>puntRec(+id,(cats||[]).map(x=>CT(x)).filter(Boolean).map(c=>c.k));

/* ---------- shared pieces (view and drills) ---------- */
// all ten teams around the average team, better to the right (fewer TO is better)
function teamBars(c,B){const sg=c.neg?-1:1;
  return `<div class="hc-wl">${CH.hbars(B.teams.map(t=>{const x=t.line[c.k],d=sg*(x-B.tAvg),r=t.catRank[c.k];
    return {label:`#${r} ${tn(t.id)}${t.id===ME?' <small>you</small>':''}`,v:d,txt:fT(c,x),hi:t.id===ME,cls:d>=0?'pos':'neg',stat:`tc|${t.id}|${c.k}`,
      tip:`${teamById[t.id].name}: ${c.pct?teamSmall(c,t):fT(c,x)+' '+c.l+' '+per()}, #${r} of 10. ${d>=0?'Better':'Worse'} than the average team by ${gapTxt(c,d)}.`}}),
    {center:true,stack:true,label:`${c.n}: team totals`})}</div>`}
// the race in plain numbers: tightest neighbours, the spread, and where you sit. Shooting gaps for your team are also given
// in made shots: how many more (or fewer) makes at your current attempts would draw level.
function raceTxt(c,B){const ts=B.teams,v=t=>c.neg?-t.line[c.k]:t.line[c.k],g=ts.slice(0,-1).map((t,i)=>({a:t,b:ts[i+1],d:v(t)-v(ts[i+1])}));
  if(!g.length)return '';const tight=[...g].sort((x,y)=>x.d-y.d)[0],me=tm(ME),r=me.catRank[c.k],up=ts[r-2],dn=ts[r],A=c.pct?tAtt(me,c):0;
  const mk=d=>c.pct&&A?` (${mkTxt(c,Math.abs(d)*A)} at your volume)`:'';
  const s1=`Tightest race: #${tight.a.catRank[c.k]} ${tlink(tight.a.id)} and #${tight.b.catRank[c.k]} ${tlink(tight.b.id)}, ${gapTxt(c,tight.d)} apart.`;
  const s2=`First to last: ${gapTxt(c,v(ts[0])-v(ts[ts.length-1]))}.`;
  const s3=`You're ${sbtn(`tc|${ME}|${c.k}`,'#'+r)}${up?`: ${gapTxt(c,v(up)-v(me))} behind #${r-1} ${tlink(up.id)}${mk(v(up)-v(me))}`:', on top'}${dn?`${up?';':':'} ${gapTxt(c,v(me)-v(dn))} ahead of #${r+1} ${tlink(dn.id)}${mk(v(me)-v(dn))}`:', last'}.`;
  return `<p class="note">${s1} ${s2} ${s3}</p>`}
const stripFmt=c=>c.pct?(v=>(v>=0?'+':'−')+Math.abs(v).toFixed(1)):(v=>v.toFixed(1));
// the strip's median label collides with the end label when the median sits near one end (blocks, steals), so hide it there
function stripOf(c,B){const vs=B.ros.map(r=>r.raw).filter(v=>v!=null&&isFinite(v)),lo=Math.min(...vs),hi=Math.max(...vs),t=hi>lo?(B.med-lo)/(hi-lo):.5,e=Math.min(t,1-t);
  return `<div class="${e<.18?'hc-nomed':e<.27?'hc-nomed-m':''}">${CH.strip(B.ros.map(r=>({v:r.raw,label:`${r.p.name} (${teamAbbr(r.p)})`,me:r.p.team===ME,hi:r.rk===1,stat:`pc|${r.p.name}|${c.k}`})),
  {fmt:stripFmt(c),rev:!!c.neg,label:`${c.n}: every rostered player`})}</div>`}
const stripLegend=(c,B)=>legend([['hi',c.neg?'Fewest turnovers':'Leader'],['me','Your players'],['mut','Other rostered players']])+`<p class="note">${c.pct?`Each dot is a player's impact: ${MAKES[c.k]} a game above (right) or below a league-average shooter (${f3(M.lg[c.k])}) taking the same shots.`:c.neg?'Each dot is a player\'s turnovers a game. Fewer is better, so the axis runs from most (left) to fewest (right).':`Each dot is a player's ${c.n.toLowerCase()} a game.`} The dashed line is the median (${esc(stripFmt(c)(B.med))}).</p>`;
function shareBars(k){const S0=scar();return CH.hbars([...CATS].sort((a,b)=>S0[b.k].share-S0[a.k].share).map(c=>{const s=S0[c.k];
  return {label:`${c.l}${c.k===k?' <small>shown</small>':''}`,v:s.share,txt:pc(s.share),hi:c.k===k,stat:`lc|${c.k}`,
    tip:`${c.n}: the top 10 hold ${pc(s.share)} of the above-average value (an even spread over the ${s.nPos} above-average players would give them ${pc(s.even)}). #${s.rank} of 9 for concentration.`}}),{max:Math.max(...CATS.map(c=>S0[c.k].share),.01),label:'Concentration by category'})}
function punterHtml(c){const L=punters(c.k);
  return L.map(x=>{const t=x.t,pill=x.verdict==='deliberate'?['Looks deliberate','p2']:x.verdict==='maybe'?['Could be a punt','']:['Probably not a punt',''];
    const why=[],t8=esc(teamById[x.t8.id].abbr),ratio=x.ratio;
    why.push(x.far?`${gapTxt(c,x.gap)} behind #8 ${t8}, ${ratio>=2?ratio.toFixed(1)+' times':'well over'} the usual gap between neighbouring teams (${gapTxt(c,x.step)})`
      :ratio<1?`only ${gapTxt(c,x.gap)} behind #8 ${t8}, less than the usual gap between neighbouring teams (${gapTxt(c,x.step)}), so one move could lift them`
      :`${gapTxt(c,x.gap)} behind #8 ${t8}, close to the usual gap between neighbouring teams (${gapTxt(c,x.step)})`);
    const ol=x.opp.slice(0,4).map(o=>`${o.l} #${t.catRank[o.k]}`).join(', ');
    if(x.opp.length)why.push(x.built?`strong in what usually trades off against ${c.l}: ${ol}`:`not especially strong in what usually trades off against ${c.l} (${ol})`);
    else why.push(`no category clearly trades off against ${c.l}, so there is no obvious build to explain it`);
    why.push(x.winning?`still ${scoreStr(t.rec)} against the field overall`:`only ${scoreStr(t.rec)} against the field overall, so the rest of the roster isn't clearly making up for it`);
    return `<div class="sub"><div class="ph"><div><b>${sbtn(`tc|${t.id}|${c.k}`,'#'+x.rank)} ${tlink(t.id)}${t.id===ME?' (you)':''}</b></div><span class="pill ${pill[1]}" style="margin:0">${pill[0]}</span></div><p class="note">${why.map(s=>s[0].toUpperCase()+s.slice(1)).join('. ')}.</p></div>`}).join('')}
// categories that move with (or against) one category, as centred bars
function corrBars(k){const R=corr().r[k],c=CT(k);
  return CH.hbars(CATS.filter(o=>o.k!==k).sort((a,b)=>R[b.k]-R[a.k]).map(o=>({label:o.l,v:R[o.k],txt:fR(R[o.k]),cls:R[o.k]>=0?'pos':'neg',stat:`lcx|${k}|${o.k}`,
    tip:`${c.l} and ${o.l}: r ${fR(R[o.k])}, ${strength(R[o.k])} link. ${pairTxt(c,o,R[o.k])}`})),{center:true,max:1,fmt:fR,label:`What moves with ${c.l}`})}
function pairTxt(A,B,r){if(Math.abs(r)<.15)return `Knowing a player's ${A.l} tells you almost nothing about their ${B.l}.`;
  if(Math.abs(r)<.3)return r>0?`Players who ${goodAt(A)} are a little more likely to ${goodAt(B)} too. The link is weak, so punting one costs only a little of the other.`
    :`Players who ${goodAt(A)} are a little more likely to ${badAt(B)}. The trade-off is weak, so punting ${B.l} makes ${A.l} only slightly cheaper.`;
  return r>0?`Players who ${goodAt(A)} usually ${goodAt(B)} too, so punting one tends to drag the other down with it.`
    :`Players who ${goodAt(A)} usually ${badAt(B)}, so punting ${B.l} makes ${A.l} cheaper to build, and the other way round.`}
const corrLegend=()=>`<div class="legend hc-sw"><span>Pull apart</span><span><i class="n3"></i><i class="n2"></i><i class="n1"></i><i class="z0"></i><i class="p1"></i><i class="p2"></i><i class="p3"></i></span><span>Go together</span></div>`;

/* ---------- the view: Stats › Categories ---------- */
function vCats(){css();
  const k=CT(S_X('cats.k','pts'))?CT(S_X('cats.k','pts')).k:'pts',c=CT(k),B=board(k),SC=scar()[k],me=tm(ME),mr=me.catRank[k],L=punters(k),del=L.filter(x=>x.verdict==='deliberate');
  const lead=B.ros[0],fa=B.fas[0],picker=segX('cats.k',k,CATS.map(x=>[x.k,x.l,x.n]),'Category','hc-pick');
  const mine=B.ros.filter(r=>r.p.team===ME);
  let h=`<section class="panel" id="cats-top">${picker}
    ${head(esc(c.n),`${c.neg?'Lower is better: the fewest turnovers wins the category. ':''}${c.pct?`Scored by impact, made shots above a league-average shooter (${f3(M.lg[k])}) at the player's volume, the same way player value counts it. `:''}${SEA()?'Players per game; team totals over the season.':'Players and team totals are per game.'}`)}
    <p class="hc-lead">${lead?`<b>${sbtn(`pc|${lead.p.name}|${k}`,nm(lead.p))}</b> ${c.neg?'turns the ball over least':'leads the league'} (${pTxt(lead.p,c)}). `:''}${c.l} is <b>${concTxt(SC.rank)}</b>: the top 10 players hold ${pc(B.share)} of the above-average value. You rank <b>${sbtn(`tc|${ME}|${k}`,`#${mr} of 10`)}</b>${mine.length?`, led by ${sbtn(`pc|${mine[0].p.name}|${k}`,nm(mine[0].p))} (#${mine[0].rk} in the league)`:''}.</p>
    ${facts([
      lead?fact(leadL(c),bigN(lead.p),`${c.pct?shotTxt(lead.p,c):fV(c,lead.v)+' a game'} · ${ab(lead.p.team)}`,`pc|${lead.p.name}|${k}`):'',
      fact('Your team',`#${mr} of 10`,teamSmall(c,me),`tc|${ME}|${k}`),
      fact(c.pct?'League average':'Average rostered player',c.pct?f3(B.avg):fV(c,B.avg),c.pct?`all rostered shots, made over attempted`:`a game · median ${fV(c,B.med)}`,`lc|${k}`),
      fa?fact('Best free agent',bigN(fa.p),`${c.pct?shotTxt(fa.p,c):fV(c,fa.v)+' a game'} · would rank #${fa.would}`,`pc|${fa.p.name}|${k}`):'',
      fact('Top-10 share',pc(B.share),`of above-average value · ${concShort(SC.rank)}`,`lc|${k}`),
      fact('Deliberate punts',`${del.length} of ${L.length}`,`bottom two: ${L.map(x=>`#${x.rank} ${ab(x.t.id)}`).join(', ')}`,`lc|${k}`)])}
  </section>`;
  h+=`<div class="cols"><div class="hc-v">${leadersPanel(c,B)}${distPanel(c,B)}</div><div class="hc-v"><section class="panel">${head('Team totals and ranks',`All ten rosters ${per()}, against the average team. ${c.neg?'Fewer turnovers counts as better, so it points right.':'Right of centre is better.'} Tap a team for its breakdown.`)}
    ${teamBars(c,B)}${legend([['pos','Better than the average team'],['neg','Worse']])}${raceTxt(c,B)}
    ${how([`Team totals add up every rostered player's projected numbers ${SEA()?'over their projected games':'per game'}; FG%, FT% and 3P% are total makes over total attempts, not an average of percentages. Ranks are 1 to 10, best first. The centre line is the average of the ten teams. Weekly matchups also depend on games played and the daily lineup limit, which the Matchup tab handles.`])}</section>${scarPanel(c,B,SC)}</div></div>`;
  h+=corrPanel(c);
  h+=puntPanel(c);
  return h}

function leadersPanel(c,B){const k=c.k,poolK=['ros','fa','all'].includes(S_X('cats.pool','ros'))?S_X('cats.pool','ros'):'ros',n=+S_X('cats.n','15')===40?40:15;
  const base=poolK==='fa'?B.fas:poolK==='all'?B.all:B.ros,[sk,sd]=S.sort[SK];
  const rows=sortRows([...base],sk,sd,(r,key)=>key==='name'?r.p.name:key==='team'?teamAbbr(r.p):key==='v'?r.v:key==='att'?r.att:key==='raw'?r.raw:r.z).slice(0,n);
  const rk=r=>poolK==='all'?r.rkAll:r.rk;
  const cells=r=>{const d=`pc|${r.p.name}|${k}`;
    return c.pct?`<td class="num" ${sx(d)}><b>${fV(c,r.v)}</b><small class="d">${r.att!=null?r.att.toFixed(1):'0'} ${ATT[k]}</small></td><td class="num" ${sx(d)}>${fImp(r.raw)}</td>`
      :`<td class="num" ${sx(d)}><b>${fV(c,r.v)}</b></td>`};
  const sub=r=>{const p=r.p;return `${p.team?sbtn(`tc|${p.team}|${k}`,ab(p.team)):'FA'} · ${p.nba==='?'?'Unsigned':esc(p.nba)} · ${p.pos}${p.team?'':` · would rank #${r.would??rankIn(B.zs,r.z)}`}`};
  return `<section class="panel" id="cats-leaders">${head('Leaders',`${poolK==='fa'?'Free agents only':poolK==='all'?'Rostered players and free agents together':'Every rostered player'}, best first${c.pct?' by impact':''}. Tap a row for the player's breakdown, a team for theirs.`,segX('cats.pool',poolK,[['ros','Rostered'],['fa','Free agents'],['all','Everyone']],'Player pool'))}
    <div class="scroll" data-keep="h2c-lead"><table class="hc-tbl"><thead><tr><th scope="col">#</th>${th(SK,'name','Player','l stick')}${c.pct?`${th(SK,'v',c.l)}${th(SK,'raw','Impact','','Made shots a game above a league-average shooter taking the same shots')}`:th(SK,'v','Per game')}${th(SK,'z','z','','How far above or below an average rostered player, in standard deviations'+(c.neg?'; fewer turnovers scores higher':''))}</tr></thead><tbody>
    ${rows.map(r=>{const p=r.p;return `<tr class="click ${p.team===ME?'me':''}" ${sx(`pc|${p.name}|${k}`)} tabindex="0"><td class="num">${rk(r)}</td>${pcell(p,sub(r))}${cells(r)}<td class="z ${zc(r.z)}" ${sx(`pc|${p.name}|${k}`)}>${fZ(r.z)}</td></tr>`}).join('')||`<tr><td class="l" colspan="5">No players in this pool.</td></tr>`}</tbody></table></div>
    <div class="hc-acts">${base.length>15?`<button type="button" class="btn sm ghost" data-set="cats.n=${n===40?15:40}">${n===40?'Show the top 15':'Show the top 40'}</button>`:''}<span class="note">${plural(base.length,'player')} in this pool.</span></div>
    ${how([`Players are ranked by z-score: how far their number sits above or below the average rostered player, in standard deviations (about two thirds of players fall between −1 and +1).${c.neg?' For TO the sign is flipped, so fewer turnovers scores higher.':''}${c.pct?` For ${c.l}, the score uses impact, (their ${c.l} − the league's ${f3(M.lg[c.k])}) × their ${ATT[c.k]}, so a great shooter on a few attempts moves a team less than a good shooter on many. Tap the ${c.l} heading to sort by the raw percentage instead.`:''}`,
      'Rostered players use ESPN\'s 2026-27 projections, blended with the season so far once games start; a few late picks tagged \'26 or EST use their 2025-26 stats or an estimate instead. Free agents use their 2025-26 per-game stats, because ESPN\'s free-agent pool can\'t be read in bulk; "would rank" slots a free agent into the rostered list.'])}</section>`}

function distPanel(c,B){const mine=B.ros.filter(r=>r.p.team===ME),q=B.ros[9],k=c.k;
  const top=B.ros.slice(0,30).filter(r=>r.p.team===ME).length;
  return `<section class="panel">${head('Distribution',`Every rostered player in ${c.l}. Your players are blue; tap any dot.`)}
    ${stripOf(c,B)}${stripLegend(c,B)}
    <div class="hc-mini">${fact('Median player',c.pct?fImp(B.med):fV(c,B.med),c.pct?`${MAKES[k]} a game vs average`:'a game',`lc|${k}`)}${q?fact('10th best',c.pct?fImp(q.raw):fV(c,q.v),`${nm(q.p)}`,`pc|${q.p.name}|${k}`):''}${mine.length?fact('Your best',`#${mine[0].rk}`,`${nm(mine[0].p)} · ${top} of yours in the top 30`,`pc|${mine[0].p.name}|${k}`):''}</div>
    ${how([`One dot per rostered player with a projection (${B.ros.length} players). ${c.pct?'Shooting categories are plotted as impact, the way the value model scores them, because a percentage alone hides how many shots it comes on.':'Dots that would overlap are stacked.'} The far ends show the lowest and highest numbers, and the dashed line is the median player.`])}</section>`}

function scarPanel(c,B,SC){const k=c.k,S0=scar(),R=[1,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120].filter(x=>x<=B.ros.length);
  const avgZ=x=>mean(CATS.map(o=>board(o.k).zs[x-1]));
  const ser=[{name:c.l,cls:'s1',pts:R.map(x=>[x,B.zs[x-1],`pc|${B.ros[x-1].p.name}|${k}`])},{name:'Average of all nine',cls:'s2',pts:R.map(x=>[x,avgZ(x)])}];
  const ratio=SC.z10>0?SC.z1/SC.z10:null,fa=SC.fa;
  return `<section class="panel">${head('Scarcity',`How concentrated ${c.l} is among the top players, and how fast it runs out.`)}
    ${`<div class="hc-mini">`+[fact('Top-10 share',pc(B.share),`even spread: ${pc(B.even)}`,`lc|${k}`),fact('Leader vs 10th',ratio?ratio.toFixed(1)+'×':'–',`z ${fZ(SC.z1)} vs ${fZ(SC.z10)}`,`pc|${B.ros[0].p.name}|${k}`),
      fa?fact('Best free agent',`#${fa.would}`,`${nm(fa.p)} would rank here`,`pc|${fa.p.name}|${k}`):fact('Best free agent','–','none with numbers')].join('')+'</div>'}
    <div class="hc-sec"><span class="lbl">Value of the Nth-best player</span>${CH.line(ser,{xl:x=>'#'+x,fmt:v=>v.toFixed(1),ref:0,h:220,label:`${c.l} value by rank`})}
    <p class="note">z-score of the player at each rank. A steeper fall means a few players carry the category. The dashed line is an average rostered player.</p></div>
    <div class="hc-sec"><span class="lbl">Top-10 share, every category</span>${shareBars(k)}</div>
    ${how([`Top-10 share adds up how far each above-average player sits above average (their z-score) and asks how much of that total the 10 best players hold. If talent were spread evenly over the ${B.nPos} above-average players, the top 10 would hold about ${pc(B.even)}. A higher share means the category is concentrated in a few players, so losing one hurts and waivers rarely replace them.${B.prod!=null?` Measured more simply, the top 10 make ${pc(B.prod)} of all the ${c.n.toLowerCase()} on rosters while being ${pc(10/B.ros.length)} of the players.`:''}`,
      `"Would rank" places the best free agent's ${c.pct?'impact':'number'} among the rostered players. The free-agent pool here is the ${M.fas.length} players the board tracks, with 2025-26 stats.`])}</section>`}

function corrPanel(c){const k=c.k,{r:R,n}=corr(),order=CATS;
  const pairs=[];CATS.forEach((a,i)=>CATS.slice(i+1).forEach(b=>pairs.push([a,b,R[a.k][b.k]])));
  const posP=[...pairs].sort((x,y)=>y[2]-x[2]).slice(0,4),negP=[...pairs].sort((x,y)=>x[2]-y[2]).slice(0,4);
  const cell=(a,b)=>{if(a.k===b.k)return `<td class="dg" aria-label="${a.l}">·</td>`;const r=R[a.k][b.k];
    return `<td class="${rCls(r)}" ${sx(`lcx|${a.k}|${b.k}`)} data-tip="${esc(`${a.l} and ${b.l}: r ${fR(r)}, ${strength(r)} ${r>=0?'positive':'negative'} link. ${pairTxt(a,b,r)}`)}" tabindex="0">${fR(r)}</td>`};
  const li=([a,b,r])=>`<li><span>${sbtn(`lcx|${a.k}|${b.k}`,`${a.l} and ${b.l}`)}<small>${pairTxt(a,b,r)}</small></span><span class="r">${fR(r)}</span></li>`;
  const withK=CATS.filter(o=>o.k!==k&&R[k][o.k]>=.3).sort((a,b)=>R[k][b.k]-R[k][a.k]),cheap=CATS.filter(o=>o.k!==k&&R[k][o.k]<=-.15).sort((a,b)=>R[k][a.k]-R[k][b.k]);
  const kb=o=>sbtn(`lcx|${k}|${o.k}`,`${o.l} (${fR(R[k][o.k])})`);
  return `<section class="panel" id="cats-corr">${head('Which categories go together',`How the nine categories move together across the ${n} rostered players. Tap a cell to see the players behind it.`)}
    <div class="cols"><div class="hc-sec"><div class="scroll"><table class="hc-hm" aria-label="Category correlations"><thead><tr><th scope="col"></th>${order.map(b=>`<th scope="col" class="${b.k===k?'on':''}">${b.l}</th>`).join('')}</tr></thead><tbody>
      ${order.map(a=>`<tr class="${a.k===k?'on':''}"><th scope="row" class="rl ${a.k===k?'on':''}">${a.l}</th>${order.map(b=>cell(a,b)).join('')}</tr>`).join('')}</tbody></table></div>
      ${corrLegend()}<p class="note">Green: players good at one are usually good at the other. Red: being good at one usually costs the other. TO is flipped, so green with TO means few turnovers. The ${c.l} row is outlined.</p></div>
    <div class="hc-sec"><h3>${esc(c.l)}: punt partners</h3>
      <p class="note">${withK.length?`Punt ${c.l} and you usually give up ground in ${listAnd(withK.map(kb))} too, so they make a natural double punt.`:`No category is tightly tied to ${c.l}, so punting it doesn't drag another one down with it.`} ${cheap.length?`Punting ${c.l} makes ${listAnd(cheap.map(kb))} cheaper, because ${cheap.length===1?`the players who ${goodAt(cheap[0])}`:'players who are strong there'} tend to ${badAt(c)}.`:`No category gets much cheaper when you punt ${c.l}.`}</p>
      <span class="lbl">Strongest pairs</span><ul class="hc-pairs">${posP.map(li).join('')}</ul>
      <span class="lbl">Strongest trade-offs</span><ul class="hc-pairs">${negP.map(li).join('')}</ul></div></div>
    ${how([`Each number is the correlation (r) between two categories' per-game z-scores across every rostered player with a projection. It runs from −1 to +1: +1 would mean the two always rise together, −1 that one always falls as the other rises, 0 no link. Above about .5 either way is strong, .3 moderate, .15 weak.`,
      `TO is scored so that fewer turnovers is good, and the shooting categories are scored by impact (percentage against the league times attempts), the same as player value. So a red PTS-TO cell means scorers usually turn the ball over more, which is why punting TO pairs well with points and assists. Correlation describes the player pool as a whole; individual players break the pattern, and the cell drill shows who.`])}</section>`}

function puntPanel(c){const me=tm(ME);
  const raw=S_X('cats.punt',null);let P=raw==null?(S.punt.size?[...S.punt].slice(0,2):[[...CATS].sort((a,b)=>me.catRank[b.k]-me.catRank[a.k])[0].k]):String(raw).split(',').filter(x=>CT(x)).map(x=>CT(x).k);
  P=[...new Set(P)].slice(0,2);
  const chip=o=>{const on=P.includes(o.k),nx=on?P.filter(x=>x!==o.k):[...(P.length>=2?P.slice(1):P),o.k];
    return `<button type="button" class="chip" data-set="cats.punt=${nx.join(',')}" aria-pressed="${on}" title="${esc(o.n)}: you rank #${me.catRank[o.k]} of 10${on?'. Tap to stop punting it here':''}">${o.l} <small>#${me.catRank[o.k]}</small></button>`};
  const R=corr().r,pairs=[];CATS.forEach((a,i)=>CATS.slice(i+1).forEach(b=>pairs.push([a,b,R[a.k][b.k]])));
  const quick=pairs.sort((x,y)=>y[2]-x[2]).slice(0,3);
  let h=`<section class="panel" id="cats-punt">${head('Punt explorer','Pick one or two categories to give up on. See what it costs each team today and which players gain the most value.')}
    <div class="filters hc-chips"><span class="lbl">Punt</span><div class="chips">${CATS.map(chip).join('')}</div></div>
    <div class="filters"><span class="lbl">Pairs that go together</span>${quick.map(([a,b,r])=>`<button type="button" class="btn sm ${P.length===2&&P.includes(a.k)&&P.includes(b.k)?'':'ghost'}" data-set="cats.punt=${a.k},${b.k}" title="r ${fR(r)}: players good at one are usually good at the other">${a.l} + ${b.l}</button>`).join('')}</div>
    <p class="note">The number on each chip is your league rank in it. This explorer is separate from the punts in your build menu.</p>`;
  if(!P.length)return h+`<div class="empty">Pick one or two categories above to see what punting them does.</div>${how(['Punting means giving up on a category on purpose: you expect to lose it most weeks and spend your roster on the others.'])}</section>`;
  const PC=P.map(k=>CT(k)),pl=listAnd(PC.map(x=>x.l)),rows=M.teams.map(t=>({t,now:t.rec,pr:puntRec(t.id,P)})).sort((a,b)=>(b.pr.w+b.pr.t/2)-(a.pr.w+a.pr.t/2)||b.pr.mw-a.pr.mw||a.t.pr-b.t.pr);
  const mr=rows.find(x=>x.t.id===ME),left=9-P.length;
  h+=`<p class="hc-lead">Punting <b>${pl}</b> costs you <b>${sbtn('trec|'+ME,plural(mr.pr.cost,'category win'))}</b> against the field today (you rank ${PC.map(x=>`#${me.catRank[x.k]} in ${x.l}`).join(' and ')}): your record against the other nine teams drops from ${scoreStr(mr.now)} to <b>${scoreStr(mr.pr)}</b>. Standings count every category win, so the punt pays only if the players it frees up win back more. You'd win ${mr.pr.rate==null?'–':pc(mr.pr.rate)} of the other ${left} categories. In a playoff week, where the team that wins more categories advances (assumed), you'd need 5 of the other ${left} and would be ahead of <b>${mr.pr.mw} of 9</b> teams (${mr.now.mw} now).</p>`;
  const costCls=n=>n===0?'p2':n<=2?'p1':n>=12?'n2':n>=6?'n1':'';
  h+=`<div class="cols"><div class="hc-sec"><h3>Every team, punting ${pl}</h3><p class="note">Category record against the other nine teams, now and with ${pl} conceded every week. Best record with the punt first.</p>
    <div class="scroll"><table class="hc-tbl"><thead><tr><th class="l stick" scope="col">Team</th><th scope="col" title="Category record vs the field with the punt (now underneath)">Punting</th><th scope="col" title="Category wins given up">Cost</th><th scope="col" class="hc-full" title="Win rate in the categories that are left">In the rest</th><th scope="col" title="Teams they'd beat in more categories than they lose, with the punt (now underneath): what decides a playoff week">Favored</th>${PC.map(x=>`<th scope="col" title="League rank in ${esc(x.n)}">${x.l}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(({t,now,pr})=>`<tr class="${t.id===ME?'me':''}"><td class="l stick tname"><button type="button" class="tlink" data-team="${t.id}"><span class="hc-full">${tn(t.id)}</span><span class="hc-short">${ab(t.id)}</span></button><small class="hc-full">${ab(t.id)} · power #${t.pr}</small></td><td class="num" ${sx('trec|'+t.id)}><b>${scoreStr(pr)}</b><small class="d">${scoreStr(now)} now</small></td><td class="z ${costCls(pr.cost)}" ${sx('trec|'+t.id)}>${pr.cost?'−'+pr.cost:'0'}</td><td class="num hc-full" ${sx('trec|'+t.id)}>${pr.rate==null?'–':pc(pr.rate)}</td><td class="num" ${sx('trec|'+t.id)}><b>${pr.mw}</b><small class="d">${now.mw} now</small></td>${PC.map(x=>`<td class="z ${rc(t.catRank[x.k])}" ${sx(`tc|${t.id}|${x.k}`)}>#${t.catRank[x.k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const RS=risers(P),top=RS.filter(r=>r.rb<=75).sort((a,b)=>b.up-a.up||b.d-a.d).slice(0,10),mineL=RS.filter(r=>r.p.team===ME&&r.d<0).sort((a,b)=>a.d-b.d).slice(0,3);
  h+=`<div class="hc-sec"><h3>Players who gain the most</h3><p class="note">Their rank and value without ${pl}, among all ${RS.length} players (rostered and free agents). Only players inside the top 75 after the punt.</p>
    <div class="scroll"><table class="hc-tbl"><thead><tr><th class="l stick" scope="col">Player</th><th scope="col" title="Rank by value without the punted categories">Rank</th><th scope="col" title="Value gained by dropping the punted categories">Gain</th>${PC.map(x=>`<th scope="col" title="Their z-score in ${esc(x.n)}">${x.l} z</th>`).join('')}</tr></thead><tbody>
    ${top.map(r=>{const p=r.p;return `<tr class="click ${p.team===ME?'me':''}" ${sx('pv|'+p.name)} tabindex="0">${pcell(p,`${p.team?sbtn('tval|'+p.team,ab(p.team)):'FA'} · ${p.pos}`)}<td class="num" ${sx('pv|'+p.name)}><b>#${r.rb}</b><small class="d">from #${r.ra}</small></td><td class="num" ${sx('pv|'+p.name)}><b>${fZ(r.d)}</b><small class="d hc-full">${fZ(r.a)} → ${fZ(r.b)}</small></td>${PC.map(x=>`<td class="z ${zc(p.z[x.k])}" ${sx(`pc|${p.name}|${x.k}`)}>${fZ(p.z[x.k])}</td>`).join('')}</tr>`}).join('')||`<tr><td class="l" colspan="5">Nobody climbs into the top 75 with this punt.</td></tr>`}</tbody></table></div>
    ${mineL.length?`<p class="note">Your players who lose the most: ${mineL.map(r=>`${sbtn('pv|'+r.p.name,nm(r.p))} (${fZ(r.d)}, #${r.ra} → #${r.rb})`).join(', ')}. If you commit to the punt, they're the ones to shop.</p>`:''}</div></div>`;
  h+=`<div class="hc-acts"><span class="lbl">Your build</span>${PC.map(x=>`<button type="button" class="btn sm ${S.punt.has(x.k)?'':'ghost'}" data-punt="${x.k}" aria-pressed="${S.punt.has(x.k)}">${S.punt.has(x.k)?`Stop punting ${x.l} board-wide`:`Punt ${x.l} board-wide`}</button>`).join('')}<span class="note">Changes player value, waivers and trade ideas everywhere on the board.</span></div>
    ${how([`The small "now" number is each team's category record against the other nine rosters (each category compared head to head, ${SEA()?'season totals':'per game'}), the same as "Vs field" in League › Categories. "Punting" assumes the team concedes ${pl} every week and keeps its current numbers everywhere else. "Cost" is the category wins given up, "In the rest" the win rate in the ${left} categories left (ties count half), and "Favored" the teams they'd still beat in more categories than they lose, which is what decides a playoff week. The regular-season standings count every category win, so "Punting" is the number that matters most until then.`,
      `It doesn't model what a punt is really for: trading the punted categories away for help elsewhere. The players table shows that side. Value adds up a player's z-scores ${SEA()?'over the season (projected games count)':'per game'}; dropping ${pl} from the sum lifts the players who are weakest there, so they are the cheap targets for a team running this punt. "Gain" is the value added, with the total before and after underneath on wider screens.`])}</section>`;
  return h}

/* ---------- drill: lc|cat, one category across the league ---------- */
DRILL.lc=k=>{const c=CT(k);if(!c||!M)return null;css();const K=c.k,B=board(K),SC=scar()[K],me=tm(ME),mr=me.catRank[K],lead=B.ros[0],fa=B.fas[0];
  const top=B.ros.slice(0,10),fas=B.fas.slice(0,5);
  const prow=(r,fa)=>({label:`${nm(r.p)} <small>${fa?`would rank #${r.would}`:esc(teamAbbr(r.p))}${c.pct?' · '+fV(c,r.v):''}</small>`,v:c.pct?r.raw:r.v,txt:c.pct?(r.raw>=0?'+':'−')+Math.abs(r.raw).toFixed(1):fV(c,r.v),
    cls:r.p.team===ME?'me':c.pct?(r.raw>=0?'pos':'neg'):'',stat:`pc|${r.p.name}|${K}`,tip:`${r.p.name} (${r.p.team?teamById[r.p.team].abbr:'free agent'}): ${pTxt(r.p,c)}. z ${fZ(r.z)}.`});
  const lleg=legend([...(c.pct?[['pos','Above a league-average shooter'],['neg','Below']]:[['mut','Other teams\' players']]),['me','Your players']]);
  const bv=[...top,...fas].map(r=>c.pct?r.raw:r.v),lmax=Math.max(...bv.map(Math.abs),1e-9),ctr=bv.some(v=>v<0);   // one scale for both charts; centred only when someone is below average
  let h=facts([
    lead?fact(leadL(c),bigN(lead.p),`${c.pct?shotTxt(lead.p,c):fV(c,lead.v)+' a game'}`,`pc|${lead.p.name}|${K}`):'',
    fact('Your team',`#${mr} of 10`,teamSmall(c,me),`tc|${ME}|${K}`),
    fact(c.pct?'League average':'Average player',c.pct?f3(B.avg):fV(c,B.avg),c.pct?'all rostered shots':`a game · median ${fV(c,B.med)}`),
    fa?fact('Best free agent',bigN(fa.p),`${c.pct?shotTxt(fa.p,c):fV(c,fa.v)+' a game'} · would rank #${fa.would}`,`pc|${fa.p.name}|${K}`):'',
    fact('Top-10 share',pc(B.share),concShort(SC.rank)),
    fact('First to last',gapTxt(c,(c.neg?-1:1)*(B.teams[0].line[K]-B.teams[B.teams.length-1].line[K])).replace(/ (a game|over the season)$/,''),`#1 ${ab(B.teams[0].id)} vs #10 ${ab(B.teams[B.teams.length-1].id)}`,`tc|${B.teams[0].id}|${K}`)]);
  h+=drillSec('Team totals and ranks',`${per()==='a game'?'Per game':'Over the season'}, against the average team; ${c.neg?'fewer turnovers points right':'right is better'}. Tap a team.`,teamBars(c,B)+raceTxt(c,B));
  h+=drillSec('Leaders',`The 10 best rostered players${c.pct?`, by impact: ${MAKES[K]} a game above a league-average shooter taking the same shots (their ${c.l} is next to the name)`:c.neg?', fewest turnovers a game first':', per game'}. Tap one for their breakdown.`,`<div class="hc-wl">${CH.hbars(top.map(r=>prow(r,false)),{max:lmax,center:ctr,stack:true,label:`${c.n} leaders`})}</div>`+lleg);
  h+=drillSec('Best free agents',fas.length?`2025-26 numbers, on the same scale, and where each would rank among rostered players.`:'',fas.length?`<div class="hc-wl">${CH.hbars(fas.map(r=>prow(r,true)),{max:lmax,center:ctr,stack:true,label:`${c.n}: best free agents`})}</div>`:'<div class="empty">No free agents with numbers.</div>');
  h+=drillSec('Distribution',`All ${B.ros.length} rostered players.`,stripOf(c,B)+stripLegend(c,B));
  h+=drillSec('Scarcity',`The top 10 hold ${pc(B.share)} of the above-average value in ${c.l} (even spread: ${pc(B.even)}); the leader is worth ${SC.z10>0?(SC.z1/SC.z10).toFixed(1)+'×':'more than'} the 10th best${fa?`, and the best free agent would rank #${fa.would}`:''}.${B.prod!=null?` The top 10 make ${pc(B.prod)} of all the ${c.n.toLowerCase()} on rosters.`:''}`,shareBars(K));
  const L=punters(K);
  h+=drillSec('Who is punting it',`The two teams at the bottom, and whether it looks like a plan.`,`<div class="hc-pun">${punterHtml(c)}</div>`);
  h+=drillSec(`What moves with ${esc(c.l)}`,`Correlation with each other category across rostered players. Tap one to see both together.`,corrBars(K)+legend([['pos','Usually go together'],['neg','Usually pull apart']]));
  h+=how([`Players are ranked by per-game z-score: how far above or below an average rostered player, in standard deviations${c.neg?', with the sign flipped so fewer turnovers ranks higher':''}.${c.pct?` ${c.l} uses impact, (player % − league ${f3(M.lg[K])}) × ${ATT[K]}, the same way player value counts it.`:''} Team totals add up every rostered player ${SEA()?'over the season':'per game'}${c.pct?'; percentages are total makes over total attempts':''}.`,
    `Top-10 share is the share of all above-average z-score held by the 10 best players. "Who is punting it" checks three signs for each bottom-two team: a gap to #8 at least 1.5 times the usual gap between neighbouring teams, a top-4 average rank in the categories that usually come at ${c.l}'s expense (correlation of −.15 or lower), and a winning record against the field anyway. Two or more signs, with a gap to #8 at least as big as the usual one, reads as deliberate; one sign with that gap, or two without it, reads as "could be". It's an inference from the rosters, not something the managers said.`,
    'Free agents use 2025-26 per-game stats, because ESPN\'s free-agent pool can\'t be read in bulk.']);
  return {eyebrow:'League · category',title:esc(c.n),sub:`${c.neg?'Fewer is better · ':''}${lead?`${nm(lead.p)} ${c.neg?'has the fewest':'leads'} · `:''}you're #${mr} of 10${L.length?` · bottom: ${L.map(x=>ab(x.t.id)).join(', ')}`:''}`,back:`${c.l} league`,html:h}};

/* ---------- drill: lcx|a|b, two categories together ---------- */
DRILL.lcx=(a,b)=>{const A=CT(a),Bc=CT(b);if(!A||!Bc||A.k===Bc.k||!M)return null;css();
  const r=rOf(A.k,Bc.k),ros=M.players.filter(p=>p.pg),fas=M.fas.filter(p=>p.pg),za=p=>p.zpg[A.k],zb=p=>p.zpg[Bc.k];
  const q={both:0,a:0,b:0,none:0};ros.forEach(p=>{const x=za(p)>0,y=zb(p)>0;q[x&&y?'both':x?'a':y?'b':'none']++});
  const pt=(p,cls)=>({x:za(p),y:zb(p),me:p.team===ME,cls,stat:`pc|${p.name}|${A.k}`,
    tip:`${p.name} (${p.team?teamById[p.team].abbr:'free agent'}) · ${A.l} z ${fZ(za(p))} · ${Bc.l} z ${fZ(zb(p))}`});
  const pts=[...ros.filter(p=>p.team!==ME).map(p=>pt(p,'')),...fas.map(p=>pt(p,'s3')),...ros.filter(p=>p.team===ME).map(p=>pt(p,''))];
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),xlo=Math.min(...xs,-1)-.3,xhi=Math.max(...xs,1)+.3,ylo=Math.min(...ys,-1)-.3,yhi=Math.max(...ys,1)+.3;
  const pool=[...ros,...fas];
  const both=pool.filter(p=>za(p)>.2&&zb(p)>.2).sort((x,y)=>(za(y)+zb(y))-(za(x)+zb(x))).slice(0,6);
  const aOnly=pool.filter(p=>za(p)>.5&&zb(p)<0).sort((x,y)=>(za(y)-zb(y))-(za(x)-zb(x))).slice(0,5);
  const bOnly=pool.filter(p=>zb(p)>.5&&za(p)<0).sort((x,y)=>(zb(y)-za(y))-(zb(x)-za(x))).slice(0,5);
  const prow=p=>`<li><span><button type="button" class="plink" data-player="${esc(p.name)}"><b>${nm(p)}</b></button>${pills(p)}<small>${p.team?esc(teamById[p.team].abbr):'Free agent'} · ${p.pos}</small></span><span class="r">${sbtn(`pc|${p.name}|${A.k}`,fZ(za(p)))} / ${sbtn(`pc|${p.name}|${Bc.k}`,fZ(zb(p)))}</span></li>`;
  const lst=(arr,empty)=>arr.length?`<ul class="hc-pairs">${arr.map(prow).join('')}</ul>`:`<p class="note">${empty}</p>`;
  const ts=[...M.teams].sort((x,y)=>(x.catRank[A.k]+x.catRank[Bc.k])-(y.catRank[A.k]+y.catRank[Bc.k])||x.catRank[A.k]-y.catRank[A.k]);
  let h=facts([fact('Correlation',fR(r),`${strength(r)} ${Math.abs(r)<.15?'link':r>0?'positive link':'negative link'}`),fact(`Good at both`,String(q.both),`of ${ros.length} rostered`),fact(`${A.l} only`,String(q.a),`above average in ${A.l}, not ${Bc.l}`),fact(`${Bc.l} only`,String(q.b),`above average in ${Bc.l}, not ${A.l}`)]);
  h+=`<p class="hc-lead">${pairTxt(A,Bc,r)}</p>`;
  h+=drillSec('Every player',`Right is better in ${A.l}${A.neg?' (fewer turnovers)':''}; up is better in ${Bc.l}${Bc.neg?' (fewer turnovers)':''}. The dashed line is the trend. Tap a dot for the ${A.l} breakdown.`,
    CH.scatter(pts,{xl:`${A.l} z-score`,yl:`${Bc.l} z-score`,fx:v=>v.toFixed(0),fy:v=>v.toFixed(0),ref:x=>r*x,x0:xlo,x1:xhi,y0:ylo,y1:yhi,h:380,label:`${A.l} against ${Bc.l}`})+legend([['mut','Rostered'],['me','Your players'],['s3','Free agents']]));
  h+=drillSec('Good at both',`The players who help ${A.l} and ${Bc.l} at once (z-scores ${A.l} / ${Bc.l}).`,lst(both,'Nobody is clearly above average in both.'));
  h+=`<div class="cols">${drillSec(`${A.l} at the cost of ${Bc.l}`,'',lst(aOnly,`Nobody is clearly strong in ${A.l} and below average in ${Bc.l}.`))}${drillSec(`${Bc.l} at the cost of ${A.l}`,'',lst(bOnly,`Nobody is clearly strong in ${Bc.l} and below average in ${A.l}.`))}</div>`;
  h+=drillSec('Teams in both',`League rank in each, best combined first.`,`<div class="scroll"><table class="hc-tbl"><thead><tr><th class="l stick" scope="col">Team</th><th scope="col">${A.l}</th><th scope="col">${Bc.l}</th></tr></thead><tbody>${ts.map(t=>`<tr class="${t.id===ME?'me':''}"><td class="l stick tname">${tlink(t.id)}</td><td class="z ${rc(t.catRank[A.k])}" ${sx(`tc|${t.id}|${A.k}`)}>#${t.catRank[A.k]}</td><td class="z ${rc(t.catRank[Bc.k])}" ${sx(`tc|${t.id}|${Bc.k}`)}>#${t.catRank[Bc.k]}</td></tr>`).join('')}</tbody></table></div>`);
  h+=`<div class="filters">${sbtn('lc|'+A.k,`${A.l} across the league`,'linkbtn')}${sbtn('lc|'+Bc.k,`${Bc.l} across the league`,'linkbtn')}</div>`;
  h+=how([`The correlation (r) is measured on per-game z-scores across the ${ros.length} rostered players with projections. It runs from −1 to +1; around .5 either way is strong. TO is flipped so that fewer turnovers counts as good, and FG%, FT% and 3P% use impact (percentage against the league times attempts), as player value does. The trend line is where a player's ${Bc.l} z-score sits on average for a given ${A.l} z-score.`,
    `Free agents are plotted and listed with their 2025-26 numbers but are not part of the correlation. "Good at" means above the average rostered player (z above 0); the trade-off lists need at least +0.5 in the strong category.`]);
  return {eyebrow:'League · two categories',title:`${esc(A.l)} and ${esc(Bc.l)}`,sub:`r ${fR(r)} across ${ros.length} rostered players · ${strength(r)} ${Math.abs(r)<.15?'link':r>0?'positive link':'negative link'}`,back:`${A.l} & ${Bc.l}`,html:h}};

/* ---------- registration ---------- */
HUB.push({k:'cats',label:'Categories',order:20,note:'Every category across the league: leaders, team races, scarcity, which categories go together, and what a punt does.',render:vCats});
const openCats=(k,anchor)=>{if(k){S.x['cats.k']=k;store.set('x',S.x)}go('stats',{hub:'cats'});if(anchor)setTimeout(()=>scrollToId(anchor),0)};
const KW={pts:'points scoring scorers',reb:'rebounds rebounding boards',ast:'assists passing dimes',stl:'steals',blk:'blocks shot blocking',to:'turnovers fewest',fg:'field goal percentage fg shooting efficiency',ft:'free throw percentage ft foul shooting',tp:'three point 3 point threes 3pt percentage'};
CATS.forEach(c=>CMDS.push({label:c.neg?'Turnovers: fewest a game':`${c.n} leaders`,sub:`Leaders, team ranks, scarcity and punts in ${c.l}`,kw:`${c.n} ${c.l} ${KW[c.k]||''} leaders leaderboard category`,tag:'Stats',act:()=>openCats(c.k)}));
CMDS.push({label:'Punt explorer',sub:'Punt one or two categories: each team\'s record and the players who gain',kw:'punt punting strategy build explorer categories',tag:'Stats',act:()=>openCats(null,'cats-punt')});
CMDS.push({label:'Which categories go together',sub:'Correlations between the nine categories, for punt planning',kw:'correlation correlations together pairs heat map categories punt pairs',tag:'Stats',act:()=>openCats(null,'cats-corr')});
})();
