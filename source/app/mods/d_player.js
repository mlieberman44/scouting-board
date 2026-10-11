/* d_player.js: player drill-downs and the "Fantasy profile" panel on the player sheet.
   pc|name|cat   one player in one category        pv|name   fantasy value breakdown
   ptv|name      trade value breakdown              pgm|name  games outlook
   Registers only at load; everything is computed at render time. Shared helpers: LAB.similarPlayers, LAB.playerCatPctl. */
(()=>{
const NS='d_player';
window.LAB=window.LAB||{};

/* ---------- styles: injected on first render, theme tokens only ---------- */
const CSS=`
.dp-lead{margin:0;font-size:.92rem;line-height:1.5;max-width:72ch}
.dp-lead b{font-weight:600}
.dp-acts{display:flex;flex-wrap:wrap;gap:8px}
.legend .dp-pos{background:var(--pos-3)}.legend .dp-neg{background:var(--neg-3)}.legend .dp-dn{background:var(--neg-2)}
.legend .dp-mut{background:var(--muted);opacity:.35}.legend .dp-po{background:var(--soft);border:1px solid var(--line)}
.legend .dp-avg{width:14px;height:2px;border-radius:0;vertical-align:3px;background:var(--ink)}
.legend .dp-iso{width:14px;height:2px;border-radius:0;vertical-align:3px;background:var(--s1)}
.legend .dp-md{width:14px;height:0;border-radius:0;vertical-align:3px;border-top:1.5px dashed var(--muted)}
.hb-b i.dp-oth{background:var(--muted);opacity:.55}.hb-b i.dp-pz{background:var(--muted);opacity:.3}.hb-b i.dp-pzn{background:var(--muted);opacity:.3;border-radius:4px 0 0 4px}
.dp-sky{display:grid;grid-template-columns:repeat(9,minmax(0,1fr));gap:4px}
.dp-col{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:0;padding:6px 0 4px;border-radius:8px;cursor:pointer;font:inherit;color:inherit;min-width:0}
.dp-col:hover{background:var(--soft)}
.dp-col.punted{opacity:.4}
.dp-trk{position:relative;display:block;width:100%;max-width:30px;height:58px;background:var(--soft);border-radius:4px;overflow:hidden}
.dp-trk::after{content:"";position:absolute;left:0;right:0;bottom:50%;border-top:1px dashed var(--muted);opacity:.7}
.dp-trk i{position:absolute;left:0;right:0;bottom:0;border-radius:4px 4px 0 0}
.dp-col b{font:700 1.05rem/1 var(--display);font-variant-numeric:tabular-nums}
.dp-col span.l{font:600 .7rem var(--body);letter-spacing:.04em;color:var(--muted);white-space:nowrap}
.dp-sim{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dp-sim .fact b{font:600 .95rem/1.25 var(--body);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dp-sim .fact small{white-space:normal}
.dp-sc{max-width:540px;width:100%}
.dp-sc .ch text{font-size:12px}
.ch .dp-iso{stroke-width:1.5}
.dp-gm{display:flex;flex-direction:column;gap:4px;min-width:0}
.dp-gplot{position:relative;height:112px;margin-left:18px}
.dp-gl{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--grid)}
.dp-gl span{position:absolute;left:-18px;top:-.62em;width:14px;text-align:right;font:500 .64rem/1 var(--mono);color:var(--muted)}
.dp-gcols,.dp-gx{display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));gap:2px}
.dp-gcols{position:absolute;inset:0}
.dp-gc{position:relative;display:block;height:100%;background:none;border:0;padding:0;margin:0;border-radius:3px;font:inherit;color:inherit;min-width:0}
.dp-gc.po{background:var(--soft)}
button.dp-gc{cursor:pointer}button.dp-gc:hover{box-shadow:inset 0 0 0 1px var(--line);background:var(--soft)}
.dp-gc i{position:absolute;left:16%;right:16%;bottom:0;border-radius:3px 3px 0 0}
.dp-gc i.up{background:var(--pos-3)}.dp-gc i.dn{background:var(--neg-2)}.dp-gc i.eq{background:var(--muted);opacity:.55}
.dp-gc u{position:absolute;left:2%;right:2%;height:2px;margin-bottom:-1px;background:var(--ink);text-decoration:none}
.dp-gc.past{opacity:.4}
.dp-gx{margin-left:18px;font:500 .62rem/1.2 var(--mono);color:var(--muted);text-align:center}
.dp-gx span{min-width:0;overflow:hidden}
.dp-gx span.po{color:var(--ink);font-weight:600}
.dp-tiers{display:flex;flex-wrap:wrap;gap:6px}
.dp-tiers .pill{margin:0;opacity:.55}
.dp-tiers .pill.on{opacity:1;box-shadow:0 0 0 1.5px var(--ink)}
.dp-strip .ch text{font-size:11px}
.dp-wl .hb-r{grid-template-columns:minmax(0,13em) minmax(0,1fr) 4.2em}
.dp-f3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dp-note{margin-top:6px!important}
.dp-sc .ch text.halo{paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round}
.dp-f6{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.dp-t.dense th,.dp-t.dense td{padding:6px 5px}.dp-t.dense td.z{font-size:.76rem}
.dp-t td.nm{max-width:13em}
.dp-t td.nm small.b{white-space:normal}
.dp-stk{display:flex;align-items:center;gap:10px}
.dp-stk-b{flex:1;display:flex;gap:2px;height:18px;background:var(--soft);border-radius:4px;overflow:hidden;min-width:0}
.dp-stk-b span{height:100%}.dp-stk-b span:last-child{border-radius:0 4px 4px 0}
.dp-stk-b .s1{background:var(--s1)}.dp-stk-b .s2{background:var(--s2)}.dp-stk-b .s3{background:var(--s3)}
.dp-stk>b{font:700 1.5rem/1 var(--display);font-variant-numeric:tabular-nums}.dp-stk>b small{font:500 .75rem var(--body);color:var(--muted);margin-left:2px}
.dp-t td.wrap{white-space:normal;min-width:9em}
.dp-t td small.b{display:block;color:var(--muted);font-size:.72rem}
@media (max-width:560px){.dp-sim{grid-template-columns:1fr}.dp-f6{grid-template-columns:repeat(2,minmax(0,1fr))}.dp-strip .ch text{font-size:17px}
.dp-wl .hb-r{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) 3.4em}
.dp-t th,.dp-t td{padding:7px 6px}.dp-t td.wrap{min-width:7.5em}.dp-t th{white-space:normal}
.dp-f3{grid-template-columns:1fr;gap:6px}.dp-f3 .fact{display:grid;grid-template-columns:minmax(0,1fr) auto;column-gap:12px;align-items:center}
.dp-f3 .fact span,.dp-f3 .fact small{grid-column:1}.dp-f3 .fact b{grid-column:2;grid-row:1/span 2}.dp-sky{gap:2px}.dp-col span.l{font-size:.64rem;letter-spacing:0}.dp-gx{font-size:.56rem}}
`;
function css(){if(document.getElementById('dp-css'))return;const s=document.createElement('style');s.id='dp-css';s.textContent=CSS;document.head.appendChild(s)}

/* ---------- small helpers ---------- */
const r1=x=>Math.round(x*10)/10;
const sd3=x=>x==null||!isFinite(x)?'–':(x>=0?'+':'-')+Math.abs(x).toFixed(3).replace(/^0/,'');
const SHOT={fg:['shots','FGA','field goals'],ft:['free throws','FTA','free throws'],tp:['3-pointers','3PA','3-pointers']};
const MINA={fg:2,ft:1,tp:1};
const VERB={pts:['scores','points'],reb:['grabs','rebounds'],ast:['hands out','assists'],stl:['records','steals'],blk:['blocks','shots'],to:['commits','turnovers']};
const tAbbr=p=>p.team&&teamById[p.team]?teamById[p.team].abbr:'FA';
const tName=p=>p.team&&teamById[p.team]?teamById[p.team].name:'Free agent';
const nbaS=p=>!p.nba||p.nba==='?'?'Unsigned':p.nba;
const subOf=p=>`${esc(tName(p))} · ${esc(nbaS(p))} · ${esc(p.pos)}${pills(p)}`;
const plist=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const above=(arr,v)=>arr.filter(x=>x>v+1e-12).length;
// share of rostered values a player beats; insiders use the core's pctl (ties half, self excluded)
const beat=(arr,v,inside)=>inside?pctl(arr,v):arr.filter(x=>x<v-1e-12).length/Math.max(1,arr.length);
const pctTxt=s=>Math.round(Math.max(0,Math.min(1,s))*100)+'%';
const pcls=s=>s>=.85?'p3':s>=.65?'p2':s>=.5?'p1':s<=.15?'n3':s<=.35?'n2':'n1';
const descr=(type,...a)=>[type,...a].join('|');
const ptsTxt=d=>{const n=Math.round(d*100);return (n>0?'+':'')+n+(Math.abs(n)===1?' pt':' pts')};
const art=c=>/^(FG|FT|AST)/.test(c.l)?'an':'a';
// raw category value the model ranks on: per game, or impact = (their % - league %) x attempts for percentages
function rawOf(ln,c){if(!ln)return null;if(c.pct){const a=ln[c.pct[1]];return a?(ln[c.pct[0]]/a-M.lg[c.k])*a:0}return ln[c.k]??null}
function zLine(ln,c){const r=rawOf(ln,c);if(r==null||!isFinite(r))return null;const z=(r-M.st[c.k].m)/M.st[c.k].s;return c.neg?-z:z}
const projLabel=p=>p.src&&p.src.startsWith('ESPN')?(p.cur?'Projection (with season)':'ESPN projection'):p.team?'Projection':'2025-26 stats';
const srcTxt=p=>p.team===0?'their 2025-26 per-game stats (free agents are not in ESPN\'s projection feed)':p.src&&p.src.startsWith('ESPN')?'ESPN\'s 2026-27 projection'+(p.cur?', blended with the season so far':''):p.src==='2025-26 actual'?'their 2025-26 per-game stats (no ESPN projection could be read)':'a hand estimate ('+esc(p.src||'no source')+')';
const legend=items=>`<div class="legend">${items.map(([cls,l])=>`<span><i class="${cls}"></i>${l}</span>`).join('')}</div>`;
const actBtn=(d,l)=>`<button type="button" class="btn sm ghost" ${sx(d)}>${l}</button>`;
const noData=(p,what)=>`<div class="empty">No projection or stats for ${esc(p.name)} yet, so there is no ${what} to break down.</div>`;

/* ---------- memoized tables (once per model state) ---------- */
const catTab=k=>memo(NS+'.cat.'+k,()=>{const R=M.players.filter(p=>p.pg),A=M.all.filter(p=>p.pg);
  return {R,A,zr:R.map(p=>p.zpg[k]),za:A.map(p=>p.zpg[k])}});
// value in your build, per game and over a full season (projected games / average games), for every rostered player
const valTab=()=>memo(NS+'.val',()=>{const ks=CATS.filter(c=>!S.punt.has(c.k)).map(c=>c.k),R=M.players.filter(p=>p.pg);
  const pg=q=>q.pg?ks.reduce((s,k)=>s+q.zpg[k],0):null,fs=q=>q.pg?pg(q)*(q.gp||0)/M.avgGp:null;
  return {pg,fs,R,pgArr:R.map(pg),fsArr:R.map(fs),vArr:R.map(q=>q.value)}});
const valRank=p=>p.team>0&&p.rank?p.rank:(p.value==null?null:1+M.players.filter(q=>q.value!=null&&q.value>p.value+1e-12).length);
const tvRank=p=>p.tvRank??(1+M.players.filter(q=>q.tv>p.tv+1e-12).length);
// nearest neighbours in nine-category per-game z space (rostered and free agents)
const similar=name=>memo(NS+'.nn.'+name,()=>{const p=findP(name);if(!p||!p.pg)return [];
  return M.all.filter(q=>q.pg&&q!==p).map(q=>{let s=0;const diff=CATS.map(c=>{const d=q.zpg[c.k]-p.zpg[c.k];s+=d*d;return [c,d]});
    return {p:q,d:Math.sqrt(s),rms:Math.sqrt(s/CATS.length),diff}}).sort((a,b)=>a.d-b.d).slice(0,8)});
const diffTxt=s=>{const big=s.diff.filter(x=>Math.abs(x[1])>=.35).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,2);
  if(!big.length)return 'Nearly the same in every category';
  return big.map(([c,d])=>c.neg?(d>0?'fewer TO':'more TO'):c.pct?(d>0?'better '+c.l:'worse '+c.l):(d>0?'more ':'fewer ')+c.l).join(', ').replace(/^./,m=>m.toUpperCase())};
const nbaTeams=()=>memo(NS+'.nba',()=>typeof PLAY==='object'&&PLAY&&Object.keys(PLAY).length?Object.keys(PLAY):[...new Set(M.all.map(q=>q.nba).filter(x=>x&&x!=='?'))]);
// games for every NBA team in every fantasy week, and the league averages built from them
const gamesTab=()=>memo(NS+'.games',()=>{const T=nbaTeams(),by={},avg={};T.forEach(t=>by[t]=WEEKS.map(w=>gamesIn(t,w)));
  WEEKS.forEach((w,i)=>avg[w]=mean(T.map(t=>by[t][i])));
  const reg=WEEKS.map((w,i)=>[w,i]).filter(([w])=>w<=REGW&&(preseason||w>=curWeek));
  const n4=t=>reg.filter(([,i])=>by[t][i]>=4).length,n2=t=>reg.filter(([,i])=>by[t][i]<=2).length,po=t=>WEEKS.reduce((s,w,i)=>s+(w>REGW?by[t][i]:0),0);
  return {T,by,avg,n4avg:mean(T.map(n4)),n2avg:mean(T.map(n2)),poAvg:mean(T.map(po)),poAll:T.map(po)}});

// this week's matchup for the player's fantasy team with and without them (a free agent is swapped onto your team for your lowest-value player)
const weekSwing=p=>{if(!p.pg)return null;const w=Math.min(curWeek,REGW),tid=p.team>0?p.team:ME,opp=oppOf(tid,w);if(opp==null)return null;
  return memo(NS+'.sw.'+p.name,()=>{const base=mp(tid,opp,w),L=base.live,ro=rosterOf(tid),drop=p.team>0?null:dropDefault(ME);
    const alt=p.team>0?ro.filter(q=>q!==p):[...ro.filter(q=>q.name!==drop),p],P=weekProj(alt,w,L?L.fromSP:0),pr=catProbs(catDist(P,L&&L.ca),base.db),o=matchOdds(pr);
    const other={p:pr,exp:o.exp,win:o.win},cur={p:base.p,exp:base.exp,win:base.win};
    return {w,tid,opp,drop,games:gamesIn(p.nba,w,L?L.fromSP:0),live:!!L,with:p.team>0?cur:other,without:p.team>0?other:cur}})};
window.LAB.weekSwing=n=>{const p=findP(n);return p?weekSwing(p):null};
window.LAB.similarPlayers=(name,n=3)=>similar(name).slice(0,n).map(s=>({name:s.p.name,team:s.p.team,gap:s.rms,diff:diffTxt(s)}));
window.LAB.playerCatPctl=(name,k)=>{const p=findP(name),c=catOf(k);if(!p||!c||!p.pg)return null;const T=catTab(k),z=p.zpg[k];
  return {z,rank:1+above(T.zr,z),n:T.R.length,pctl:beat(T.zr,z,p.team>0)}};

/* ---------- pc: one player in one category ---------- */
function shotChart(p,c){const [mk,ak]=c.pct,lg=M.lg[c.k],k=c.k,minA=MINA[k],onR=p.team>0;
  const pool=[...M.players.filter(q=>q.pg),...(onR?[]:[p])].filter(q=>q.pg[ak]>=minA);
  if(pool.length<5)return '';
  const pts=pool.map(q=>{const y=q.pg[mk]/q.pg[ak];return {q,x:q.pg[ak],y,imp:(y-lg)*q.pg[ak]}});
  const W=440,H=262,pl=42,pr=14,pt=18,pb=38,me=pts.find(d=>d.q===p);
  const ys=pts.map(d=>d.y).sort((a,b)=>a-b),qt=f=>ys[Math.round(f*(ys.length-1))];
  let y0=Math.min(qt(.03),lg,me?me.y:lg),y1=Math.max(qt(.97),lg,me?me.y:lg);const py=(y1-y0)*.08||.02;y0-=py;y1+=py;
  const x1=Math.max(...pts.map(d=>d.x))*1.05,X=x=>pl+x/x1*(W-pl-pr),Y=y=>pt+(1-(Math.max(y0,Math.min(y1,y))-y0)/(y1-y0))*(H-pt-pb);
  const yt=CH.ticks(y0,y1,4).filter(v=>v>=y0&&v<=y1),xt=CH.ticks(0,x1,5).filter(v=>v<=x1);
  let iso='';
  if(me&&Math.abs(me.imp)>.02){const I=me.imp,xa=Math.max(.05,I>0?I/(y1-lg):I/(y0-lg)),q=[];
    for(let i=0;i<=60;i++){const x=xa+(x1-xa)*i/60,y=lg+I/x;if(y>=y0-1e-9&&y<=y1+1e-9)q.push(r1(X(x))+','+r1(Y(y)))}
    if(q.length>1){iso=`<polyline class="ln s1 dp-iso" points="${q.join(' ')}" data-tip="${esc(`Every point on this curve has the same impact as ${p.name}: ${f2(I)} makes a game`)}"/>`;
}}
  const ord2=[...pts].sort((a,b)=>(a.q===p)-(b.q===p)||(a.q.team===ME)-(b.q.team===ME));
  const dots=ord2.map(d=>{const hi=d.q===p,cl=hi?'hi':d.q.team===ME?'me':'';
    return `<circle class="dot ${cl}" cx="${r1(X(d.x))}" cy="${r1(Y(d.y))}" r="${hi?6:4}" data-tip="${esc(`${d.q.name} (${tAbbr(d.q)}) · ${f3(d.y)} on ${d.x.toFixed(1)} ${SHOT[k][1]} · impact ${f2(d.imp)}`)}"${hi?'':` ${sx(descr('pc',d.q.name,k))}`}/>`}).join('');
  const clipped=pts.filter(d=>d.y<y0||d.y>y1).length;
  return `<div class="chwrap dp-sc"><svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.l+' against attempts for every rostered player')}">
    ${yt.map(v=>`<line class="gr" x1="${pl}" x2="${W-pr}" y1="${r1(Y(v))}" y2="${r1(Y(v))}"/><text x="${pl-6}" y="${r1(Y(v)+4)}" text-anchor="end">${f3(v)}</text>`).join('')}
    ${xt.map(v=>`<text x="${r1(X(v))}" y="${H-pb+16}" text-anchor="middle">${v}</text>`).join('')}
    <line class="ax" x1="${pl}" x2="${W-pr}" y1="${H-pb}" y2="${H-pb}"/>
    <line class="md" x1="${pl}" x2="${W-pr}" y1="${r1(Y(lg))}" y2="${r1(Y(lg))}"/><text class="halo" x="${pl+4}" y="${r1(Y(lg)-5)}">league ${f3(lg)}</text>
    ${iso}${dots}
    <text x="${r1((pl+W-pr)/2)}" y="${H-4}" text-anchor="middle">${SHOT[k][1]} a game</text><text x="${pl-36}" y="${pt-6}">${c.l}</text></svg>
    ${legend([['hi',esc(p.name)],...(pts.some(d=>d.q!==p&&d.q.team===ME)?[['me',p.team===ME?'Your other players':'Your players']]:[]),['dp-mut','Other rostered'],...(iso?[['dp-iso','Same impact as them']]:[]),['dp-md','League average']])}
    ${clipped?`<p class="note dp-note">${clipped} low-volume shooter${clipped>1?'s sit':' sits'} beyond the edge and ${clipped>1?'are':'is'} pinned to it.</p>`:''}</div>`}

function shootSec(p,c,T){const [mk,ak]=c.pct,k=c.k,lg=M.lg[k],m=p.pg[mk],a=p.pg[ak],pct=a?m/a:null,imp=rawOf(p.pg,c),onR=p.team>0,N=T.R.length;
  const minA=MINA[k],qual=T.R.filter(q=>q.pg[ak]>=minA);
  const rkPct=pct==null||a<minA?null:1+qual.filter(q=>q.pct[k]>pct+1e-12).length,rkAtt=1+T.R.filter(q=>q.pg[ak]>a+1e-12).length,rkImp=1+above(T.zr,p.zpg[k]);
  if(!a)return drillSec('Shooting, and why volume matters','',`<p class="note">They don't attempt ${SHOT[k][0]}, so they add nothing to a team's makes or attempts. ${c.l} is neutral for them: impact 0, which sits near the middle of the league because the average impact is 0 by definition. ${T.R.filter(q=>(q.pg[ak]||0)<MINA[k]).length} of ${N} rostered players take fewer than ${MINA[k]} ${SHOT[k][1]} a game.</p>`);
  const facts=`<div class="facts">${fact('Makes / attempts',`${m.toFixed(1)} / ${a.toFixed(1)}`,`a game · ${ord(rkAtt)} in ${SHOT[k][1]}`)}${fact('Percentage',pct==null?'–':f3(pct),`league ${f3(lg)} (${pct==null?'no attempts':sd3(pct-lg)})`)}${fact('Impact',f2(imp),'makes a game above an average shooter')}${fact('Rank by impact',`#${rkImp}`,`of ${N}${rkPct?` · #${rkPct} of ${qual.length} by % alone`:''}`)}</div>`;
  // why volume matters, with this league's numbers
  const TA=mean(M.teams.map(t=>t.roster.reduce((s,q)=>s+(q.pg?q.pg[ak]:0),0)));
  const tp=M.teams.map(t=>t.line[k]).filter(v=>v!=null&&isFinite(v)).sort((x,y)=>y-x),gap15=tp.length>=5?tp[0]-tp[4]:null;
  const out=[];
  if(!a)out.push(`They don't attempt ${SHOT[k][0]}, so ${c.l} is neutral for them: they can't help or hurt a fantasy team's ${c.l}.`);
  else{
    out.push(`A team's ${c.l} is its total makes divided by its total attempts, so every shot counts the same no matter who takes it. That is why the board ranks shooting by <b>impact</b>: (their % − league %) × attempts, the extra makes a game compared with a league-average shooter on the same volume.`);
    if(imp>.03){const cand=qual.filter(q=>q!==p&&q.pct[k]>pct+.005&&(q.pct[k]-lg)*q.pg[ak]<imp-.02).sort((x,y)=>y.pct[k]-x.pct[k])[0];
      if(cand)out.push(`Compare ${sbtn(descr('pc',cand.name,k),esc(cand.name))}: a better ${f3(cand.pct[k])}, but on only ${cand.pg[ak].toFixed(1)} ${SHOT[k][1]}, so they add ${f2((cand.pct[k]-lg)*cand.pg[ak])} makes a game, less than ${esc(p.name)}'s ${f2(imp)}.`);
      else out.push(`Few players combine this accuracy with this much volume, which is what makes ${esc(p.name)}'s ${c.l} valuable.`)}
    else if(imp<-.03){const lowA=Math.max(.5,a/3);out.push(`Volume cuts both ways: at ${a.toFixed(1)} ${SHOT[k][1]} a game, a ${f3(pct)} shooter costs ${f2(imp)} makes. The same ${f3(pct)} on ${lowA.toFixed(1)} attempts would cost only ${f2((pct-lg)*lowA)}.`)}
    else out.push(`Their percentage is close to league average, so they barely move a team's ${c.l} either way, however many they take.`);
    if(TA>0)out.push(`A fantasy roster here takes about ${TA.toFixed(0)} ${SHOT[k][1]} a game in total, so ${f2(imp)} makes moves a team's ${c.l} by about ${sd3(imp/TA)}${gap15!=null?`. For scale, ${f3(gap15).replace(/^-/,'')} separates the 1st and 5th teams in ${c.l}`:''}.`)}
  return drillSec('Shooting, and why volume matters','',`${facts}${a?shotChart(p,c):''}${out.map(t=>`<p class="note">${t}</p>`).join('')}`)}

function teamSec(p,c){const k=c.k,z=p.zpg[k],me=tm(ME);
  if(p.team>0){const t=tm(p.team);if(!t)return '';const ro=t.roster.filter(q=>q.pg),rkIn=1+ro.filter(q=>q.zpg[k]>z+1e-12).length;
    const without=ranksOf(lineOf(ro.filter(q=>q!==p)),t.id)[k],now=t.catRank[k];let txt;
    if(c.pct){const [mk,ak]=c.pct,TM=ro.reduce((s,q)=>s+q.pg[mk],0),TA=ro.reduce((s,q)=>s+q.pg[ak],0),m=p.pg[mk],a=p.pg[ak];
      const pw=TA?TM/TA:null,po=TA-a>0?(TM-m)/(TA-a):null;
      txt=`They take ${pctTxt(TA?a/TA:0)} of the team's ${SHOT[k][1]} and make ${pctTxt(TM?m/TM:0)} of its ${SHOT[k][2]}. ${pw!=null&&po!=null?`With them the roster shoots ${f3(pw)}; without them, ${f3(po)}.`:''}`}
    else{const tot=ro.reduce((s,q)=>s+q.pg[k],0);txt=`${esc(p.name)} ${c.neg?'commits':'supplies'} ${pctTxt(tot?p.pg[k]/tot:0)} of the team's ${c.neg?'turnovers':VERB[k][1]} (per game, whole roster).`}
    const rankTxt=without===now?`Without them the team would still rank #${now} in ${c.l}.`:`Without them the team would rank <b>#${without}</b> in ${c.l} instead of #${now}${c.neg&&without<now?' (fewer turnovers, but you lose everything else they do)':''}.`;
    const ws=weekSwing(p),wf=ws?fact(`${weekName(ws.w)}: ${c.l} win chance`,pc(ws.with.p[k]),`${pc(ws.without.p[k])} without them · vs ${esc(teamById[ws.opp].abbr)}`,descr('mc',ws.tid,ws.opp,ws.w,k)):'';
    return drillSec(`On ${esc(t.name)}`,'',`<div class="${wf?'dp-f3':'facts'}">${fact(`Rank on the roster`,`#${rkIn}`,`of ${ro.length} in ${c.l}`)}${fact(`Team rank in ${c.l}`,`#${now}`,`of 10${without!==now?` · #${without} without them`:''}`,descr('tc',t.id,k))}${wf}</div><p class="note">${txt} ${rankTxt}</p><div class="dp-acts">${actBtn(descr('tc',t.id,k),`${esc(t.abbr)} in ${c.l}`)}</div>`)}
  // free agent: what adding them to your roster does to your rank
  const drop=dropDefault(ME),kept=me.roster.filter(q=>q.name!==drop),rk=ranksOf(lineOf([...kept,p]),ME)[k],now=me.catRank[k],ws=weekSwing(p);
  return drillSec('If you add them','',`${ws?`<div class="facts">${fact(`Your ${c.l} rank`,`#${rk}`,`now #${now}`,descr('tc',ME,k))}${fact(`${weekName(ws.w)}: ${c.l} win chance`,pc(ws.with.p[k]),`now ${pc(ws.without.p[k])} · vs ${esc(teamById[ws.opp].abbr)}`,descr('mc',ME,ws.opp,ws.w,k))}</div>`:''}<p class="note">${drop!=='none'?`Swapping them in for ${esc(drop)} (your lowest-value player)`:'Adding them'} would ${rk<now?`lift your ${c.l} rank from #${now} to <b>#${rk}</b>`:rk>now?`drop your ${c.l} rank from #${now} to <b>#${rk}</b>`:`leave your ${c.l} rank at #${now}`}, with every other roster as it is.</p><div class="dp-acts">${actBtn(descr('tc',ME,k),`Your team in ${c.l}`)}<button type="button" class="btn sm ghost" data-go="waivers">Waivers</button></div>`)}

function linesSec(p,c,T){const k=c.k,L=[[projLabel(p),p.pg,p.gp],['Season so far',p.cur,p.cur&&p.cur.gp],['Last 15 days',p.rec,p.rec&&p.rec.gp],['2025-26',p.last,p.last&&p.last.gp]].filter(x=>x[1]);
  const rows=L.map(([lab,ln,gp])=>{const z=zLine(ln,c),v=catV(ln,c),sh=z==null?null:beat(T.zr,z,false);
    const sub=[gp!=null?Math.round(gp)+' GP':'',c.pct&&ln[c.pct[1]]!=null?`${(+ln[c.pct[0]]).toFixed(1)}/${(+ln[c.pct[1]]).toFixed(1)} ${SHOT[k][1]}`:''].filter(Boolean).join(' · ');
    return `<tr><td class="l wrap"><b>${lab}</b><small class="b">${sub}</small></td><td class="num">${fmtC(c,v)}</td>${c.pct?`<td class="num">${f2(rawOf(ln,c)||0)}</td>`:''}<td class="z ${z==null?'':zc(z)}">${z==null?'–':f2(z)}</td><td class="num">${sh==null?'–':ord(Math.max(1,Math.min(99,Math.round(sh*100))))}</td></tr>`}).join('');
  const heads=`<th scope="col">${c.l}</th>${c.pct?'<th scope="col" title="Makes a game above an average shooter">Impact</th>':''}`;
  const pv=catV(p.pg,c),cmp=[];
  if(p.cur&&catV(p.cur,c)!=null&&pv!=null){const d=catV(p.cur,c)-pv,tiny=Math.abs(d)<(c.pct?.003:.15);cmp.push(`So far they're at ${fmtC(c,catV(p.cur,c))}, ${tiny?'right on the projection':`${c.pct?f3(Math.abs(d)):Math.abs(d).toFixed(1)} ${(c.neg?d<0:d>0)?'better':'worse'} than the projection`}.`)}
  if(p.rec&&catV(p.rec,c)!=null&&pv!=null){const d=catV(p.rec,c)-pv;cmp.push(`Over the last 15 days: ${fmtC(c,catV(p.rec,c))} (${(c.neg?d<0:d>0)?'running hot':Math.abs(d)<(c.pct?.01:.5)?'on track':'running cold'}).`)}
  if(!p.cur&&!p.rec)cmp.push(preseason?'Season-so-far and last-15-day lines appear here once games start on Oct 20.':'Season-so-far and last-15-day lines appear once they play.');
  return drillSec('Projection and real games',`Percentile compares each line with the rostered players' projections.`,`<div class="scroll"><table class="dp-t"><thead><tr><th class="l" scope="col">Line</th>${heads}<th scope="col">z</th><th scope="col" title="Percentile among rostered projections">Pctl</th></tr></thead><tbody>${rows}</tbody></table></div><p class="note">${cmp.join(' ')}</p>`)}

function topSec(p,c,T){const k=c.k,top=[...T.A].sort((a,b)=>b.zpg[k]-a.zpg[k]),i=top.indexOf(p),ten=top.slice(0,10);
  const title=c.neg?'Fewest turnovers':c.pct?`Best ${c.l} by impact`:`Top 10 in ${c.l}`,note=c.neg?'Rostered and free agents. Low-usage players lead here and stars turn it over more, which is why TO is a common punt.':'Rostered and free agents. Tap a row for that player.';
  if(c.pct){const [mk,ak]=c.pct,row=(q,n)=>`<tr class="click ${q===p?'sel':q.team===ME?'me':''}" ${sx(descr('pc',q.name,k))} tabindex="0"><td class="num">${n}</td><td class="l wrap">${esc(q.name)}<small class="b">${esc(tAbbr(q))} · ${q.pg[mk].toFixed(1)}/${q.pg[ak].toFixed(1)} ${SHOT[k][1]}</small></td><td class="num">${fmtC(c,catV(q.pg,c))}</td><td class="num"><b>${f2(rawOf(q.pg,c))}</b></td></tr>`;
    return drillSec(title,note,`<div class="scroll"><table class="dp-t"><thead><tr><th scope="col">#</th><th class="l" scope="col">Player</th><th scope="col">${c.l}</th><th scope="col">Impact</th></tr></thead><tbody>${ten.map((q,n)=>row(q,n+1)).join('')}${i>=10?row(p,i+1):''}</tbody></table></div>`)}
  const row=(q,n)=>({label:`${n}. ${esc(q.name)}<small>${esc(tAbbr(q))}</small>`,v:q.pg[k],hi:q===p,me:q.team===ME&&q!==p,stat:descr('pc',q.name,k),tip:`${q.name} (${tAbbr(q)}): ${q.pg[k].toFixed(1)} ${c.l} a game, z ${f2(q.zpg[k])}`});
  const rows=ten.map((q,n)=>row(q,n+1));if(i>=10)rows.push(row(p,i+1));
  const hasMe=rows.some(r=>r.me);
  return drillSec(title,note,`<div class="dp-wl">${CH.hbars(rows,{label:title,fmt:v=>v.toFixed(1),max:Math.max(...rows.map(r=>r.v))})}</div>`+legend([['hi',esc(p.name)],...(hasMe?[['me','Your players']]:[]),['mut','Others']]))}

function puntSec(p,c,T){const k=c.k,punted=S.punt.has(k),R=T.R.filter(q=>q.value!=null);if(p.value==null)return '';
  const alt=q=>punted?q.value+q.z[k]:q.value-q.z[k],va=alt(p),rkNow=valRank(p),rkAlt=1+R.filter(q=>q!==p&&alt(q)>va+1e-12).length;
  const z=p.z[k],move=rkNow-rkAlt,me=tm(ME),w=p.team>0?'':'would be ';
  const facts=`<div class="facts">${fact(punted?`Now (punting ${c.l})`:'Value now',f1(p.value),`${w}#${rkNow} of ${R.length}`,descr('pv',p.name))}${fact(punted?`Counting ${c.l} again`:`If you punt ${c.l}`,f1(va),`${w}#${rkAlt} · ${move>0?'up '+move:move<0?'down '+(-move):'no change'}`)}</div>`;
  const why=punted?`You're punting ${c.l}, so it's left out of every player's value. Counting it again ${z>=0?'adds':'subtracts'} ${f2(Math.abs(z))} for ${esc(p.name)}.`
    :`Their ${c.l} is ${z>=.15?`a strength worth ${f2(z)}`:z<=-.15?`a drag of ${f2(z)}`:`close to neutral (${f2(z)})`}, and a punt takes it out of their value${Math.abs(z)<.15?', so their own number barely changes':''}. ${move?`They ${move>0?'climb':'slip'} ${Math.abs(move)} spot${Math.abs(move)===1?'':'s'} among rostered players${Math.abs(z)<.15?`, because players ${move<0?`held back by ${c.l} jump past them`:`helped by ${c.l} fall behind them`}`:''}.`:'Their rank stays the same.'}`;
  return drillSec(`What ${art(c)} ${c.l} punt does`,'',`${facts}<p class="note">${why} Your team ranks #${me.catRank[k]} of 10 in ${c.l}${me.catRank[k]>=8?', so it\'s a natural punt candidate':''}.</p><div class="dp-acts"><button type="button" class="btn sm ghost" data-punt="${k}">${punted?`Stop punting ${c.l}`:`Punt ${c.l} across the board`}</button></div>`)}

DRILL.pc=(name,k)=>{const p=findP(name),c=catOf(k);if(!p||!c)return null;css();
  const base={eyebrow:`Player · ${c.l}`,title:`${esc(p.name)}: ${esc(c.n)}`,sub:subOf(p)};
  if(!p.pg)return {...base,html:noData(p,c.l)+how([`Category breakdowns use a player's per-game projection or stats. ${esc(p.name)} has none in the board's data yet.`])};
  const T=catTab(k),onR=p.team>0,N=T.R.length,NA=T.A.length,z=p.zpg[k],v=catV(p.pg,c),rk=1+above(T.zr,z),rkA=1+above(T.za,z),sh=beat(T.zr,z,onR),rks=onR?'ranks':'would rank';
  let lead;
  if(c.pct){const a=p.pg[c.pct[1]],imp=rawOf(p.pg,c);
    lead=!a?`${esc(p.name)} doesn't attempt ${SHOT[k][0]}, so ${c.l} is neutral for them (z ${f2(z)}).`
      :`${esc(p.name)} shoots <b>${f3(v)}</b> on <b>${a.toFixed(1)} ${SHOT[k][1]}</b> a game. League average is ${f3(M.lg[k])}, so they make <b>${Math.abs(imp).toFixed(2)} ${imp>=0?'more':'fewer'}</b> ${SHOT[k][2]} a game than an average shooter would on that volume. That impact ${rks} <b>${ord(rk)}</b> of ${N} rostered players, better than ${pctTxt(sh)} of them.`}
  else lead=`${esc(p.name)} ${VERB[k][0]} <b>${v.toFixed(1)} ${VERB[k][1]}</b> a game${c.neg?' (fewer is better)':''}. That ${rks} <b>${ord(rk)}</b> of ${N} rostered players, better than ${pctTxt(sh)} of them; the average rostered player ${c.neg?'commits':'gets'} ${M.st[k].m.toFixed(1)}.`;
  const facts=`<div class="facts">${fact(`${c.l} a game`,fmtC(c,v),c.pct?`league ${f3(M.lg[k])}`:`average ${M.st[k].m.toFixed(1)}`)}${fact('Z-score',f2(z),c.neg?'sign flipped: plus is good':'vs the average rostered player')}${fact(onR?'Rank, rostered':'Would rank, rostered',`#${rk}`,`of ${N} · better than ${pctTxt(sh)}`,descr('lc',k))}${fact('Rank with free agents',`#${rkA}`,`of ${NA}`)}</div>`;
  const items=T.R.map(q=>({v:rawOf(q.pg,c),label:q.name,hi:q===p,me:q.team===ME&&q!==p,stat:q===p?null:descr('pc',q.name,k)}));
  if(!onR)items.push({v:rawOf(p.pg,c),label:p.name+' (FA)',hi:true});
  const strip=drillSec(`Among ${N} rostered players`,c.pct?'Each dot is a player\'s impact: makes a game above (right) or below (left) a league-average shooter on their volume.':c.neg?'Each dot is a player. Fewer turnovers sit to the right, so right is better.':'Each dot is a player. Right is better. Tap a dot for that player.',
    `<div class="dp-strip">${CH.strip(items,{fmt:c.pct?f2:(x=>x.toFixed(1)),rev:!!c.neg,label:`${c.n} for every rostered player`})}</div>`+legend([['hi',esc(p.name)],...(items.some(x=>x.me)?[['me',p.team===ME?'Your other players':'Your players']]:[]),['mut','Other rostered']]));
  const html=`<p class="dp-lead">${lead}</p>${facts}${strip}${c.pct?shootSec(p,c,T):''}${teamSec(p,c)}${linesSec(p,c,T)}${topSec(p,c,T)}${puntSec(p,c,T)}
    <div class="dp-acts">${actBtn(descr('pv',p.name),'All of their value')}${actBtn(descr('lc',k),`${c.l} across the league`)}<button type="button" class="btn sm ghost" data-player="${esc(p.name)}">Player profile</button></div>
    ${how([`Numbers are per game, from ${srcTxt(p)}. The z-score is how many standard deviations they sit above (+) or below (−) the average rostered player in ${c.l}${c.neg?'; for TO the sign is flipped, so plus always means better':''}.`,
      `Ranks and percentiles compare per-game z-scores with the ${N} rostered players${onR?'':' (a free agent is slotted in where they would land)'}, and with the ${NA-N} tracked free agents added. Percentile is the share of rostered players they beat.`,
      ...(c.pct?[`${c.l} is ranked by impact, not raw percentage: impact = (their % − league %) × attempts a game. League % is every rostered player's makes over attempts (${f3(M.lg[k])}). A team's ${c.l} is total makes over total attempts, so a high-volume shooter moves it far more than a low-volume one. Rank by % alone only counts players with at least ${MINA[k]} attempt${MINA[k]>1?'s':''} a game.`]:[]),
      `Team effects re-rank the roster's per-game totals (percentages as makes over attempts) against the other nine teams, assuming nothing else changes.${onR?'':' For a free agent, the board assumes you drop your lowest-value player.'} This week's ${c.l} win chance reruns the matchup model (real NBA schedule, the daily 11-starter limit, ${LIVEW?'live totals so far, ':''}the same opponent projection) ${onR?'without them':'with them added'}.`,
      `A punt removes this category's z-score from every player's value and re-ranks them. The punt button changes your build everywhere on the board; press it again to undo.`])}`;
  return {...base,html}};

/* ---------- pv: fantasy value breakdown ---------- */
DRILL.pv=name=>{const p=findP(name);if(!p)return null;css();
  const base={eyebrow:'Player · fantasy value',title:`${esc(p.name)}: value`,sub:subOf(p)};
  if(!p.pg||p.value==null)return {...base,html:noData(p,'value')+how(['Value needs a per-game projection or stats line.'])};
  const V=valTab(),N=V.R.length,onR=p.team>0,w=onR?'':'would be ',pgv=V.pg(p),fsv=V.fs(p),rk=valRank(p),rkPg=1+above(V.pgArr,pgv),rkFs=1+above(V.fsArr,fsv),sh=beat(V.vArr,p.value,onR);
  const gf=(p.gp||0)/M.avgGp,counted=CATS.filter(c=>!S.punt.has(c.k)),srt=[...counted].sort((a,b)=>p.z[b.k]-p.z[a.k]);
  const good=srt.filter(c=>p.z[c.k]>=.3).slice(0,3),bad=srt.filter(c=>p.z[c.k]<=-.3).reverse().slice(0,2);
  const punts=[...S.punt].map(k=>catOf(k).l);
  const lead=`${esc(p.name)} is worth <b>${f1(p.value)}</b> in your build${punts.length?` (punting ${plist(punts)})`:''}${S.mode==='season'?', counting missed games':''}: ${w}<b>${ord(rk)}</b> of ${N} rostered players, better than ${pctTxt(sh)} of them. ${good.length?`Most of it comes from ${plist(good.map(c=>`${c.l} (${f1(p.z[c.k])})`))}.`:'No category stands out as a strength.'} ${bad.length?`${plist(bad.map(c=>`${c.l} (${f1(p.z[c.k])})`))} cost${bad.length===1?'s':''} them the most.`:'Nothing costs them much.'}`;
  const facts=`<div class="facts">${fact('Value, your build',f1(p.value),`${w}#${rk} of ${N}`)}${fact('Per game',f1(pgv),`#${rkPg} · ignores missed games`)}${fact('Full season',f1(fsv),`#${rkFs} · ×${gf.toFixed(2)} for games`)}${fact('Trade value',p.tv.toFixed(0),`#${tvRank(p)} · all nine categories`,descr('ptv',p.name))}</div>`;
  const ws=weekSwing(p);let wk='';
  if(ws){const dE=ws.with.exp-ws.without.exp,dW=ws.with.win-ws.without.win,big=CATS.map(c=>[c,ws.with.p[c.k]-ws.without.p[c.k]]).filter(x=>Math.abs(x[1])>=.03).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,4),who=p.team>0?esc(teamById[ws.tid].name):'your team',opp=esc(teamById[ws.opp].name);
    wk=drillSec(`${weekName(ws.w)}: what they're worth`,`${p.team>0?`${who} against ${opp}, with and without ${esc(p.name)}`:`Your matchup against ${opp} if you add them for ${esc(ws.drop)}`} (${ws.games} game${ws.games===1?'':'s'}${ws.live?' left':''}). Matchups count all nine categories, whatever you punt.`,
      `<div class="facts">${fact('Expected categories',(dE>=0?'+':'')+dE.toFixed(2),`${ws.without.exp.toFixed(2)} → ${ws.with.exp.toFixed(2)} of 9`,descr('mw',ws.tid,ws.opp,ws.w))}${fact('Win chance',ptsTxt(dW),`${pc(ws.without.win)} → ${pc(ws.with.win)}`,descr('mw',ws.tid,ws.opp,ws.w))}</div>${big.length?`<p class="note">Biggest category swings: ${big.map(([c,d])=>sbtn(descr('mc',ws.tid,ws.opp,ws.w,c.k),`${c.l} ${ptsTxt(d)}`)).join(' · ')}.</p>`:''}`)}
  const rows=CATS.map(c=>{const z=p.z[c.k],pu=S.punt.has(c.k);return {label:`${c.l}<small>${fmtC(c,catV(p.pg,c))}${pu?' · punted':''}</small>`,v:z,txt:f2(z),cls:pu?(z<0?'dp-pzn':'dp-pz'):(z>=0?'pos':'neg'),stat:descr('pc',p.name,c.k),
    tip:`${c.n}: ${fmtC(c,catV(p.pg,c))} a game, z ${f2(z)}${pu?' (punted, not counted)':''}. Tap for the breakdown.`}});
  const contrib=drillSec('Category by category',`Z-scores${S.mode==='season'?' scaled by games':' per game'}. The counted ones add up to ${f1(p.value)}. Tap a category for its breakdown.`,
    CH.hbars(rows,{label:'Value by category',fmt:f2})+legend([['dp-pos','Helps'],['dp-neg','Hurts'],...(punts.length?[['dp-mut','Punted']]:[])]));
  const modeTxt=`The board is set to <b>${S.mode==='season'?'full season':'per game'}</b> (change it in the build menu at the top). Per game asks how good they are when they play. Full season multiplies every category by projected games ÷ the average rostered player's ${M.avgGp.toFixed(0)}, so ${esc(p.name)}'s ${p.gp?Math.round(p.gp):'unknown'} projected games ${gf>=1.02?`lift their value (×${gf.toFixed(2)})`:gf<=.98?`shrink their value (×${gf.toFixed(2)})`:'leave it about the same'}: #${rkPg} per game, #${rkFs} over a full season.`;
  const pool=M.all.filter(q=>q!==p&&q.value!=null).sort((a,b)=>Math.abs(a.value-p.value)-Math.abs(b.value-p.value)).slice(0,5);
  const near=[...pool,p].sort((a,b)=>b.value-a.value),hasMe=near.some(q=>q.team===ME&&q!==p);
  const nearH=CH.hbars(near.map(q=>({label:`${esc(q.name)}<small>${esc(tAbbr(q))}</small>`,v:q.value,txt:f1(q.value),hi:q===p,me:q.team===ME&&q!==p,cls:q===p?'hi':q.team===ME?'me':(q.value<0?'neg':'dp-oth'),stat:q===p?null:descr('pv',q.name),
    tip:`${q.name} (${tAbbr(q)}): value ${f1(q.value)}${q.team>0&&q.rank?`, #${q.rank} rostered`:q.team===0?', free agent':''}`})),{label:'Closest in value',fmt:f1}),hasNeg=near.some(q=>q!==p&&q.team!==ME&&q.value<0);
  const sim=similar(p.name).slice(0,6);
  const simT=`<div class="scroll"><table class="dp-t dense"><thead><tr><th class="l stick" scope="col">Player</th>${catHeads()}<th scope="col">Value</th></tr></thead><tbody>
    <tr class="sel"><td class="l stick pname wrap nm"><b>${esc(p.name)}</b><small>${esc(tAbbr(p))} · ${esc(p.pos)} · per-game z</small></td>${CATS.map(c=>`<td class="z ${zc(p.zpg[c.k])} ${S.punt.has(c.k)?'punted':''}">${f1(p.zpg[c.k])}</td>`).join('')}<td class="num">${f1(p.value)}</td></tr>
    ${sim.map(s=>{const q=s.p;return `<tr class="click ${q.team===ME?'me':''}" ${sx(descr('pv',q.name))} tabindex="0"><td class="l stick pname wrap nm"><button type="button" class="plink" data-player="${esc(q.name)}"><b>${esc(q.name)}</b></button><small title="Typical gap per category, in z-scores">${esc(tAbbr(q))} · ${esc(q.pos)} · gap ${s.rms.toFixed(2)}</small><small>${esc(diffTxt(s))}</small></td>${CATS.map(c=>`<td class="z ${zc(q.zpg[c.k])} ${S.punt.has(c.k)?'punted':''}" data-tip="${esc(`${q.name} ${c.l}: z ${f2(q.zpg[c.k])} (${esc(p.name)} ${f2(p.zpg[c.k])})`)}">${f1(q.zpg[c.k])}</td>`).join('')}<td class="num">${q.value==null?'–':f1(q.value)}</td></tr>`}).join('')}</tbody></table></div>`;
  const html=`<p class="dp-lead">${lead}</p>${facts}${contrib}${wk}${drillSec('Per game or full season','',`<p class="note">${modeTxt}</p>`)}
    ${drillSec('Closest in value','Rostered players and free agents on either side of them in your build. Tap one for their breakdown.','<div class="dp-wl">'+nearH+'</div>'+legend([['hi',esc(p.name)],...(hasMe?[['me','Your players']]:[]),['mut','Others'],...(hasNeg?[['dp-neg','Others below zero']]:[])]))}
    ${drillSec('Similar players','The closest profiles across all nine categories (per-game z-scores). Tap a name for their profile, or the row for their value.',simT)}
    <div class="dp-acts">${actBtn(descr('ptv',p.name),'Trade value')}${actBtn(descr('pgm',p.name),'Games outlook')}<button type="button" class="btn sm ghost" data-player="${esc(p.name)}">Player profile</button></div>
    ${how([`Value is the sum of a player's z-scores over the categories you count. A z-score is how many standard deviations above (+) or below (−) the average rostered player they are; TO is flipped so plus always helps. FG%, FT% and 3P% count by impact: (their % − league %) × attempts. Numbers come from ${srcTxt(p)}.`,
      `Per game uses per-game numbers only. Full season multiplies each z-score by projected games ÷ ${M.avgGp.toFixed(1)} (the average rostered player's projection), so missed games cost value. Ranks are among the ${N} rostered players${onR?'':'; a free agent is slotted in where they would land'}.`,
      `Closest in value: the five players, rostered or free agent, whose value in your build is nearest theirs. Similar players: nearest neighbours by straight-line distance across all nine per-game z-scores, ignoring punts. Gap is the typical difference per category (root mean square): under 0.3 is very close, above 0.7 is a loose match.`,
      `This week's worth reruns the board's matchup model for the current week ${onR?'without them':'with them in place of your lowest-value player'}: same opponent, real NBA schedule, the daily 11-starter limit${LIVEW?', live totals so far':''}. A change of "+10 pts" means the win chance moves 10 percentage points.`])}`;
  return {...base,html}};

/* ---------- ptv: trade value breakdown ---------- */
function teamNeeds(p){return memo(NS+'.need.'+p.name,()=>M.teams.filter(t=>t.id!==p.team).map(t=>{
    const drop=t.roster.filter(q=>q.pg).sort((a,b)=>a.tv-b.tv)[0],ro=[...t.roster.filter(q=>q!==drop),p],line=lineOf(ro),rec=recordOf(line,t.id),rk=ranksOf(line,t.id);
    const fixes=CATS.filter(c=>rk[c.k]<t.catRank[c.k]).map(c=>({c,from:t.catRank[c.k],to:rk[c.k]})).sort((a,b)=>(b.from-b.to)-(a.from-a.to)||b.from-a.from);
    return {t,drop,gain:rec.w-t.rec.w,mw:rec.mw-t.rec.mw,fixes}}).sort((a,b)=>b.gain-a.gain||b.mw-a.mw).slice(0,4))}
DRILL.ptv=name=>{const p=findP(name);if(!p)return null;css();
  const base={eyebrow:'Player · trade value',title:`${esc(p.name)}: trade value`,sub:subOf(p)};
  const onR=p.team>0,N=M.players.length,rk=tvRank(p),tier=tierOf(p.tv)||TIER[TIER.length-1],ti=TIER.indexOf(tier),next=ti>0?TIER[ti-1]:null,W=BLEND.W||{model:1,draft:0,ros:0};
  const lead=`${esc(p.name)} has a trade value of <b>${p.tv.toFixed(0)}</b> out of 100: ${onR?'':'it would be '}<b>${ord(rk)}</b> of ${N} rostered players, in the <b>${tier[1]}</b> tier.${next?` ${(next[0]-p.tv).toFixed(1)} points short of ${next[1]} (${next[0]}+).`:''} It ignores your punts, because the other manager doesn't share them.`;
  const tiers=`<div class="dp-tiers">${TIER.map((x,i)=>`<span class="pill ${x[2]} ${x===tier?'on':''}" data-tip="${esc(`${x[1]}: ${x[0]}${i?' to '+(TIER[i-1][0]-1):' and up'}`)}">${x[1]} ${x[0]}${i?'–'+(TIER[i-1][0]-1):'+'}</span>`).join('')}</div>`;
  const comp=[['Model',p.tvModel,W.model,'the category model, step by step below'],['Draft slot',p.tvDraft,W.draft,p.draftPick?`pick ${p.draftPick} (${pickStr(p.draftPick)}) in this league's draft`:'undrafted, so it counts as pick 160'],...(BLEND.hasRos?[['ROS rank',p.tvRos??0,W.ros,p.rosRank?`ranked #${p.rosRank} rest of season`:'not ranked, so it counts as 175']]:[])];
  const segs=comp.map(([l,v,wt,note],i)=>({l,v,wt,note,add:v*wt,cls:['s1','s2','s3'][i]}));
  const compT=`<div class="dp-stk"><div class="dp-stk-b" role="img" aria-label="${esc(`Trade value ${p.tv.toFixed(0)} of 100: `+segs.map(x=>`${x.l} adds ${x.add.toFixed(1)}`).join(', '))}">${segs.filter(x=>x.add>.05).map(x=>`<span class="${x.cls}" style="width:${x.add.toFixed(2)}%" data-tip="${esc(`${x.l}: scores ${x.v.toFixed(0)} × ${pc(x.wt)} weight = ${x.add.toFixed(1)}. ${x.note}`)}"></span>`).join('')}</div><b>${p.tv.toFixed(0)}<small>/100</small></b></div>
    ${legend(segs.map(x=>[x.cls,`${x.l} ${x.v.toFixed(0)} × ${pc(x.wt)} = <b>${x.add.toFixed(1)}</b>`]))}<p class="note">${segs.map(x=>`${x.l}: ${esc(x.note)}.`).join(' ')}</p>`;
  const mk=p.tvModel,dr=p.tvDraft,gapTxt=Math.abs(mk-dr)<5?'The model and the draft room agree on them.':mk>dr?`The model likes them more than the draft room did (${mk.toFixed(0)} vs ${dr.toFixed(0)}): a possible buy.`:`The draft room liked them more than the model does (${dr.toFixed(0)} vs ${mk.toFixed(0)}): their name may be worth more than their numbers.`;
  // the model's parts, replayed step by step (replacement level recomputed the same way the core does)
  let parts='';const tp=p.tvParts;
  if(tp){const radj=M.players.map(q=>q.adj).filter(x=>x!=null).sort((a,b)=>b-a),repl=radj[Math.min(119,radj.length-1)],maxRaw=radj[0]-repl;
    const pgvR=1+M.players.filter(q=>q.tvParts&&q.tvParts.pgv>tp.pgv+1e-12).length,pos=tp.pgv>=0,mult=pos?tp.gf*tp.inj*tp.conf:1/Math.max(tp.gf,.5);
    const chk=p.adj!=null&&maxRaw>0?100*Math.pow(Math.max(0,(p.adj-repl)/maxRaw),.85):null,ok=chk!=null&&Math.abs(chk-p.tvModel)<.6;
    const st=[['Per-game value, all nine categories',f2(tp.pgv),`#${pgvR} among rostered`,descr('pv',p.name)],
      ['Games factor',pos?'×'+tp.gf.toFixed(2):'÷'+Math.max(tp.gf,.5).toFixed(2),`${p.gp?Math.round(p.gp):'?'} projected games vs ${M.avgGp.toFixed(0)} average (kept between 0.3 and 1.15)`,descr('pgm',p.name)],
      ...(pos?[['Health','×'+tp.inj.toFixed(2),p.inj==='OUT'?'Listed out':p.inj==='DTD'?'Day-to-day':'Healthy'],['Data confidence','×'+tp.conf.toFixed(2),tp.conf<1?(p.team===0?'Free-agent line from last season':'Estimated or last-season numbers'):'ESPN projection']]:[['Health and confidence','not applied','Below-average players skip these, so a bad line is not softened']]),
      ['Position flexibility','+'+tp.flex.toFixed(2),`${tp.posN} position${tp.posN>1?'s':''} (${esc(p.pos)}), +0.25 for each extra`],
      ['Adjusted value',p.adj!=null?f2(p.adj):'–',`${f2(tp.pgv)} ${pos?'×':'÷'} ${(pos?mult:Math.max(tp.gf,.5)).toFixed(2)} + ${tp.flex.toFixed(2)}`],
      ...(ok?[['Replacement level',f2(repl),'The 120th-best rostered player'],['Model score',p.tvModel.toFixed(0),`${(p.adj-repl).toFixed(2)} above replacement, as a share of the best player's ${maxRaw.toFixed(2)}, curved (power 0.85) and × 100`]]:[['Model score',p.tvModel.toFixed(0),'Above replacement, scaled so the best player is 100']])];
    parts=drillSec('Inside the model','How the category model gets from per-game stats to its score.',`<div class="scroll"><table class="dp-t"><thead><tr><th class="l" scope="col">Step</th><th scope="col">Number</th></tr></thead><tbody>${st.map(([a,b,c2,d])=>`<tr${d?` class="click" ${sx(d)} tabindex="0"`:''}><td class="l wrap"><b>${a}</b><small class="b">${c2}</small></td><td class="num">${b}</td></tr>`).join('')}</tbody></table></div>`)}
  // neighbours on the value chart
  const lad=[...M.players].sort((a,b)=>b.tv-a.tv);if(!onR){lad.splice(rk-1,0,p)}
  const i=lad.indexOf(p),win=lad.slice(Math.max(0,i-4),i+5),hasMe=win.some(q=>q.team===ME&&q!==p);
  const lb='<div class="dp-wl">'+CH.hbars(win.map(q=>({label:`${q===p?rk:q.tvRank}. ${esc(q.name)}<small>${esc(tAbbr(q))}</small>`,v:q.tv,txt:q.tv.toFixed(0),hi:q===p,me:q.team===ME&&q!==p,stat:q===p?null:descr('ptv',q.name),tip:`${q.name} (${tAbbr(q)}): ${q.tv.toFixed(1)}, ${(tierOf(q.tv)||TIER[5])[1]}`})),{label:'Neighbours on the trade value chart',max:100,fmt:v=>v.toFixed(0)})+'</div>';
  // teams that need what they bring
  const strong=CATS.filter(c=>p.pg&&p.zpg[c.k]>=.3).sort((a,b)=>p.zpg[b.k]-p.zpg[a.k]).slice(0,4);
  let needs='';
  if(p.pg){const nd=teamNeeds(p);
    needs=drillSec('Who needs what they bring',`${strong.length?`Their best categories: ${strong.map(c=>`${c.l} (${f1(p.zpg[c.k])})`).join(', ')}. `:''}Each team below gets them in place of its lowest trade value player; the board recounts category wins against the rest of the league.`,
      `<div class="scroll"><table class="dp-t"><thead><tr><th class="l" scope="col">Team and the ranks they'd gain</th><th scope="col" title="Category wins gained against the other nine teams">Wins</th></tr></thead><tbody>${nd.map(r=>`<tr class="${r.t.id===ME?'me':''}"><td class="l wrap tname"><button type="button" class="tlink" data-team="${r.t.id}">${esc(r.t.name)}</button><small class="b">#${r.t.pr} power${r.t.id===ME?' (you)':''}${r.drop?` · in place of <button type="button" class="plink" data-player="${esc(r.drop.name)}">${esc(r.drop.name)}</button>`:''}</small><small class="b">${r.fixes.slice(0,3).map(f=>sbtn(descr('tc',r.t.id,f.c.k),`${f.c.l} #${f.from}→#${f.to}`)).join(' · ')||'No category rank changes'}</small></td><td class="num ${dWinCls(r.gain)}">${sg(r.gain)}</td></tr>`).join('')}</tbody></table></div>`)}
  const html=`<p class="dp-lead">${lead}</p>${tiers}
    <div class="facts">${fact('Trade value',p.tv.toFixed(0),`${onR?'':'would be '}#${rk} of ${N}`)}${fact('Model',mk.toFixed(0),`${pc(W.model)} of the blend`)}${fact('Draft slot',dr.toFixed(0),`${pc(W.draft)} · ${p.draftPick?'pick '+p.draftPick:'undrafted'}`)}${BLEND.hasRos?fact('ROS rank',(p.tvRos??0).toFixed(0),`${pc(W.ros)} · ${p.rosRank?'#'+p.rosRank:'not ranked'}`):fact('Value, your build',p.value==null?'–':f1(p.value),'opens the breakdown',descr('pv',p.name))}</div>
    ${drillSec('The blend',gapTxt,compT)}${parts}
    ${drillSec('Just above and below','Their neighbours on the trade value chart. Tap one for their breakdown.',lb+legend([['hi',esc(p.name)],...(hasMe?[['me','Your players']]:[]),['mut','Others']]))}
    ${needs}
    <div class="dp-acts">${p.team>0&&p.team!==ME?`<button type="button" class="btn sm" data-want="${esc(p.name)}">Find a deal for them</button>`:''}${p.team===ME?`<button type="button" class="btn sm" data-addtrade="${esc(p.name)}" data-pteam="${ME}">Shop them</button>`:''}<button type="button" class="btn sm ghost" data-go="trades">Trades</button><button type="button" class="btn sm ghost" data-player="${esc(p.name)}">Player profile</button></div>
    ${how([`Trade value runs from 0 (a typical waiver pickup) to 100 (the most valuable player in the league). It blends ${BLEND.hasRos?'three':'two'} opinions, each put on the model's scale (pick or rank N is worth what the model's Nth-best player is worth): model ${pc(W.model)}, draft slot ${pc(W.draft)}${BLEND.hasRos?`, rest-of-season rank ${pc(W.ros)}`:''}. The draft's share shrinks each week as real games replace draft-day opinions.${BLEND.hasRos?'':' Rest-of-season rankings join the blend once they are imported on the Trades tab.'}`,
      `The model takes per-game value across all nine categories, then for above-average players multiplies by a games factor (projected games ÷ the average, kept between 0.3 and 1.15), health (×0.97 day-to-day, ×0.85 out) and data confidence (×0.9 for estimates and free agents); below-average players are divided by the games factor instead. It adds 0.25 per extra position, measures the result above replacement (the 120th-best rostered player) and scales it so the best player is 100, with a gentle curve.`,
      `Tiers are fixed cut-offs on the 0 to 100 scale. "Who needs what they bring" is a what-if: each team gets the player in place of its lowest trade value player (assumed; a real trade sends someone back) while every other roster stays as it is, and the board counts category wins against the other nine teams.`])}`;
  return {...base,html}};

/* ---------- pgm: games outlook ---------- */
function startsFor(p){return memo(NS+'.starts.'+p.name,()=>{
    const weeks=WEEKS.filter(w=>preseason||w>=curWeek),drop=p.team>0?null:dropDefault(ME),ro=p.team>0?null:[...rosterOf(ME).filter(q=>q.name!==drop),p];
    let g=0,s=0;const per={};
    weeks.forEach(w=>{const P=p.team>0?projTeam(p.team,w,0):weekProj(ro,w,0);let gw=0,sw=0;
      P.days.forEach(d=>{if(!preseason&&d.sp<todaySP)return;if(plays(p.nba,d.sp)){gw++;if(d.st.has(p.name))sw++}});g+=gw;s+=sw;per[w]=[gw,sw]});
    return {g,s,per,drop}})}
DRILL.pgm=name=>{const p=findP(name);if(!p)return null;css();
  const base={eyebrow:'Player · games',title:`${esc(p.name)}: games outlook`,sub:subOf(p)};
  const G=gamesTab(),ab=p.nba,unsigned=!ab||ab==='?'||!G.by[ab],by=unsigned?WEEKS.map(()=>0):G.by[ab];
  const left=w=>!preseason&&w===curWeek?gamesIn(ab,w,todaySP):gamesIn(ab,w);
  const regLeft=WEEKS.filter(w=>w<=REGW&&(preseason||w>=curWeek)),g=w=>by[WEEKS.indexOf(w)];
  const totLeft=unsigned?0:regLeft.reduce((s,w)=>s+left(w),0),n4=regLeft.filter(w=>g(w)>=4).length,n2=regLeft.filter(w=>g(w)<=2).length;
  const po=unsigned?0:poGames(p),poRank=1+G.poAll.filter(x=>x>po).length,rate=Math.min(.97,Math.max(.25,(p.gp||0)/82));
  const exp=unsigned||!p.pg?0:WEEKS.filter(w=>preseason||w>=curWeek).reduce((s,w)=>s+left(w)*rate,0);
  const U=v=>unsigned?'–':v;
  const facts=`<div class="dp-f6">${fact('Projected games',p.gp?Math.round(p.gp):'–',`of 82${p.cur&&p.cur.gp!=null?` · ${Math.round(p.cur.gp)} played`:''}`)}${fact('Team games left',U(totLeft),`regular season, weeks ${regLeft[0]??'–'} to ${REGW}`)}${fact('4-game weeks',U(n4),`league average ${G.n4avg.toFixed(1)}`)}${fact('2-game weeks',U(n2),`or fewer · average ${G.n2avg.toFixed(1)}`)}${fact('Playoff games',U(po),`average ${G.poAvg.toFixed(1)} · ${unsigned?'no NBA team':`${ord(poRank)} of ${G.T.length} NBA teams`}`)}${fact('Expected games',U(Math.round(exp)),`team games × ${pc(rate)} availability`)}</div>`;
  // weekly columns: bar = NBA games that week, tick = league average, playoff weeks shaded
  const mx=Math.max(5,...by),own=p.team>0?p.team:ME,lnk=w=>{if(w>REGW)return null;const o=oppOf(own,w);return o==null?null:descr('mw',own,o,w)};
  const cols=WEEKS.map((w,i)=>{const gg=by[i],av=G.avg[w],cls=gg>=av+.3?'up':gg<=av-.3?'dn':'eq',past=!preseason&&w<curWeek,po=w>REGW,d=lnk(w);
    const tip=`${weekName(w)} · ${weekLabel(w)}: ${gg} game${gg===1?'':'s'}${PER[w]&&PER[w].length>7?` (${PER[w].length}-day week)`:''}, league average ${av.toFixed(1)}${d?`. Tap for ${tAbbr({team:own})} vs ${teamById[oppOf(own,w)].abbr}`:''}`;
    const inner=`<i class="${cls}" style="height:${(gg/mx*100).toFixed(1)}%"></i><u style="bottom:${(av/mx*100).toFixed(1)}%"></u>`;
    return d?`<button type="button" class="dp-gc ${po?'po':''} ${past?'past':''}" ${sx(d)} data-tip="${esc(tip)}" aria-label="${esc(tip)}">${inner}</button>`:`<span class="dp-gc ${po?'po':''} ${past?'past':''}" data-tip="${esc(tip)}">${inner}</span>`}).join('');
  const grid=[...Array(mx+1).keys()].filter(v=>v%(mx>6?2:1)===0).map(v=>`<div class="dp-gl" style="bottom:${(v/mx*100).toFixed(1)}%"><span>${v}</span></div>`).join('');
  const xl=WEEKS.map(w=>`<span class="${w>REGW?'po':''}">${w>REGW?'P'+(w-REGW):w}</span>`).join('');
  const chart=`<div class="dp-gm" style="--n:${WEEKS.length}" role="group" aria-label="${esc(`NBA games per fantasy week for ${p.name}`)}"><div class="dp-gplot">${grid}<div class="dp-gcols">${cols}</div></div><div class="dp-gx">${xl}</div></div>
    ${legend([['dp-pos','More games than average'],['dp-dn','Fewer'],['dp-mut','About average'],['dp-avg','League average'],['dp-po','Fantasy playoffs (P1 to P3)']])}`;
  const fours=regLeft.filter(w=>g(w)>=4),twos=regLeft.filter(w=>g(w)<=2);
  const wkTxt=unsigned?`${esc(p.name)} has no NBA team right now, so no games are scheduled for them.`:`${fours.length?`Four or more games in weeks ${plist(fours.map(String))}.`:'No four-game weeks left.'} ${twos.length?`Two or fewer in weeks ${plist(twos.map(String))}${twos.length>=4?': good weeks to stream around them':''}.`:'No two-game weeks left.'}`;
  // lineup crunch: how many of their games would count on a fantasy roster
  let crunch='';
  if(p.pg&&!unsigned&&(p.team>0||tm(ME))){const st=startsFor(p),bench=st.g-st.s,ownT=p.team>0?teamById[p.team].name:'your roster';
    crunch=drillSec('Games that count',`The board fills 11 lineup spots a day by value and position, so on crowded days some games sit on the bench.`,
      `<div class="facts">${fact('Would start',st.s,`of ${st.g} games ${p.team>0?'on '+esc(tAbbr(p)):'on your roster'}`)}${fact('Benched',bench,st.g?pctTxt(bench/st.g)+' of their games':'')}</div><p class="note">${p.team>0?`On ${esc(ownT)}`:`On your roster, in place of ${esc(st.drop||'your lowest-value player')}`}, ${esc(p.name)} would start ${st.s} of their team's ${st.g} remaining games (fantasy playoffs included)${bench?`; ${bench} land on the bench when more than 11 players have games or better options fill their spots.`:', with none lost to a crowded lineup.'} This counts schedule only; it assumes they are healthy.</p>`)}
  const html=`<p class="dp-lead">${unsigned?wkTxt:`${esc(ab)} play <b>${totLeft}</b> regular-season games${preseason?'':' from today'} across ${regLeft.length} fantasy weeks, and <b>${po}</b> in the fantasy playoffs (league average ${G.poAvg.toFixed(1)}). ${p.gp?`${esc(p.name)} is projected to play ${Math.round(p.gp)} of 82 games.`:''}`}</p>${facts}
    ${drillSec('Games by fantasy week',`${unsigned?'The dark ticks show the league average; bars appear once they sign with a team.':`Each bar is ${esc(ab)}'s NBA games that week; the dark tick is the league average. Tap a regular-season week to open ${p.team>0?'that fantasy matchup':'your matchup that week'}.`}`,chart+(unsigned?'':`<p class="note">${wkTxt}</p>`))}
    ${crunch}
    <div class="dp-acts">${actBtn(descr('pv',p.name),'Their value')}<button type="button" class="btn sm ghost" data-player="${esc(p.name)}">Player profile</button></div>
    ${how([`Games come from the real NBA schedule mapped onto this league's fantasy weeks (ESPN scoring periods). Week 1 is six days and week 18 runs 14 days around the All-Star break, so their counts run high or low. League average is the mean over all ${G.T.length} NBA teams that week.`,
      `Projected games is ${p.team===0?'last season\'s games, pulled toward a full season':'the projection behind their stats'}. Expected games multiplies their team's remaining games by their availability (projected games ÷ 82, kept between 25% and 97%), the same rate the matchup model uses.`,
      `Four-game and two-game weeks count the regular-season weeks ${preseason?'ahead':'left'}. Playoff games are weeks ${PO_WEEKS.join(', ')}; the rank compares their NBA team with the other ${G.T.length-1}.`,
      `Games that count replays the board's daily lineup: each day the highest-value players with games fill PG, SG, SF, PF, C, G, F and four UT spots. ${p.team>0?'It uses their current fantasy roster.':'For a free agent it assumes they replace your lowest-value player.'}`])}`;
  return {...base,html}};

/* ---------- player sheet panel: fantasy profile ---------- */
PANELS.player.push(name=>{const p=findP(name);if(!p||!p.pg)return '';css();
  const onR=p.team>0,N=M.players.filter(q=>q.pg).length;
  const sky=CATS.map(c=>{const T=catTab(c.k),z=p.zpg[c.k],sh=beat(T.zr,z,onR),rk=1+above(T.zr,z),pp=Math.round(Math.max(0,Math.min(1,sh))*100),v=catV(p.pg,c);
    const tip=`${c.n}: ${fmtC(c,v)} a game. ${onR?'Ranks':'Would rank'} ${ord(rk)} of ${N} rostered, better than ${pp}%${S.punt.has(c.k)?' (punted)':''}. Tap for the breakdown.`;
    return `<button type="button" class="dp-col ${S.punt.has(c.k)?'punted':''}" ${sx(descr('pc',p.name,c.k))} data-tip="${esc(tip)}" aria-label="${esc(tip)}"><span class="dp-trk"><i class="${pcls(sh)}" style="height:${Math.max(4,pp)}%"></i></span><b>${pp}</b><span class="l">${c.l}</span></button>`}).join('');
  const V=valTab(),pgv=V.pg(p),fsv=V.fs(p),rk=valRank(p),rkPg=1+above(V.pgArr,pgv),rkFs=1+above(V.fsArr,fsv),tr=tvRank(p),tier=(tierOf(p.tv)||TIER[TIER.length-1])[1];
  const G=gamesTab(),unsigned=!p.nba||p.nba==='?'||!G.by[p.nba],regLeft=WEEKS.filter(w=>w<=REGW&&(preseason||w>=curWeek)),by=unsigned?null:G.by[p.nba];
  const n4=unsigned?0:regLeft.filter(w=>by[WEEKS.indexOf(w)]>=4).length,n2=unsigned?0:regLeft.filter(w=>by[WEEKS.indexOf(w)]<=2).length;
  const vs=beat(V.vArr,p.value,onR);
  const facts=`<div class="dp-f3">${fact(onR?'Value rank':'Value rank, if rostered',rk?`#${rk}`:'–',`better than ${pctTxt(vs)} · ${rkPg===rkFs?'same per game and full season':`#${rkPg} per game, #${rkFs} full season`}`,descr('pv',p.name))}${fact(onR?'Trade value rank':'Trade value rank, if rostered',`#${tr}`,`${tier} · model ${p.tvModel.toFixed(0)}, draft ${p.tvDraft.toFixed(0)}`,descr('ptv',p.name))}${fact('Four-game weeks left',unsigned?'–':n4,unsigned?'no NBA team yet':`${n2} with two or fewer · full games outlook`,descr('pgm',p.name))}</div>`;
  const sim=similar(p.name).slice(0,3);
  const simH=sim.length?`<div class="dp-sim">${sim.map(s=>`<button type="button" class="fact" data-player="${esc(s.p.name)}" data-tip="${esc(`Typical gap per category: ${s.rms.toFixed(2)} z`)}"><span>${esc(tAbbr(s.p))} · ${esc(s.p.pos)}${s.p.team===ME?' · yours':''}</span><b>${esc(s.p.name)}</b><small>${esc(diffTxt(s))}</small></button>`).join('')}</div>`:'';
  return `<div class="drill-sec"><div><h3>Fantasy profile</h3><p class="note">Percentile in each category among the ${N} rostered players; 50 is the middle (dashed line). Tap one for the full breakdown.</p></div>
    <div class="dp-sky" role="group" aria-label="Category percentiles">${sky}</div>${facts}
    ${sim.length?`<div class="lbl">Most similar players</div>${simH}`:''}
    ${how(['Percentiles rank per-game z-scores (shooting by impact: percentage above league average times attempts) against every rostered player; TO counts fewer as better. Value ranks follow your build\'s punts; trade value ignores them.','Similar players are the nearest neighbours across all nine per-game z-scores, rostered or free agent. The line under each name says where they differ most.'])}</div>`});
})();
