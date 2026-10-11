/* h4_sim.js: the Season sim view (Stats tab, order 40) and the ttl|<teamId> drill (path to the title).
   One Monte Carlo run of 4,000 seasons, cached for the page's life (it is rebuilt only if the core's seasonSim() result changes):
   the regular season is replayed with the same random numbers as the core's seasonSim(), so seeds and playoff odds match it,
   then the assumed ESPN five-team bracket (weeks 21-23) is solved exactly for each season's top five with mp(a,b,w).win.
   Shared helpers on window.LAB: titleOdds(), playoffStakes(teamId), scheduleLeft(). Registers only at load. */
(()=>{
const LAB=window.LAB=window.LAB||{};
const RUNS=4000, SEED=20261020;
S.sort.sim=S.sort.sim||['title','desc'];

/* ---------- small helpers ---------- */
const TM=id=>{const n=parseInt(id,10);return Number.isFinite(n)?(tm(n)||null):null};
const NM=id=>esc(teamById[id]?teamById[id].name:'?');
const AB=id=>esc(teamById[id]?teamById[id].abbr:'?');
const RAW=id=>teamById[id]?teamById[id].name:'?';
// odds as a percent that never rounds a real chance to 0% or 100%
const P=x=>x==null||!isFinite(x)?'–':x<=0?'0%':x<.005?'<1%':x>=1?'100%':x>.995?'>99%':pc(x);
const PT=d=>`${d>=0?'+':'−'}${Math.abs(Math.round(d*100))}`;            // percentage points, signed
const facts=a=>`<div class="facts">${a.join('')}</div>`;
const legend=items=>`<div class="legend">${items.map(([cls,l,st])=>`<span><i class="${cls}"${st?` style="${st}"`:''}></i>${l}</span>`).join('')}</div>`;
const done=w=>!!(PER[w]&&PER[w][PER[w].length-1]<todaySP);
const leftWeeks=()=>WEEKS.filter(w=>w<=REGW&&w>=Math.max(1,curWeek));
const roundWeeks=()=>{const p=PO_WEEKS.length?PO_WEEKS:[REGW+1,REGW+2,REGW+3];return [p[0],p[1]??p[p.length-1],p[2]??p[p.length-1]]};
const RNAME=['Round 1','Round 2','Final'];
// heat classes on the rounded percent the cell shows, symmetric around 50: 70+, 60-69, 53-59, 48-52, 41-47, 31-40, 30 or less
const winCls=p=>{const r=Math.round(p*100);return r>=70?'p3':r>=60?'p2':r>=53?'p1':r>=48?'':r>=41?'n1':r>=31?'n2':'n3'};
const wkDates=w=>weekLabel(w);
const plural=(n,a,b)=>n===1?a:(b||a+'s');

function css(){if(typeof addCSS!=='function')return;
  addCSS('h4sim-css',`
.h4-br{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;align-items:start}
.h4-rd{display:flex;flex-direction:column;gap:8px;min-width:0}
.h4-rd>.lbl small{display:block;text-transform:none;letter-spacing:0;font-weight:400;font-size:.74rem;margin-top:2px}
.h4-m{border:1px solid var(--line);border-radius:10px;background:var(--panel);display:flex;flex-direction:column;overflow:hidden;min-width:0}
.h4-s{display:grid;grid-template-columns:1.7em minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 10px;background:none;border:0;text-align:left;font:inherit;color:inherit;width:100%;min-width:0}
button.h4-s{cursor:pointer}button.h4-s:hover{background:var(--soft)}
.h4-s+.h4-s,.h4-s+.h4-vs,.h4-vs+.h4-s{border-top:1px solid var(--soft)}
.h4-sd{font:700 1.25rem/1 var(--display);color:var(--accent);text-align:center}
.h4-s>span{min-width:0}
.h4-s>span b{font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h4-s>span small{display:block;color:var(--muted);font-size:.74rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h4-s>em{font:600 .84rem var(--mono);font-style:normal}
.h4-s.tbd>span b{font-weight:500;color:var(--muted)}
.h4-s>em.up{color:var(--pos-fg)}.h4-s>em.down{color:var(--neg-fg)}
.h4-s .h4-you{display:inline;margin-left:4px;font-weight:400}
.h4-vs{font:600 .7rem var(--body);text-transform:uppercase;letter-spacing:.09em;color:var(--muted);padding:3px 10px 3px calc(1.7em + 18px);background:var(--raise)}
button.h4-vs{display:block;width:100%;border:0;text-align:left;cursor:pointer}
button.h4-vs span{text-decoration:underline dotted;text-underline-offset:2px}button.h4-vs:hover{color:var(--accent)}
.h4-pairs{display:flex;flex-direction:column;gap:2px}
.h4-pair{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:baseline;background:none;border:0;padding:4px 6px;margin:0 -6px;border-radius:6px;font:inherit;color:inherit;text-align:left;cursor:pointer;width:calc(100% + 12px)}
.h4-pair:hover{background:var(--soft)}
.h4-pair span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.84rem}
.h4-pair em{font:500 .8rem var(--mono);font-style:normal;color:var(--muted)}
.h4-facts{grid-template-columns:repeat(3,minmax(0,1fr))}
.h4-top{display:flex;flex-direction:column;gap:10px;min-width:0}
.h4-top>.seg{align-self:flex-start}
.h4-hm td{padding:5px 6px}
.h4-hm td.l{text-align:left}
.h4-hm .h4-name{font-family:var(--body);font-size:.84rem}
.h4-hm td.h4-me{background:var(--me)}
.h4-hm .h4-cut{box-shadow:inset 2px 0 0 var(--muted)}
.h4-hm .h4-byel{box-shadow:inset 1px 0 0 var(--line)}
.h4-hm th.grp{text-align:center;font-size:.66rem;border-bottom:0;padding-bottom:0}
.h4-hm td.dim{color:var(--muted)}
.h4-hm th.now{color:var(--accent)}
.h4-tbl td.stick{white-space:normal;min-width:8em}
.h4-tbl td.stick small,.h4-tbl td.l small{white-space:normal}
.h4-ol{display:flex;flex-direction:column;gap:1px}
.h4-oh,.h4-o{display:grid;grid-template-columns:minmax(0,1fr) 5.4em 5em;gap:8px;align-items:center}
.h4-oh{font:600 .66rem var(--body);text-transform:uppercase;letter-spacing:.07em;color:var(--muted);padding:0 6px 4px}
.h4-oh span+span,.h4-o em{text-align:right}
.h4-o{background:none;border:0;border-top:1px solid var(--line);padding:6px;font:inherit;color:inherit;text-align:left;cursor:pointer;width:100%}
.h4-o:hover{background:var(--soft)}
.h4-o span{min-width:0}.h4-o b{font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.h4-o small{display:block;color:var(--muted);font-size:.74rem}
.h4-o em{font:500 .82rem var(--mono);font-style:normal}
.h4-o em.up{color:var(--pos-fg)}.h4-o em.down{color:var(--neg-fg)}
.h4-sub{display:block;color:var(--muted);font-size:.74rem;font-weight:400}
@media (min-width:561px){.h4-wide .hb-r{grid-template-columns:minmax(0,17em) minmax(0,1fr) 4.6em}}
@media (max-width:760px){.h4-br{grid-template-columns:1fr}}
@media (max-width:560px){.h4-facts{grid-template-columns:repeat(2,minmax(0,1fr))}
  .h4-tbl th,.h4-tbl td{padding:7px 6px}
  .h4-tbl td.stick{min-width:7em;max-width:8.5em;font-size:.86rem;line-height:1.25}
  .h4-hm .h4-name{white-space:normal;min-width:6.5em;max-width:7.5em;line-height:1.2;font-size:.8rem}}
`)}

/* ---------- the simulation ----------
   Regular season: exactly the core's seasonSim() draw order (same seed, same games, one draw per category, then one
   tie-break draw per team), so the seeds and playoff odds are the same 4,000 seasons. The bracket is then solved exactly
   for each season's top five (every path weighted by mp(a,b,w).win), so title odds carry no extra simulation noise. */
let CACHE={src:null,res:null};
function runSim(){const ss=seasonSim();if(CACHE.res&&CACHE.src===ss)return CACHE.res;
  const t0=performance.now(),ids=DATA.teams.map(t=>t.id),n=ids.length,ix={};ids.forEach((id,i)=>ix[id]=i);
  const W0=new Float64Array(n),L0=new Float64Array(n);
  DATA.teams.forEach((t,i)=>{const r=t.record||{w:0,l:0,t:0};W0[i]=r.w+r.t/2;L0[i]=r.l+r.t/2});
  const games=[];
  for(let w=Math.max(1,curWeek);w<=REGW;w++)DATA.schedule.filter(m=>m[0]===w).forEach(([,a,b])=>{const o=mp(a,b,w);games.push({w,a,b,ia:ix[a]??-1,ib:ix[b]??-1,ps:CATS.map(c=>o.p[c.k]),win:o.win})});
  const G=games.length,NC=CATS.length,GA=new Int16Array(G),GB=new Int16Array(G),GP=new Float64Array(G*NC);
  games.forEach((g,k)=>{GA[k]=g.ia;GB[k]=g.ib;g.ps.forEach((p,c)=>{GP[k*NC+c]=p})});
  const RW=roundWeeks(),PW=RW.map(w=>{const m=new Float64Array(n*n).fill(.5);
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const p=mp(ids[i],ids[j],w).win;m[i*n+j]=p;m[j*n+i]=1-p}return m});
  // mulberry32, the core's rng(), written inline: a closure call per draw is the slowest part of 3.6 million draws
  const N=RUNS,GT=new Float64Array(G*NC),TOT=new Float64Array(n),TD=new Float64Array(n);
  for(let k=0;k<G*NC;k++)GT[k]=GP[k]*4294967296;
  for(let i=0;i<n;i++)TOT[i]=W0[i]+L0[i];for(let g=0;g<G;g++){if(GA[g]>=0)TOT[GA[g]]+=NC;if(GB[g]>=0)TOT[GB[g]]+=NC}
  for(let i=0;i<n;i++)TD[i]=Math.max(1,TOT[i]);
  const seedC=new Float64Array(n*n),po=new Float64Array(n),bye=new Float64Array(n),rd2=new Float64Array(n),fin=new Float64Array(n),ttl=new Float64Array(n),
    sw=new Float64Array(n),sl=new Float64Array(n),tbs=new Float64Array(n*5),meet=[0,1,2].map(()=>new Float64Array(n*n));
  // every season's final category wins, tie-break noise and each game's category split, kept for the exact race math below
  const WS=new Float64Array(N*n),US=new Float64Array(N*n),AWS=new Uint8Array(N*G),Wn=new Float64Array(n),
    key=new Float64Array(n),idx=ids.map((_,i)=>i),cmp=(x,y)=>key[y]-key[x],tl=new Float64Array(5);
  const [P0,P1,P2]=PW;
  let sd=SEED|0;
  for(let k=0;k<N;k++){
    for(let i=0;i<n;i++)Wn[i]=W0[i];
    for(let g=0;g<G;g++){const o=g*NC;let aw=0;
      for(let c=0;c<NC;c++){sd=sd+0x6D2B79F5|0;let t=Math.imul(sd^sd>>>15,1|sd);t=t+Math.imul(t^t>>>7,61|t)^t;if(((t^t>>>14)>>>0)<GT[o+c])aw++}
      const a=GA[g],b=GB[g];if(a>=0)Wn[a]+=aw;if(b>=0)Wn[b]+=NC-aw;AWS[k*G+g]=aw}
    for(let i=0;i<n;i++){sd=sd+0x6D2B79F5|0;let t=Math.imul(sd^sd>>>15,1|sd);t=t+Math.imul(t^t>>>7,61|t)^t;const u=((t^t>>>14)>>>0)/4294967296*1e-6;
      key[i]=Wn[i]/TD[i]+u;WS[k*n+i]=Wn[i];US[k*n+i]=u}
    const ord=idx.slice().sort(cmp);
    for(let s=0;s<n;s++){const i=ord[s];seedC[i*n+s]++;if(s<5)po[i]++;if(s<3)bye[i]++}
    for(let i=0;i<n;i++){sw[i]+=Wn[i];sl[i]+=TOT[i]-Wn[i]}
    if(n>=5){// the bracket is solved exactly for this season's seeds, no extra random draws: every path, weighted by its chance
      const s1=ord[0],s2=ord[1],s3=ord[2],s4=ord[3],s5=ord[4],q4=P0[s4*n+s5],q5=1-q4;
      meet[0][s4*n+s5]++;meet[0][s5*n+s4]++;
      rd2[s1]++;rd2[s2]++;rd2[s3]++;rd2[s4]+=q4;rd2[s5]+=q5;
      meet[1][s1*n+s4]+=q4;meet[1][s4*n+s1]+=q4;meet[1][s1*n+s5]+=q5;meet[1][s5*n+s1]+=q5;meet[1][s2*n+s3]++;meet[1][s3*n+s2]++;
      const A=[s1,s4,s5],aP=[q4*P1[s1*n+s4]+q5*P1[s1*n+s5],q4*P1[s4*n+s1],q5*P1[s5*n+s1]],B=[s2,s3],bP=[P1[s2*n+s3],P1[s3*n+s2]],aS=[0,3,4],bS=[1,2];
      tl.fill(0);
      for(let x=0;x<3;x++){fin[A[x]]+=aP[x];
        for(let y=0;y<2;y++){const pm=aP[x]*bP[y];if(!pm)continue;const px=P2[A[x]*n+B[y]];
          meet[2][A[x]*n+B[y]]+=pm;meet[2][B[y]*n+A[x]]+=pm;tl[aS[x]]+=pm*px;tl[bS[y]]+=pm*(1-px)}}
      fin[s2]+=bP[0];fin[s3]+=bP[1];
      for(let q=0;q<5;q++){ttl[ord[q]]+=tl[q];tbs[ord[q]*5+q]+=tl[q]}}
  }
  const T={};let maxDiff=0;
  ids.forEach((id,i)=>{const seed=Array.from({length:n},(_,s)=>seedC[i*n+s]/N);
    T[id]={id,i,po:po[i]/N,bye:bye[i]/N,r2:rd2[i]/N,final:fin[i]/N,title:ttl[i]/N,seed,w:sw[i]/N,l:sl[i]/N,
      avgSeed:seed.reduce((a,x,s)=>a+x*(s+1),0),seedN:Array.from({length:5},(_,s)=>seedC[i*n+s]),
      tbs:Array.from({length:5},(_,s)=>{const c=seedC[i*n+s];return c?tbs[i*5+s]/c:null})};
    if(ss&&ss[id])maxDiff=Math.max(maxDiff,Math.abs(T[id].po-ss[id].po))});
  const res={N,ids,ix,n,games,G,NC,WS,US,AWS,TD,T,meet,PW,RW,stk:new Map(),same:maxDiff<1e-9,maxDiff,ms:performance.now()-t0};
  CACHE={src:ss,res};return res}

/* The race for one team, solved inside each simulated season. For a game, every split of the nine categories (0 to 9, with
   the matchup model's chances) is put back into that season's standings with everything else as it happened, and the team's
   playoff spot is checked each way. Averaged over the seasons, that gives the playoff odds if a side wins the week and if it
   loses, with much less noise than splitting the seasons into two groups. Cached per team for the page's life. */
function raceFor(R,id){const i=R.ix[id];if(i==null)return {own:[],root:[]};if(R.stk.has(i))return R.stk.get(i);
  const {N,n,G,NC,WS,US,AWS,TD,games}=R,K=new Float64Array(n);
  const prep=games.map((g,k)=>{if(g.ia<0||g.ib<0)return null;const d=mp(g.a,g.b,g.w).dist,mine=g.ia===i||g.ib===i,isA=g.ia===i;
    const D=mine&&!isA?d.slice().reverse():d.slice(),win=D.slice(5).reduce((s,x)=>s+x,0);
    return {k,g,mine,isA,o:mine?(isA?g.ib:g.ia):-1,D,win,sW:0,sL:0,sd:0,sd2:0}}).filter(Boolean);
  const own=prep.filter(x=>x.mine),oth=prep.filter(x=>!x.mine);
  for(let k=0;k<N;k++){const b=k*n;for(let m=0;m<n;m++)K[m]=WS[b+m]/TD[m]+US[b+m];
    const kT=K[i];let above=0;for(let m=0;m<n;m++)if(m!==i&&K[m]>kT)above++;
    for(const x of own){const aw=AWS[k*G+x.k],awT=x.isA?aw:NC-aw,o=x.o,wT=WS[b+i]-awT,wO=WS[b+o]-(NC-awT);let inW=0,inL=0;
      // shortcut: out even with 9 categories, or in even with 0 (and the opponent passing them)
      const lo=wT/TD[i]+US[b+i],hi=(wT+NC)/TD[i]+US[b+i];let cLo=0,cHi=0;
      for(let m=0;m<n;m++)if(m!==i&&m!==o){if(K[m]>hi)cHi++;if(K[m]>lo)cLo++}
      if(cHi>=5)continue;
      if(cLo+1<5){x.sW+=1;x.sL+=1;continue}
      for(let j=0;j<=NC;j++){const p=x.D[j];if(!p)continue;const kt=(wT+j)/TD[i]+US[b+i],ko=(wO+NC-j)/TD[o]+US[b+o];
        let c=ko>kt?1:0;for(let m=0;m<n&&c<5;m++)if(m!==i&&m!==o&&K[m]>kt)c++;
        if(c<5){if(j*2>NC)inW+=p;else inL+=p}}
      const pw=x.win>1e-9?inW/x.win:0,pl=x.win<1-1e-9?inL/(1-x.win):0;x.sW+=pw;x.sL+=pl;x.sd+=pw-pl;x.sd2+=(pw-pl)**2}
    for(const x of oth){const a=x.g.ia,bb=x.g.ib,c0=above-(K[a]>kT?1:0)-(K[bb]>kT?1:0);
      if(c0>=5)continue;// out whoever wins this game
      if(c0+2<5){x.sW+=1;x.sL+=1;continue}// in whoever wins it
      const aw=AWS[k*G+x.k],wa=WS[b+a]-aw,wb=WS[b+bb]-(NC-aw);let inA=0,inB=0;
      const aL=wa/TD[a]+US[b+a]>kT,aH=(wa+NC)/TD[a]+US[b+a]>kT,bL=wb/TD[bb]+US[b+bb]>kT,bH=(wb+NC)/TD[bb]+US[b+bb]>kT;
      if(aL===aH&&bL===bH){const v=c0+(aL?1:0)+(bL?1:0)<5?1:0;x.sW+=v;x.sL+=v;continue}// this game cannot move them
      for(let j=0;j<=NC;j++){const p=x.D[j];if(!p)continue;const c=c0+((wa+j)/TD[a]+US[b+a]>kT?1:0)+((wb+NC-j)/TD[bb]+US[b+bb]>kT?1:0);
        if(c<5){if(j*2>NC)inA+=p;else inB+=p}}
      const pa=x.win>1e-9?inA/x.win:0,pb=x.win<1-1e-9?inB/(1-x.win):0;x.sW+=pa;x.sL+=pb;x.sd+=pa-pb;x.sd2+=(pa-pb)**2}}
  const fin=x=>{const d=x.sd/N,se=Math.sqrt(Math.max(0,x.sd2/N-d*d)/N);return {pW:x.sW/N,pL:x.sL/N,d,se}};
  const ownR=own.map(x=>{const f=fin(x),ok=x.win>1e-6&&x.win<1-1e-6;return {w:x.g.w,op:R.ids[x.o],win:x.win,pW:ok?f.pW:null,pL:ok?f.pL:null,swing:ok?f.d:null,se:f.se,ok}});
  const root=oth.map(x=>{const f=fin(x),g=x.g,up=f.d>=0;
    return {w:g.w,a:g.a,b:g.b,fav:up?g.a:g.b,vs:up?g.b:g.a,d:Math.abs(f.d),se:f.se,pFav:up?f.pW:f.pL,pVs:up?f.pL:f.pW,favWin:up?x.win:1-x.win}}).sort((x,y)=>y.d-x.d);
  const out={own:ownR,root};R.stk.set(i,out);return out}
const stakesFor=(R,id)=>raceFor(R,id).own, rootingFor=(R,id)=>raceFor(R,id).root;

/* ---------- strength of schedule left ---------- */
function sosData(){return memo('h4|sos|'+curWeek,()=>{const left=leftWeeks();
  return M.teams.map(t=>{let sc=0,nc=0,swn=0,nw=0,opr=0,k=0,hard=null,easy=null;
    const others=M.teams.filter(o=>o.id!==t.id);
    left.forEach(w=>{const op=oppOf(t.id,w);if(op==null)return;const q=mp(t.id,op,w);sc+=q.exp;swn+=q.win;opr+=tm(op).pr;k++;
      if(!hard||q.win<hard.win)hard={w,op,win:q.win};if(!easy||q.win>easy.win)easy={w,op,win:q.win};
      nc+=mean(others.map(o=>mp(t.id,o.id,w).exp));nw+=mean(others.map(o=>mp(t.id,o.id,w).win))});
    return {id:t.id,t,weeks:k,sc,nc,sw:swn,nw,dc:sc-nc,dw:swn-nw,opr:k?opr/k:null,hard,easy}})})}

/* ---------- shared helpers for other modules (call at render time) ---------- */
LAB.titleOdds=()=>{const R=runSim(),o={};R.ids.forEach(id=>{const s=R.T[id];o[id]={po:s.po,final:s.final,title:s.title,seed:s.seed.slice(),bye:s.bye,r2:s.r2,w:s.w,l:s.l,avgSeed:s.avgSeed}});return o};
LAB.playoffStakes=id=>{const R=runSim();return stakesFor(R,+id).filter(x=>x.ok).sort((a,b)=>b.swing-a.swing)};
LAB.scheduleLeft=()=>sosData().map(x=>({id:x.id,weeks:x.weeks,catsGained:x.dc,matchupsGained:x.dw,avgOppPower:x.opr}));

/* ---------- small charts ---------- */
// vertical bars on one zero-based axis: items [{x,v,tip,stat,em}]; values print above the em bars only; o.fmt, o.cls (series)
function vbars(items,o={}){if(!items.length)return '<div class="empty">No weeks left.</div>';
  const W=520,H=o.h||190,pl=30,pr=6,pt=20,pb=24,vals=items.map(d=>Math.max(0,d.v||0)),mx=Math.max(...vals,1e-9),tk=CH.ticks(0,mx,4);
  // the axis always ends on a labelled gridline at or above the tallest bar
  if(tk.length>1&&tk[tk.length-1]<mx-1e-9)tk.push(+(tk[tk.length-1]+tk[1]-tk[0]).toFixed(10));const top=Math.max(mx,tk[tk.length-1]||mx);
  const bw=(W-pl-pr)/items.length,Y=v=>pt+(1-v/top)*(H-pt-pb),base=H-pb,fmt=o.fmt||(v=>String(Math.round(v))),cls=o.cls||'s1',f=x=>x.toFixed(1);
  const bars=items.map((d,i)=>{const v=vals[i],x=pl+i*bw+2,w=Math.max(2,bw-4),h=Math.max(v>0?2:0,base-Y(v)),y=base-h,r=Math.min(4,h/2,w/2);
    const path=h>0?`M${f(x)},${base}V${f(y+r)}Q${f(x)},${f(y)} ${f(x+r)},${f(y)}H${f(x+w-r)}Q${f(x+w)},${f(y)} ${f(x+w)},${f(y+r)}V${base}Z`:'';
    const hit=`<rect x="${f(pl+i*bw)}" y="${pt}" width="${f(bw)}" height="${base-pt}" fill="transparent" stroke="none" data-tip="${esc(d.tip||'')}"${d.stat?` data-stat="${esc(d.stat)}"`:''}/>`;
    return `${path?`<path class="${cls}" d="${path}"${d.em?'':' fill-opacity=".55" stroke-opacity="0"'}/>`:''}${d.em&&v>0?`<text class="ink" x="${f(x+w/2)}" y="${f(y-5)}" text-anchor="middle">${esc(fmt(v))}</text>`:''}<text class="${d.em?'ink':''}" x="${f(x+w/2)}" y="${H-7}" text-anchor="middle">${esc(String(d.x))}</text>${hit}`}).join('');
  return `<div class="chwrap"><svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Bars')}">
    ${tk.map(v=>`<line class="gr" x1="${pl}" x2="${W-pr}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text x="${pl-6}" y="${f(Y(v)+4)}" text-anchor="end">${esc(fmt(v))}</text>`).join('')}
    <line class="ax" x1="${pl}" x2="${W-pr}" y1="${base}" y2="${base}"/>${bars}</svg>${o.legend||''}</div>`}
const segX=(key,cur,opts,label)=>`<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v,l])=>`<button type="button" data-set="${key}=${v}" aria-pressed="${v===cur}">${l}</button>`).join('')}</div>`;

/* ---------- view panels ---------- */
const METRIC={title:['Title','wins the final','ttl','Share of seasons each team wins the title. Tap a bar for the path to it.'],final:['Final','reaches the final','ttl','Share of seasons each team reaches the final. Tap a bar for the path to the title.'],bye:['Bye','finishes in the top three and skips round 1','ttl','Share of seasons each team finishes in the top three and skips round 1. Tap a bar for the path to the title.'],po:['Playoffs','finishes in the top five','tpo','Share of seasons each team finishes in the top five. Tap a bar for the schedule behind it.']};
function secOdds(R){const me=R.T[ME],ids=R.ids,n=ids.length;
  const byTitle=[...ids].sort((a,b)=>R.T[b].title-R.T[a].title),byPo=[...ids].sort((a,b)=>R.T[b].po-R.T[a].po);
  const tRank=byTitle.indexOf(ME)+1,pRank=byPo.indexOf(ME)+1,fav=byTitle[0],favS=R.T[fav],mostSeed=me.seed.indexOf(Math.max(...me.seed))+1,tin=me.po>=.02?me.title/me.po:null;
  const lead=`You make the playoffs in ${P(me.po)} of simulated seasons (${ord(pRank)} best) and win the title in ${P(me.title)} (${ord(tRank)}). `+
    (fav===ME?`That makes you the favorite.`:`The favorite is ${sbtn('ttl|'+fav,NM(fav))} at ${P(favS.title)}.`)+(tin!=null?` Once in, you win it all ${P(tin)} of the time.`:'');
  const mk=METRIC[S_X('sim.bar','title')]?S_X('sim.bar','title'):'title',[ml,mv,md,mn]=METRIC[mk],rowsB=[...ids].sort((a,b)=>R.T[b][mk]-R.T[a][mk]);
  const chart=CH.hbars(rowsB.map(id=>{const s=R.T[id];return {label:`${NM(id)}${id===ME?' <small>you</small>':''}`,v:s[mk],txt:P(s[mk]),me:id===ME,stat:`${md}|${id}`,
    tip:`${RAW(id)} ${mv} in ${P(s[mk])} of seasons. Playoffs ${P(s.po)} · final ${P(s.final)} · title ${P(s.title)}`}}),{label:`${ml} odds`,stack:true});
  let h=`<section class="panel">${head('Playoff and title odds',`${R.N.toLocaleString('en-US')} simulated seasons, then the five-team bracket in weeks ${R.RW[0]} to ${R.RW[2]}. Tap any number for its breakdown.`)}
    <div class="cols"><div class="h4-top"><div class="facts h4-facts">${[fact('Your playoff odds',P(me.po),`${ord(pRank)} of ${n} · top 5 make it`,'tpo|'+ME),fact('First-round bye',P(me.bye),'Seeds 1 to 3 skip round 1','ttl|'+ME),
      fact('Reach the final',P(me.final),`Week ${R.RW[2]}`,'ttl|'+ME),fact('Win the title',P(me.title),`${ord(tRank)} of ${n}`,'ttl|'+ME),fact('Most likely seed',String(mostSeed),`${P(me.seed[mostSeed-1])} of seasons`,'ttl|'+ME),
      fact('Projected record',`${Math.round(me.w)}-${Math.round(me.l)}`,'Category wins and losses','tpo|'+ME)].join('')}</div>
    <p class="note">${lead}</p></div>
    <div class="h4-top">${segX('sim.bar',mk,[['title','Title'],['final','Final'],['bye','Bye'],['po','Playoffs']],'Odds to show')}<p class="note">${mn}</p><div class="h4-wide">${chart}</div></div></div>`;
  const rows=ids.map(id=>{const t=tm(id),s=R.T[id];return {id,t,s,name:t.name,pr:t.pr,rec:s.w,seed:s.avgSeed,po:s.po,bye:s.bye,final:s.final,title:s.title,tin:s.po>=.02?s.title/s.po:null}});
  const [k,d]=S.sort.sim;sortRows(rows,k,d,(x,key)=>x[key]);
  const cell=(stat,txt,tip,b)=>`<td class="num" ${sx(stat)} tabindex="0"${tip?` data-tip="${esc(tip)}"`:''}>${b?`<b>${txt}</b>`:txt}</td>`;
  h+=`<div class="scroll h4-tbl"><table><thead><tr>${th('sim','name','Team','l stick')}${th('sim','po','Playoffs','','Finishes in the top five')}${th('sim','bye','Bye','','Finishes in the top three, so skips round 1')}${th('sim','final','Final','','Reaches the final in week '+R.RW[2])}${th('sim','title','Title')}${th('sim','tin','Title if in','','Title odds in the seasons where they make the playoffs')}${th('sim','seed','Avg seed','','Average finishing position, 1 to '+n)}${th('sim','rec','Proj. record','','Average final category record')}${th('sim','pr','Power','','Power rank today')}</tr></thead><tbody>
    ${rows.map(x=>`<tr class="${x.id===ME?'me':''}"><td class="l stick tname"><button type="button" class="tlink" ${sx('ttl|'+x.id)}>${esc(x.name)}</button><small>${esc(x.t.mgr)}${x.id===ME?' (you)':''}</small></td>
      ${cell('tpo|'+x.id,P(x.po),`${RAW(x.id)}: top five in ${P(x.po)} of seasons`,true)}${cell('ttl|'+x.id,P(x.bye),`${RAW(x.id)}: top three in ${P(x.bye)} of seasons`)}${cell('ttl|'+x.id,P(x.final),`${RAW(x.id)}: reaches the final in ${P(x.final)} of seasons`)}${cell('ttl|'+x.id,P(x.title),`${RAW(x.id)}: wins the title in ${P(x.title)} of seasons`,true)}${cell('ttl|'+x.id,x.tin==null?'–':P(x.tin),x.tin==null?'Makes the playoffs too rarely to measure':`${RAW(x.id)}: title in ${P(x.tin)} of the seasons they make the playoffs`)}
      ${cell('tpo|'+x.id,x.seed.toFixed(1),`${RAW(x.id)}: average finish ${x.seed.toFixed(2)} of ${n}`)}${cell('tpo|'+x.id,`${Math.round(x.s.w)}-${Math.round(x.s.l)}`,`${RAW(x.id)}: ${x.s.w.toFixed(1)} category wins and ${x.s.l.toFixed(1)} losses on average`)}${cell('tpr|'+x.id,'#'+x.pr,`Power rank ${x.pr} of ${n}`)}</tr>`).join('')}</tbody></table></div>`;
  h+=how([`The board plays out the rest of the regular season ${R.N.toLocaleString('en-US')} times, week by week. In each simulated week every category of every matchup goes to one team or the other, with the chance from the matchup model: projected totals through the real NBA schedule and the 11-starter daily limit, and how much each category usually swings. Categories are drawn independently, which is assumed; real weeks are a little streakier.`,
    `Standings rank teams by category win percentage, the way this league keeps them, and the top five make the playoffs. Ties are broken at random, since ESPN's tiebreakers are not modelled.${weeksDone?' Results already played are locked in.':''} ${R.same?'These are the same simulated seasons behind the playoff odds on the Home and League tabs and the team pages, so those numbers match exactly.':`These seasons are a separate run from the League tab's, so playoff odds can differ from it by a point or two (largest gap now ${Math.abs(Math.round(R.maxDiff*100))} points).`}`,
    `Each season's top five then play the bracket in the assumed ESPN format for a five-team playoff (below). A playoff matchup goes to whoever wins more of the nine categories that week, using the same matchup model with each roster's real games in weeks ${R.RW.join(', ')}. The bracket is worked out exactly for each season's seeds, every path weighted by its chance, so the title odds add no extra randomness. Rosters are held as they are today: no trades, pickups or new injuries. "Title if in" is left blank for a team that makes the playoffs in under 2% of seasons.${curWeek>REGW?' The playoffs have started, but the board does not have bracket results, so it replays the bracket from the final standings.':''}`])+'</section>';
  return h}

