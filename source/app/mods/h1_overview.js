/* h1_overview.js: the Stats tab's Overview (the league at a glance) and the Home "Insights" panel.
   HUB {k:'overview', order:10}: headline cards, this week's matchups, the playoff race, category leaders and the closest
   category races, Matt's strengths and holes, and the best values. Every number opens the drill that proves it.
   PANELS.home: "Insights", the 4-6 most useful findings for Matt's team, each one sentence that opens its drill.
   CMDS: one search entry per Stats view. Registers only; everything is computed at render time. */
(()=>{
const LAB=window.LAB=window.LAB||{};

/* ---------- small helpers ---------- */
const SEA=()=>S.mode==='season';
const per=()=>SEA()?'over the season':'a game';
const dp=()=>SEA()?0:1;
const mult=p=>SEA()?(p.gp||0):1;
const NOUN={pts:'points',reb:'rebounds',ast:'assists',stl:'steals',blk:'blocks',to:'turnovers'};
const MADE={fg:'made field goals',ft:'made free throws',tp:'made threes'};
const unit=c=>c.pct?MADE[c.k]:NOUN[c.k];
const tname=id=>esc(teamById[id]?teamById[id].name:'?');
const tabbr=id=>esc(teamById[id]?teamById[id].abbr:'?');
const fv=(c,v)=>fmtC(c,v,dp());
// two values that print the same get more decimals, so a near tie still shows who leads
const fvPair=(c,a,b)=>{const x=fv(c,a),y=fv(c,b);if(x!==y)return [x,y];const g=c.pct?v=>v.toFixed(4).replace(/^0/,''):v=>v.toFixed(dp()+2);return [g(a),g(b)]};
const upAmt=x=>{const d=dp(),m=10**d;return Math.max(1/m,Math.ceil(x*m-1e-9)/m).toFixed(d)};   // rounded up, so "passes" really passes
const rAmt=x=>{const a=Math.abs(x);return dp()&&a>0&&a<.005?'under 0.01':dp()&&a>0&&a<.1?a.toFixed(2):a.toFixed(dp())};
const one=(n,w)=>n==='1'?w.replace(/s$/,''):w;   // "1 more steal", not "1 more steals"
const an=x=>/^(8|1[18](\D|$))/.test(String(x))?'an':'a';   // "an 18% chance", "a 42% chance"
const passP=(c,x)=>{const n=upAmt(x);return c.neg?`${n} fewer ${one(n,'turnovers')} ${per()}`:c.pct?`${n} more ${one(n,MADE[c.k])} ${per()} at the same attempts`:`${n} more ${one(n,NOUN[c.k])} ${per()}`};
const gapP=(c,x)=>{const n=rAmt(x);return `${n} ${one(n,unit(c))} ${per()}`};
const live=c=>!S.punt.has(c.k);
const hasHub=k=>HUB.some(h=>h.k===k);
const stamp=()=>preseason?'Projections until games start on Oct 20.':`${weeksDone} of ${REGW} weeks played.`;
// once the regular season is over there is no weekly matchup left to project (playoff pairings are not in the schedule)
const regOver=()=>!preseason&&curWeek>REGW;
const SW_LO=.38,SW_HI=.62;   // the core's Swing band (tag()), the same one the matchup drills use

// how much team t needs to draw level with team o (>0 means o is ahead): counting stats in their own units (fewer, for TO),
// percentages in made shots at t's current attempts. Same arithmetic as the tc drill, so the numbers agree.
function sums(t,c){const ro=t.roster.filter(p=>p.pg);return {m:ro.reduce((s,p)=>s+(+p.pg[c.pct[0]]||0)*mult(p),0),a:ro.reduce((s,p)=>s+(+p.pg[c.pct[1]]||0)*mult(p),0)}}
function need(t,o,c){if(c.pct){const s=sums(t,c);return o.line[c.k]*s.a-s.m}return c.neg?t.line[c.k]-o.line[c.k]:o.line[c.k]-t.line[c.k]}
const word=rel=>rel<.25?'narrow':rel<.75?'clear':'commanding';

function titleOdds(){try{if(typeof LAB.titleOdds!=='function')return null;const r=LAB.titleOdds();
  return r&&typeof r==='object'&&M.teams.every(t=>r[t.id]&&isFinite(r[t.id].title))?r:null}catch(e){return null}}

/* ---------- shared numbers (memoized per model state) ---------- */
const catData=()=>memo('h1ov|cats|'+S.mode,()=>CATS.map(c=>{
  const vals=M.teams.map(t=>t.line[c.k]),m=mean(vals),sd=sdev(vals),order=[...M.teams].sort((a,b)=>a.catRank[c.k]-b.catRank[c.k]);
  const pairs=order.slice(0,-1).map((t,i)=>{const u=order[i+1];return {c,a:t,b:u,ra:i+1,rb:i+2,rel:Math.abs(t.line[c.k]-u.line[c.k])/sd,amt:Math.max(0,need(u,t,c))}});
  const pool=M.players.filter(p=>p.pg);
  const top=c.neg?[...pool].sort((a,b)=>b.pg.to-a.pg.to)[0]:[...pool].sort((a,b)=>b.zpg[c.k]-a.zpg[c.k])[0];
  const fa=c.neg?null:M.fas.filter(p=>p.pg).sort((a,b)=>b.zpg[c.k]-a.zpg[c.k])[0]||null;
  const z=t=>(t.line[c.k]-m)/sd*(c.neg?-1:1);
  return {c,m,sd,order,pairs,top,fa,z}}));
// this week's matchups, favorite first (Matt always first in his), closest first
const weekMus=w=>memo('h1ov|mus|'+w,()=>DATA.schedule.filter(x=>x[0]===w).map(([,x,y])=>{const f=mp(x,y,w);let a=x,b=y;
  if(y===ME||(x!==ME&&f.win<.5)){a=y;b=x}const o=mp(a,b,w);
  return {a,b,o,close:Math.abs(o.win-.5),swing:CATS.filter(c=>o.p[c.k]>=SW_LO&&o.p[c.k]<SW_HI).length,mine:a===ME||b===ME}}).sort((p,q)=>p.close-q.close));
// the same matchup with the favorite first (for "X over Y" wording, whoever is listed first on the card)
const favOf=m=>m.o.win>=.5?{f:m.a,u:m.b,p:m.o.win,e:m.o.exp,el:m.o.expL}:{f:m.b,u:m.a,p:1-m.o.win,e:m.o.expL,el:m.o.exp};
const race=()=>memo('h1ov|race',()=>{const ss=seasonSim(),to=titleOdds();
  const rows=M.teams.map(t=>({t,s:ss[t.id],po:ss[t.id].po,title:to?to[t.id].title:null,avg:avgSeed(ss[t.id])})).sort((a,b)=>b.po-a.po||a.avg-b.avg);
  rows.forEach((r,i)=>r.rank=i+1);return {rows,to}});
const poG=()=>memo('h1ov|pog',()=>{const g=M.teams.map(t=>({id:t.id,g:PO_WEEKS.reduce((s,w)=>s+projTeam(t.id,w,0).games,0)})).sort((a,b)=>b.g-a.g);g.forEach((x,i)=>x.rank=i+1);return g});
// Matt's race in every category: what passes the team above, the cushion over the team below. The cushion is what Matt
// could lose before the team below draws level (percentages: made shots at Matt's attempts), as in the tc drill.
const myRace=()=>memo('h1ov|myrace|'+S.mode,()=>{const t=tm(ME);return catData().map(d=>{const r=t.catRank[d.c.k],ab=d.order[r-2]||null,be=d.order[r]||null;
  return {...d,r,ab,be,up:ab?Math.max(0,need(t,ab,d.c)):null,upRel:ab?Math.abs(ab.line[d.c.k]-t.line[d.c.k])/d.sd:null,
    cush:be?Math.max(0,-need(t,be,d.c)):null,cushRel:be?Math.abs(t.line[d.c.k]-be.line[d.c.k])/d.sd:null,zt:d.z(t)}})});
// Draft steals: the Draft view's own list (value against what the slot usually returns) when h5_draft is loaded, so the
// two views agree; otherwise pick number against value rank among rostered players.
function steals(){try{if(typeof LAB.draftBoard==='function'){const B=LAB.draftBoard();
    const ks=B&&Array.isArray(B.picks)?B.picks.filter(k=>k&&k.p&&k.d!=null&&isFinite(k.d)&&isFinite(k.v)&&isFinite(k.e)).sort((a,b)=>b.d-a.d).slice(0,3):[];
    if(ks.length)return {draft:true,vw:S_X('draft.v','tv')==='model'?'model value':'trade value',rows:ks.map(k=>({p:k.p,n:k.n,by:k.by,d:k.d,v:k.v,e:k.e}))}}}catch(e){}
  return {draft:false,rows:M.players.filter(p=>p.draftPick&&p.rank).map(p=>({p,n:p.draftPick,by:p.team,d:p.draftPick-p.rank})).sort((a,b)=>b.d-a.d).slice(0,3)}}

/* ---------- layout CSS (theme tokens only) ---------- */
function css(){addCSS('h1ov-css',`
.ov-hls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.ov-hls.sm{grid-template-columns:repeat(2,minmax(0,1fr))}
@media (max-width:980px){.ov-hls{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ov-hl{display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel);font:inherit;color:inherit;cursor:pointer;min-width:0}
.ov-hl:hover{background:var(--soft)}.ov-hl.me{background:var(--me)}
.ov-hl b{font:700 1.75rem/1.05 var(--display);font-variant-numeric:tabular-nums}
.ov-hl .who{font-weight:600;font-size:.86rem;line-height:1.25;overflow-wrap:anywhere}
.ov-hl small{color:var(--muted);font-size:.75rem;line-height:1.3}
.ov-mus{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:10px}
.ov-mu{display:flex;flex-direction:column;gap:6px;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel);font:inherit;color:inherit;cursor:pointer;min-width:0}
.ov-mu:hover{background:var(--soft)}.ov-mu.me{background:var(--me)}
.ov-mu-h{display:flex;gap:6px;align-items:center;flex-wrap:wrap;min-height:1.3em}.ov-mu-h .pill{margin:0}
.ov-mu-t{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center}
.ov-mu-t b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ov-mu-t em{font:600 .88rem var(--mono);font-style:normal}
.ov-sw{width:10px;height:10px;border-radius:3px;display:inline-block;background:var(--s1)}
.ov-sw.me{background:var(--s2)}.ov-sw.b{background:var(--soft);box-shadow:inset 0 0 0 1px var(--muted)}
.ov-split{position:relative;display:block;height:8px;border-radius:4px;background:var(--soft);overflow:hidden}
.ov-split i{position:absolute;left:0;top:0;bottom:0;background:var(--s1)}.ov-split i.me{background:var(--s2)}
.ov-split::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:var(--panel)}
.ov-mu small{color:var(--muted);font-size:.76rem}
.ov-cut{display:flex;align-items:center;gap:8px;color:var(--muted);font:600 .7rem var(--body);text-transform:uppercase;letter-spacing:.09em;margin:2px 0}
.ov-cut::before,.ov-cut::after{content:"";flex:1;border-top:1px dashed var(--muted)}
@media (min-width:561px){.ov-wide .hb-r{grid-template-columns:minmax(0,16em) minmax(0,1fr) 4.6em}}
.ov-cats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
@media (max-width:1000px){.ov-cats{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.ov-cats{grid-template-columns:1fr}}
.ov-cat.ov-pun{opacity:.6}.ov-tbl tr.ov-pun td{opacity:.55}
.ov-cat{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ov-cat-h{display:flex;align-items:center;gap:8px}
.ov-cat-h .sx{font:700 1.25rem/1 var(--display);letter-spacing:.03em}
.ov-cat-h .note{flex:1;min-width:0}
.ov-cat-h .pill{margin:0;border:0;cursor:pointer;font-family:var(--body)}
.ov-kv{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 10px;align-items:baseline}
.ov-kv .lbl,.ov-kv small{grid-column:1/-1}
.ov-kv .sx{font-weight:600;min-width:0;overflow-wrap:anywhere;text-align:left}
.ov-kv .v{font:600 .84rem var(--mono);white-space:nowrap}
.ov-kv small{color:var(--muted);font-size:.76rem}
.ov-kv.lead .sx{font:600 1.08rem/1.15 var(--display);text-transform:uppercase;letter-spacing:.02em}
.ov-kv.lead .v{font:700 1.3rem/1 var(--display)}
.ov-races,.ov-list,.ov-insl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ov-race{display:grid;grid-template-columns:3.4em minmax(0,1fr) auto;gap:4px 12px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:8px 12px}
.ov-race.me{background:var(--me)}
.ov-race>.sx{font:700 1.05rem var(--display);letter-spacing:.03em}
.ov-race .tm{display:flex;flex-wrap:wrap;gap:2px 8px;align-items:baseline;min-width:0}
.ov-race .tm .sx{font-weight:600;text-align:left}
.ov-race .tm i{font-style:normal;color:var(--muted);font-size:.8rem}
.ov-race .tm code{font:500 .8rem var(--mono)}
.ov-race .tm small{flex-basis:100%;color:var(--muted);font-size:.76rem}
.ov-race .pill{margin:0}
@media (max-width:560px){.ov-race{grid-template-columns:minmax(0,1fr) auto}.ov-race>.sx{grid-row:1;justify-self:start}.ov-race .pill{grid-row:1;grid-column:2}.ov-race .tm{grid-row:2;grid-column:1/-1}}
.ov-list li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 12px;align-items:baseline;border-bottom:1px solid var(--soft);padding:3px 0 6px}
.ov-list .sx{font-weight:600;text-align:left;min-width:0}
.ov-list .v{font:600 .84rem var(--mono);white-space:nowrap}
.ov-list small{grid-column:1/-1;color:var(--muted);font-size:.76rem}
.ov-insl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:8px}
.ov-in{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;height:100%;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--panel);font:inherit;color:inherit;cursor:pointer}
.ov-in:hover{background:var(--soft)}
.ov-in .dot{width:10px;height:10px;border-radius:50%;background:var(--muted)}
.ov-in.good .dot{background:var(--pos-3)}.ov-in.bad .dot{background:var(--neg-3)}
.ov-in .bd{display:flex;flex-direction:column;gap:2px;min-width:0}
.ov-in .tx{font-size:.9rem;line-height:1.4}
.ov-in .go{color:var(--accent);font:600 .8rem var(--body);white-space:nowrap}
@media (max-width:560px){.ov-in .go b{display:none}.ov-in{gap:10px}}
@media (max-width:560px){.ov-tbl th,.ov-tbl td{padding-left:5px;padding-right:5px}.ov-tbl th{letter-spacing:.03em}}
`)}
const hl=(lab,big,who,small,stat,me)=>`<button type="button" class="ov-hl${me?' me':''}" data-stat="${esc(stat)}"><span class="lbl">${lab}</span><b>${big}</b><span class="who">${who}</span>${small?`<small>${small}</small>`:''}</button>`;
const safe=(name,f)=>{try{return f()}catch(e){console.error('h1_overview',name,e);return ''}};

/* ---------- Overview sections ---------- */
function secGlance(){const w=Math.min(curWeek,REGW),mus=weekMus(w),R=race(),cd=catData(),pg=poG(),cards=[];
  const p1=[...M.teams].sort((a,b)=>a.pr-b.pr)[0];
  cards.push(hl('Power rank #1',p1.rr.toFixed(2),tname(p1.id),`categories won in an average week · grade ${p1.grade}`,'tpr|'+p1.id,p1.id===ME));
  if(R.to){const f=[...R.rows].sort((a,b)=>b.title-a.title)[0];cards.push(hl('Title favorite',pc(f.title),tname(f.t.id),`wins the title in ${pc(f.title)} of simulated seasons · playoffs ${pc(f.po)}`,'ttl|'+f.t.id,f.t.id===ME))}
  else{const f=R.rows[0];cards.push(hl('Playoff favorite',pc(f.po),tname(f.t.id),`makes the top five in ${pc(f.po)} of simulated seasons`,'tpo|'+f.t.id,f.t.id===ME))}
  if(mus.length&&!regOver()){const c=mus[0],l=favOf(mus[mus.length-1]),lm=mus[mus.length-1];
    cards.push(hl('Closest matchup',`${pc(c.o.win)}–${pc(1-c.o.win)}`,`${tname(c.a)} vs ${tname(c.b)}`,`${weekName(w)} · ${c.o.exp.toFixed(1)}–${c.o.expL.toFixed(1)} expected categories`,`mw|${c.a}|${c.b}|${w}`,c.mine));
    if(mus.length>1)cards.push(hl('Most lopsided',pc(l.p),`${tname(l.f)} over ${tname(l.u)}`,`${weekName(w)} · ${l.e.toFixed(1)}–${l.el.toFixed(1)} expected categories`,lm.mine?`mw|${lm.a}|${lm.b}|${w}`:`mw|${l.f}|${l.u}|${w}`,lm.mine))}
  const mvp=M.players.filter(p=>p.value!=null).sort((a,b)=>b.value-a.value)[0];
  if(mvp)cards.push(hl('Most valuable player',f1(mvp.value),`${esc(mvp.name)} <span class="note">${esc(teamAbbr(mvp))}</span>`,`value across ${S.punt.size?'your unpunted':'all nine'} categories ${SEA()?'over the season':'per game'}`,'pv|'+mvp.name,mvp.team===ME));
  const fa=M.fas.filter(p=>p.value!=null).sort((a,b)=>b.value-a.value)[0];
  if(fa){const bc=CATS.filter(live).sort((a,b)=>fa.zpg[b.k]-fa.zpg[a.k])[0];cards.push(hl('Best free agent',f1(fa.value),esc(fa.name),`value · strongest in ${bc?bc.l:'–'} · ${esc(fa.nba)} ${esc(fa.pos)}`,'pv|'+fa.name))}
  const lead=cd.map(d=>d.pairs[0]).sort((a,b)=>b.rel-a.rel)[0];
  if(lead)cards.push(hl('Biggest category lead',rAmt(lead.amt),`${tname(lead.a.id)} in ${lead.c.l}`,lead.c.neg?`fewer turnovers ${per()} than #2 ${tname(lead.b.id)}`:`${unit(lead.c)} ${per()} ahead of #2 ${tname(lead.b.id)}${lead.c.pct?' at the same attempts':''}`,`tc|${lead.a.id}|${lead.c.k}`,lead.a.id===ME));
  const g=pg[0];if(g)cards.push(hl('Most playoff games',g.g.toFixed(0),tname(g.id),`expected player-games in weeks ${PO_WEEKS[0]} to ${PO_WEEKS[PO_WEEKS.length-1]}; the league average is ${mean(pg.map(x=>x.g)).toFixed(0)}`,'tgm|'+g.id,g.id===ME));
  return `<section class="panel">${head('At a glance',`The numbers that stand out in the league right now. ${stamp()} Tap any card for the breakdown.`)}<div class="ov-hls">${cards.join('')}</div>
    ${how(['Every card comes from the same model as the rest of the board: ESPN projections (blended with real games once they start), the real NBA schedule and the 11-starter daily lineup limit.',
      'Power rank and its "categories won in an average week" come from the League tab. Matchup chances are the chance of taking at least five of the nine categories that week. Value adds up a player\'s z-scores (how far above or below an average rostered player) in '+(S.punt.size?'the categories you have not punted':'all nine categories')+'.',
      'The biggest category lead compares the gap between the #1 and #2 teams with how spread out all ten teams are in that category, so a lead in points and a lead in blocks can be compared fairly. For percentages the gap is counted in made shots at the same attempts. Playoff games are expected player-games in the fantasy playoffs after the daily lineup limit.'])}</section>`}

function secWeek(){const w=Math.min(curWeek,REGW),all=weekMus(w);if(!all.length||regOver())return '';
  // your matchup first, then the rest closest first; the tags still mark the closest and most lopsided of all of them
  const mus=[...all.filter(m=>m.mine),...all.filter(m=>!m.mine)],first=all[0],last=all.length>1?all[all.length-1]:null;
  const card=m=>{const o=m.o,L=o.live,ma=m.a===ME;
    const tagTxt=m===first?'Closest':m===last?'Most lopsided':'';
    return `<button type="button" class="ov-mu${m.mine?' me':''}" data-stat="mw|${m.a}|${m.b}|${w}" data-tip="${esc(`${teamById[m.a].name} ${pc(o.win)}, ${teamById[m.b].name} ${pc(1-o.win)} to win ${weekName(w)}`)}">
      <span class="ov-mu-h">${tagTxt?`<span class="lbl">${tagTxt}</span>`:''}${m.mine?'<span class="pill star">You</span>':''}${L?`<span class="pill live">Live ${L.score[0]}–${L.score[1]}${L.score[2]?'–'+L.score[2]:''}</span>`:''}<span class="pill ${tag(o.win)[1]}">${tag(o.win)[0]}</span></span>
      <span class="ov-mu-t"><i class="ov-sw${ma?' me':''}"></i><b>${tname(m.a)}</b><em>${pc(o.win)}</em></span>
      <span class="ov-mu-t"><i class="ov-sw b"></i><b>${tname(m.b)}</b><em>${pc(1-o.win)}</em></span>
      <span class="ov-split" aria-hidden="true"><i class="${ma?'me':''}" style="width:${(o.win*100).toFixed(1)}%"></i></span>
      <small>${o.exp.toFixed(1)}–${o.expL.toFixed(1)} expected categories · ${m.swing} swing categor${m.swing===1?'y':'ies'}</small></button>`};
  return `<section class="panel">${head(`${preseason?'Up next':'This week'}: ${weekName(w)}`,`${weekLabel(w)}. ${mus[0].mine?'Your matchup first, then the closest.':'Closest first.'} The bar is the first team's chance to win the week.`,`<button type="button" class="btn ghost" data-go="matchup" data-week="${w}" data-wkteam="${ME}">Full matchup</button>`)}
    <div class="ov-mus">${mus.map(card).join('')}</div>
    ${how(['Each card is one matchup with the favorite listed first, except yours, which always lists you first, in blue. Winning the week means taking at least five of the nine categories; the mark in the middle of the bar is 50%. The tag reads the first team\'s chance: Lock from 80%, Lean yes from 62%, Swing from 38%, Lean no from 20%, Long shot below that.',
      'Swing categories are ones where neither side is above 62%. Each team\'s week is built day by day from the real NBA schedule and the 11-starter limit'+(LIVEW===w?', starting from ESPN\'s live totals':'')+'.'])}</section>`}

function secRace(){const R=race(),rows=R.rows,row=r=>({label:tname(r.t.id),v:r.po*100,txt:pc(r.po),me:r.t.id===ME,stat:'tpo|'+r.t.id,
    tip:`${r.t.name}: playoffs ${pc(r.po)}, #1 seed ${pc(r.s.top)}${r.title!=null?', title '+pc(r.title):''}, average finish ${r.avg.toFixed(1)}, projected ${Math.round(r.s.w)}-${Math.round(r.s.l)} in categories`});
  const bars=o=>`<div class="ov-wide">${CH.hbars(o,{max:100,stack:true,label:'Playoff odds'})}</div>`;
  const me=rows.find(r=>r.t.id===ME),fifth=rows[4],sixth=rows[5],cards=[];
  cards.push(hl('Your odds',pc(me.po),`${ord(me.rank)}-best odds of 10`,`average finish ${me.avg.toFixed(1)}${me.title!=null?` · title ${pc(me.title)}`:''}`,'tpo|'+ME,true));
  if(fifth)cards.push(hl('Last spot in',pc(fifth.po),tname(fifth.t.id),'fifth-best odds',`tpo|${fifth.t.id}`,fifth.t.id===ME));
  if(sixth)cards.push(hl('First team out',pc(sixth.po),tname(sixth.t.id),'sixth-best odds',`tpo|${sixth.t.id}`,sixth.t.id===ME));
  if(R.to){const f=[...rows].sort((a,b)=>b.title-a.title)[0];cards.push(hl('Title favorite',pc(f.title),tname(f.t.id),`playoffs ${pc(f.po)}`,'ttl|'+f.t.id,f.t.id===ME))}
  const locks=rows.filter(r=>r.po>=.9).length,shots=rows.filter(r=>r.po<.1).length;
  return `<section class="panel">${head('Playoff race',`The top five of ten make the playoffs. ${locks?`${locks} team${locks>1?'s are':' is'} above 90%`:'No team is above 90%'}${shots?`, ${shots} below 10%`:''}. Your team is in blue.`)}
    ${bars(rows.slice(0,5).map(row))}<div class="ov-cut">Playoff line</div>${bars(rows.slice(5).map(row))}
    <div class="ov-hls sm">${cards.join('')}</div>
    ${how(['Odds come from 4,000 simulated seasons: every remaining regular-season week is played category by category with the matchup model, and the top five by category win percentage make the playoffs, as the league is set up (five teams, seeded by category record). ESPN\'s tiebreakers are not modeled. Teams are ordered by playoff odds, so the line falls between the five most likely playoff teams and the rest.'+(R.to?' Title odds come from the Season sim view, which plays out an assumed five-team bracket.':''),
      'Each bar\'s tooltip also shows the #1-seed odds, the average finish and the projected final category record: the record so far plus the expected results of every week left.'])}</section>`}

function secCats(){const cd=catData(),me=tm(ME);
  const card=d=>{const c=d.c,t1=d.order[0],t2=d.order[1],r=me.catRank[c.k],gap=d.pairs[0],[v1,v2]=fvPair(c,t1.line[c.k],t2.line[c.k]);
    const pl=(lab,p,isFa)=>{if(!p)return '';const v=c.pct?`${f3(p.pct[c.k])} <span class="note">on ${(+p.pg[c.pct[1]]||0).toFixed(1)}</span>`:(+p.pg[c.k]).toFixed(1);
      return `<div class="ov-kv"><span class="lbl">${lab}</span>${sbtn(`pc|${p.name}|${c.k}`,esc(p.name))}<span class="v">${v}</span><small>${isFa?'Free agent':esc(teamById[p.team]?teamById[p.team].name:'')} · ${esc(p.nba)} · per game</small></div>`};
    return `<div class="ov-cat${S.punt.has(c.k)?' ov-pun':''}"><div class="ov-cat-h">${sbtn('lc|'+c.k,c.l)}<span class="note">${c.n}${c.neg?', fewer is better':''}</span><button type="button" class="pill ${rc(r)}" data-stat="tc|${ME}|${c.k}" title="Your rank in ${c.n}">You #${r}</button></div>
      <div class="ov-kv lead"><span class="lbl">${c.neg?'Fewest':'Leader'}</span>${sbtn(`tc|${t1.id}|${c.k}`,tname(t1.id))}<span class="v">${v1}</span><small>${word(gap.rel)} lead: ${gapP(c,gap.amt)} ${c.neg?'fewer than':'ahead of'} ${tname(t2.id)} (${v2})</small></div>
      ${pl(c.neg?'Most turnovers':c.pct?'Best impact':'Top player',d.top,false)}${c.neg?'':pl('Best free agent',d.fa,true)}</div>`};
  const pairs=cd.flatMap(d=>d.pairs).sort((a,b)=>a.rel-b.rel).slice(0,6);
  const race=x=>{const c=x.c,[va,vb]=fvPair(c,x.a.line[c.k],x.b.line[c.k]),mine=x.a.id===ME||x.b.id===ME;
    return `<li class="ov-race${mine?' me':''}">${sbtn('lc|'+c.k,c.l)}<span class="tm"><span>#${x.ra} ${sbtn(`tc|${x.a.id}|${c.k}`,tname(x.a.id))} <code>${va}</code></span><i>vs</i><span>#${x.rb} ${sbtn(`tc|${x.b.id}|${c.k}`,tname(x.b.id))} <code>${vb}</code></span><small>${gapP(c,x.amt)} apart</small></span><span class="pill ${x.rel<.05?'p2':x.rel<.25?'p1':''}">${x.rel<.05?'Dead heat':x.rel<.25?'Tight':'Close'}</span></li>`};
  return `<section class="panel">${head('Category leaders',`Who leads each category by roster totals ${per()}, how safe the lead is, and the best players. Tap a category, team or player for the breakdown.`)}
    <div class="ov-cats">${cd.map(card).join('')}</div>
    <h3>Closest races</h3><p class="note">Teams next to each other in a category's standings, closest first. Small moves here change ranks.</p>
    <ul class="ov-races">${pairs.map(race).join('')}</ul>
    ${how([`Team totals add up every rostered player's projected numbers ${SEA()?'over the season':'per game'}; FG%, FT% and 3P% are total makes over total attempts. That is roster strength before the weekly schedule and the daily lineup limit, which the matchup odds handle.`,
      'Top player is the best per-game number among rostered players. For the percentages it is impact (how far above the league average, times attempts; the number after the percentage is attempts a game), so a high-volume shooter beats a 3-for-3 bench player. For TO the card shows the player with the most turnovers, the biggest drag on a team.',
      'A lead or gap is measured against how spread out the ten teams are in that category (their standard deviation), so races in different categories can be compared: a lead under a quarter of that spread is narrow, up to three quarters is clear, and beyond is commanding. A race under 5% of it is a dead heat, under a quarter is tight. The plain number is what separates the teams; for percentages it is made shots at the same attempts.'])}</section>`}

function secMine(){const t=tm(ME),rr=myRace(),pg=poG(),gi=pg.find(x=>x.id===ME),vr=[...M.teams].sort((a,b)=>b.value-a.value).findIndex(x=>x.id===ME)+1;
  const cards=[hl('Vs the field',scoreStr(t.rec),'category record, roster against roster',`favored against ${t.rec.mw} of the other 9 teams`,'trec|'+ME,true),
    hl('Power rank',`#${t.pr}`,`grade ${t.grade}`,`${t.rr.toFixed(2)} categories in an average week`,'tpr|'+ME,true),
    hl('Team value',f1(t.value),`${ord(vr)} of 10`,'sum of every player\'s value','tval|'+ME,true),
    hl('Playoff games',gi?gi.g.toFixed(0):'–',gi?`${ord(gi.rank)} of 10`:'',`expected player-games in weeks ${PO_WEEKS[0]} to ${PO_WEEKS[PO_WEEKS.length-1]}`,'tgm|'+ME,true)];
  const bars=[...rr].sort((a,b)=>b.zt-a.zt).map(d=>({label:`${d.c.l} <small>#${d.r}</small>`,v:d.zt,txt:fv(d.c,t.line[d.c.k]),stat:`tc|${ME}|${d.c.k}`,cls:S.punt.has(d.c.k)?'pun':d.zt>=0?'pos':'neg',
    tip:`${d.c.n}: ${fv(d.c,t.line[d.c.k])} ${per()}, #${d.r} of 10; league average ${fv(d.c,d.m)}${S.punt.has(d.c.k)?' (punted)':''}`}));
  const cell=(d,txt,sub)=>`<td class="num" ${sx(`tc|${ME}|${d.c.k}`)}>${txt}${sub?`<span class="rk">${sub}</span>`:''}</td>`;
  const tbl=`<div class="scroll ov-tbl"><table><thead><tr><th class="l stick" scope="col">Category</th><th scope="col">Rank</th><th scope="col">Total</th><th scope="col" title="How much more passes the team ranked just above you">To pass</th><th scope="col" title="How much you could lose before the team just below catches you">Lead</th></tr></thead><tbody>
    ${rr.map(d=>`<tr class="${S.punt.has(d.c.k)?'ov-pun':''}"><td class="l stick">${sbtn('lc|'+d.c.k,`<b>${d.c.l}</b>`)}</td><td class="z ${rc(d.r)}" ${sx(`tc|${ME}|${d.c.k}`)}>#${d.r}</td>${cell(d,fv(d.c,t.line[d.c.k]))}${d.ab?cell(d,(d.c.neg?'−':'+')+upAmt(d.up),'past '+tabbr(d.ab.id)):cell(d,'–','leader')}${d.be?cell(d,rAmt(d.cush),'over '+tabbr(d.be.id)):cell(d,'–','last')}</tr>`).join('')}</tbody></table></div><p class="note">To pass and Lead are ${per()==='a game'?'per game':'over the season'}; for FG%, FT% and 3P% they count made shots at your current attempts.</p>`;
  return `<section class="panel">${head(`Your team: ${tname(ME)}`,'Strengths and holes against the rest of the league. Longer bars to the right are better (TO is flipped).',`<button type="button" class="btn ghost" data-team="${ME}">Team page</button>`)}
    <div class="ov-hls sm">${cards.join('')}</div>
    ${CH.hbars(bars,{center:true,label:'Your categories against the league average'})}
    <div class="legend"><span><i class="pos"></i>Above the league average</span><span><i class="neg"></i>Below</span>${S.punt.size?'<span><i class="mut"></i>Punted</span>':''}</div>
    ${tbl}
    ${how([`Bars show how far your roster total sits above or below the average of the ten teams in each category, measured in how spread out the teams are (TO is flipped, so longer to the right is always better). The number at the end is your total ${per()}.`,
      'To pass is how much more you would need to draw level with the team ranked just above you, rounded up so it really passes; for percentages it counts extra made shots (makes) at your current attempts, and for TO it is turnovers to cut. Lead is how much you could lose before the team just below draws level, counted the same way. Both use roster totals '+per()+', the same numbers as each category\'s team breakdown. Punted categories stay in the table, faded, because the league still counts them.'])}</section>`}

