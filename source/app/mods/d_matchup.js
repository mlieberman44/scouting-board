/* d_matchup.js: matchup drill-downs and the Matchup lab panel.
   mw|a|b|week        one week between two teams: categories-won distribution, each category's chance (links to mc), player-games
                      and benched games, the day-by-day lineups, the swing categories and the move that helps most
   mc|a|b|week|cat    one category in that week: both projected totals and their ranges, who supplies it on each side,
                      games, how much more of the stat makes it lean either way, and how much the week hinges on it
   PANELS.matchup     "Matchup lab" at the end of the Matchup tab: distribution, category chances, swing categories, best move
   Registers only; everything computes at render time. Shared helpers on window.LAB: matchPivots, swingCats, leanNeed, bestStream. */
(()=>{
const LAB=window.LAB=window.LAB||{};
const NS='dmu';

/* ---------- small helpers ---------- */
const TM=x=>{const n=parseInt(x,10);return Number.isFinite(n)?(tm(n)||null):null};
const WK=x=>{const n=parseInt(x,10);return Number.isFinite(n)&&PER[n]&&PER[n].length?n:null};
const CT=k=>catOf(String(k||'').toLowerCase())||null;
const LEAN=.62,SW_LO=.38,SW_HI=.62;                       // the same bands as the core's Lock / Lean / Swing tags
const invPhi=q=>{let lo=-8,hi=8;for(let i=0;i<64;i++){const m=(lo+hi)/2;if(Phi(m)<q)lo=m;else hi=m}return (lo+hi)/2};
const Z_LEAN=invPhi(LEAN);
const sum=a=>a.reduce((s,x)=>s+x,0);
const ab=t=>esc(t.abbr), tn=t=>esc(t.name);
const poss=s=>/s$/i.test(s)?s+"'":s+"'s";                          // possessive: Fears' / NUT's
const pab=t=>esc(poss(t.abbr)), ptn=t=>esc(poss(t.name));
const nb=s=>esc(s).replace(/ /g,'&nbsp;');
const wkShort=w=>w>REGW?'P'+(w-REGW):'W'+w;
const short=n=>{const w=String(n).split(' ');return w.length>1?w[0].charAt(0)+'. '+w.slice(1).join(' '):String(n)};
let DF=null;const DL=new Map();                                                   // one date formatter, labels cached by day
const dlab=sp=>{if(!DL.has(sp)){DF=DF||new Intl.DateTimeFormat('en-US',{weekday:'short',month:'numeric',day:'numeric',timeZone:TZ});DL.set(sp,DF.format(spDate(sp)).replace(',',''))}return DL.get(sp)};
const isOver=w=>!!(PER[w]&&PER[w][PER[w].length-1]<todaySP);
const meets=(a,b)=>DATA.schedule.filter(m=>(m[1]===a&&m[2]===b)||(m[1]===b&&m[2]===a)).map(m=>m[0]).sort((x,y)=>x-y);
const isReal=(a,b,w)=>w<=REGW&&oppOf(a,w)===b;
const fmtT=(c,v)=>v==null||!isFinite(v)?'–':c.pct?f3(v):String(Math.round(v));                      // a week total, short
// two week totals that would print the same get one more digit, so a near tie still shows who leads
const pairT=(c,a,b,f=fmtT)=>{const x=f(c,a),y=f(c,b);if(x!==y)return [x,y];const g=v=>c.pct?v.toFixed(4).replace(/^0/,''):v.toFixed(1);return [g(a),g(b)]};
const fmt1=(c,v)=>v==null||!isFinite(v)?'–':c.pct?f3(v):Math.abs(v)>=100?v.toFixed(0):v.toFixed(1);
const amt=x=>x>=10?String(Math.ceil(x-1e-9)):(Math.ceil(x*10-1e-9)/10).toFixed(1);                   // rounded up, so it really gets there
const MADE={fg:'made field goals',ft:'made free throws',tp:'made threes'};
const pts=x=>{const n=Math.round(x*100);return `${sg(n)} point${Math.abs(n)===1?'':'s'}`};
// the change between two chances as printed, so "42% → 55%" always reads "+13 points"
const ptsBetween=(from,to)=>pts((Math.round(to*100)-Math.round(from*100))/100);
const sf1=x=>{const r=Math.round(x*10)/10;return r===0?'0.0':f1(r)};                                 // signed, never "-0.0"
const plural=(n,w)=>`${n} ${n===1?w:w.endsWith('y')?w.slice(0,-1)+'ies':w+'s'}`;
const legend=items=>`<div class="legend">${items.map(([cls,l])=>`<span>${cls?`<i class="${cls}"></i>`:''}${l}</span>`).join('')}</div>`;   // no class: a plain note, no swatch
// series colours: Matt's team is always blue (s2); otherwise the first team is orange (s1). bA/bB are the matching bar classes
const PAL=(a,b)=>a===ME?{A:'s2',B:'s1',bA:'me',bB:'hi'}:{A:'s1',B:'s2',bA:'hi',bB:'me'};
const ghost=(attrs,l)=>`<button type="button" class="btn sm ghost" ${attrs}>${l}</button>`;

const CSS=`.dmu-cards{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:8px}
.dmu-card{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;min-width:0;background:var(--panel);text-align:left;font:inherit;color:inherit}
button.dmu-card{cursor:pointer}button.dmu-card:hover{background:var(--soft)}
.dmu-card .dmu-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
.dmu-card .dmu-top span{font:600 .95rem var(--display);letter-spacing:.05em;text-transform:uppercase}
.dmu-card b{font:700 1.5rem/1.05 var(--display);font-variant-numeric:tabular-nums}
.dmu-card small{color:var(--muted);font-size:.76rem;line-height:1.35}
.dmu-card .pill{margin:0}
.dmu-pm{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center}
.dmu-meter{position:relative;height:6px;border-radius:3px;background:var(--neg-2);overflow:hidden}
.dmu-meter i{position:absolute;left:0;top:0;bottom:0;background:var(--pos-3)}
.dmu-meter::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--panel)}
.dmu-lever{border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;background:var(--raise);min-width:0}
.dmu-lever>b{font:600 1.15rem/1.2 var(--display);text-transform:uppercase;letter-spacing:.03em}
.dmu-lever p{margin:0;font-size:.86rem}
.dmu-lever .note{font-size:.8rem}
.dmu-shift{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font:700 1.6rem/1 var(--display);font-variant-numeric:tabular-nums}
.dmu-shift i{font-style:normal;color:var(--muted);font-size:1.1rem}
.dmu-shift small{font:600 .8rem var(--body);color:var(--pos-fg)}
.dmu-shift small.down{color:var(--neg-fg)}
.dmu-alt{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;font-size:.8rem;color:var(--muted)}
.dmu-alt b{color:var(--ink);font-weight:600}
.dmu-days th,.dmu-days td{padding:6px 8px}
.dmu-days td small.sit{display:inline;margin-left:4px}
.dmu-days tr.tot td{border-top:1px solid var(--line);font-weight:600}
.dmu-who{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.dmu-who>div{display:grid;grid-template-columns:6.6em minmax(0,1fr);gap:8px;font-size:.82rem;align-items:baseline}
.dmu-who>div.past{opacity:.55}.dmu-who>div.idle{display:block}
.dmu-who b{font-weight:600;white-space:nowrap}
.dmu-who small{display:block;color:var(--muted);font-size:.75rem}
.dmu-flip{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.dmu-flip li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:baseline;font-size:.86rem}
.dmu-flip li>span:first-child{font:700 1.05rem var(--display);min-width:3.6em;font-variant-numeric:tabular-nums}
.dmu-sum{font-size:.84rem;margin:0}
.dmu-sum b{font-weight:600}
.dmu-links{display:flex;flex-wrap:wrap;gap:8px}
.dmu-wide .hb.stack .hb-r{grid-template-columns:minmax(0,1fr) 4.6em;row-gap:2px}.dmu-wide .hb.stack .hb-l{grid-column:1/-1;white-space:normal}
@media (max-width:560px){.dmu-cards{grid-template-columns:1fr}.dmu-wide .hb.stack .hb-r{grid-template-columns:minmax(0,1fr) 4.2em}.dmu-who>div{grid-template-columns:1fr;gap:0}.dmu-days th,.dmu-days td{padding:6px 6px}}`;
const css=()=>addCSS('dmu-css',CSS);

/* ---------- the model behind the drills ---------- */
// chance of each number of categories won, treating the categories as independent (same as the core's matchOdds)
const convo=ps=>{let d=[1];ps.forEach(q=>{const nd=new Array(d.length+1).fill(0);d.forEach((x,i)=>{nd[i]+=x*(1-q);nd[i+1]+=x*q});d=nd});return d};
// for each category: the chance the other eight split 4-4 (so this one settles the week), and the week's chance if it is won or lost.
// The week's chance is exactly ifLost + p * piv, so piv is also how much one point of category chance is worth in week chance.
function pivots(o){return memo(`${NS}|piv|${o.a}|${o.b}|${o.w}`,()=>{const out={};
  CATS.forEach(c=>{const d=convo(CATS.filter(x=>x!==c).map(x=>o.p[x.k]));out[c.k]={piv:d[4],ifWon:sum(d.slice(4)),ifLost:sum(d.slice(5))}});return out})}
const spread=(o,k)=>Math.sqrt(o.da[k].v+o.db[k].v);
// how much more of the stat one side ('a' or 'b') needs for the category to lean its way (62%), everything else held fixed.
// Counting stats in the stat's own units (fewer, for TO); percentages also as made shots on the same attempts.
function leanNeed(o,c,side){const s=spread(o,c.k);if(!(s>1e-9))return null;let d=o.da[c.k].m-o.db[c.k].m;if(c.neg)d=-d;if(side==='b')d=-d;
  const need=Z_LEAN*s-d,own=side==='a'?o.da[c.k]:o.db[c.k];
  if(need<=0)return {need:0,already:true};
  if(c.pct&&!(own.A>0))return null;
  return c.pct?{need,makes:need*own.A}:{need}}
function swings(o){const pv=pivots(o);return CATS.map(c=>({c,p:o.p[c.k],...pv[c.k]})).sort((x,y)=>Math.abs(x.p-.5)-Math.abs(y.p-.5)||y.piv-x.piv)}
// each player's expected starts in the projected week and what they add in one category
function contrib(id,P,w,c){const n=new Map();P.days.forEach(d=>d.st.forEach(x=>n.set(x,(n.get(x)||0)+1)));
  return rosterOf(id).filter(p=>p.pg&&n.get(p.name)).map(p=>{const days=n.get(p.name),g=days*avail(p,w);
    if(c.pct){const mk=g*p.pg[c.pct[0]],at=g*p.pg[c.pct[1]];return {p,days,g,mk,at,v:mk-M.lg[c.k]*at}}
    return {p,days,g,v:g*p.pg[c.k]}})}
// the free agent who adds the most win chance for team a in this week (a's lowest-value player makes room)
const dropFor=id=>{if(id===ME)return dropDefault(ME);const q=rosterOf(id).filter(p=>p.nvPG!=null).sort((x,y)=>x.nvPG-y.nvPG)[0];return q?q.name:'none'};
function streams(a,b,w){return memo(`${NS}|str|${a}|${b}|${w}`,()=>{const drop=dropFor(a);
  if(a===ME&&isReal(a,b,w))return {drop,rows:weekAdds(w,drop)};            // the core's own streamer run, already cached
  const base=mp(a,b,w),L=base.live,from=L?L.fromSP:0,kept=rosterOf(a).filter(p=>p.name!==drop);
  const rows=M.fas.filter(f=>f.pg).map(f=>{const games=gamesIn(f.nba,w,from);if(!games)return {f,games,dExp:0,dWin:0,gain:[],o:base};   // no games, no change
    const P=weekProj([...kept,f],w,from),p=catProbs(catDist(P,L&&L.ca),base.db),o=matchOdds(p);
    const gain=CATS.map(c=>[c,p[c.k]-base.p[c.k]]).filter(x=>x[1]>.02).sort((x,y)=>y[1]-x[1]);
    return {f,games,dExp:o.exp-base.exp,dWin:o.win-base.win,gain,o}});
  return {drop,rows}})}
const rankedStreams=(a,b,w)=>{const s=streams(a,b,w);return {drop:s.drop,rows:[...s.rows].sort((x,y)=>y.dWin-x.dWin||y.dExp-x.dExp)}};

/* ---------- shared pieces ---------- */
function distChart(o,A,B){const d=o.dist,mode=d.indexOf(Math.max(...d));
  const items=d.map((p,i)=>({x:i,p,cls:i>=5?'bar-w':'bar-l',em:i===mode,tip:`${A.abbr} ${i}–${9-i} ${B.abbr}`}));
  return CH.dist(items,{label:`Categories ${A.name} wins, 0 to 9`,legend:legend([['w',`${ab(A)} wins the week (5 or more)`],['l',`${ab(B)} wins it`]])})}
function distLine(o,A){const d=o.dist,mode=d.indexOf(Math.max(...d)),big=sum(d.slice(6)),small=sum(d.slice(0,4));
  return `<p class="dmu-sum">Most likely <b>${mode}-${9-mode}</b> (${pc(d[mode])}). ${ab(A)} takes 6 or more categories ${pc(big)} of the time and 3 or fewer ${pc(small)}.</p>`}
function catChart(o,A,B){const rows=CATS.map(c=>({c,p:o.p[c.k]})).sort((x,y)=>y.p-x.p).map(({c,p})=>{const [x,y]=pairT(c,o.da[c.k].m,o.db[c.k].m),[x1,y1]=pairT(c,o.da[c.k].m,o.db[c.k].m,fmt1);return {
    label:`<b>${c.l}</b><small>${x}–${y}</small>`,v:p-.5,txt:pc(p),cls:p>=.5?'pos':'neg',
    stat:`mc|${A.id}|${B.id}|${o.w}|${c.k}`,tip:`${c.n}: ${A.abbr} ${x1} vs ${B.abbr} ${y1} projected · ${pc(p)} for ${A.abbr} (${tag(p)[0]})`}});
  return CH.hbars(rows,{center:true,max:.5,label:`Chance ${A.name} wins each category`})+legend([['pos',`Leans ${ab(A)}`],['neg',`Leans ${ab(B)}`],['',`Bars grow from 50%. Small numbers: projected totals, ${ab(A)} first`]])}
// one line on what flips a category: the amount a side needs for a 62% lean
function needTxt(o,c,side,T){const n=leanNeed(o,c,side);if(!n)return '';if(n.already)return `Already leans ${ab(T)}`;
  if(c.pct)return `${ab(T)} needs ${amt(n.makes)} more ${MADE[c.k]} on the same attempts to make it lean their way`;
  return `${ab(T)} needs ${c.neg?amt(n.need)+' fewer TO':'+'+amt(n.need)+' '+c.l} to make it lean their way`}
function swingCards(o,A,B,n){const sw=swings(o),band=sw.filter(x=>x.p>=SW_LO&&x.p<SW_HI),list=(band.length>=2?band:sw).slice(0,n);
  const cards=list.map(x=>{const c=x.c,[tg,cl]=tag(x.p);
    return `<button type="button" class="dmu-card" data-stat="${esc(`mc|${A.id}|${B.id}|${o.w}|${c.k}`)}" data-tip="${esc(`${c.n}: open both ranges and who supplies it`)}">
      <span class="dmu-top"><span>${c.l}</span><span class="pill ${cl}">${tg}</span></span>
      <span class="dmu-pm"><b>${pc(x.p)}</b><span class="dmu-meter" aria-hidden="true"><i style="width:${pc(x.p)}"></i></span></span>
      <small>${pab(A)} chance. Settles the week ${pc(x.piv)} of the time.</small>
      <small>${x.p<LEAN?needTxt(o,c,'a',A):needTxt(o,c,'b',B)}.</small></button>`});
  const head=band.length>=2?`${plural(band.length,'category')} of 9 ${band.length===1?'is':'are'} between 38% and 62%.${band.length>n?` The ${n} closest:`:''}`:
    `No real toss-ups${band.length?' beyond '+band[0].c.l:''} this week. The closest:`;
  return `<p class="note">${head}</p><div class="dmu-cards" style="--n:${cards.length}">${cards.join('')}</div>`}
// the best move for team A this week; with b ME (or not), a line on the other side's best answer
function lever(a,b,w,o,opts={}){const A=tm(a),B=tm(b);
  if(isOver(w)&&!o.live)return `<div class="dmu-lever"><b>Week over</b><p class="note">${weekName(w)} has finished, so there is nothing left to change.</p></div>`;
  const R=rankedStreams(a,b,w),r=R.rows[0],alt=R.rows.slice(1,3).filter(x=>x.dWin>=.005),dropTxt=R.drop&&R.drop!=='none'?`, drop ${esc(R.drop)}`:'';
  let h;
  if(!r||r.dWin<.005){const s=swings(o)[0],n=s.p<LEAN?needTxt(o,s.c,'a',A):'';
    h=`<div class="dmu-lever"><b>No pickup helps</b><p>None of the ${M.fas.filter(f=>f.pg).length} free agents raises ${pab(A)} chance this week by even half a point. The closest category is ${sbtn(`mc|${a}|${b}|${w}|${s.c.k}`,s.c.l)} at ${pc(s.p)}.${n?` ${n}.`:''}</p></div>`}
  else{const gains=r.gain.slice(0,2).map(g=>g[0].l),down=r.dWin<0;
    h=`<div class="dmu-lever">
      <b>Add ${esc(r.f.name)}${dropTxt}</b>
      <div class="dmu-shift" data-tip="${esc(`${poss(A.abbr)} chance to win ${weekName(w)}, before and after`)}">${pc(o.win)}<i>→</i>${pc(r.o.win)}<small class="${down?'down':''}">${ptsBetween(o.win,r.o.win)}</small></div>
      <p>${pab(A)} chance to win the week with ${esc(r.f.name)} (${esc(r.f.nba)} · ${esc(r.f.pos)}), who has ${plural(r.games,'game')}${o.live?' left':''} this week. ${f2(r.dExp)} expected categories${gains.length?`, mostly ${gains.join(' and ')}`:''}.</p>
      ${alt.length?`<ul class="dmu-alt">${alt.map(x=>`<li>Next: <b>${esc(x.f.name)}</b> ${pts(x.dWin)} · ${plural(x.games,'game')}</li>`).join('')}</ul>`:''}
      <div class="dmu-links">${ghost(`data-player="${esc(r.f.name)}"`,'Player profile')}${gains.length?ghost(`data-stat="${esc(`pc|${r.f.name}|${r.gain[0][0].k}`)}"`,`${gains[0]} breakdown`):''}</div></div>`}
  if(opts.answer){const Q=rankedStreams(b,a,w).rows[0],yb=b===ME,their=yb?'your':pab(B),aCh=a===ME?'your chance':`${pab(A)} chance`;
    if(Q&&Q.dWin>=.01&&r&&r.dWin>=.005&&Q.f.name===r.f.name)h+=`<p class="note">${esc(Q.f.name)} is also ${their} best answer (${pts(Q.dWin)} for ${yb?'you':'them'}), so whoever adds them first keeps them from the other side.</p>`;
    else if(Q&&Q.dWin>=.01)h+=`<p class="note">${yb?'Your':pab(B)} best answer: ${esc(Q.f.name)} would move ${yb?'your':'their'} chance from ${pc(1-o.win)} to ${pc(Q.o.win)} (${ptsBetween(1-o.win,Q.o.win)}), so ${aCh} would drop to about ${pc(1-Q.o.win)}.</p>`;
    else h+=`<p class="note">${yb?'No free agent moves your chance':`${ab(B)} has no free agent who moves their chance`} by a full point.</p>`}
  return h}
const ctxNote=(A,B,w,o)=>{const out=[];
  if(w>REGW)out.push(`Fantasy playoffs. This pairing is assumed: who actually meets depends on the final standings.`);
  else if(!isReal(A.id,B.id,w)){const m=meets(A.id,B.id);out.push(`${tn(A)} and ${tn(B)} don't meet in ${weekName(w)}, so this is a what-if on that week's NBA schedule.${m.length?` They meet in ${m.length>1?'weeks':'week'} ${m.map(x=>sbtn(`mw|${A.id}|${B.id}|${x}`,String(x))).join(', ')}.`:''}`)}
  if(isOver(w)&&!o.live)out.push(`This week has finished. The board keeps no box scores for past weeks, so these numbers are the projection from today's rosters.`);
  else if(o.live)out.push(`Under way: ESPN's live totals so far, plus projections for the games left.`);
  return out.length?`<p class="note">${out.join(' ')}</p>`:''};

/* ---------- mw: the week ---------- */
DRILL.mw=(a,b,wk)=>{const A=TM(a),B=TM(b),w=WK(wk);if(!A||!B||A.id===B.id||w==null)return null;css();
  const o=mp(A.id,B.id,w),L=o.live,d=o.dist,mode=d.indexOf(Math.max(...d)),[tg,tcl]=tag(o.win);
  const fA=projTeam(A.id,w,0),fB=projTeam(B.id,w,0);
  const facts=[
    L?fact('Live now',`${L.score[0]}-${L.score[1]}${L.score[2]?'-'+L.score[2]:''}`,'categories, as of the last update'):'',
    fact(isOver(w)&&!L?'Projected win chance':'Win chance',pc(o.win),`${tg} · needs 5 of the 9 categories`),
    fact(L?'Projected final':'Expected categories',`${o.exp.toFixed(1)}–${o.expL.toFixed(1)}`,'the average split'),
    L?'':fact('Most likely result',`${mode}-${9-mode}`,`${pc(d[mode])} chance`),
    fact('Player-games',`${o.Pa.games.toFixed(0)} v ${o.Pb.games.toFixed(0)}`,`expected starts${L?' left':''} · ${o.Pa.bench||o.Pb.bench?`games benched: ${ab(A)} ${o.Pa.bench}, ${ab(B)} ${o.Pb.bench}`:'no games benched'}`,`tgm|${A.id}`)].join('');
  const days=fA.days.map((x,i)=>[x,fB.days[i]]).filter(([x,y])=>x&&y);
  // consecutive days when neither side has a game collapse into one row (the All-Star break, for one)
  const runs=ds=>{const out=[];ds.forEach(d=>{const idle=!d[0].playing&&!d[1].playing,l=out[out.length-1];if(idle&&l&&l.idle){l.last=d[0];l.n++}else out.push(idle?{idle,first:d[0],last:d[0],n:1}:{d})});return out};
  const tipNames=(id,dd)=>{const R=rosterOf(id).filter(p=>p.pg).sort((x,y)=>y.prio-x.prio),st=R.filter(p=>dd.st.has(p.name)).map(p=>short(p.name)),bn=R.filter(p=>plays(p.nba,dd.sp)&&avail(p,w)>0&&!dd.st.has(p.name)).map(p=>short(p.name));
    return `${teamById[id].abbr} ${dlab(dd.sp)}: ${st.length?st.join(', '):'nobody'}${bn.length?' · bench: '+bn.join(', '):''}`};
  const cell=(id,dd)=>`<td class="num ${dd.sp<todaySP?'past':''} ${dd.playing>dd.started?'warnc':''}" data-tip="${esc(tipNames(id,dd))}">${dd.started}${dd.playing>dd.started?`<small class="sit">+${dd.playing-dd.started} sit</small>`:''}</td>`;
  const rem=days.filter(([x])=>!L||x.sp>=L.fromSP),sA=sum(rem.map(x=>x[0].started)),sB=sum(rem.map(x=>x[1].started)),eA=L?o.Pa.games:fA.games,eB=L?o.Pb.games:fB.games;
  const dayTbl=`<div class="scroll"><table class="dmu-days"><thead><tr><th class="l" scope="col">Day</th><th scope="col">${ab(A)}</th><th scope="col">${ab(B)}</th><th scope="col">Edge</th></tr></thead><tbody>
    ${runs(days).map(g=>{if(g.idle)return `<tr><td class="l ${g.last.sp<todaySP?'past':''}" colspan="4">${g.n>1?`${dlab(g.first.sp)} – ${dlab(g.last.sp)}`:dlab(g.first.sp)} <span class="note" style="display:inline">· no NBA games${g.n>1?` for ${g.n} days`:''}</span></td></tr>`;const [x,y]=g.d,df=x.started-y.started;return `<tr><td class="l ${x.sp<todaySP?'past':''}">${dlab(x.sp)}</td>${cell(A.id,x)}${cell(B.id,y)}<td class="num ${df>0?'up':df<0?'down':''}">${df?`+${Math.abs(df)} ${df>0?ab(A):ab(B)}`:'even'}</td></tr>`}).join('')}
    <tr class="tot"><td class="l">${L?'Starts left':'Starts'}</td><td class="num">${sA}</td><td class="num">${sB}</td><td class="num ${sA>sB?'up':sA<sB?'down':''}">${sA===sB?'even':`+${Math.abs(sA-sB)} ${sA>sB?ab(A):ab(B)}`}</td></tr>
    <tr><td class="l" data-tip="Starts scaled by how often each player is expected to play">${L?'Expected left':'Expected'}</td><td class="num">${eA.toFixed(1)}</td><td class="num">${eB.toFixed(1)}</td><td class="num ${eA-eB>=.05?'up':eB-eA>=.05?'down':''}">${Math.abs(eA-eB)<.05?'even':`+${Math.abs(eA-eB).toFixed(1)} ${eA>eB?ab(A):ab(B)}`}</td></tr></tbody></table></div>`;
  const who=(T,ds)=>{const R=rosterOf(T.id).filter(p=>p.pg).sort((x,y)=>y.prio-x.prio),groups=[];
    ds.forEach(dd=>{const l=groups[groups.length-1];if(!dd.playing&&l&&l.idle){l.last=dd;l.n++}else groups.push(dd.playing?{dd}:{idle:true,first:dd,last:dd,n:1})});
    return `<details class="inline"><summary>${tn(T)}: who starts each day</summary><div class="dmu-who">${groups.map(g=>{
      if(g.idle)return `<div class="idle ${g.last.sp<todaySP?'past':''}"><b>${g.n>1?`${dlab(g.first.sp)} – ${dlab(g.last.sp)}`:dlab(g.first.sp)}</b> <span class="note" style="display:inline">· no games</span></div>`;
      const dd=g.dd,st=R.filter(p=>dd.st.has(p.name)),bn=R.filter(p=>plays(p.nba,dd.sp)&&avail(p,w)>0&&!dd.st.has(p.name)),out=R.filter(p=>plays(p.nba,dd.sp)&&avail(p,w)===0);
      return `<div class="${dd.sp<todaySP?'past':''}"><b>${dlab(dd.sp)}</b><span>${st.length?st.map(p=>esc(short(p.name))).join(', '):'Nobody can start'}${bn.length?`<small>Bench (no open slot): ${bn.map(p=>esc(short(p.name))).join(', ')}</small>`:''}${out.length?`<small>Listed out: ${out.map(p=>esc(short(p.name))).join(', ')}</small>`:''}</span></div>`}).join('')}</div></details>`};
  const links=[isReal(A.id,B.id,w)?ghost(`data-go="matchup" data-week="${w}" data-wkteam="${A.id}"`,'Open in the Matchup tab'):'',
    ghost(`data-stat="${esc(`h2h|${A.id}|${B.id}`)}"`,'Roster v roster'),ghost(`data-stat="${esc(`tpo|${A.id}`)}"`,`${ab(A)} playoff odds`),ghost(`data-stat="${esc(`tpo|${B.id}`)}"`,`${ab(B)} playoff odds`)].join('');
  const h=`${ctxNote(A,B,w,o)}<div class="facts">${facts}</div>
    ${drillSec('Categories won',`How often ${ab(A)} ends the week with each number of category wins, out of 9.`,distChart(o,A,B)+distLine(o,A))}
    ${drillSec('Chance in each category',`${pab(A)} chance, sorted from safest to longest shot, with both projected totals. Tap one for the full picture.`,catChart(o,A,B))}
    ${drillSec('Swing categories','Where the week is likely to be decided.',swingCards(o,A,B,3))}
    ${drillSec(A.id===ME?'Your best move':'Best move',`The free agent who adds the most win chance for ${ab(A)}, run through this week's real schedule.`,lever(A.id,B.id,w,o,{answer:A.id===ME||B.id===ME}))}
    ${drillSec('Games, day by day',`Starts each day after the 11-slot daily limit. Orange days have more players with games than open slots. Expected scales the starts by how often each player is expected to play.${days.some(([x])=>x.sp<todaySP)?' Faded days are already played.':''}`,dayTbl+who(A,days.map(x=>x[0]))+who(B,days.map(x=>x[1])))}
    <div class="dmu-links">${links}</div>
    ${how([`Each team's week is built day by day from the real NBA schedule. On each day the players with games fill the 11 starting slots (PG, SG, SF, PF, C, G, F and four UTIL) in order of value, so extra games on a crowded day sit on the bench, as in ESPN's daily lineups. Each player's numbers are scaled by how often they are expected to play. Injuries count only in the near term: a player listed out sits the current week once it starts (before the season, their week-1 games are cut by 60%) and loses half their games the week after; a day-to-day player loses a quarter of the current week once it starts. Later weeks assume everyone is back.`,
      `Each category's chance compares the two projected totals with how much that category usually swings in a week: steals, blocks and the shooting percentages swing the most, points the least. The categories-won chart treats the nine categories as independent, which is an assumption (some move together, such as points and field goal attempts), and adds up every way they can split. Ties within a category (possible in small counts such as blocks) are not modelled.`,
      `"Settles the week" is the chance the other eight categories split 4-4, so this one decides it. The week's chance moves by exactly that much for each point of chance in the category. "Lean" means 62%, the board's Lean threshold; the amount needed holds everything else fixed, including the other team.`,
      `The best move adds each free agent in place of ${esc(dropFor(A.id))} (${A.id===ME?'your lowest-value player':'their lowest-value player across all nine categories'}), assumes the pickup is made before their first game of the week, and reruns the week. Other teams' moves are not modelled.`])}`;
  return {eyebrow:`${tn(A)} vs ${tn(B)}`,title:`${weekName(w)}: ${pc(o.win)} to win`,sub:`${weekLabel(w)} · ${o.exp.toFixed(1)}–${o.expL.toFixed(1)} ${L?'projected final':'expected'} categories`,back:`${A.abbr} v ${B.abbr} · ${wkShort(w)}`,html:h}};

/* ---------- mc: one category in that week ---------- */
DRILL.mc=(a,b,wk,k)=>{const A=TM(a),B=TM(b),w=WK(wk),c=CT(k);if(!A||!B||A.id===B.id||w==null||!c)return null;css();
  const o=mp(A.id,B.id,w),L=o.live,p=o.p[c.k],[tg,tcl]=tag(p),pv=pivots(o)[c.k],ga=o.da[c.k],gb=o.db[c.k],sa=Math.sqrt(ga.v),sb=Math.sqrt(gb.v),pal=PAL(A.id,B.id);
  // two percentages that would print the same get a fourth decimal, so a near tie still shows who leads
  const [tA,tB]=pairT(c,ga.m,gb.m,fmt1);
  const now=(cur)=>{if(!L||!cur)return null;const v=cur[c.k]??(c.pct?(cur[c.pct[1]]?cur[c.pct[0]]/cur[c.pct[1]]:null):null);return v};
  const nA=now(L&&L.ca),nB=now(L&&L.cb);
  const swingTxt=v=>c.pct?`±${f3(v)}`:`±${v>=10?v.toFixed(0):v.toFixed(1)}`;
  const projFact=(T,g,s,nw,stat)=>fact(`${esc(T.abbr)} projected`,T===A?tA:tB,`${c.pct?`on ${Math.round(g.A||0)} attempts · `:''}usually ${swingTxt(s)}${nw!=null?` · ${fmt1(c,nw)} so far`:''}`,stat);
  const facts=[fact(`Chance ${esc(A.abbr)} wins it`,pc(p),tg),projFact(A,ga,sa,nA,`tc|${A.id}|${c.k}`),projFact(B,gb,sb,nB,`tc|${B.id}|${c.k}`),
    fact('Settles the week',pc(pv.piv),`Week chance ${pc(pv.ifWon)} if ${esc(A.abbr)} wins it, ${pc(pv.ifLost)} if not (${pc(o.win)} now)`,`mw|${A.id}|${B.id}|${w}`)].join('');
  const fmtN=v=>c.pct?f3(v):Math.abs(v)>=100?v.toFixed(0):(Math.round(v*10)/10).toString();
  const range=sa>1e-6&&sb>1e-6?CH.normals([{m:ga.m,s:sa,name:A.abbr,cls:pal.A},{m:gb.m,s:sb,name:B.abbr,cls:pal.B}],{fmt:fmtN,rev:!!c.neg,label:`${c.n}: projected range for each team`}):'<div class="empty">One side has no games projected, so there is no range to draw.</div>';
  const flips=`<ul class="dmu-flip">${[['a',A],['b',B]].map(([s,T])=>{const n=leanNeed(o,c,s);if(!n)return '';
    const head=n.already?'Done':c.pct?`+${amt(n.makes)}`:c.neg?`−${amt(n.need)}`:`+${amt(n.need)}`;
    let body=n.already?`Already leans ${ab(T)} (${pc(s==='a'?p:1-p)}).`:c.pct?`${MADE[c.k]} for ${ab(T)} on the same attempts (${f3((s==='a'?ga:gb).m)} to ${f3((s==='a'?ga:gb).m+n.need)}) would make it lean their way.`
      :c.neg?`TO for ${ab(T)} this week (${amt(n.need)} fewer turnovers) would make it lean their way.`:`${c.l} for ${ab(T)} this week would make it lean their way.`;
    if(!n.already&&!c.pct&&!c.neg){const top=rosterOf(T.id).filter(q=>q.pg&&q.pg[c.k]>0).sort((x,y)=>y.pg[c.k]-x.pg[c.k])[0];
      if(top)body+=` That is about ${(n.need/top.pg[c.k]).toFixed(1)} extra games of ${esc(top.name)} (${top.pg[c.k].toFixed(1)} a game).`}
    return `<li><span>${head}</span><span>${body}</span></li>`}).join('')}</ul>`;
  const CA=contrib(A.id,o.Pa,w,c),CB=contrib(B.id,o.Pb,w,c);
  const rowsOf=(list,bc)=>{const s=[...list].sort((x,y)=>Math.abs(y.v)-Math.abs(x.v)),top=s.slice(0,6),rest=s.slice(6);
    const rows=top.map(x=>{const per=c.pct?`${f3(x.at?x.mk/x.at:null)} on ${(x.at/Math.max(x.g,1e-9)).toFixed(1)} a game`:`${x.p.pg[c.k].toFixed(1)} a game`;
      return {label:`${esc(x.p.name)}<small>${x.g.toFixed(1)} starts ${c.pct?`· ${f3(x.at?x.mk/x.at:null)} on ${(x.at/Math.max(x.g,1e-9)).toFixed(1)} ${c.l.replace('%','')}A`:`× ${x.p.pg[c.k].toFixed(1)}`} a game</small>`,v:x.v,txt:c.pct?sf1(x.v):x.v.toFixed(1),cls:c.pct?(x.v>=0?'pos':'neg'):bc,stat:`pc|${x.p.name}|${c.k}`,
        tip:c.pct?`${x.p.name}: ${x.mk.toFixed(1)} of ${x.at.toFixed(1)} expected (${per}) · ${sf1(x.v)} made shots against a league-average shooter`:`${x.p.name}: ${per} × ${x.g.toFixed(1)} expected starts = ${x.v.toFixed(1)} ${c.l}`}});
    const rv=sum(rest.map(x=>x.v));rows.rest=rest.length?` The other ${plural(rest.length,'player')} with starts add ${c.pct?sf1(rv)+' made shots against that line':rv.toFixed(1)+' '+c.l}.`:'';
    return rows};
  const RA=rowsOf(CA,pal.bA),RB=rowsOf(CB,pal.bB),mx=Math.max(1e-9,...[...RA,...RB].map(x=>Math.abs(x.v)));
  const bars=(T,rows)=>rows.length?'<div class="dmu-wide">'+CH.hbars(rows,{max:mx,center:!!c.pct,stack:true,label:`${T.name}: ${c.n} by player`})+'</div>':'<div class="empty">No starts projected.</div>';
  const sideSec=(T,P,list,rows)=>{const tot=c.pct?(()=>{const mk=sum(list.map(x=>x.mk)),at=sum(list.map(x=>x.at));return `${mk.toFixed(1)} made on ${at.toFixed(1)} ${c.l.replace('%','')}A expected${L?' in the games left':''} (${f3(at?mk/at:null)})`})():`${sum(list.map(x=>x.v)).toFixed(1)} ${c.l} expected${L?' in the games left':''}`;
    return drillSec(`${ab(T)}: ${c.neg?'who commits them':c.pct?'who moves it':'who supplies it'}`,`${tot}, from ${P.games.toFixed(1)} expected starts${P.bench?` (${plural(P.bench,'game')} benched)`:''}.${c.pct?' Bars show made shots above or below a league-average shooter on the same attempts.':''}${rows.rest}`,bars(T,rows))};
  const nav=`<div class="chips" role="group" aria-label="Other categories">${CATS.map(x=>`<button type="button" class="chip tchip" data-stat="${esc(`mc|${A.id}|${B.id}|${w}|${x.k}`)}" data-on="${x.k===c.k}" ${x.k===c.k?'aria-current="true"':''}>${x.l} <small>${pc(o.p[x.k])}</small></button>`).join('')}</div>`;
  const links=[ghost(`data-stat="${esc(`mw|${A.id}|${B.id}|${w}`)}"`,'The whole week'),ghost(`data-stat="${esc(`tc|${A.id}|${c.k}`)}"`,`${ab(A)} in ${c.l}`),ghost(`data-stat="${esc(`tc|${B.id}|${c.k}`)}"`,`${ab(B)} in ${c.l}`),ghost(`data-stat="${esc(`lc|${c.k}`)}"`,`${c.l} across the league`)].join('');
  const h=`${ctxNote(A,B,w,o)}<div class="facts">${facts}</div>
    ${drillSec('Range of outcomes',`Each curve is where that team's ${c.pct?c.n.toLowerCase()+' for the week':c.n.toLowerCase()+' total'} is likely to land${L?', counting what is already in':''}. The more they overlap, the closer the race.${c.neg?' Lower is better.':''}`,range)}
    ${drillSec('What flips it',`The amount each side needs for a lean (62%), with everything else as projected.`,flips)}
    ${sideSec(A,o.Pa,CA,RA)}${sideSec(B,o.Pb,CB,RB)}
    ${drillSec('Other categories this week','',nav)}
    <div class="dmu-links">${links}</div>
    ${how([`Each total is projected from the real NBA schedule and the daily 11-starter limit: a player's per-game numbers times their expected starts this week (games they start, scaled by how often they are expected to play).${L?' Once the week is under way, ESPN\'s live totals are added to the projection for the games left.':''}`,
      `The curves are normal ranges around each projection. "Usually" means within one typical swing, about two weeks in three. ${c.pct?'A percentage swings less as attempts pile up, so a high-volume team is steadier.':c.k==='pts'?'Points are the steadiest category.':'Smaller counting stats swing more, relative to their size.'} The chance is how often the ${c.neg?'lower':'higher'} total comes out on top, assuming the two teams' weeks are independent.`,
      `"Settles the week" is the chance that the other eight categories split 4-4. The week's chance moves by exactly that much for each point of chance here, so a close category that often settles the week is where an extra pickup pays off most.`,
      `"What flips it" holds both teams' ranges fixed and asks how far one total has to move for a 62% lean.${c.pct?' For a percentage, it counts extra made shots on the same attempts.':''}${!c.pct&&!c.neg?' The game count uses that team\'s best per-game producer in this category.':''}`])}`;
  return {eyebrow:`${tn(A)} vs ${tn(B)} · ${weekName(w)}`,title:`${nb(c.n)}: ${pc(p)}`,sub:`${ab(A)} ${tA} vs ${ab(B)} ${tB} projected · <span class="pill ${tcl}" style="margin:0">${tg}</span>`,back:`${c.l} · ${A.abbr} v ${B.abbr}`,html:h}};

/* ---------- Matchup lab panel on the Matchup tab ---------- */
PANELS.matchup.push((tid,opp,w)=>{const A=tm(+tid),B=tm(+opp);if(!A||!B||A.id===B.id||!PER[w])return '';css();
  const o=mp(A.id,B.id,w);
  return `<section class="panel" id="dmu-lab">${head('Matchup lab',`${weekName(w)} from ${ptn(A)} side: how the nine categories could split, where the week will be decided, and the one move that helps most.`,ghost(`data-stat="${esc(`mw|${A.id}|${B.id}|${w}`)}"`,'Full breakdown'))}
    <div class="cols">${drillSec('Categories won',`How often ${ab(A)} ends the week with each number of category wins.`,distChart(o,A,B)+distLine(o,A))}
      ${drillSec('Chance in each category','Sorted from safest to longest shot. Tap a category for both ranges and who supplies it.',catChart(o,A,B))}</div>
    <div class="cols">${drillSec('Swing categories','Where the week is likely to be decided.',swingCards(o,A,B,3))}
      ${drillSec(A.id===ME?'Your best move':'Best move',`The free agent who adds the most win chance for ${ab(A)} this week.`,lever(A.id,B.id,w,o,{answer:B.id===ME||A.id===ME}))}</div>
    ${how([`The categories-won chart turns the nine category chances into the chance of every final score, treating the categories as independent (an assumption: some move together). Five or more wins takes the week.`,
      `A swing category sits between 38% and 62%. "Settles the week" is the chance the other eight split 4-4, so that category decides it; the week's chance moves by that much for each point of chance in it.`,
      `The best move reruns the week with each free agent in place of ${esc(dropFor(A.id))}, on the days they would actually start, and keeps the one that raises the win chance most.${A.id===ME?' It ranks by win chance, not expected categories, so it can differ from the streamer table above.':''} The pickup is assumed to be made before their first game of the week; other teams' moves are not modelled.`])}</section>`});

/* ---------- search commands ---------- */
CMDS.push({label:'My matchup this week',sub:'Every way the categories can split, swing categories and the best move',kw:'matchup week odds swing streamer move categories won distribution',tag:'Drill',
  act:()=>{const w=Math.min(curWeek,REGW),o=oppOf(ME,w);if(curWeek>REGW||o==null){go('matchup');return}openStat(`mw|${ME}|${o}|${w}`)}});
CMDS.push({label:'My closest category this week',sub:'The swing category, its range and what flips it',kw:'swing toss-up close category flip lean',tag:'Drill',
  act:()=>{const w=Math.min(curWeek,REGW),o=oppOf(ME,w);if(curWeek>REGW||o==null){go('matchup');return}const s=swings(mp(ME,o,w))[0];openStat(`mc|${ME}|${o}|${w}|${s.c.k}`)}});

/* ---------- shared helpers for other modules (call at render time) ---------- */
LAB.matchPivots=(a,b,w)=>{const A=TM(a),B=TM(b),x=WK(w);return A&&B&&A.id!==B.id&&x!=null?pivots(mp(A.id,B.id,x)):null};
LAB.swingCats=(a,b,w)=>{const A=TM(a),B=TM(b),x=WK(w);return A&&B&&A.id!==B.id&&x!=null?swings(mp(A.id,B.id,x)).map(s=>({k:s.c.k,p:s.p,piv:s.piv,ifWon:s.ifWon,ifLost:s.ifLost})):null};
LAB.leanNeed=(a,b,w,k,side='a')=>{const A=TM(a),B=TM(b),x=WK(w),c=CT(k);return A&&B&&A.id!==B.id&&x!=null&&c?leanNeed(mp(A.id,B.id,x),c,side):null};
LAB.bestStream=(a,b,w)=>{const A=TM(a),B=TM(b),x=WK(w);if(!A||!B||A.id===B.id||x==null)return null;const R=rankedStreams(A.id,B.id,x),r=R.rows[0];
  return r?{name:r.f.name,drop:R.drop,dWin:r.dWin,dExp:r.dExp,games:r.games,win:r.o.win}:null};
})();