function secBracket(R){const ids=R.ids,n=R.n,RW=R.RW,ix=R.ix,[P0,P1]=R.PW;
  // the projected bracket: the five best average finishes, in that order, so each team appears once
  const proj=[...ids].sort((a,b)=>R.T[a].avgSeed-R.T[b].avgSeed||R.T[b].po-R.T[a].po).slice(0,5);
  const pw=(r,a,b)=>R.PW[r][ix[a]*n+ix[b]],[t1,t2,t3,t4,t5]=proj,q4=pw(0,t4,t5);
  const adv={[t4]:q4,[t5]:1-q4,[t1]:q4*pw(1,t1,t4)+(1-q4)*pw(1,t1,t5),[t2]:pw(1,t2,t3),[t3]:pw(1,t3,t2)};
  const rnd={[t4]:0,[t5]:0,[t1]:1,[t2]:1,[t3]:1};
  const slot=(s,id)=>{const x=R.T[id],a=adv[id];
    return `<button type="button" class="h4-s" ${sx('ttl|'+id)} data-tip="${esc(`${RAW(id)}: projected seed ${s+1} (they land there in ${P(x.seed[s])} of seasons). In this bracket they would be ${pc(a)} to win ${RNAME[rnd[id]].toLowerCase()}. Title odds over all seasons: ${P(x.title)}. Tap for their path to the title.`)}"><b class="h4-sd">${s+1}</b><span><b>${NM(id)}${id===ME?' <small class="h4-you">you</small>':''}</b><small>seed ${s+1} in ${P(x.seed[s])} · title ${P(x.title)}</small></span><em class="${a>=.5?'up':'down'}">${pc(a)}</em></button>`};
  const tbd=(txt,a)=>`<div class="h4-s tbd"><span aria-hidden="true"></span><span><b>${txt}</b></span><em class="${a==null?'':a>=.5?'up':'down'}">${a==null?'':pc(a)}</em></div>`;
  const vs=(a,b,w)=>a?`<button type="button" class="h4-vs" ${sx(`mw|${a}|${b}|${w}`)} data-tip="${esc(`${RAW(a)} v ${RAW(b)}, week ${w}: tap for the matchup`)}">v <span>matchup</span></button>`:`<div class="h4-vs">v</div>`;
  const pairs=(r,k=3)=>{const out=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){const c=R.meet[r][i*n+j];if(c)out.push([ids[i],ids[j],c/R.N])}
    return out.sort((a,b)=>b[2]-a[2]).slice(0,k)};
  const plist=(r,lab)=>{const ps=pairs(r);return ps.length?`<span class="lbl">${lab}</span><div class="h4-pairs">${ps.map(([a,b,p])=>{const q=mp(a,b,RW[r]),fav=q.win>=.5?a:b,fp=q.win>=.5?q.win:1-q.win;
      return `<button type="button" class="h4-pair" ${sx(`mw|${a}|${b}|${RW[r]}`)} data-tip="${esc(`${RAW(a)} v ${RAW(b)} happens in ${P(p)} of seasons. ${RAW(fav)} would be ${pc(fp)} to win it.`)}"><span>${NM(a)} v ${NM(b)}</span><em>${P(p)}</em></button>`}).join('')}</div>`:''};
  const champs=[...ids].sort((a,b)=>R.T[b].title-R.T[a].title).slice(0,3);
  return `<section class="panel">${head('The bracket',`The projected bracket: the five teams with the best average finish, seeded in that order, in the assumed ESPN format for a five-team playoff. The percentage beside a team is their chance to win that round if it plays out this way. Tap a team for their path to the title.`)}
    <div class="h4-br">
    <div class="h4-rd"><span class="lbl">${RNAME[0]} · week ${RW[0]}<small>${wkDates(RW[0])}</small></span><div class="h4-m">${slot(3,t4)}${vs(t4,t5,RW[0])}${slot(4,t5)}</div><p class="note">Seeds 1, 2 and 3 rest this week.</p>${plist(0,'Likeliest pairings, all seasons')}</div>
    <div class="h4-rd"><span class="lbl">${RNAME[1]} · week ${RW[1]}<small>${wkDates(RW[1])}</small></span><div class="h4-m">${slot(0,t1)}${vs()}${tbd('Winner of 4 v 5',1-adv[t1])}</div><div class="h4-m">${slot(1,t2)}${vs(t2,t3,RW[1])}${slot(2,t3)}</div>${plist(1,'Likeliest pairings, all seasons')}</div>
    <div class="h4-rd"><span class="lbl">${RNAME[2]} · week ${RW[2]}<small>${wkDates(RW[2])}</small></span><div class="h4-m">${tbd('Winner of 1 v 4/5')}${vs()}${tbd('Winner of 2 v 3')}</div>
      <span class="lbl">Likeliest champions</span><div class="h4-m">${champs.map((id,i)=>`<button type="button" class="h4-s" ${sx('ttl|'+id)} data-tip="${esc(`${RAW(id)} wins the title in ${P(R.T[id].title)} of seasons`)}"><b class="h4-sd">${i+1}</b><span><b>${NM(id)}${id===ME?' <small class="h4-you">you</small>':''}</b><small>reaches the final ${P(R.T[id].final)}</small></span><em>${P(R.T[id].title)}</em></button>`).join('')}</div>${plist(2,'Likeliest finals, all seasons')}</div>
    </div>
    ${how([`This bracket is the assumed ESPN format for a five-team playoff over weeks ${RW.join(', ')}: seeds 4 and 5 meet in round 1 while seeds 1 to 3 rest, then seed 1 plays the lowest seed left (the 4 v 5 winner) and seed 2 plays seed 3, then the two winners meet in the final. If the league's real bracket differs, the playoff odds still hold but the title odds would shift.`,
      `The bracket drawn here is a projection: the five teams with the best average finish over the simulated seasons, seeded in that order. Each team's line shows how often they land in exactly that seed, and their title odds over every season. The percentage on the right is their chance to win that round in this bracket, from the matchup model with that week's NBA games; for seed 1 it is averaged over the two possible opponents.`,
      'The pairings, champions and finals lists come from every simulated season, so they include brackets that look different from this one. A playoff matchup is won by taking more of the nine categories that week; a tied week is rare and is not modelled.'])}</section>`}

function secSeeds(R){const ids=[...R.ids].sort((a,b)=>R.T[a].avgSeed-R.T[b].avgSeed),n=R.n,mx=Math.max(...ids.flatMap(id=>R.T[id].seed),1e-9);
  const sep=s=>s===5?'h4-cut':s===3?'h4-byel':'';
  return `<section class="panel">${head('Seed odds','Share of simulated seasons each team finishes in each spot. Darker is likelier. The line after seed 5 is the playoff cut. Tap a row for that team\'s path to the title.')}
    <div class="scroll"><table class="hm h4-hm"><thead><tr><th class="l stick" scope="col" rowspan="2">Team</th><th class="grp" scope="colgroup" colspan="3">Bye</th><th class="grp h4-byel" scope="colgroup" colspan="2">Round 1</th><th class="grp h4-cut" scope="colgroup" colspan="${n-5}">Miss the playoffs</th><th scope="col" rowspan="2">Avg</th><th scope="col" rowspan="2">Playoffs</th></tr>
    <tr>${Array.from({length:n},(_,s)=>`<th scope="col" class="${sep(s)}">${s+1}</th>`).join('')}</tr></thead><tbody>
    ${ids.map(id=>{const s=R.T[id],me=id===ME;return `<tr><td class="l stick h4-name ${me?'h4-me':''}"><button type="button" class="tlink" ${sx('ttl|'+id)}>${NM(id)}</button></td>${s.seed.map((p,k)=>`<td class="${sep(k)} ${p<.005?'dim':''}" style="${CH.seq(p/mx)}" ${sx('ttl|'+id)} tabindex="0" data-tip="${esc(`${RAW(id)}: seed ${k+1} in ${P(p)} of seasons`)}">${p<.005?'·':Math.round(p*100)}</td>`).join('')}<td ${sx('tpo|'+id)} tabindex="0" data-tip="${esc(`${RAW(id)}: average finish ${s.avgSeed.toFixed(2)}`)}">${s.avgSeed.toFixed(1)}</td><td ${sx('tpo|'+id)} tabindex="0" data-tip="${esc(`${RAW(id)}: playoffs in ${P(s.po)} of seasons`)}"><b>${P(s.po)}</b></td></tr>`}).join('')}</tbody></table></div>
    <p class="note">Numbers are percentages of seasons; a dot means under 1%. Teams are sorted by average finish.</p>
    ${how(['Seeds come from the same simulated seasons: final standings by category win percentage, ties broken at random. The top three skip round 1 in the assumed bracket, which is why seeds 1 to 3 are worth much more than 4 and 5 (see each team\'s path to the title).'])}</section>`}

function secStakes(R){const sel=+S_X('sim.t',ME),T=R.T[sel]?sel:ME,mine=T===ME,s=R.T[T],cls=mine?'s2':'s1';
  const who=mine?'your':`${NM(T)}'s`,they=mine?'you':'they',their=mine?'your':'their';
  let h=`<section class="panel">${head('Weeks that decide the race',`How much ${who} playoff odds (now ${P(s.po)}) ride on each week left: the odds if ${they} win that week, minus the odds if ${they} lose it.`,`<select data-setk="sim.t" aria-label="Team">${teamOpts(T)}</select>`)}`;
  const st=stakesFor(R,T);
  if(!st.length)return h+`<div class="empty">The regular season is over, so the seeds are set.</div>${how(['Once the regular season ends, the seeds are fixed and only the bracket is left to play.'])}</section>`;
  const ok=st.filter(x=>x.ok),top=[...ok].sort((a,b)=>b.swing-a.swing).slice(0,5),top3=top.slice(0,3),b=top[0];
  const rest=ok.filter(x=>!top3.includes(x)).map(x=>x.swing),noise=Math.max(.005,...st.map(x=>2*x.se));
  if(b)h+=`<p class="note">The biggest is ${sbtn(`mw|${T}|${b.op}|${b.w}`,`${weekName(b.w)} against ${NM(b.op)}`)}: win it and ${their} odds are ${P(b.pW)}; lose it and they are ${P(b.pL)}.${top.length>1?` Next: ${top.slice(1,3).map(x=>`${sbtn(`mw|${T}|${x.op}|${x.w}`,`week ${x.w} v ${NM(x.op)}`)} (${PT(x.swing)} points)`).join(' and ')}.`:''}${rest.length?` The other weeks are worth ${Math.round(Math.min(...rest)*100)} to ${Math.round(Math.max(...rest)*100)} points each, because every category counts in the standings.`:''}</p>`;
  const chart=vbars(st.map(x=>({x:x.w,v:x.ok?x.swing*100:0,em:top3.includes(x),stat:`mw|${T}|${x.op}|${x.w}`,
      tip:x.ok?`${weekName(x.w)} v ${RAW(x.op)}: win and ${their} odds are ${P(x.pW)}, lose and they are ${P(x.pL)} (${PT(x.swing)} points). Win chance ${pc(x.win)}.`:`${weekName(x.w)} v ${RAW(x.op)}: the result is all but certain (win chance ${pc(x.win)}), so there is nothing to swing.`})),{cls,label:'Playoff odds swing by week',fmt:v=>String(Math.round(v))});
  const tbl=`<div class="scroll h4-tbl"><table><thead><tr><th class="l stick" scope="col">Week · opponent</th><th scope="col" title="Playoff odds if they win this week, minus if they lose it, in points">Swing</th><th scope="col" title="Playoff odds if they win this week">If win</th><th scope="col" title="Playoff odds if they lose this week">If lose</th></tr></thead><tbody>
    ${top.map(x=>`<tr class="click" ${sx(`mw|${T}|${x.op}|${x.w}`)} tabindex="0" data-tip="${esc(`${weekName(x.w)}, ${wkDates(x.w)}: ${RAW(T)} v ${RAW(x.op)}, ${pc(x.win)} to win. ${RAW(x.op)} makes the playoffs in ${P(R.T[x.op].po)} of seasons.`)}"><td class="l stick tname">${NM(x.op)}<small>Week ${x.w} · ${pc(x.win)} to win</small></td><td class="num"><b>${PT(x.swing)}</b></td><td class="num up">${P(x.pW)}</td><td class="num down">${P(x.pL)}</td></tr>`).join('')}</tbody></table></div>`;
  h+=`<div class="cols">${drillSec('','Swing in playoff odds, in percentage points, for each week left. The three biggest are darker and labelled. Tap a bar for the matchup.',chart)}${drillSec('','The five biggest weeks. Tap one for the matchup.',tbl)}</div>`;
  const root=rootingFor(R,T).filter(x=>x.d>=.01&&x.d>=3*x.se).slice(0,5);
  h+=drillSec('Other games to watch',root.length?`Games between other teams that move ${who} odds the most: ${their} playoff odds if the team to root for wins that week, and if it loses.`:'',
    root.length?`<div class="scroll h4-tbl"><table><thead><tr><th class="l stick" scope="col">Root for</th><th scope="col" title="Playoff odds if they win, minus if they lose, in points">Swing</th><th scope="col" title="Their chance to win that week">Chance</th><th scope="col" title="${mine?'Your':'Their'} playoff odds if they win">If so</th><th scope="col" title="${mine?'Your':'Their'} playoff odds if they lose">If not</th></tr></thead><tbody>
      ${root.map(x=>`<tr class="click" ${sx(`mw|${x.fav}|${x.vs}|${x.w}`)} tabindex="0" data-tip="${esc(`${weekName(x.w)}: ${RAW(x.fav)} over ${RAW(x.vs)}. ${RAW(x.vs)} makes the playoffs in ${P(R.T[x.vs].po)} of seasons.`)}"><td class="l stick tname">${NM(x.fav)}<small>over ${AB(x.vs)} · week ${x.w}</small></td><td class="num"><b>${PT(x.d)}</b></td><td class="num">${pc(x.favWin)}</td><td class="num up">${P(x.pFav)}</td><td class="num down">${P(x.pVs)}</td></tr>`).join('')}</tbody></table></div>`
    :`<p class="note">No single game between other teams moves ${who} odds by a point or more.</p>`);
  h+=how([`For each week, the board takes every one of the ${R.N.toLocaleString('en-US')} simulated seasons and replays that one matchup every way it can go (0 to 9 categories, with the matchup model's chances), keeping the rest of the season as it happened. The swing is ${their} playoff odds averaged over the outcomes where ${they} win the week (five or more categories), minus the outcomes where ${they} lose it.`,
    `A bigger swing usually means the opponent is chasing the same playoff spots, so the result moves both teams. Standings count categories, so even a lost week adds some category wins, and a 5-4 win is worth less than a 9-0 one; the swing covers the whole week, not just the W or L. Each figure is accurate to about ${Math.max(1,Math.round(noise*100))} ${Math.max(1,Math.round(noise*100))===1?'point':'points'} either way.`,
    `Games to watch use the same method for matchups between other teams and list the biggest ones worth at least a point. Other teams' games matter far less than ${their} own, because each one only moves two rivals. A week whose result is all but certain has nothing to swing and shows an empty bar.`])+'</section>';
  return h}