function secValues(){const top=M.players.filter(p=>p.value!=null).sort((a,b)=>b.value-a.value).slice(0,10);
  const bars=top.map(p=>({label:`${esc(p.name)} <small>${esc(teamAbbr(p))}</small>`,v:p.value,txt:f1(p.value),me:p.team===ME,stat:'pv|'+p.name,tip:`${p.name}: value ${f1(p.value)}, #${p.rank} of the rostered players, trade value ${p.tv.toFixed(0)}`}));
  const fas=M.fas.filter(p=>p.value!=null).sort((a,b)=>b.value-a.value).slice(0,3);
  const st=steals(),by=x=>x.by!=null&&teamById[x.by]?tname(x.by):'';
  const li=(stat,name,v,small)=>`<li>${sbtn(stat,name)}<span class="v">${v}</span><small>${small}</small></li>`;
  return `<section class="panel">${head('Best values',`The most valuable rostered players${S.punt.size?' for your build':''} ${SEA()?'over the season':'per game'}; your players are in blue.`)}
    <div class="ov-wide">${CH.hbars(bars,{stack:true,label:'Top ten players by value'})}</div>
    <div class="cols"><div class="drill-sec"><h3>Best free agents</h3><ul class="ov-list">${fas.map(p=>{const bc=CATS.filter(live).sort((a,b)=>p.zpg[b.k]-p.zpg[a.k]).slice(0,2).map(c=>c.l).join(' and ');
        return li('pv|'+p.name,esc(p.name),f1(p.value),`${esc(p.nba)} · ${esc(p.pos)} · strongest in ${bc}`)}).join('')||'<li><small>No free agents with data.</small></li>'}</ul></div>
      <div class="drill-sec"><h3>Draft steals</h3><ul class="ov-list">${st.rows.map(x=>st.draft
        ?li('dpk|'+x.n,`${esc(x.p.name)} <span class="note">pick ${pickStr(x.n)}</span>`,'+'+Math.round(x.d),`Worth ${Math.round(x.v)} in ${st.vw}; the ${ord(x.n)} pick usually returns ${Math.round(x.e)}${by(x)?` · drafted by ${by(x)}`:''}`)
        :li('dpk|'+x.n,`${esc(x.p.name)} <span class="note">pick ${pickStr(x.n)}</span>`,`#${x.p.rank}`,`Taken ${ord(x.n)} overall, ranks ${ord(x.p.rank)} by value · ${tname(x.p.team)}`)).join('')||'<li><small>No draft picks to compare.</small></li>'}</ul></div></div>
    ${how([`Value adds up a player's z-scores in every category${S.punt.size?' you have not punted':''}: how far above or below an average rostered player they are, ${SEA()?'over the season, so games played count':'per game'}. FG%, FT% and 3P% use impact, so shot volume counts.`,
      st.draft?'Draft steals are the Draft view\'s best steals: how much more '+st.vw+' a pick in this league\'s draft is worth today than that slot usually returns. Open one for the pick, or the Draft view for every pick.'
        :'Draft steals compare where a player went in this league\'s draft with where they rank by value among rostered players now. Players added after the draft are not counted.'])}</section>`}

function vOverview(){css();
  return safe('glance',secGlance)+`<div class="cols">${safe('week',secWeek)}${safe('race',secRace)}</div>`+safe('cats',secCats)+`<div class="cols">${safe('mine',secMine)}${safe('values',secValues)}</div>`}

/* ---------- Insights for Matt's team (Home) ---------- */
function insights(){const t=tm(ME),out=[],w=Math.min(curWeek,REGW),regLeft=curWeek<=REGW,rr=myRace();
  // 1. this week's matchup: its swing categories and what the closest one is worth. Uses the matchup drill's own list
  //    (LAB.swingCats: closest to 50% first) when it is loaded, so the numbers match the drill this opens.
  const opp=regLeft?oppOf(ME,w):null;
  if(opp!=null){const o=mp(ME,opp,w);let sw=null;
    try{if(typeof LAB.swingCats==='function'){const r=LAB.swingCats(ME,opp,w);if(Array.isArray(r))sw=r.map(x=>({c:catOf(x.k),p:x.p,w1:x.ifWon,w0:x.ifLost})).filter(x=>x.c&&isFinite(x.p)&&isFinite(x.w1)&&isFinite(x.w0))}}catch(e){sw=null}
    if(!sw||!sw.length)sw=CATS.map(c=>({c,p:o.p[c.k],w1:matchOdds({...o.p,[c.k]:1}).win,w0:matchOdds({...o.p,[c.k]:0}).win})).sort((a,b)=>Math.abs(a.p-.5)-Math.abs(b.p-.5)||(b.w1-b.w0)-(a.w1-a.w0));
    const band=sw.filter(x=>x.p>=SW_LO&&x.p<SW_HI),top=sw[0],L=o.live;
    if(top)out.push({k:preseason?'Up next':'This week',tone:o.win>=SW_HI?'good':o.win<SW_LO?'bad':'',stat:`mc|${ME}|${opp}|${w}|${top.c.k}`,
      t:`${weekName(w)} against ${tname(opp)}: ${an(pc(o.win))} <b>${pc(o.win)}</b> chance to win${L?` (live ${L.score[0]}–${L.score[1]}${L.score[2]?'–'+L.score[2]:''})`:''}, with ${band.length?`${band.length} swing categor${band.length===1?'y':'ies'} (${band.map(x=>x.c.l).join(', ')})`:'no swing categories'}. ${band.length?'The closest':'Your closest'}, ${top.c.l} at ${pc(top.p)}, takes you to <b>${pc(top.w1)}</b> if you win it and <b>${pc(top.w0)}</b> if you lose it.`})}
  // 2. playoff odds and the cut line
  const R=race(),me=R.rows.find(r=>r.t.id===ME);
  if(me){const cut=me.rank<=5?R.rows[5]:R.rows[4],ttl=me.title!=null?`, and win the title in <b>${pc(me.title)}</b>`:'',done=regOver();
    out.push({k:'Playoffs',tone:me.po>=.65?'good':me.po<.35?'bad':'',stat:'tpo|'+ME,
      t:me.po>=.999?(done?`You made the playoffs${me.title!=null?`, and win the title in <b>${pc(me.title)}</b> of simulated brackets`:''}.`:`You make the playoffs in every one of 4,000 simulated seasons${ttl}.`)
       :me.po<=.001?(done?'You missed the playoffs.':'You miss the playoffs in every one of 4,000 simulated seasons.')
       :`You make the playoffs in <b>${pc(me.po)}</b> of 4,000 simulated seasons, the ${ord(me.rank)}-best odds of 10${ttl}.${cut?` ${me.rank<=5?'The first team out':'The last team in'}, ${tname(cut.t.id)}, is at ${pc(cut.po)}.`:''}`})}
  // 3. cheapest climb (unpunted categories): the smallest gap to the team above, measured against the spread of the ten teams.
  //    The weakest category is left to its own insight when that one shows.
  const worst=rr.filter(d=>live(d.c)).sort((a,b)=>b.r-a.r||a.zt-b.zt)[0],showWorst=!!(worst&&worst.r>=6);
  const climbs=rr.filter(d=>live(d.c)&&d.ab).sort((a,b)=>a.upRel-b.upRel);
  let cl=climbs[0],skip=false;if(cl&&showWorst&&cl.c.k===worst.c.k&&climbs[1]){cl=climbs[1];skip=true}
  if(cl&&!(showWorst&&cl.c.k===worst.c.k))out.push({k:'Cheapest climb',tone:'',stat:`tc|${ME}|${cl.c.k}`,
    t:`<b>${passP(cl.c,cl.up)}</b> would lift you from #${cl.r} to #${cl.r-1} in ${cl.c.l}, past ${tname(cl.ab.id)}: your easiest rank to gain${skip?' outside your weakest category':''}.`});
  // 4. biggest hole
  if(showWorst){const big=worst.ab&&worst.upRel>1;
    out.push({k:'Weakest category',tone:'bad',stat:`tc|${ME}|${worst.c.k}`,
      t:`${worst.c.l} is your weakest category at <b>#${worst.r} of 10</b>${worst.ab?`, ${gapP(worst.c,worst.up)} ${worst.c.neg?'more than':'behind'} ${tname(worst.ab.id)} at #${worst.r-1}`:''}${big?'. The gap is big enough that punting it is worth a look':''}.`})}
  // 5. biggest strength, and whether the lead leaves room to trade from it
  const best=rr.filter(d=>live(d.c)).sort((a,b)=>a.r-b.r||(b.cushRel??0)-(a.cushRel??0))[0];
  if(best&&best.r<=4&&best.be)out.push({k:'Strongest category',tone:'good',stat:`tc|${ME}|${best.c.k}`,
    t:best.r===1?`You lead the league in ${best.c.l} by <b>${gapP(best.c,best.cush)}</b> over ${tname(best.be.id)}${best.cushRel>=.25?', room to trade some of it away and stay #1':', a narrow lead to protect'}.`
      :`${best.c.l} is your best category at <b>#${best.r}</b>, ${gapP(best.c,best.cush)} clear of ${tname(best.be.id)} at #${best.r+1}.`});
  // 6. games in the fantasy playoffs, when they stand out
  const pg=poG(),gi=pg.find(x=>x.id===ME);
  if(regLeft&&gi&&(gi.rank<=3||gi.rank>=8)){const avg=mean(pg.map(x=>x.g));
    out.push({k:'Playoff schedule',tone:gi.rank<=3?'good':'bad',stat:'tgm|'+ME,
      t:`Your roster has about <b>${gi.g.toFixed(0)}</b> expected player-games in the fantasy playoffs (weeks ${PO_WEEKS[0]} to ${PO_WEEKS[PO_WEEKS.length-1]}), <b>${ord(gi.rank)} of 10</b>${gi.rank===1?`, ${(gi.g-avg).toFixed(0)} more than the league average`:`; ${tname(pg[0].id)} leads with ${pg[0].g.toFixed(0)}`}.`})}
  // 7. the toughest week ahead
  if(regLeft){const ws=WEEKS.filter(x=>x>w&&x<=Math.min(w+5,REGW)),nx=ws.map(x=>{const op=oppOf(ME,x);return op==null?null:{x,op,q:mp(ME,op,x)}}).filter(Boolean).sort((a,b)=>a.q.win-b.q.win)[0];
    if(nx)out.push({k:'Toughest week ahead',tone:nx.q.win<SW_LO?'bad':'',stat:`mw|${ME}|${nx.op}|${nx.x}`,
      t:`Your toughest week ${ws.length>1?`of weeks ${ws[0]}-${ws[ws.length-1]}`:'ahead'} is ${weekName(nx.x)} against ${tname(nx.op)}, with ${an(pc(nx.q.win))} <b>${pc(nx.q.win)}</b> chance to win it.`})}
  // 8. roster against roster, as a fallback
  out.push({k:'Vs the field',tone:t.rec.mw>=5?'good':t.rec.mw<=3?'bad':'',stat:'trec|'+ME,
    t:`Roster against roster, you would beat <b>${t.rec.mw} of the other 9 teams</b> (${scoreStr(t.rec)} in categories).`});
  return out.slice(0,6)}

function panelInsights(){css();const ins=insights();if(!ins.length)return '';
  return `<section class="panel" id="ov-insights">${head('Insights','The most useful things the numbers say about your team right now. Tap one to see the proof.')}
    <ul class="ov-insl">${ins.map(x=>`<li><button type="button" class="ov-in ${x.tone}" data-stat="${esc(x.stat)}"><span class="dot" aria-hidden="true"></span><span class="bd"><span class="lbl">${x.k}</span><span class="tx">${x.t}</span></span><span class="go"><b>See why </b>›</span></button></li>`).join('')}</ul>
    ${how(['The board looks at your team from several angles and shows up to six findings, in this order: this week\'s matchup (a swing category is one where neither side is above 62%; the closest is the one nearest 50%, and the two chances are your chance to win the week if you win or lose it), your playoff odds from 4,000 simulated seasons, your easiest rank to gain (the smallest gap to the team above, measured against how spread out the ten teams are in that category), your weakest and strongest categories, your games in the fantasy playoffs when they rank top three or bottom three, and your toughest week in the next five.',
      'Categories you punt are left out of the climb, weakest and strongest findings; matchups and standings still count all nine. Amounts to pass are rounded up so they really pass, and percentage gaps are counted in made shots at your current attempts. The dot is green for good news, red for a problem and grey for neutral. These are projections, not guarantees.'])}</section>`}

/* ---------- registration ---------- */
HUB.push({k:'overview',label:'Overview',order:10,note:'The league at a glance: the numbers that stand out, this week\'s matchups, the playoff race, category leaders and your team\'s strengths and holes. Every number opens its breakdown.',render:vOverview});
PANELS.home.push(panelInsights);
[['overview','Overview','League at a glance: leaders, races, matchups, playoff race','overview glance summary league leaders races highlights'],
 ['cats','Categories','Every category across the league: leaders, totals, scarcity, punts','categories category leaders scarcity punt'],
 ['teams','Teams','Compare teams: radar, rank heat map, archetypes, team DNA','teams compare radar heat map archetypes dna'],
 ['sim','Season sim','Playoff and title odds, seed chances, the weeks that decide the race','season sim simulation playoffs title odds seeds bracket'],
 ['draft','Draft','The draft board, steals and reaches, team draft grades','draft board picks steals reaches grades'],
 ['pos','Positions','Positional scarcity, replacement level, best free agent at each spot','positions position scarcity replacement pg sg sf pf c'],
 ['history','History','Past seasons of this league','history past seasons champions records']]
 .forEach(([k,l,sub,kw])=>CMDS.push({label:'Stats: '+l,sub,kw:'stats lab view '+kw,tag:'Stats',act:()=>{const ok=hasHub(k);go('stats',{hub:ok?k:'overview'});if(!ok)toast(`The ${l} view isn't ready yet, so here is the Overview.`)}}));
CMDS.push({label:'My insights',sub:'The most useful things the numbers say about your team',kw:'insights tips advice my team findings',tag:'Home',act:()=>{go('home');setTimeout(()=>scrollToId('ov-insights'),0)}});
})();
