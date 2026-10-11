/* h5_draft.js: the Draft view in the Stats tab (HUB order 50, k 'draft') and the draft drills.
   dpk|<pick>    one pick: who went there, what that pick usually returns, value against it, the picks around it, hindsight
   tdr|<teamId>  one team's draft: every pick against its slot, grade, best and worst pick, position mix
   drd|<round>   one round: its picks against the curve (an extra drill, opened from round labels)
   Registers only at load; everything is computed at render time and memoised per model state.
   Shared: LAB.draftBoard(vk) returns the board (picks, fitted curve, inferred slot map, team grades, rounds);
           LAB.draftExpected(pick) is what a pick usually returns in trade value. */
(()=>{
const LAB=window.LAB=window.LAB||{};
const NS='h5';
const POS=['PG','SG','SF','PF','C'];
const POSN={PG:'point guards',SG:'shooting guards',SF:'small forwards',PF:'power forwards',C:'centers'};
const KNOWN_SLOT=ME===DATA.myTeam?5:null;   // the commissioner's team (team 1) is known to have drafted 5th; used only to check the inferred slot map
const VK=()=>S_X('draft.v','tv')==='model'?'model':'tv';
const VL={tv:'Trade value',model:'Model value'};
const valOf=(p,vk)=>!p||!p.pg?null:vk==='model'?p.tvModel:p.tv;
const sgn=x=>{if(x==null||!isFinite(x))return '–';const r=Math.round(x);return r>0?'+'+r:r<0?'−'+(-r):'0'};
const n0=x=>x==null||!isFinite(x)?'–':String(Math.round(x));
const shortName=n=>{const w=String(n).trim().split(/\s+/);return w.length>1?w.slice(1).join(' '):w[0]};
const tAb=id=>id&&teamById[id]?teamById[id].abbr:id===0?'FA':'?';
const tNm=id=>id&&teamById[id]?teamById[id].name:'Unknown team';
const legend=items=>`<div class="legend">${items.map(([c,l])=>`<span><i class="${c}"></i>${l}</span>`).join('')}</div>`;
const facts=a=>`<div class="facts">${a.join('')}</div>`;
const VERD={p3:'a big steal',p2:'a steal',p1:'a little better than the slot','':'about what the slot usually returns',n1:'a little below the slot',n2:'a reach',n3:'a big reach'};

function css(){addCSS('h5-css',`
.h5-bd{border-collapse:separate;border-spacing:3px;width:100%;table-layout:fixed;min-width:960px}
.h5-bd th,.h5-bd td{padding:0;border:0;white-space:normal;text-align:left;vertical-align:top}
.h5-bd thead th{position:static;background:none}
.h5-bd .h5-rd{width:44px;position:sticky;left:0;z-index:2;background:var(--panel)}
.h5-rd button,.h5-th{display:flex;flex-direction:column;gap:1px;width:100%;background:none;border:0;padding:4px 4px;border-radius:6px;font:inherit;color:inherit;text-align:left;cursor:pointer}
.h5-rd button{font:700 1rem/1 var(--display);align-items:center;padding-top:14px}
.h5-rd small{font:500 .7rem var(--body);color:var(--muted)}
.h5-th b{font:700 1rem/1.05 var(--display);text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.h5-th small{font-size:.7rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.h5-th:hover,.h5-rd button:hover{background:var(--soft)}
.h5-th.me{background:var(--me);box-shadow:inset 0 -2px 0 var(--s2)}
.h5-c{display:flex;flex-direction:column;gap:1px;width:100%;min-height:54px;padding:5px 6px;border:0;border-radius:6px;font:inherit;text-align:left;cursor:pointer;min-width:0}
.h5-c.h5-0{background:var(--soft);color:var(--ink)}
.h5-c.h5-x{background:none;border:1px dashed var(--line);color:var(--muted)}
.h5-c.me{box-shadow:inset 0 0 0 2px var(--s2)}
.h5-c:hover{box-shadow:inset 0 0 0 2px var(--accent)}
.h5-nm{font-weight:600;font-size:.8rem;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.h5-ln{display:flex;justify-content:space-between;gap:4px;font:500 .68rem/1.25 var(--mono);opacity:.88;min-width:0;white-space:nowrap}
.h5-ln span{overflow:hidden;text-overflow:ellipsis}
.legend .h5-md{width:16px;height:0;border-radius:0;background:none;border-top:2px dashed var(--muted);vertical-align:3px}
.legend .h5-me{background:none;box-shadow:inset 0 0 0 2px var(--s2)}
.legend .h5-0{background:var(--soft);border:1px solid var(--line)}
.legend .h5-bnd{background:var(--accent-soft);border:1px solid var(--line)}
.h5-mb{position:relative;display:block;height:6px;min-width:40px;background:var(--soft);border-radius:3px;margin-top:3px}
.h5-mb::after{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--muted)}
.h5-mb i{position:absolute;top:0;bottom:0;border-radius:3px}
.h5-mb i.pos{background:var(--pos-3)}.h5-mb i.neg{background:var(--neg-3)}
.h5-t td.l small{display:block;color:var(--muted);font-size:.72rem;font-weight:400}
.h5-t td.wrap{white-space:normal;min-width:7.5em}
.h5-t td.wrap b{overflow-wrap:anywhere}
.h5-t tr.sel td{background:var(--accent-soft)}
.h5-strip{min-width:720px}
.ch .h5-tk{fill:var(--muted);fill-opacity:.5}.ch .h5-tk.on{fill:var(--accent);fill-opacity:1}.ch .h5-band{fill:var(--accent-soft)}
.h5-runs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.h5-runs li{border:1px solid var(--line);border-radius:10px;padding:9px 12px;display:flex;flex-direction:column;gap:3px}
.h5-nw{white-space:nowrap}
.h5-runs b{font-weight:600}.h5-runs p{margin:0;font-size:.83rem;color:var(--muted)}
.h5-acts{display:flex;flex-wrap:wrap;gap:8px}
.h5-lead{margin:0;font-size:.92rem;line-height:1.5;max-width:72ch}
.h5-sc{max-width:820px;width:100%}
.h5-fx{display:flex;flex-direction:column;gap:6px}.h5-fx .facts{grid-template-columns:repeat(auto-fit,minmax(min(100%,92px),1fr))}
@media (min-width:561px){.h5-sr .hb-r{grid-template-columns:minmax(0,15.5em) minmax(0,1fr) 3em}}
@media (max-width:560px){.h5-sc .ch text{font-size:17px}.h5-t th,.h5-t td{padding-left:6px;padding-right:6px}.h5-t td.wrap{min-width:6em}.h5-t td.wrap b{font-size:.93rem}.h5-mb{min-width:34px}}
`)}

/* ---------- the snake ---------- */
const rndOf=(n,NT)=>Math.ceil(n/NT), inRd=(n,NT)=>(n-1)%NT+1;
const slotOf=(n,NT)=>{const r=rndOf(n,NT),i=inRd(n,NT);return r%2?i:NT+1-i};
const pickAt=(slot,r,NT)=>(r-1)*NT+(r%2?slot:NT+1-slot);
const pl=(n,NT=DATA.teams.length)=>`${rndOf(n,NT)}.${String(inRd(n,NT)).padStart(2,'0')}`;

/* ---------- the board: picks, inferred slots, the expected-value curve, grades, rounds ---------- */
function board(vk){vk=vk==='model'?'model':vk==='tv'?'tv':VK();return memo(NS+'.board.'+vk,()=>{
  const NT=DATA.teams.length;
  const drafted=M.all.filter(p=>p.draftPick!=null&&Number.isFinite(+p.draftPick)&&+p.draftPick>=1);
  const byPick=new Map(),dups=[];
  [...drafted].sort((a,b)=>a.draftPick-b.draftPick||(b.team>0)-(a.team>0)).forEach(p=>{const n=+p.draftPick;if(byPick.has(n))dups.push(p);else byPick.set(n,p)});
  const N=byPick.size?Math.max(...byPick.keys()):0,R=Math.ceil(N/NT),NN=R*NT;
  // slot -> team by majority vote of where each slot's players are rostered now, one team per slot
  const votes={};byPick.forEach((p,n)=>{if(p.team>0){const s=slotOf(n,NT),o=votes[s]=votes[s]||{};o[p.team]=(o[p.team]||0)+1}});
  const pairs=[];Object.entries(votes).forEach(([s,o])=>Object.entries(o).forEach(([t,c])=>pairs.push([c,+s,+t])));
  pairs.sort((a,b)=>b[0]-a[0]||a[1]-b[1]);
  const s2t={},t2s={};pairs.forEach(([c,s,t])=>{if(s2t[s]==null&&t2s[t]==null){s2t[s]=t;t2s[t]=s}});
  const freeS=[...Array(NT)].map((_,i)=>i+1).filter(s=>s2t[s]==null),freeT=DATA.teams.map(t=>t.id).filter(t=>t2s[t]==null);
  if(freeS.length===1&&freeT.length===1){s2t[freeS[0]]=freeT[0];t2s[freeT[0]]=freeS[0]}
  const support={};for(let s=1;s<=NT;s++){const o=votes[s]||{},tot=Object.values(o).reduce((a,b)=>a+b,0);support[s]={n:s2t[s]!=null?(o[s2t[s]]||0):0,of:tot}}
  const picks=[];for(let n=1;n<=NN;n++){const p=byPick.get(n)||null,s=slotOf(n,NT),by=s2t[s]??null;
    picks.push({n,r:rndOf(n,NT),i:inRd(n,NT),s,by,p,v:valOf(p,vk),moved:!!(p&&by!=null&&p.team!==by)})}
  // expected value: a smooth curve through the values of nearby picks. A weighted straight-line fit around each pick on a
  // log scale of pick number (Gaussian weights, so the steep early picks get a narrow window and late picks a wide one),
  // the window width chosen by leave-one-out error, then made non-increasing (pool adjacent violators) and floored at 0.
  // (One straight line in ln(pick) ran ~4 points too high in round 1 and the last rounds and too low in rounds 4-9,
  // so whole rounds showed up as reaches or steals.)
  const pts=picks.filter(k=>k.v!=null),X=pts.map(k=>Math.log(k.n)),Y=pts.map(k=>k.v);
  const ll=(u,h,skip)=>{let sw=0,sx=0,sy=0,sxx=0,sxy=0;for(let i=0;i<X.length;i++){if(i===skip)continue;const w=Math.exp(-.5*((X[i]-u)/h)**2);sw+=w;sx+=w*X[i];sy+=w*Y[i];sxx+=w*X[i]*X[i];sxy+=w*X[i]*Y[i]}
    if(sw<1e-12)return null;const mx=sx/sw,my=sy/sw,vx=sxx/sw-mx*mx,sl=vx>1e-9?(sxy/sw-mx*my)/vx:0;return my+sl*(u-mx)};
  let bw=null;const g=[0];
  if(pts.length>=8){let bestE=Infinity;[.25,.35,.5,.7,1].forEach(h=>{let s=0;for(let i=0;i<X.length;i++){const f=ll(X[i],h,i);s+=(Math.max(0,f??0)-Y[i])**2}if(s<bestE){bestE=s;bw=h}});
    for(let n=1;n<=NN;n++)g[n]=ll(Math.log(n),bw,-1)??0;
    // pool adjacent violators: the usual return never rises for a later pick
    const bl=[];for(let n=1;n<=NN;n++){bl.push({s:g[n],c:1});while(bl.length>1&&bl[bl.length-2].s/bl[bl.length-2].c<bl[bl.length-1].s/bl[bl.length-1].c){const t=bl.pop();bl[bl.length-1].s+=t.s;bl[bl.length-1].c+=t.c}}
    let j=1;bl.forEach(q=>{for(let c=0;c<q.c;c++)g[j++]=Math.max(0,q.s/q.c)})}
  else{const m=pts.length?mean(Y):0;for(let n=1;n<=NN;n++)g[n]=m}
  const E=x=>{if(!NN)return 0;const c=Math.min(NN,Math.max(1,+x||1)),i=Math.floor(c),f=c-i;return i>=NN?g[NN]:g[i]*(1-f)+g[i+1]*f};
  picks.forEach(k=>{k.e=E(k.n);k.d=k.v==null?null:k.v-k.e});
  const res=pts.map(k=>k.d),sd=res.length>1?Math.sqrt(mean(res.map(x=>x*x))):1,ym=mean(pts.map(k=>k.v));
  const sst=pts.reduce((s,k)=>s+(k.v-ym)**2,0),sse=pts.reduce((s,k)=>s+k.d**2,0),r2=sst?Math.max(0,1-sse/sst):0;
  const T=[.5,1,2].map(m=>Math.max(1,Math.round(m*sd)));
  // bands use the rounded gap, so the colour always matches the number shown (a −5.6 shows as −6 and counts as 6+ below)
  const cls=d0=>{if(d0==null)return '';const d=Math.round(d0);return d>=T[2]?'p3':d>=T[1]?'p2':d>=T[0]?'p1':d<=-T[2]?'n3':d<=-T[1]?'n2':d<=-T[0]?'n1':''};
  picks.forEach(k=>k.c=cls(k.d));
  // re-draft rank: 1 + players worth more (ties share a rank; many late picks sit at exactly 0)
  pts.forEach(k=>{k.vr=1+pts.filter(x=>x.v>k.v+1e-9).length;k.vt=pts.filter(x=>x!==k&&Math.abs(x.v-k.v)<=1e-9).length});
  const dmax=Math.max(1,...pts.map(k=>Math.abs(k.d)));
  // teams: every pick credited to the team that made it, wherever the player is now
  const teams={};DATA.teams.forEach(t=>{const ks=picks.filter(k=>k.by===t.id),q=ks.filter(k=>k.v!=null);
    const best=q.reduce((m,k)=>!m||k.d>m.d?k:m,null),worst=q.reduce((m,k)=>!m||k.d<m.d?k:m,null);
    teams[t.id]={id:t.id,slot:t2s[t.id]??null,ks,nq:q.length,val:q.reduce((s,k)=>s+k.v,0),exp:q.reduce((s,k)=>s+k.e,0),sur:q.reduce((s,k)=>s+k.d,0),best,worst,
      steals:q.filter(k=>Math.round(k.d)>=T[1]).length,reaches:q.filter(k=>Math.round(k.d)<=-T[1]).length,kept:ks.filter(k=>k.p&&k.p.team===t.id).length}});
  const TL=Object.values(teams),sm=mean(TL.map(x=>x.sur)),ss=sdev(TL.map(x=>x.sur))||1;
  TL.forEach(x=>{x.z=(x.sur-sm)/ss;x.grade=x.z>=.9?'A':x.z>=.35?'B+':x.z>=-.3?'B':x.z>=-.9?'C+':'C'});
  [...TL].sort((x,y)=>y.sur-x.sur).forEach((x,i)=>x.rk=i+1);[...TL].sort((x,y)=>y.val-x.val).forEach((x,i)=>x.vrk=i+1);
  const rounds=[];for(let r=1;r<=R;r++){const ks=picks.filter(k=>k.r===r),q=ks.filter(k=>k.v!=null);
    rounds.push({r,ks,nq:q.length,avg:q.length?mean(q.map(k=>k.v)):null,exp:mean((q.length?q:ks).map(k=>k.e)),hits:q.filter(k=>k.d>0).length,
      best:q.reduce((m,k)=>!m||k.d>m.d?k:m,null),worst:q.reduce((m,k)=>!m||k.d<m.d?k:m,null),top:q.reduce((m,k)=>!m||k.v>m.v?k:m,null),mine:ks.find(k=>k.by===ME)||null})}
  return {vk,NT,N,NN,R,picks,dups,s2t,t2s,support,fit:{bw,r2,sd,E,T,n:pts.length},cls,teams,rounds,dmax,
    kept:picks.filter(k=>k.p&&k.by!=null&&k.p.team===k.by).length,known:picks.filter(k=>k.p).length}})}
LAB.draftBoard=vk=>board(vk);
LAB.draftExpected=n=>{const B=board('tv');return B.N?B.fit.E(+n):null};

/* position streaks: each position's tightest stretch (the window least likely at its overall rate), and how often a random
   order of the same picks produces one at least as tight somewhere in the draft. Scanning ~150 picks always finds a window
   that looks rare on its own, so only the draft-wide chance says whether a streak was a real run. */
function binTail(n,k,p){let s=0;for(let j=k;j<=n;j++){let c=1;for(let i=0;i<j;i++)c=c*(n-i)/(i+1);s+=c*Math.pow(p,j)*Math.pow(1-p,n-j)}return s}
const elig=k=>k.p?String(k.p.pos||'').split('/'):[];
const SHUF=300,RUNP=.1,WMAX=12;
function runs(){return memo(NS+'.runs',()=>{const B=board('tv'),P=B.picks,known=Math.max(1,B.known),r=rng(20260927);
  const tight=(seq,X,tab)=>{const idx=[];seq.forEach((k,i)=>{if(elig(k).includes(X))idx.push(i)});let best=null;
    for(let a=0;a<idx.length;a++)for(let b=a+2;b<idx.length;b++){const n=idx[b]-idx[a]+1;if(n>WMAX)break;const k=b-a+1,t=tab[n][k];if(!best||t<best.tail-1e-12||(Math.abs(t-best.tail)<=1e-12&&k>best.k))best={i0:idx[a],i1:idx[b],n,k,tail:t}}
    return best};
  const sh=[];for(let s=0;s<SHUF;s++){const q=[...P];for(let i=q.length-1;i>0;i--){const j=Math.floor(r()*(i+1));const t=q[i];q[i]=q[j];q[j]=t}sh.push(q)}
  return POS.map(X=>{const p=P.filter(k=>elig(k).includes(X)).length/known;if(p<=0||p>=1)return null;
    const tab=[];for(let n=0;n<=WMAX;n++){tab[n]=[];for(let k=0;k<=n;k++)tab[n][k]=binTail(n,k,p)}
    const s=tight(P,X,tab);if(!s)return null;
    const chance=sh.filter(q=>{const o=tight(q,X,tab);return o&&o.tail<=s.tail+1e-12}).length/SHUF;
    return {X,p,...s,chance,odd:chance<RUNP}}).filter(Boolean).sort((a,b)=>a.i0-b.i0)})}

/* ---------- small pieces ---------- */
const vseg=vk=>`<div class="seg" role="group" aria-label="Value used">${[['tv','Trade value'],['model','Model only']].map(([v,l])=>`<button type="button" data-set="draft.v=${v}" aria-pressed="${v===vk}">${l}</button>`).join('')}</div>`;
const mbar=(d,mx)=>{if(d==null)return '';const w=Math.min(50,Math.abs(d)/mx*50);return `<span class="h5-mb" aria-hidden="true"><i class="${d>=0?'pos':'neg'}" style="${d>=0?'left:50%':'right:50%'};width:${w.toFixed(1)}%"></i></span>`};
const nowTxt=k=>!k.p?'':k.p.team===0?'now a free agent':k.moved?`now on ${esc(tAb(k.p.team))}`:'';
const poss=s=>/s$/i.test(s)?s+"'":s+"'s";
const pName=k=>k.p?esc(k.p.name):'<i>Not in the data</i>';
const tipOf=(k,B)=>k.p?`${pl(k.n)} (pick ${k.n}) · ${k.p.name}, ${k.p.pos} · by ${tNm(k.by)}${k.moved?' · now '+(k.p.team?tNm(k.p.team):'a free agent'):''} · ${k.v==null?'no projection':`${VL[B.vk].toLowerCase()} ${n0(k.v)}, usually ${n0(k.e)} here (${sgn(k.d)})`}`:`${pl(k.n)} (pick ${k.n}): no player recorded`;
const links=(a,end='.')=>a.map((x,i)=>`<span class="h5-nw">${x}${i<a.length-1?',':end}</span>`).join(' ');
const chTxt=c=>c<.01?'under 1%':pc(c);
const grd=g=>`<span class="grade g-${gcls(g)}" style="font-size:.95rem;min-width:1.9em;padding:2px 5px">${g}</span>`;
// one table row per pick (rows open the pick); team column optional
function pickRows(ks,B,o={}){return `<div class="scroll"><table class="h5-t"><thead><tr><th class="l stick" scope="col">Pick</th><th class="l" scope="col">Player</th><th scope="col" title="Today's value, and what this pick usually returns">Value</th><th scope="col">vs slot</th></tr></thead><tbody>
  ${ks.map(k=>`<tr class="click ${k.n===o.sel?'sel':''} ${o.team&&k.by===ME?'me':''}" ${sx('dpk|'+k.n)} tabindex="0" data-tip="${esc(tipOf(k,B))}"><td class="l stick num">${pl(k.n)}<span class="rk">#${k.n}</span></td><td class="l wrap"><b style="font-weight:600">${pName(k)}</b>${k.p?pills(k.p):''}<small>${k.p?esc(k.p.pos)+' · '+esc(k.p.nba):''}${o.team?' · by '+esc(tAb(k.by)):''}${nowTxt(k)?' · '+nowTxt(k):''}</small></td><td class="num"><b>${n0(k.v)}</b><span class="rk">usually ${n0(k.e)}</span></td><td class="num z ${k.c}" style="text-align:right">${sgn(k.d)}${mbar(k.d,B.dmax)}</td></tr>`).join('')}</tbody></table></div>`}
const dleg=B=>legend([['p3',`Big steal, ${B.fit.T[2]}+ above`],['p2',`Steal, ${B.fit.T[1]}+`],['p1',`${B.fit.T[0]}+`],['h5-0',`Within ${B.fit.T[0]}`],['n1',`${B.fit.T[0]}+ below`],['n2',`Reach, ${B.fit.T[1]}+`],['n3',`Big reach, ${B.fit.T[2]}+`]]);
const noDraft=()=>`<div class="empty">No draft picks are in the data yet.</div>`;
const fitHow=B=>{const E=B.fit.E,m=Math.min(B.NN,5*B.NT);return `The usual return of a pick is a smooth curve through the ${VL[B.vk].toLowerCase()} of all ${B.fit.n} drafted players with a projection. Around each pick it fits a weighted straight line on a log scale of pick number, so the steep early picks lean on a narrow window of neighbours and the late picks on a wide one; the window width is the one that best predicts each pick when that pick is left out. The curve is then kept from rising for a later pick and floored at 0 (replacement level). It puts the usual return at ${n0(E(1))} for pick 1, ${n0(E(B.NT))} for pick ${B.NT}, ${n0(E(m))} for pick ${m} and ${n0(E(B.NN))} for pick ${B.NN}. It explains ${pc(B.fit.r2)} of the differences between picks, and a typical pick lands ${B.fit.sd.toFixed(0)} points off it. This is one draft, so "usual" means "what the picks around it returned", not an average over many drafts. Colours mark how far a pick sits from the curve: ${B.fit.T[0]}, ${B.fit.T[1]} and ${B.fit.T[2]} points (half, one and two typical misses).`};
const valHow=()=>`Values are today's${preseason?' preseason':''} projections, not draft-day ones. Trade value already counts the draft slot (${pc(BLEND.W?BLEND.W.draft:0)} of the blend now, shrinking each week), which pulls every player toward where they went; "Model only" uses the category model alone (per-game value across all nine categories, games, health, above replacement), so it shows steals and reaches more starkly.`;
const slotHow=B=>{const me=B.t2s[ME],sp=Object.entries(B.support).filter(([,x])=>x.of).sort((a,b)=>a[1].n/a[1].of-b[1].n/b[1].of)[0];return `Which team picked in which slot is inferred, not read from ESPN. In a ${B.NT}-team snake the team in slot 3 picks 3rd in odd rounds and ${ord(B.NT-2)} in even rounds, so each slot owns one pick per round; each slot goes to the team that rosters most of the players taken with those picks today. ${Object.values(B.support).every(x=>x.of&&x.n===x.of)?`Every slot is unanimous: all of its picks are still on one team.`:sp?`The weakest call is slot ${sp[0]}, backed by ${sp[1].n} of its ${sp[1].of} rostered picks.`:''} ${me!=null&&KNOWN_SLOT!=null?(me===KNOWN_SLOT?`Your team maps to slot ${me}, which matches the slot you are known to have drafted from.`:`Your team maps to slot ${me}, but you are known to have drafted ${ord(KNOWN_SLOT)}: treat the mapping with care.`):''}`};

/* =====================================================================================
   dpk|<pick>
   ===================================================================================== */
DRILL.dpk=pick=>{const n=parseInt(pick,10),B=board();if(!Number.isFinite(n)||String(n)!==String(pick).trim()||n<1||!B.N||n>B.NN)return null;css();
  const k=B.picks[n-1],p=k.p,vk=B.vk,NT=B.NT,vl=VL[vk].toLowerCase();
  const base={eyebrow:`Draft · round ${k.r}, pick ${k.i} of ${NT}`,title:p?`${esc(p.name)} at ${pl(n)}`:`Pick ${pl(n)}`,back:`Pick ${pl(n)}`,
    sub:`Pick ${n} of ${B.NN}, by ${k.by!=null?esc(tNm(k.by)):'an unknown team'}${k.by===ME?' (you)':''}${p&&k.moved?` · ${p.team?'now on '+esc(tNm(p.team)):'now a free agent'}`:''}`};
  const lead=p&&k.v!=null?`${esc(p.name)} went ${ord(n)} overall. A ${ord(n)} pick usually returns about <b>${n0(k.e)}</b> in ${vl}; they are worth <b>${n0(k.v)}</b>, ${Math.abs(Math.round(k.d))} ${k.d>=0?'more':'less'}: ${VERD[k.c]}. ${k.v<=1e-9&&k.vt?`Their value of 0 is replacement level, shared with ${k.vt} other drafted player${k.vt>1?'s':''}, so on current values a re-draft might not take them at all.`:`On current values they are ${k.vt?'tied for ':'the '}${ord(k.vr)} most valuable of the ${B.fit.n} drafted players, so a re-draft would take them around pick ${pl(k.vr)}.`}`
    :p?`${esc(p.name)} went ${ord(n)} overall but has no projection or stats yet, so the board can't value the pick. A ${ord(n)} pick usually returns about <b>${n0(k.e)}</b> in ${vl}.`
    :`No player in the data carries this pick (they may have been dropped and left the free-agent list). A ${ord(n)} pick usually returns about <b>${n0(k.e)}</b> in ${vl}.`;
  const tier=k.v!=null?tierOf(p.tv):null;
  let h=`<p class="h5-lead">${lead}</p><div class="filters"><span class="lbl">Value</span>${vseg(vk)}</div>`;
  h+=facts([k.v!=null?fact(VL[vk],n0(k.v),vk==='tv'?`${tier?tier[1]:''} · #${p.tvRank??'–'} on the trade chart`:`Trade value ${n0(p.tv)}`,'ptv|'+p.name):'',
    fact(`A ${ord(n)} pick usually returns`,n0(k.e),'the fitted curve at this pick'),
    k.v!=null?fact('Against the slot',sgn(k.d),VERD[k.c]):'',
    k.v!=null?(k.v<=1e-9&&k.vt?fact('Re-draft spot','Maybe none',`replacement level, like ${k.vt} other${k.vt>1?'s':''}`):fact('Re-draft spot',pl(k.vr),`${k.vt?'tied ':''}${ord(k.vr)} most valuable drafted`)):'',
    k.by!=null?fact('Drafted by',esc(tAb(k.by)),`${ord(B.teams[k.by].rk)} best draft · grade ${B.teams[k.by].grade}`,'tdr|'+k.by):'',
    fact('Round',k.r,`pick ${k.i} of ${NT} in the round`,'drd|'+k.r)]);
  // around the curve
  const lo=Math.max(1,n-15),hi=Math.min(B.NN,n+15),win=B.picks.slice(lo-1,hi),vals=win.filter(x=>x.v!=null);
  const y1=Math.max(10,Math.ceil((Math.max(...vals.map(x=>x.v),B.fit.E(lo))+8)/10)*10),hasMe=vals.some(x=>x.by===ME&&x!==k);
  h+=drillSec('Against the curve',`Picks ${lo} to ${hi}. The dashed line is what each pick usually returns; dots above it beat their slot.`,
    `<div class="h5-sc">${CH.scatter(vals.map(x=>({x:x.n,y:x.v,hi:x===k,me:x.by===ME&&x!==k,tip:tipOf(x,B),stat:x===k?null:'dpk|'+x.n})),{xl:'Pick number',yl:VL[vk],fx:v=>String(Math.round(v)),fy:v=>String(Math.round(v)),ref:B.fit.E,x0:lo,x1:hi,y0:0,y1,h:250,label:'Value against pick number near this pick'})}</div>`
    +legend([...(k.v!=null?[['hi','This pick']]:[]),...(hasMe?[['me','Your picks']]:[]),['mut','Other picks'],['h5-md','What the pick usually returns']]));
  // the picks around it
  h+=drillSec('Just before and after','Tap a pick to move to it.',pickRows(B.picks.slice(Math.max(0,n-4),Math.min(B.NN,n+3)),B,{team:true,sel:n}));
  // hindsight
  if(k.v!=null){const later=B.picks.filter(x=>x.n>n&&x.v!=null&&x.v>k.v).sort((x,y)=>y.v-x.v),earlier=B.picks.filter(x=>x.n<n&&x.v!=null&&x.v<k.v);
    h+=drillSec('Hindsight',`${later.length?`${later.length} player${later.length>1?'s':''} taken later ${later.length>1?'are':'is'} worth more today.`:'Nobody taken after this pick is worth more today: on current values it was the right call.'} ${earlier.length?`${earlier.length} player${earlier.length>1?'s':''} taken earlier ${earlier.length>1?'are':'is'} worth less.`:''}`,
      later.length?'<div class="h5-sr">'+CH.hbars(later.slice(0,4).map(x=>({label:`${pl(x.n)} ${esc(x.p.name)}<small>${esc(tAb(x.by))}</small>`,v:x.v-k.v,txt:'+'+Math.round(x.v-k.v),cls:'pos',stat:'dpk|'+x.n,tip:`${x.p.name} went ${x.n-n} picks later and is worth ${n0(x.v)}, ${Math.round(x.v-k.v)} more`})),{stack:true,label:'Later picks worth more'})+'</div>':'')}
  // position context
  if(p){const lines=elig(k).filter(X=>POS.includes(X)).map(X=>{const xs=B.picks.filter(x=>elig(x).includes(X)),i=xs.indexOf(k),prev=xs[i-1],next=xs[i+1];
      const run=runs().find(u=>(u.odd||u.k>=4)&&u.X===X&&k.n-1>=u.i0&&k.n-1<=u.i1);
      return `<li><b>${ord(i+1)} ${X} taken</b><p>${prev?`Previous: ${sbtn('dpk|'+prev.n,`${pl(prev.n)} ${esc(prev.p.name)}`)}. `:'The first one off the board. '}${next?`Next: ${sbtn('dpk|'+next.n,`${pl(next.n)} ${esc(next.p.name)}`)}${next.n-n>1?`, ${next.n-n} picks later`:', the very next pick'}.`:'The last one taken.'}${run?` Part of the tightest ${X} streak of the draft: ${run.k} ${POSN[X]} in ${run.n} picks (${pl(run.i0+1)} to ${pl(run.i1+1)}), ${run.odd?'an unusual run':'about as tight as random order produces'}.`:''}</p></li>`});
    if(lines.length)h+=drillSec('Position',`${esc(p.pos)}. Players with two positions count for both.`,`<ul class="h5-runs">${lines.join('')}</ul>`)}
  // the team's draft around it
  if(k.by!=null){const tk=B.teams[k.by].ks,j=tk.indexOf(k),pv=tk[j-1],nx=tk[j+1];
    h+=drillSec(`${esc(poss(tNm(k.by)))} draft`,`Their ${ord(j+1)} pick of ${tk.length}.${pv?` Before it: ${sbtn('dpk|'+pv.n,`${pl(pv.n)} ${pv.p?esc(pv.p.name):'unknown'}`)}.`:''}${nx?` After it: ${sbtn('dpk|'+nx.n,`${pl(nx.n)} ${nx.p?esc(nx.p.name):'unknown'}`)}.`:''}`,'')}
  h+=`<div class="h5-acts">${p?`<button type="button" class="btn sm ghost" data-player="${esc(p.name)}">Player profile</button>`:''}${k.by!=null?`<button type="button" class="btn sm ghost" ${sx('tdr|'+k.by)}>${esc(tAb(k.by))} draft</button>`:''}<button type="button" class="btn sm ghost" ${sx('drd|'+k.r)}>Round ${k.r}</button>${n>1?`<button type="button" class="btn sm ghost" ${sx('dpk|'+(n-1))}>Pick ${pl(n-1)}</button>`:''}${n<B.NN?`<button type="button" class="btn sm ghost" ${sx('dpk|'+(n+1))}>Pick ${pl(n+1)}</button>`:''}</div>`;
  h+=how([fitHow(B),valHow(),slotHow(B)+` "Re-draft spot" ranks every drafted player by today's value; hindsight compares the same values, so it is wiser than anyone could have been on draft day.`]);
  return {...base,html:h}};

/* =====================================================================================
   tdr|<teamId>
   ===================================================================================== */
DRILL.tdr=id=>{const tid=parseInt(id,10),t=Number.isFinite(tid)&&String(tid)===String(id).trim()?tm(tid):null;if(!t)return null;const B=board();if(!B.N)return null;css();
  const x=B.teams[tid],NT=B.NT,vk=B.vk,vl=VL[vk].toLowerCase(),me=tid===ME;
  const base={eyebrow:`Draft · ${x.slot!=null?ord(x.slot)+' slot':'slot unknown'}`,title:`${esc(t.name)}: draft`,back:`${t.abbr} draft`,sub:`${esc(t.mgr)}${me?' (you)':''} · ${x.ks.length} picks · grade ${x.grade}`};
  if(!x.ks.length)return {...base,html:`<div class="empty">No picks map to this team. The slot mapping is inferred from current rosters, and none of them point here.</div>`};
  const firsts=x.ks.slice(0,4).map(k=>k.n).join(', ');
  const lead=`${me?'You':esc(t.name)} picked ${ord(x.slot)} in odd rounds and ${ord(NT+1-x.slot)} in even rounds (picks ${firsts} and so on). ${me?'Your':'Their'} ${x.nq} valued picks are worth <b>${n0(x.val)}</b> in ${vl}, <b>${sgn(x.sur)}</b> against what those slots usually return: ${ord(x.rk)} of ${NT}, grade <b>${x.grade}</b>.${x.best?` Best pick: ${esc(x.best.p.name)} (${sgn(x.best.d)}). Worst: ${esc(x.worst.p.name)} (${sgn(x.worst.d)}).`:''}`;
  let h=`<p class="h5-lead">${lead}</p><div class="filters"><span class="lbl">Value</span>${vseg(vk)}</div>`;
  h+=facts([fact('Draft grade',x.grade,`${ord(x.rk)} of ${NT} against the slots`),fact('Against the slots',sgn(x.sur),`${x.steals} steal${x.steals===1?'':'s'}, ${x.reaches} reach${x.reaches===1?'':'es'}`),
    fact('Total value',n0(x.val),`${ord(x.vrk)} of ${NT}; slots usually return ${n0(x.exp)}`),
    x.best?fact('Best pick',sgn(x.best.d),`${esc(x.best.p.name)}, ${pl(x.best.n)}`,'dpk|'+x.best.n):'',x.worst?fact('Worst pick',sgn(x.worst.d),`${esc(x.worst.p.name)}, ${pl(x.worst.n)}`,'dpk|'+x.worst.n):'',
    fact('Still on the roster',`${x.kept} of ${x.ks.length}`,x.kept===x.ks.length?'every pick kept':'the rest traded or dropped')]);
  h+=drillSec('Pick by pick',`Value against what each pick usually returns. Tap a pick for the full story.`,pickRows(x.ks,B));
  // early, middle and late
  const thirds=[[1,5],[6,10],[11,B.R]].filter(([a,b])=>a<=B.R).map(([a,b])=>{const q=x.ks.filter(k=>k.r>=a&&k.r<=Math.min(b,B.R)&&k.v!=null);return [a,Math.min(b,B.R),q.reduce((s,k)=>s+k.d,0)]});
  h+=drillSec('Where the edge came from','Value against the slots, by stage of the draft.',facts(thirds.map(([a,b,s])=>fact(`Rounds ${a} to ${b}`,sgn(s),s>=0?'beat the slots':'below the slots'))));
  const TL=Object.values(B.teams).filter(y=>y.ks.length).sort((a,b)=>b.sur-a.sur);
  h+=drillSec('Against the league','Every team\'s value against its slots. Tap a team for its draft.',CH.hbars(TL.map(y=>({label:`${esc(tAb(y.id))}<small>${esc(teamById[y.id].mgr)}${y.id===ME?' (you)':''} · ${y.grade}</small>`,v:y.sur,txt:sgn(y.sur),cls:y.sur>=0?'pos':'neg',hi:y.id===tid,stat:y.id===tid?null:'tdr|'+y.id,tip:`${tNm(y.id)}: ${sgn(y.sur)} against their slots, grade ${y.grade}`})),{center:true,stack:true,label:'Value against slots by team'}));
  // position mix against the league average
  const cnt=ks=>{const o={};POS.forEach(X=>o[X]=ks.filter(k=>elig(k).includes(X)).length);return o},mine=cnt(x.ks),all=cnt(B.picks.filter(k=>k.by!=null)),nt=Object.values(B.teams).filter(y=>y.ks.length).length||1;
  h+=drillSec('Position mix',`How many players at each position ${me?'you':'they'} drafted, against the league average per team. Players with two positions count for both.`,
    `<div class="scroll"><table class="h5-t"><thead><tr><th class="l stick" scope="col"></th>${POS.map(X=>`<th scope="col">${X}</th>`).join('')}</tr></thead><tbody>
    <tr><td class="l stick"><b>${esc(t.abbr)}</b></td>${POS.map(X=>{const d=mine[X]-all[X]/nt;return `<td class="num z ${d>=2?'p2':d>=1?'p1':d<=-2?'n2':d<=-1?'n1':''}" ${sx('pos|'+X)} data-tip="${esc(`${mine[X]} ${POSN[X]} drafted; the average team took ${(all[X]/nt).toFixed(1)}`)}">${mine[X]}</td>`}).join('')}</tr>
    <tr><td class="l stick">League average</td>${POS.map(X=>`<td class="num">${(all[X]/nt).toFixed(1)}</td>`).join('')}</tr></tbody></table></div>`);
  h+=`<div class="h5-acts"><button type="button" class="btn sm ghost" data-team="${tid}">Team page</button><button type="button" class="btn sm ghost" ${sx('tval|'+tid)}>Team value today</button></div>`;
  h+=how([`Each pick's value minus what that pick usually returns, added up over the team's picks, is the team's value against its slots. The grade compares that total with the other teams, in typical team-to-team gaps (standard deviations): A is about one gap above the league average, B is about average, C about one gap below. Players count for the team that drafted them, even if they have since been traded or dropped; picks with no projection are left out.`,fitHow(B),valHow(),slotHow(B)]);
  return {...base,html:h}};

/* =====================================================================================
   drd|<round>
   ===================================================================================== */
DRILL.drd=r=>{const B=board(),rn=parseInt(r,10);if(!B.N||!Number.isFinite(rn)||String(rn)!==String(r).trim()||rn<1||rn>B.R)return null;css();
  const R=B.rounds[rn-1],vk=B.vk,mine=R.mine,cnt=POS.map(X=>[X,R.ks.filter(k=>elig(k).includes(X)).length]);
  const base={eyebrow:`Draft · round ${rn} of ${B.R}`,title:`Round ${rn}`,back:`Round ${rn}`,sub:`Picks ${R.ks[0].n} to ${R.ks[R.ks.length-1].n}, ${rn%2?'slot 1 first':`slot ${B.NT} first (the snake turns)`}`};
  let h=`<p class="h5-lead">The average pick in round ${rn} is worth <b>${n0(R.avg)}</b> in ${VL[vk].toLowerCase()}, against <b>${n0(R.exp)}</b> usually. ${R.hits} of ${R.nq} picks beat their slot.</p><div class="filters"><span class="lbl">Value</span>${vseg(vk)}</div>`;
  h+=facts([fact('Average pick',n0(R.avg),`usually ${n0(R.exp)}`),R.best?fact('Best pick',sgn(R.best.d),`${esc(R.best.p.name)}, ${pl(R.best.n)}`,'dpk|'+R.best.n):'',R.worst?fact('Worst pick',sgn(R.worst.d),`${esc(R.worst.p.name)}, ${pl(R.worst.n)}`,'dpk|'+R.worst.n):'',
    mine?fact('Your pick',mine.v!=null?sgn(mine.d):'–',`${pName(mine)}, ${pl(mine.n)}`,'dpk|'+mine.n):'']);
  h+=drillSec('The picks',`Positions taken: ${cnt.filter(c=>c[1]).map(([X,c])=>`${c} ${X}`).join(', ')}.`,pickRows(R.ks,B,{team:true}));
  h+=`<div class="h5-acts">${rn>1?`<button type="button" class="btn sm ghost" ${sx('drd|'+(rn-1))}>Round ${rn-1}</button>`:''}${rn<B.R?`<button type="button" class="btn sm ghost" ${sx('drd|'+(rn+1))}>Round ${rn+1}</button>`:''}</div>`;
  h+=how([fitHow(B),valHow(),slotHow(B)]);
  return {...base,html:h}};

/* =====================================================================================
   The Draft view
   ===================================================================================== */
function vDraft(){const B=board();css();if(!B.N)return `<section class="panel">${head('Draft','')}${noDraft()}</section>`;
  const vk=B.vk,NT=B.NT,vl=VL[vk].toLowerCase(),my=B.teams[ME],src=DATA.draftSource||'this league\'s draft';
  const q=B.picks.filter(k=>k.v!=null),steals=[...q].sort((a,b)=>b.d-a.d),reaches=[...q].sort((a,b)=>a.d-b.d),bestT=Object.values(B.teams).sort((a,b)=>a.rk-b.rk)[0];
  const slots=[...Array(NT)].map((_,i)=>i+1);
  // 1. the board
  let h=`<section class="panel">${head('Draft board',`${esc(src.charAt(0).toUpperCase()+src.slice(1))}: ${B.NN} picks in ${B.R} rounds. Each square is a pick, coloured by its ${vl} against what that pick usually returns. Tap any pick, team or round.`,vseg(vk))}
    ${facts([my&&my.slot!=null?fact('Your draft slot',ord(my.slot),KNOWN_SLOT==null?'inferred from where your picks landed':my.slot===KNOWN_SLOT?'matches your known draft position':'inferred; check it','tdr|'+ME):'',
      my?fact('Your draft grade',my.grade,`${sgn(my.sur)} against your slots · ${ord(my.rk)} of ${NT}`,'tdr|'+ME):'',
      steals[0]?fact('Biggest steal',sgn(steals[0].d),`${esc(steals[0].p.name)}, ${pl(steals[0].n)}`,'dpk|'+steals[0].n):'',
      reaches[0]?fact('Biggest reach',sgn(reaches[0].d),`${esc(reaches[0].p.name)}, ${pl(reaches[0].n)}`,'dpk|'+reaches[0].n):'',
      bestT?fact('Best draft',esc(tAb(bestT.id)),`grade ${bestT.grade} · ${sgn(bestT.sur)} against the slots`,'tdr|'+bestT.id):'',
      fact('Kept by their drafter',`${B.kept} of ${B.known}`,B.kept===B.known?'no draft pick has moved yet':'the rest were traded or dropped')])}
    <div class="scroll" data-keep="h5-board"><table class="h5-bd"><thead><tr><th class="h5-rd" scope="col"><span class="lbl">Rd</span></th>${slots.map(s=>{const id=B.s2t[s],x=id!=null?B.teams[id]:null,t=id!=null?teamById[id]:null;
      return `<th scope="col">${t?`<button type="button" class="h5-th ${id===ME?'me':''}" ${sx('tdr|'+id)} data-tip="${esc(`Slot ${s}: ${t.name} (${t.mgr})${id===ME?', you':''}. Grade ${x.grade}, ${sgn(x.sur)} against the slots. Supported by ${B.support[s].n} of ${B.support[s].of} picks.`)}"><small>Slot ${s}</small><b>${esc(t.abbr)}</b><small>${esc(t.mgr)} · ${x.grade}</small></button>`:`<span class="h5-th"><small>Slot ${s}</small><b>?</b></span>`}</th>`}).join('')}</tr></thead><tbody>
    ${B.rounds.map(R=>`<tr><th class="h5-rd" scope="row"><button type="button" ${sx('drd|'+R.r)} data-tip="${esc(`Round ${R.r}: average ${n0(R.avg)}, usually ${n0(R.exp)}; ${R.hits} of ${R.nq} beat their slot`)}">${R.r}<small>${R.r%2?'→':'←'}</small></button></th>${slots.map(s=>{const k=B.picks[pickAt(s,R.r,NT)-1];if(!k)return '<td></td>';
      return `<td><button type="button" class="h5-c ${k.p?(k.c||'h5-0'):'h5-x'} ${k.by===ME?'me':''}" ${sx('dpk|'+k.n)} data-tip="${esc(tipOf(k,B))}"><span class="h5-nm">${k.p?esc(shortName(k.p.name)):'Unknown'}</span><span class="h5-ln"><span>${k.p?esc(k.p.pos):''}</span><span>${k.p&&k.moved?'→'+esc(tAb(k.p.team)):''}</span></span><span class="h5-ln"><span>${pl(k.n)}</span><span>${k.v==null?'–':`${n0(k.v)} ${sgn(k.d)}`}</span></span></button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>
    ${dleg(B)}<p class="note">Each square shows the player, their position, the pick, today's ${vl} and how far that is from the pick's usual return. Your picks have a blue outline. Rounds run left to right in odd rounds and right to left in even ones. An arrow (→) marks a player now on another team. Which team picked in which slot is inferred from today's rosters (see How this works).</p>
    ${how([slotHow(B),fitHow(B),valHow()])}</section>`;
  // 2. pick against value
  const pts=q.map(k=>({x:k.n,y:k.v,me:k.by===ME,tip:tipOf(k,B),stat:'dpk|'+k.n}));
  const ys=[1,NT,25,50,100,B.NN].filter((v,i,a)=>v<=B.NN&&a.indexOf(v)===i);
  h+=`<section class="panel">${head('Pick against value',`Every drafted player by pick number and today's ${vl}. The dashed curve is what each pick usually returns; dots above it beat their slot.`)}
    <div class="h5-sc">${CH.scatter(pts,{xl:'Pick number',yl:VL[vk],fx:v=>String(Math.round(v)),fy:v=>String(Math.round(v)),ref:B.fit.E,x0:1,x1:B.NN,y0:0,y1:Math.max(10,Math.ceil((Math.max(...q.map(k=>k.v))+8)/10)*10),h:320,label:'Value against pick number'})}</div>
    ${legend([['me','Your picks'],['mut','Other picks'],['h5-md','What the pick usually returns']])}
    <div class="h5-fx"><span class="lbl">What a pick usually returns</span>${facts(ys.map(n=>fact(`Pick ${n}`,n0(B.fit.E(n)),pl(n),'dpk|'+n)))}</div>
    <p class="note">The curve follows the picks around each slot, so it falls steeply through the first round and flattens out later. It explains ${pc(B.fit.r2)} of the differences between picks; a typical pick lands ${B.fit.sd.toFixed(0)} points off it.</p>
    ${how([fitHow(B)])}</section>`;
  // 3. steals and reaches
  const mx=Math.max(1,...steals.slice(0,8).map(k=>Math.abs(k.d)),...reaches.slice(0,8).map(k=>Math.abs(k.d)));
  const lst=(ks,neg)=>CH.hbars(ks.slice(0,8).map(k=>({label:`${pl(k.n)} ${esc(k.p.name)}<small>${esc(tAb(k.by))}${k.by===ME?' · you':''}</small>`,v:Math.abs(k.d),txt:sgn(k.d),cls:neg?'neg':'pos',me:k.by===ME,stat:'dpk|'+k.n,tip:`${k.p.name} (${tNm(k.by)}): worth ${n0(k.v)}, a ${ord(k.n)} pick usually returns ${n0(k.e)}`})),{max:mx,stack:true,label:neg?'Biggest reaches':'Best steals'});
  h+=`<section class="panel">${head('Steals and reaches',`The picks furthest above and below what their slot usually returns, in points of ${vl}.`)}
    <div class="cols h5-sr"><div class="drill-sec"><h3>Best steals</h3>${lst(steals,false)}</div><div class="drill-sec"><h3>Biggest reaches</h3>${lst(reaches,true)}</div></div>
    <p class="note">${['p2','n2'].map(c=>{const m=q.filter(k=>k.by===ME&&k.c.slice(0,1)===c[0]&&Math.abs(Math.round(k.d))>=B.fit.T[1]);return m.length?`Your ${c[0]==='p'?'steals':'reaches'}: ${links(m.map(k=>sbtn('dpk|'+k.n,`${esc(k.p.name)} (${sgn(k.d)})`)))}`:`You have no ${c[0]==='p'?'steals':'reaches'} of ${B.fit.T[1]}+ points.`}).join(' ')}</p>
    ${how([`A steal is a pick worth at least ${B.fit.T[1]} points more than its slot usually returns, a reach at least ${B.fit.T[1]} points less (one typical miss from the curve). Injuries count: a player drafted early and now hurt shows as a reach, because their value today is lower. Late picks can't fall far below the curve, because value bottoms out at 0 (replacement level).`])}</section>`;
  // 4. team grades
  const TL=Object.values(B.teams).filter(y=>y.ks.length).sort((a,b)=>a.rk-b.rk);
  h+=`<section class="panel">${head('Team draft grades','Each team\'s picks against what those slots usually return, added up. Tap a team for every pick.')}
    <div style="max-width:760px">${CH.hbars(TL.map(y=>({label:`${esc(tAb(y.id))}<small>${esc(teamById[y.id].mgr)}${y.id===ME?' (you)':''} · ${y.grade}</small>`,v:y.sur,txt:sgn(y.sur),cls:y.sur>=0?'pos':'neg',hi:y.id===ME,stat:'tdr|'+y.id,tip:`${tNm(y.id)}: ${sgn(y.sur)} against their slots, grade ${y.grade}`})),{center:true,stack:true,label:'Value against slots by team'})}${legend([['pos','Beat their slots'],['neg','Below their slots']])}</div>
    <div class="scroll"><table class="h5-t"><thead><tr><th class="l stick" scope="col">Team</th><th scope="col">Slot</th><th scope="col">Grade</th><th scope="col">vs slots</th><th scope="col">Value</th><th class="l" scope="col">Best pick</th><th class="l" scope="col">Worst pick</th></tr></thead><tbody>
    ${TL.map(y=>`<tr class="click ${y.id===ME?'me':''}" ${sx('tdr|'+y.id)} tabindex="0"><td class="l stick tname">${esc(tAb(y.id))}<small>${esc(teamById[y.id].mgr)}</small></td><td class="num">${y.slot??'?'}</td><td>${grd(y.grade)}</td><td class="num"><b>${sgn(y.sur)}</b></td><td class="num">${n0(y.val)}</td><td class="l">${y.best?sbtn('dpk|'+y.best.n,`${esc(shortName(y.best.p.name))} ${sgn(y.best.d)}`):'–'}</td><td class="l">${y.worst?sbtn('dpk|'+y.worst.n,`${esc(shortName(y.worst.p.name))} ${sgn(y.worst.d)}`):'–'}</td></tr>`).join('')}</tbody></table></div>
    ${how([`Value against slots adds up each pick's value minus what that pick usually returns, so a team isn't rewarded just for picking early. "Value" is the plain total. The grade compares value against slots with the other teams, in typical team-to-team gaps (standard deviations): A is about one gap above the league average, B is about average, C about one gap below. These are the same cut-offs as the power grades on the League tab. Players count for the team that drafted them, even after a trade or a drop. Draft grades judge draft-day choices with today's values, which is hindsight.`])}</section>`;
  // 5. value by round
  const mineR=B.rounds.filter(R=>R.mine&&R.mine.v!=null),ser=[{name:'Average pick',cls:'s1',pts:B.rounds.filter(R=>R.avg!=null).map(R=>[R.r,R.avg,'drd|'+R.r])},{name:'Your pick',cls:'s2',pts:mineR.map(R=>[R.r,R.mine.v,'dpk|'+R.mine.n])},{name:'Best pick',cls:'s3',pts:B.rounds.filter(R=>R.top).map(R=>[R.r,R.top.v,'dpk|'+R.top.n])}];
  h+=`<section class="panel">${head('Value by round',`${VL[vk]} of the average pick, the best pick and your pick in each round.`)}
    <div class="h5-sc">${CH.line(ser,{xl:x=>'R'+x,fmt:v=>String(Math.round(v)),y0:0,h:220,label:'Value by round'})}</div>
    <div class="scroll"><table class="h5-t"><thead><tr><th class="l stick" scope="col">Round</th><th scope="col">Average</th><th scope="col">Usual</th><th scope="col">Beat slot</th><th class="l" scope="col">Best pick</th><th class="l" scope="col">Worst pick</th><th class="l" scope="col">Your pick</th></tr></thead><tbody>
    ${B.rounds.map(R=>`<tr><td class="l stick">${sbtn('drd|'+R.r,`Round ${R.r}`)}<small>${R.ks[0].n}–${R.ks[R.ks.length-1].n}</small></td><td class="num" ${sx('drd|'+R.r)}><b>${n0(R.avg)}</b></td><td class="num" ${sx('drd|'+R.r)}>${n0(R.exp)}</td><td class="num z ${R.nq&&R.hits/R.nq>=.7?'p2':R.nq&&R.hits/R.nq<=.3?'n1':''}" ${sx('drd|'+R.r)}>${R.hits} of ${R.nq}</td><td class="l">${R.best?sbtn('dpk|'+R.best.n,`${esc(shortName(R.best.p.name))} ${sgn(R.best.d)}`):'–'}</td><td class="l">${R.worst?sbtn('dpk|'+R.worst.n,`${esc(shortName(R.worst.p.name))} ${sgn(R.worst.d)}`):'–'}</td><td class="l">${R.mine?sbtn('dpk|'+R.mine.n,`${R.mine.p?esc(shortName(R.mine.p.name)):'?'} ${sgn(R.mine.d)}`):'–'}</td></tr>`).join('')}</tbody></table></div>
    ${how([`"Average" is the mean ${vl} of the round's picks; "Usual" is the curve's average over the same picks; "Beat slot" counts picks above the curve. Best and worst are measured against the slot, not raw value.`])}</section>`;
  // 6. position runs
  const RU=runs().filter(u=>u.odd||u.k>=4),W=1100,pL=34,pR=6,top=6,rh=24,H=top+POS.length*rh+26,cw=(W-pL-pR)/B.NN;
  const inRun=(X,i)=>RU.some(u=>u.X===X&&i>=u.i0&&i<=u.i1);
  let sv=`<svg class="ch h5-strip" viewBox="0 0 ${W} ${H}" role="img" aria-label="Positions in draft order">`;
  for(let r=0;r<=B.R;r++){const x=pL+r*NT*cw;sv+=`<line class="gr" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${top}" y2="${top+POS.length*rh}"/>`;if(r<B.R)sv+=`<text x="${(x+NT*cw/2).toFixed(1)}" y="${H-6}" text-anchor="middle">${r+1}</text>`}
  sv+=`<text x="${pL-6}" y="${H-6}" text-anchor="end">Rd</text>`;
  POS.forEach((X,j)=>{const y=top+j*rh;sv+=`<text class="ink" x="${pL-6}" y="${y+rh/2+5}" text-anchor="end">${X}</text>`;
    RU.filter(u=>u.X===X).forEach(u=>{sv+=`<rect class="h5-band" x="${(pL+u.i0*cw).toFixed(1)}" y="${y+1}" width="${((u.i1-u.i0+1)*cw).toFixed(1)}" height="${rh-2}" rx="3" data-tip="${esc(`Tightest ${X} streak: ${u.k} ${POSN[X]} in ${u.n} picks, ${pl(u.i0+1)} to ${pl(u.i1+1)}. Random order makes one this tight ${chTxt(u.chance)} of the time.`)}"/>`});
    B.picks.forEach((k,i)=>{if(!elig(k).includes(X))return;sv+=`<rect class="h5-tk ${inRun(X,i)?'on':''}" x="${(pL+i*cw+.5).toFixed(1)}" y="${y+4}" width="${Math.max(1.5,cw-1).toFixed(1)}" height="${rh-8}" rx="1" data-tip="${esc(`${pl(k.n)} ${k.p.name} (${k.p.pos})`)}" ${sx('dpk|'+k.n)}/>`})});
  sv+='</svg>';
  const pc2=X=>B.picks.filter(k=>elig(k).includes(X)).length,odd=RU.filter(u=>u.odd);
  const heat=POS.map(X=>B.rounds.map(R=>R.ks.filter(k=>elig(k).includes(X)).length)),hmx=Math.max(1,...heat.flat());
  h+=`<section class="panel">${head('Position runs','Every pick in draft order, one row per position. The shaded stretch in each row is that position\'s tightest streak of the draft.')}
    <p class="h5-lead">${odd.length?`${odd.length===1?'One streak stands out':`${odd.length} streaks stand out`}: ${odd.map(u=>`${POSN[u.X]}, ${pl(u.i0+1)} to ${pl(u.i1+1)}`).join('; ')}. A random order of the same players would rarely bunch them that tightly.`:'No position came off the board unusually fast. Each position\'s tightest streak is about as tight as a random order of the same players produces, so these are ordinary clusters rather than runs.'}</p>
    <div class="scroll" data-keep="h5-strip">${sv}</div>${legend([['h5-bnd','Tightest streak'],['hi','Picks in it'],['mut','Other picks at that position']])}
    ${RU.length?`<ul class="h5-runs">${RU.map(u=>{const ks=B.picks.slice(u.i0,u.i1+1).filter(k=>elig(k).includes(u.X));return `<li><b>${u.k} ${POSN[u.X]} in ${u.n} picks · ${pl(u.i0+1)} to ${pl(u.i1+1)}</b><p>${links(ks.map(k=>sbtn('dpk|'+k.n,`${esc(k.p.name)} (${esc(tAb(k.by))})`)))} ${Math.round(u.p*100)}% of all picks are ${u.X}-eligible. A random order of the same picks produces a streak this tight at ${u.X} ${chTxt(u.chance)} of the time: ${u.odd?'a real run':'ordinary clustering'}.</p></li>`}).join('')}</ul>`:''}
    <h3>Positions by round</h3><p class="note">How many players eligible at each position went in each round. Darker means more. Tap a cell for the round.</p>
    <div class="scroll"><table class="hm h5-t"><thead><tr><th class="l stick" scope="col">Pos</th>${B.rounds.map(R=>`<th scope="col">${R.r}</th>`).join('')}<th scope="col">Total</th><th scope="col">First</th></tr></thead><tbody>
    ${POS.map((X,j)=>{const first=B.picks.find(k=>elig(k).includes(X));return `<tr><td class="l stick">${sbtn('pos|'+X,`<b>${X}</b>`)}</td>${heat[j].map((c,i)=>`<td style="${CH.seq(c/hmx)}" ${sx('drd|'+(i+1))} data-tip="${esc(`Round ${i+1}: ${c} ${POSN[X]}`)}">${c||''}</td>`).join('')}<td><b>${pc2(X)}</b></td><td>${first?sbtn('dpk|'+first.n,pl(first.n)):'–'}</td></tr>`}).join('')}</tbody></table></div>
    ${how([`A streak is a stretch of up to ${WMAX} picks that starts and ends with the same position and holds at least three of it. Each position's tightest streak is the one least likely if that position came off the board at its overall rate (a binomial check). Any draft has some tight-looking stretches somewhere, so the board then shuffles the same ${B.known} picks into a random order ${SHUF} times and counts how often a streak at least as tight appears anywhere: that share is the chance shown. Under ${pc(RUNP)} counts as a real run. Streaks of only three picks are left out unless they pass that test.`,`Players with two positions count for both, so a guard streak can show up as PG and SG at once. Positions are today's ESPN eligibility, which can differ from draft day.`])}</section>`;
  return h}

HUB.push({k:'draft',label:'Draft',order:50,note:'This league\'s Sep 27 snake draft: every pick against what that slot usually returns.',render:vDraft});
CMDS.push({label:'Draft board',sub:'Every pick, coloured by value against the slot',kw:'draft board picks steals reaches grades snake',tag:'View',act:()=>go('stats',{hub:'draft'})});
CMDS.push({label:'My draft grade',sub:'Every pick you made against its slot',kw:'draft grade my picks',tag:'Drill',act:()=>openStat('tdr|'+ME)});
CMDS.push({label:'Biggest draft steal',sub:'The pick that beat its slot by the most',kw:'draft steal best pick value',tag:'Drill',act:()=>{const B=board(),k=B.picks.filter(x=>x.v!=null).sort((a,b)=>b.d-a.d)[0];if(k)openStat('dpk|'+k.n)}});
})();