function secWeeks(R){const reg=WEEKS.filter(w=>w<=REGW),order=[...R.ids].sort((a,b)=>R.T[b].po-R.T[a].po),cur=Math.min(curWeek,REGW);
  return `<section class="panel">${head('Week by week','Each team\'s chance to win every regular-season week. The small label is the opponent. Tap a cell for the matchup.')}
    <div class="scroll"><table class="hm h4-hm"><thead><tr><th class="l stick" scope="col">Team</th>${reg.map(w=>`<th scope="col" class="${w===cur&&!preseason?'now':''}" title="${esc(weekLabel(w))}">${w}</th>`).join('')}<th scope="col" title="Weeks left where they are at least 50% to win">Favored</th><th scope="col" title="Expected matchups won over the weeks left">Exp. wins</th></tr></thead><tbody>
    ${order.map(id=>{const me=id===ME;let fav=0,ew=0,left=0;
      const cells=reg.map(w=>{const op=oppOf(id,w);if(op==null)return '<td>–</td>';const q=mp(id,op,w),pst=done(w);if(!pst){left++;ew+=q.win;if(q.win>=.5)fav++}
        return `<td class="${winCls(q.win)}${pst?' past':''}" ${sx(`mw|${id}|${op}|${w}`)} tabindex="0" data-tip="${esc(`${weekName(w)}${pst?' (played)':''} · ${RAW(id)} v ${RAW(op)}: ${pc(q.win)} to win, ${q.exp.toFixed(1)}–${q.expL.toFixed(1)} expected categories`)}">${Math.round(q.win*100)}<span class="rk">${AB(op)}</span></td>`}).join('');
      return `<tr><td class="l stick h4-name ${me?'h4-me':''}"><button type="button" class="tlink" ${sx('tpo|'+id)}>${NM(id)}</button></td>${cells}<td ${sx('tpo|'+id)} tabindex="0" data-tip="${esc(`${RAW(id)}: favored in ${fav} of ${left} weeks left`)}">${fav}</td><td ${sx('tpo|'+id)} tabindex="0" data-tip="${esc(`${RAW(id)}: ${ew.toFixed(1)} matchups won expected over ${left} weeks`)}"><b>${ew.toFixed(1)}</b></td></tr>`}).join('')}</tbody></table></div>
    ${legend([['p3','70%+'],['p2','60–69%'],['p1','53–59%'],['','48–52%','border:1px solid var(--line)'],['n1','41–47%'],['n2','31–40%'],['n3','30% or less']])}
    ${how(['Each cell is the chance the row\'s team wins that week\'s matchup, meaning five or more of the nine categories, from projected totals over the real NBA schedule with the 11-starter daily limit and each player\'s expected rest. Teams are sorted by playoff odds; tap a team name for their playoff odds and schedule.',
      `${weeksDone?'Faded weeks have already been played; they show the projection, not the result. ':''}Favored and expected wins count only the weeks left. The standings count categories, not matchups, so these are a guide to the schedule rather than the standings.`])}</section>`}

function secSOS(){const rows=[...sosData()].filter(x=>x.weeks>0).sort((a,b)=>b.dc-a.dc);
  if(!rows.length)return `<section class="panel">${head('Schedule left','')}<div class="empty">No regular-season weeks left.</div></section>`;
  const wk=rows[0].weeks;
  return `<section class="panel">${head('Schedule left',`Category wins the remaining schedule gives or takes compared with facing an average opponent every week, over ${wk} ${plural(wk,'week')}. Tap a team for their week-by-week schedule.`)}
    <div class="h4-wide">${CH.hbars(rows.map(x=>({label:`${NM(x.id)}${x.id===ME?' <small>you</small>':''}`,v:x.dc,txt:f1(x.dc),hi:x.id===ME,cls:x.dc>=0?'pos':'neg',stat:'tpo|'+x.id,
      tip:`${RAW(x.id)}: ${x.sc.toFixed(1)} expected category wins against their real opponents, ${x.nc.toFixed(1)} against average ones (${f1(x.dc)}). Opponents' average power rank ${x.opr.toFixed(1)} (1 is the strongest).`})),{center:true,stack:true,label:'Schedule effect in category wins'})}</div>
    ${legend([['pos','Easier than average'],['neg','Harder than average']])}
    <div class="scroll h4-tbl"><table><thead><tr><th class="l stick" scope="col">Team</th><th scope="col" title="Category wins gained or lost to the schedule">Effect</th><th scope="col" title="Weekly matchups won, gained or lost to the schedule">Matchups</th><th scope="col" title="Average power rank of the opponents left (1 is the strongest)">Opp. rank</th><th class="l" scope="col">Hardest week</th></tr></thead><tbody>
    ${rows.map(x=>`<tr class="${x.id===ME?'me':''}"><td class="l stick tname"><button type="button" class="tlink" ${sx('tpo|'+x.id)}>${NM(x.id)}</button></td><td class="num ${x.dc>=0?'up':'down'}" ${sx('tpo|'+x.id)} tabindex="0" data-tip="${esc(`${x.sc.toFixed(1)} expected category wins against the real schedule, ${x.nc.toFixed(1)} against average opponents`)}"><b>${f1(x.dc)}</b></td><td class="num" ${sx('tpo|'+x.id)} tabindex="0" data-tip="${esc(`${x.sw.toFixed(1)} weekly matchups won expected against the real schedule, ${x.nw.toFixed(1)} against average opponents`)}">${f1(x.dw)}</td><td class="num" ${sx('tpo|'+x.id)} tabindex="0" data-tip="${esc(`Opponents left have an average power rank of ${x.opr.toFixed(1)} (1 is the strongest)`)}">${x.opr.toFixed(1)}</td><td class="l">${x.hard?sbtn(`mw|${x.id}|${x.hard.op}|${x.hard.w}`,`W${x.hard.w} v ${AB(x.hard.op)} · ${pc(x.hard.win)}`):'–'}</td></tr>`).join('')}</tbody></table></div>
    ${how(['For every week left, the board compares a team\'s expected categories against their real opponent with what they would expect against an average opponent that week (the mean over all nine other teams, with the same NBA games). The difference, added up, is how many category wins the schedule gives or takes. It counts each opponent\'s roster and how many games they have that week, so a strong team with a light NBA week can be an easy draw.',
      'Matchups is the same comparison for weekly matchups won. Opp. rank is the average power rank of the opponents left (1 is the strongest), which ignores NBA games, so it can disagree with the effect. The hardest week is the one with the lowest win chance.'])}</section>`}

function vSim(){css();const R=runSim();return secOdds(R)+secBracket(R)+secSeeds(R)+secStakes(R)+secWeeks(R)+secSOS()}

HUB.push({k:'sim',label:'Season sim',order:40,note:'Playoff and title odds from 4,000 simulated seasons and the five-team bracket, the weeks that decide the race, and the schedule left.',render:vSim});

/* ---------- ttl|<teamId>: the path to the title ---------- */
DRILL.ttl=id=>{const t=TM(id);if(!t)return null;css();const R=runSim(),s=R.T[t.id];if(!s)return null;
  const i=s.i,n=R.n,N=R.N,RW=R.RW,mine=t.id===ME,name=esc(t.name),MIN=80;
  const tRank=1+R.ids.filter(x=>R.T[x].title>s.title).length,tin=s.po>=.02?s.title/s.po:null,mostSeed=s.seed.indexOf(Math.max(...s.seed))+1;
  // what a bye is worth: title odds in the seasons they finish 1-3 against 4-5
  const pool=a=>{const c=a.reduce((x,k)=>x+s.seedN[k],0),w=a.reduce((x,k)=>x+(s.tbs[k]||0)*s.seedN[k],0);return c>=MIN?{c,p:w/c}:null},pb=pool([0,1,2]),p45=pool([3,4]);
  let h=`<div class="facts h4-facts">${[fact('Playoffs',P(s.po),'Top five make it','tpo|'+t.id),fact('First-round bye',P(s.bye),'Seeds 1 to 3'),fact('Reach the final',P(s.final),`Week ${RW[2]}`),
    fact('Win the title',P(s.title),`${ord(tRank)} of ${n}`),fact('If they get in',tin==null?'–':P(tin),tin==null?'Too rare to measure':'Title odds once in'),fact('Most likely seed',String(mostSeed),`${P(s.seed[mostSeed-1])} of seasons`,'tpo|'+t.id)].join('')}</div>`;
  h+=`<p class="note">${s.po<.005?`${name} almost never makes the playoffs in the simulations, so the title is out of reach unless the roster changes.`
    :pb&&p45?`${pb.p>p45.p*1.25?'A bye is worth a lot: w':'W'}hen ${name} finishes in the top three they win the title ${P(pb.p)} of the time; as seed 4 or 5, ${P(p45.p)}.`
    :`${name} finishes in seed ${mostSeed} most often (${P(s.seed[mostSeed-1])} of seasons).`}</p>`;
  const cls=mine?'me':'hi';
  h+=drillSec('Round by round','Share of all simulated seasons in which they get at least this far.',CH.hbars([
    {label:'Playoffs',v:s.po,txt:P(s.po),cls,stat:'tpo|'+t.id,tip:`Top five in ${P(s.po)} of seasons. Tap for their playoff odds and schedule.`},
    {label:'Round 2',v:s.r2,txt:P(s.r2),cls,tip:`A bye (seeds 1 to 3, ${P(s.bye)}) or a round 1 win as seed 4 or 5`},
    {label:'Final',v:s.final,txt:P(s.final),cls,tip:`Wins in round 2, week ${RW[1]}`},
    {label:'Champion',v:s.title,txt:P(s.title),cls,tip:`Wins the final in week ${RW[2]}`}],{label:'Round by round odds',max:1}));
  const path=['A bye, then the 4 v 5 winner','A bye, then seed 3','A bye, then seed 2','Seed 5 in round 1, then seed 1','Seed 4 in round 1, then seed 1'];
  h+=drillSec('Seed odds',`Where they finish over ${N.toLocaleString('en-US')} seasons; green seeds make the playoffs. Tap a bar for the schedule behind it. The table shows how often each playoff seed turns into a title.`,
    CH.dist(s.seed.map((p,k)=>({x:k+1,p,cls:k<5?'bar-w':'bar-n',tip:`Seed ${k+1}`,em:k+1===mostSeed,stat:'tpo|'+t.id})),{label:'Seed probabilities',legend:legend([['w','Makes the playoffs'],['mut','Misses']])})+
    `<div class="scroll h4-tbl"><table><thead><tr><th class="l stick" scope="col">Seed and path</th><th scope="col">Chance</th><th scope="col" title="Title odds in the seasons they finish in this seed">Title from here</th></tr></thead><tbody>
    ${path.map((pt,k)=>{const c=s.seedN[k],tb=s.tbs[k];return `<tr><td class="l stick"><b>Seed ${k+1}</b><small class="h4-sub">${pt}</small></td><td class="num">${P(s.seed[k])}</td><td class="num">${c>=MIN&&tb!=null?`<b>${P(tb)}</b>`:'–'}</td></tr>`}).join('')}
    <tr><td class="l stick"><b>Seeds 6–${n}</b><small class="h4-sub">Misses the playoffs</small></td><td class="num">${P(1-s.po)}</td><td class="num">0%</td></tr></tbody></table></div>`+
    `<p class="note">A dash means they land in that seed in fewer than ${MIN} of the ${N.toLocaleString('en-US')} seasons, too few to measure.</p>`);
  // likeliest opponents per round, as a share of their games in that round
  const reach=[s.seed[3]+s.seed[4],s.r2,s.final],roundNote=['Only seeds 4 and 5 play round 1.','Seed 1 meets the 4 v 5 winner; seeds 2 and 3 meet each other.','The two round 2 winners meet.'];
  const opp=[0,1,2].map(r=>{const w=RW[r],cnt=R.ids.map((o,j)=>[o,R.meet[r][i*n+j]]).filter(x=>x[0]!==t.id&&x[1]>0).sort((a,b)=>b[1]-a[1]),tot=cnt.reduce((a,x)=>a+x[1],0);
    const lab=`<span class="lbl">${RNAME[r]} · week ${w} · ${wkDates(w)}</span>`;
    if(tot<40)return `<div class="sub">${lab}<p class="note">${r===0?`They play round 1 in ${P(reach[0])} of seasons`:`They get this far in ${P(reach[r])} of seasons`}, too rarely to say who they would face. ${roundNote[r]}</p></div>`;
    return `<div class="sub">${lab}<p class="note">${r===0?'They play round 1':r===1?'They play round 2':'They reach the final'} in ${P(reach[r])} of seasons${r===1?` (${P(s.bye)} with a bye)`:''}. ${roundNote[r]}</p>
      <div class="h4-ol"><div class="h4-oh"><span>Opponent</span><span>Faces them</span><span>Win chance</span></div>
      ${cnt.slice(0,4).map(([o,c])=>{const q=mp(t.id,o,w);return `<button type="button" class="h4-o" ${sx(`mw|${t.id}|${o}|${w}`)} data-tip="${esc(`${RAW(o)} is their ${RNAME[r].toLowerCase()} opponent in ${P(c/tot)} of the seasons they get there. ${RAW(t.id)} would be ${pc(q.win)} to win that week.`)}"><span><b>${NM(o)}</b><small>title odds ${P(R.T[o].title)}</small></span><em>${P(c/tot)}</em><em class="${q.win>=.5?'up':'down'}">${pc(q.win)}</em></button>`}).join('')}</div></div>`}).join('');
  h+=drillSec('Likeliest opponents','Who they face in each round when they get there, and their chance to win that week. Tap one for the matchup.',`<div style="display:flex;flex-direction:column;gap:10px">${opp}</div>`);
  // playoff weeks: how this roster's NBA games and strength hold up in weeks 21-23
  const pw=RW.map(w=>{const g=projTeam(t.id,w,0).games,avg=mean(M.teams.map(x=>projTeam(x.id,w,0).games)),others=M.teams.filter(x=>x.id!==t.id),wf=mean(others.map(o=>mp(t.id,o.id,w).win));return {w,g,avg,wf}});
  h+=drillSec('Playoff weeks','Games: expected player-games that count (after the daily 11-starter limit). League: the average roster that week. Vs field: their average chance to beat each of the other nine teams that week. Tap a row for games by week.',
    `<div class="scroll h4-tbl"><table><thead><tr><th class="l stick" scope="col">Round</th><th scope="col" title="Expected player-games that count">Games</th><th scope="col" title="League average player-games">League</th><th scope="col" title="Average win chance against each of the other nine teams that week">Vs field</th></tr></thead><tbody>
    ${pw.map((x,r)=>`<tr class="click" ${sx('tgm|'+t.id)} tabindex="0" data-tip="${esc(`${RNAME[r]}, week ${x.w}: ${x.g.toFixed(1)} player-games against a league average of ${x.avg.toFixed(1)}`)}"><td class="l stick"><b>${RNAME[r]}</b><small class="h4-sub">Week ${x.w} · ${wkDates(x.w)}</small></td><td class="num ${x.g-x.avg>=1?'up':x.g-x.avg<=-1?'down':''}"><b>${x.g.toFixed(0)}</b></td><td class="num">${x.avg.toFixed(0)}</td><td class="num">${pc(x.wf)}</td></tr>`).join('')}</tbody></table></div>`);
  h+=how([`From ${N.toLocaleString('en-US')} simulated seasons. The regular season is played out week by week with the matchup model (categories drawn independently, which is assumed), the top five by category win percentage make the playoffs, and the bracket is played in the assumed ESPN format for a five-team playoff: seeds 4 v 5 in week ${RW[0]} while seeds 1 to 3 rest, then 1 v the 4/5 winner and 2 v 3 in week ${RW[1]}, then the final in week ${RW[2]}.`,
    `A playoff matchup goes to whoever wins more of the nine categories that week, with each roster's real NBA games in those weeks. The bracket is worked out exactly for each season's seeds, every path weighted by its chance, and win chances against a specific opponent come straight from the matchup model. Rosters are held as they are today, so trades, pickups and injuries will move these numbers.${curWeek>REGW?' The playoffs have started, but the board does not have bracket results, so it replays the bracket from the final standings.':''}`,
    `"Title from here" is the share of seasons in that seed that end in a title, which shows what a bye is worth. Seeds they reach in fewer than ${MIN} seasons are left blank, and opponents are listed only when they reach that round in at least 40 seasons.`]);
  return {eyebrow:name,title:`Title odds ${P(s.title)}`,sub:`Playoffs ${P(s.po)} · final ${P(s.final)} · ${ord(tRank)} of ${n} in title odds`,back:`${t.abbr} title odds`,html:h}};

/* ---------- search commands ---------- */
CMDS.push({label:'Season sim',sub:'Playoff and title odds, the bracket, the weeks that decide the race',kw:'sim simulation playoffs playoff title odds bracket seeds seed champion championship schedule strength race',tag:'Stats',act:()=>go('stats',{hub:'sim'})});
CMDS.push({label:'My path to the title',sub:'Seed odds, round-by-round odds and likeliest opponents',kw:'title championship win league path my odds',tag:'Drill',act:()=>openStat('ttl|'+ME)});
})();
