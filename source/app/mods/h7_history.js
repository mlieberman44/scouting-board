/* h7_history.js: league history, built from DATA.history (one entry per past ESPN season).
   Stats tab view  order 70, k 'history': your history card, champions by season, the all-time manager table, the all-time
                   head-to-head heat map, the record book and what each season's data covers.
   Drills  hs|<year>            one season: standings, bracket as played, notable results, best weeks, moves, data gaps.
           own|<guid>           one manager's career (any of their ESPN member ids works).
           hh|<guidA>|<guidB>   two managers' head-to-head history.
   Managers are tracked by ESPN member id (owner guid), never by team id or name: team ids were reused by different people.
   Registers nothing when DATA.history has no seasons. Everything is computed once, on first use, from the baked-in data.
   Shared helpers on window.LAB: histModel() (the whole model), histPerson(teamId) (the past manager matched to a current team). */
(()=>{
const SRC=typeof DATA!=='undefined'&&DATA&&DATA.history&&Array.isArray(DATA.history.seasons)?DATA.history.seasons:[];
const HS=SRC.filter(s=>s&&isFinite(+s.year)&&Array.isArray(s.teams)&&s.teams.length).sort((a,b)=>a.year-b.year);
if(!HS.length)return;
const LAB=window.LAB=window.LAB||{};
const SK='h7';
S.sort[SK]=S.sort[SK]||['cwp','desc'];

/* ---------- small helpers ---------- */
const wp=(w,l,t)=>{const n=w+l+t;return n?(w+t/2)/n:null};
const P=x=>x==null||!isFinite(x)?'–':Math.round(x*100)+'%';
const P1=x=>x==null||!isFinite(x)?'–':(x*100).toFixed(1)+'%';
const rec=(w,l,t)=>`${w}-${l}${t?'-'+t:''}`;
const rec3=(w,l,t)=>`${w}-${l}-${t}`;
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;
const list=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
const facts=a=>`<div class="facts">${a.join('')}</div>`;
const pcls=x=>x==null?'':x>=.6?'p2':x>=.53?'p1':x<=.4?'n2':x<=.47?'n1':'';
const CORD=['PTS','REB','AST','STL','BLK','3PM','TO','FG%','FT%','3P%'];
const cidx=c=>{const i=CORD.indexOf(c);return i<0?99:i};
const catSort=a=>[...a].sort((x,y)=>cidx(x)-cidx(y));
const NEG=c=>c==='TO';
const PCT=c=>/%$/.test(c);
const fmtCat=(c,v)=>v==null||!isFinite(v)?'–':PCT(c)?f3(v):String(Math.round(v*10)/10);
const fixName=s=>{s=String(s||'').replace(/\s+/g,' ').trim();return /[A-Z]/.test(s)?s:s.replace(/(^|[\s-])([a-z])/g,(m,a,b)=>a+b.toUpperCase())};
const TIER={WINNERS_BRACKET:'Title bracket',WINNERS_CONSOLATION_LADDER:'Placement game',LOSERS_CONSOLATION_LADDER:'Consolation'};
const css=()=>addCSS('h7hist-css',`
.h7-me{display:flex;flex-direction:column;gap:12px}
.h7-lead{margin:0;font-size:.95rem;max-width:80ch}
.h7-lead b{font-weight:600}
.h7-champs{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,210px),1fr));gap:10px}
.h7-cs{position:relative;border:1px solid var(--line);border-radius:10px;padding:12px 14px 12px;display:flex;flex-direction:column;gap:6px;background:var(--panel);min-width:0}
.h7-cs::before{content:"";position:absolute;left:14px;right:14px;top:-1px;height:3px;border-radius:0 0 3px 3px;background:var(--s1)}
.h7-cs .h7-yr{font:700 1.35rem/1 var(--display);letter-spacing:.02em;text-align:left}
.h7-cs .h7-who{display:flex;flex-direction:column;gap:1px;min-width:0}
.h7-cs .h7-who .lbl{font-size:.64rem}
.h7-cs .h7-who b{font-weight:600;font-size:.92rem;min-width:0;overflow-wrap:anywhere}
.h7-cs .h7-who small{color:var(--muted);font-size:.75rem;overflow-wrap:anywhere}
.h7-cs .h7-mine{margin-top:auto;padding-top:6px;border-top:1px solid var(--soft);font-size:.8rem;color:var(--muted);display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.h7-cs .h7-mine b{color:var(--ink);font:600 .84rem var(--mono)}
td.h7-nm{white-space:normal;min-width:9.5em;max-width:15em;overflow-wrap:break-word}
td.h7-nm b{font-weight:600}
td.h7-nm small{display:block;color:var(--muted);font-size:.74rem;font-weight:400}
table.h7-hm{width:auto}
table.h7-hm th{padding:6px 5px;font-size:.66rem;letter-spacing:.03em;text-transform:none;max-width:6.5em;overflow:hidden;text-overflow:ellipsis}
table.h7-hm th.h7-ch{text-align:center}
table.h7-hm td.h7-c{padding:6px 5px;text-align:center;font:500 .76rem var(--mono);color:var(--ink);min-width:3.3em}
table.h7-hm td.h7-c.self{background:var(--soft);color:var(--muted)}
table.h7-hm td.h7-c.none{color:var(--muted)}
table.h7-hm tr.me td.h7-c{box-shadow:inset 0 2px 0 var(--s2),inset 0 -2px 0 var(--s2)}
.h7-ph{display:none}
table.h7-covt{table-layout:auto}table.h7-covt th{white-space:normal}
table.h7-covt td.h7-wrap{white-space:normal;min-width:0;font-size:.86rem}
table.h7-covt td.h7-wrap small{display:block;color:var(--muted);font-size:.74rem}
table.h7-covt td.h7-wrap b{font-weight:600}
table.h7-covt td.h7-cs1{width:13em;max-width:40%}
table.h7-covt td.h7-cs1 b{font-weight:700}
td.h7-when b{font-weight:600}
.h7-key{white-space:nowrap}
.h7-ramp{display:inline-flex;gap:2px;vertical-align:middle;margin:0 6px}
.h7-ramp i{width:16px;height:12px;border-radius:2px;display:inline-block;margin:0}
.h7-rb{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,290px),1fr));gap:10px}
.h7-rc{border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;min-width:0;background:var(--panel)}
.h7-rc h3{font-size:1rem}
.h7-rc ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}
.h7-rc li{display:grid;grid-template-columns:1.3em 4.6em minmax(0,1fr);gap:8px;align-items:baseline;min-width:0}
.h7-rc li>i{font:500 .74rem var(--mono);font-style:normal;color:var(--muted)}
.h7-rc li .h7-big{font:700 1.15rem/1 var(--display);font-variant-numeric:tabular-nums;text-align:left;white-space:nowrap}
.h7-rc li>span{min-width:0;font-size:.84rem;overflow-wrap:anywhere}
.h7-rc li>span small{display:block;color:var(--muted);font-size:.74rem}
.h7-res{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.h7-res li{display:grid;grid-template-columns:3.4em minmax(0,1fr);gap:10px;align-items:baseline;min-width:0}
.h7-res li>b{font:700 1.05rem/1 var(--display);font-variant-numeric:tabular-nums;white-space:nowrap}
.h7-res li>span{min-width:0;font-size:.84rem;overflow-wrap:anywhere}
.h7-res li>span small{display:block;color:var(--muted);font-size:.74rem}
.h7-br{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,138px),1fr));gap:10px;align-items:stretch}
.h7-rd{display:flex;flex-direction:column;gap:8px;min-width:0}
.h7-rd .h7-gs{display:flex;flex-direction:column;justify-content:space-around;gap:8px;flex:1}
.h7-g{border:1px solid var(--line);border-radius:8px;background:var(--raise);display:flex;flex-direction:column;min-width:0;overflow:hidden}
.h7-gt{display:grid;grid-template-columns:1.9em minmax(0,1fr) auto;gap:4px;align-items:center;padding:5px 8px;background:none;border:0;font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer;min-width:0}
.h7-gt+.h7-gt{border-top:1px solid var(--line)}
.h7-gt:hover{background:var(--soft)}
.h7-gt i{font:500 .7rem var(--mono);font-style:normal;color:var(--muted)}
.h7-gt span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem}
.h7-gt b{font:600 .8rem var(--mono)}
.h7-gt.w span{font-weight:700}
.h7-gt.w b{color:var(--pos-fg)}
.h7-g small{display:block;padding:3px 8px 5px;font-size:.7rem;color:var(--warn);border-top:1px dashed var(--line)}
.h7-g.bye{border-style:dashed;background:none}
.h7-g small.h7-tn{color:var(--muted);border-top:0;padding-top:0;overflow-wrap:anywhere}
.h7-g.champ{border-color:var(--s1);box-shadow:inset 3px 0 0 var(--s1)}
.h7-strip{display:flex;flex-wrap:wrap;gap:4px}
.h7-strip button{width:30px;height:30px;border-radius:6px;border:0;font:700 .8rem var(--display);cursor:pointer;display:grid;place-items:center;background:var(--soft);color:var(--ink)}
.h7-strip button.w{background:var(--pos-2);color:var(--pos-ink)}.h7-strip button.l{background:var(--neg-2);color:var(--neg-ink)}
.h7-strip button.po{outline:2px solid var(--s1);outline-offset:-2px}
.h7-strip button:hover{box-shadow:inset 0 -2px 0 var(--accent)}
.h7-cov{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:5px;font-size:.85rem;max-width:88ch}
.h7-cov li::marker{color:var(--muted)}
details.h7-raw summary{cursor:pointer;font:600 .8rem var(--body);color:var(--accent)}
details.h7-raw p{color:var(--muted);font-size:.8rem;margin:6px 0 0;max-width:88ch;overflow-wrap:anywhere}
.h7-segs{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
@media (max-width:560px){.h7-champs{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.h7-cs{padding:11px 11px}.h7-cs .h7-who b{font-size:.86rem}.h7-cs .h7-mine{flex-wrap:wrap;gap:2px 8px}.h7-rc li{grid-template-columns:1.2em 4.2em minmax(0,1fr)}td.h7-nm{min-width:7.5em;max-width:10.5em}
  td.h7-when{max-width:none;min-width:0}
  table.h7-hm{width:100%}
  table.h7-hm th.h7-ch{padding:4px 0 6px;max-width:none;vertical-align:bottom;text-align:center}
  table.h7-hm th.h7-ch span{writing-mode:vertical-rl;transform:rotate(180deg);display:inline-block;white-space:nowrap;line-height:1.1}
  table.h7-hm td.h7-c{padding:6px 0;font-size:.66rem;min-width:0}
  table.h7-hm td.stick{padding:5px 6px 5px 0}
  table.h7-hm .h7-past{display:none}
  .h7-ph{display:block}
  table.h7-covt th,table.h7-covt td{padding:7px 5px}}`);

/* ---------- who is who: ESPN member ids, with ids that share a name and co-own one team merged into one person ----------
   Cheap (no matchups), so the search commands can list managers at load time without building the whole model. */
function ident(){
  const par={},first={},nm={},owns=new Set();
  const add=(g,y)=>{if(!g)return;if(!(g in par)){par[g]=g;first[g]=y}};
  HS.forEach(s=>{Object.entries(s.members||{}).forEach(([g,n])=>{add(g,s.year);if(n&&String(n).trim())nm[g]=String(n).trim()});(s.teams||[]).forEach(t=>(t.owners||[]).forEach(g=>{add(g,s.year);owns.add(g)}))});
  const find=g=>{while(par[g]!==g){par[g]=par[par[g]];g=par[g]}return g};
  const merged=[];
  HS.forEach(s=>(s.teams||[]).forEach(t=>{const o=t.owners||[];for(let i=0;i<o.length;i++)for(let j=i+1;j<o.length;j++){const a=find(o[i]),b=find(o[j]);
    if(a!==b&&nm[o[i]]&&norm(nm[o[i]])===norm(nm[o[j]]||'')){if(first[b]<first[a])par[a]=b;else par[b]=a;merged.push(fixName(nm[o[i]]))}}}));
  const PP={};
  Object.keys(par).forEach(g=>{const r=find(g);(PP[r]=PP[r]||{id:r,guids:[]}).guids.push(g)});
  Object.values(PP).forEach(p=>{p.name=fixName(nm[p.id]||p.guids.map(g=>nm[g]).find(Boolean)||'Unknown manager');p.owner=p.guids.some(g=>owns.has(g))});
  return {par,find,PP,merged:[...new Set(merged)]};
}

/* ---------- the model: built once, on first use, from DATA.history ---------- */
let MD=null;
function build(){
  const I=ident(),{par,find,PP}=I,merged=I.merged;
  Object.values(PP).forEach(p=>Object.assign(p,{ss:[],cw:0,cl:0,ct:0,mw:0,ml:0,mt:0,pw:0,pl:0,titles:0,ru:0,po:0,fins:[],moves:0,sweeps:0,swBy:{},H:{}}));
  const pid=g=>PP[find(g)]?find(g):null;

  // seasons
  const SE=HS.map(s=>{
    const cats=catSort((s.cats||[]).map(String)),nC=cats.length||null,T0={};
    (s.teams||[]).forEach(t=>T0[t.id]=t);
    const owners=id=>[...new Set(((T0[id]||{}).owners||[]).map(pid).filter(Boolean))];
    const ms=(s.matchups||[]).map((m,i)=>{const aw=+m.aw||0,hw=+m.hw||0,t=+m.t||0,vd=aw+hw===0,win=m.win==='HOME'?m.h:m.win==='AWAY'?m.a:null;
      return {y:+s.year,i,w:+m.w,a:m.a,h:m.h,aw,hw,t,po:!!m.po,tier:m.tier||'NONE',cats:m.cats&&typeof m.cats==='object'?m.cats:null,void:vd,win,tb:!!win&&aw===hw&&!vd,mg:Math.abs(aw-hw),sweep:!vd&&!!nC&&Math.max(aw,hw)===nC&&!!win}})
      .filter(m=>T0[m.a]&&T0[m.h]).sort((a,b)=>a.w-b.w||a.i-b.i);
    const R={},r=id=>R[id]=R[id]||{cw:0,cl:0,ct:0,mw:0,ml:0,mt:0,pw:0,pl:0,seq:[]};
    ms.forEach(m=>{if(m.void)return;[[m.a,m.aw,m.hw],[m.h,m.hw,m.aw]].forEach(([id,x,y])=>{const o=r(id),res=m.win==null?'T':m.win===id?'W':'L';
      if(!m.po){o.cw+=x;o.cl+=y;o.ct+=m.t;res==='W'?o.mw++:res==='L'?o.ml++:o.mt++}else if(m.tier==='WINNERS_BRACKET'){if(res==='W')o.pw++;else if(res==='L')o.pl++}
      o.seq.push({m,res})})});
    const teams=(s.teams||[]).map(t=>{const o=r(t.id),num=v=>v!=null&&isFinite(+v)?+v:null,mv=t.moves||{};
      const cw=num(t.w)??o.cw,cl=num(t.l)??o.cl,ct=num(t.t)??o.ct;
      const x={id:t.id,name:String(t.name||'').replace(/\s+/g,' ').trim()||'Team '+t.id,abbr:String(t.abbr||'').trim(),owners:owners(t.id),cw,cl,ct,cwp:wp(cw,cl,ct),
        mw:o.mw,ml:o.ml,mt:o.mt,pw:o.pw,pl:o.pl,seed:num(t.seed),fin:num(t.final),mv:{adds:+mv.adds||0,drops:+mv.drops||0,trades:+mv.trades||0,ir:+mv.ir||0},seq:o.seq};
      x.moves=x.mv.adds+x.mv.trades;x.made=x.seed!=null&&s.playoffTeams?x.seed<=s.playoffTeams:null;
      // longest run of straight wins over the games that count: regular season and title bracket, in order. A tie or loss ends it;
      // placement and consolation games (low stakes) and unplayed games are skipped, so they neither extend nor break a run
      const sq=x.seq.filter(q=>!q.m.po||q.m.tier==='WINNERS_BRACKET');
      let run=0,best={n:0};sq.forEach((q,k)=>{if(q.res==='W'){run++;if(run>best.n)best={n:run,from:sq[k-run+1].m,to:q.m}}else run=0});x.streak=best;
      return x});
    teams.sort((a,b)=>(a.fin??99)-(b.fin??99)||(a.seed??99)-(b.seed??99)||(b.cwp??0)-(a.cwp??0));
    const T=Object.fromEntries(teams.map(t=>[t.id,t]));
    const wbW=[...new Set(ms.filter(m=>m.po&&m.tier==='WINNERS_BRACKET').map(m=>m.w))].sort((a,b)=>a-b),poW=[...new Set(ms.filter(m=>m.po).map(m=>m.w))].sort((a,b)=>a-b);
    const regMs=ms.filter(m=>!m.po),lastReg=regMs.length?Math.max(...regMs.map(m=>m.w)):(s.regWeeks??0),poN=s.playoffTeams??null;
    // playoff round k counts periods after the regular season, so a round missing from the data can't shift the names
    const rnd=w=>w-lastReg,RR=poN>1?Math.ceil(Math.log2(poN)):Math.max(0,...wbW.map(rnd));
    // regular-season weeks with fewer games than the league plays (every team plays every week)
    const perWk=Math.floor(teams.length/2),short=[];for(let w=1;w<=lastReg;w++){const n=regMs.filter(m=>m.w===w).length;if(n<perWk)short.push([w,perWk-n])}
    return {y:+s.year,label:String(s.label||s.year),cats,nC,reg:s.regWeeks??(regMs.length?lastReg:null),poN,n:teams.length,teams,T,ms,wbW,poW,rnd,R:RR,short,
      champ:teams.find(t=>t.fin===1)||null,ru:teams.find(t=>t.fin===2)||null,complete:s.complete||{},raw:s}});
  const SY={};SE.forEach(se=>SY[se.y]=se);

  // careers and head to head
  SE.forEach(se=>{se.teams.forEach(t=>t.owners.forEach(id=>{const p=PP[id];p.ss.push({se,t});
      ['cw','cl','ct','mw','ml','mt','pw','pl','moves'].forEach(k=>p[k]+=t[k]);
      if(t.fin===1)p.titles++;if(t.fin===2)p.ru++;if(t.made)p.po++;if(t.fin!=null)p.fins.push(t.fin)}));
    se.ms.forEach(m=>{const A=se.T[m.a],B=se.T[m.h];
      if(m.sweep){(m.win===m.a?A:B).owners.forEach(id=>{const p=PP[id];p.sweeps++;p.swBy[se.y]=(p.swBy[se.y]||0)+1})}
      const push=(p,q,me,op,x,y)=>{(PP[p].H[q]=PP[p].H[q]||[]).push({m,se,me,op,x,y,res:m.void?null:m.win==null?'T':m.win===me?'W':'L'})};
      A.owners.forEach(pa=>B.owners.forEach(pb=>{if(pa===pb)return;push(pa,pb,m.a,m.h,m.aw,m.hw);push(pb,pa,m.h,m.a,m.hw,m.aw)}))})});
  const people=Object.values(PP).filter(p=>p.ss.length);
  people.forEach(p=>{p.cwp=wp(p.cw,p.cl,p.ct);p.mwp=wp(p.mw,p.ml,p.mt);p.avgFin=p.fins.length?mean(p.fins):null;p.bestFin=p.fins.length?Math.min(...p.fins):null;
    const ys=p.ss.map(x=>x.se.y);p.y0=Math.min(...ys);p.y1=Math.max(...ys);p.nSeasons=new Set(ys).size;
    const parts=p.name.split(' ');p.first=parts[0];p.last=parts.length>1?parts[parts.length-1]:'';
    // who ran this ESPN team number the season before they joined (team numbers are reused when a new manager takes a spot)
    const i0=SE.findIndex(se=>se.y===p.y0),t0=p.ss.find(x=>x.se.y===p.y0),prev=i0>0?SE[i0-1]:null,pt=prev&&t0?prev.T[t0.t.id]:null;
    p.took=pt&&pt.owners.length&&!pt.owners.includes(p.id)?{se:prev,t:pt,tid:t0.t.id}:null});
  // short names for tight headers: first name, plus last initial where two people share one
  people.forEach(p=>{const dup=people.filter(q=>norm(q.first)===norm(p.first)).length>1;p.short=dup&&p.last?`${p.first} ${p.last[0]}.`:p.first});
  const byCwp=[...people].filter(p=>p.cw+p.cl+p.ct>0).sort((a,b)=>b.cwp-a.cwp);people.forEach(p=>p.cwpRank=byCwp.indexOf(p)+1||null);

  // the current league's managers, matched by name (ESPN shows short names like "Matt L." this season)
  const cur={},curOf={};
  const lastSeasonOwner=(tid,p)=>{for(let i=SE.length-1;i>=0;i--){const t=SE[i].T[tid];if(t)return t.owners.includes(p.id)}return false};
  (DATA.teams||[]).forEach(t=>{const toks=String(t.mgr||'').replace(/\./g,' ').split(/\s+/).filter(Boolean),fn=norm(toks[0]||''),li=toks[1]?norm(toks[1])[0]||null:null;if(!fn)return;
    const okLast=p=>!li||norm(p.last||'')[0]===li;
    let c=people.filter(p=>norm(p.first)===fn&&okLast(p)),how='name';
    if(fn.length<2&&!(c.length===1&&lastSeasonOwner(t.id,c[0])))c=[];
    if(!c.length){c=people.filter(p=>(fn.length>=3?norm(p.first).startsWith(fn):fn.length===1&&norm(p.first)[0]===fn)&&okLast(p));how='partial';
      if(c.length!==1||!lastSeasonOwner(t.id,c[0]))c=[]}
    if(c.length===1&&!cur[c[0].id]){cur[c[0].id]={tid:t.id,how,mgr:String(t.mgr)};curOf[t.id]=c[0].id}});
  let me=curOf[ME]?PP[curOf[ME]]:null;
  if(!me&&ME===DATA.myTeam){const cnt={};SE.forEach(se=>se.teams.forEach(t=>{if(/^LIEB$/i.test(t.abbr))t.owners.forEach(id=>cnt[id]=(cnt[id]||0)+1)}));const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];if(top)me=PP[top[0]]}

  // record book: full sorted lists; the cards cut them (keeping ties at the cut when only one more fits)
  const tss=SE.flatMap(se=>se.teams.map(t=>({se,t})));
  const played=SE.flatMap(se=>se.ms.filter(m=>!m.void).map(m=>({se,m})));
  const RB={
    best:tss.filter(x=>x.t.cwp!=null).sort((a,b)=>b.t.cwp-a.t.cwp||b.se.y-a.se.y),
    worst:tss.filter(x=>x.t.cwp!=null).sort((a,b)=>a.t.cwp-b.t.cwp||b.se.y-a.se.y),
    titles:people.filter(p=>p.titles>0).sort((a,b)=>b.titles-a.titles||a.avgFin-b.avgFin),
    blow:played.filter(x=>x.m.win!=null).sort((a,b)=>b.m.mg-a.m.mg||b.se.y-a.se.y||b.m.w-a.m.w),
    streak:tss.filter(x=>x.t.streak.n>1).sort((a,b)=>b.t.streak.n-a.t.streak.n||b.se.y-a.se.y),
    moves:[...tss].sort((a,b)=>b.t.moves-a.t.moves||b.se.y-a.se.y),
    sweeps:people.filter(p=>p.sweeps>0).sort((a,b)=>b.sweeps-a.sweeps||b.cwp-a.cwp),
    career:people.filter(p=>p.nSeasons>=2&&p.cwp!=null).sort((a,b)=>b.cwp-a.cwp)};
  return {PP,people,SE,SY,cur,curOf,me,RB,merged,alias:g=>PP[g]?g:(g in par?find(g):null)};
}
function model(){if(!MD){try{MD=build()}catch(e){console.error('h7 history',e);MD={PP:{},people:[],SE:[],SY:{},cur:{},curOf:{},me:null,RB:{},merged:[],alias:()=>null}}}return MD}
LAB.histModel=model;
LAB.histPerson=tid=>{const D=model(),id=D.curOf[tid];return id?D.PP[id]:null};

/* ---------- shared pieces ---------- */
const who=p=>p?sbtn('own|'+p.id,esc(p.name)):'–';
const ownersHtml=(D,t,link=true)=>t.owners.map(id=>link?who(D.PP[id]):esc(D.PP[id].name)).join(' & ')||'Unknown manager';
const ownersTxt=(D,t)=>t.owners.map(id=>D.PP[id].name).join(' & ')||'Unknown manager';
const firsts=(D,t)=>t.owners.map(id=>D.PP[id].short).join(' & ')||t.abbr||t.name;
const isMe=(D,t)=>!!(D.me&&t&&t.owners.includes(D.me.id));
const finStr=(t,se)=>t&&t.fin!=null?`${ord(t.fin)} of ${se.n}`:'–';
// name of a matchup's slot in its season: "Week 3", "Final", "Semifinal", "3rd-place game", "Consolation, round 2"
// title-bracket round names, counted back from the final; the first round of a 5- or 6-team bracket (with byes) is the "First round"
const rname=(se,k)=>{const r=se.R-k;return r===0?'Final':r===1?'Semifinal':r===2?(se.poN&&se.poN<8?'First round':'Quarterfinal'):'Playoff round '+k};
function pname(se,m){if(!m.po)return 'Week '+m.w;
  const rk=se.rnd(m.w),last=rk===se.R;
  if(m.tier==='WINNERS_BRACKET')return rname(se,rk);
  // a last-round ladder game between teams that finished next to each other decided those two places
  if(last&&!m.void&&m.win!=null){const W=se.T[m.win],L=se.T[m.win===m.a?m.h:m.a];if(W&&L&&W.fin!=null&&L.fin===W.fin+1)return ord(W.fin)+'-place game'}
  return (TIER[m.tier]||'Playoffs')+', round '+rk}
const scoreTxt=(x,y,t)=>`${x}-${y}${t?'-'+t:''}`;
// "8-0" style score from the winner's side, the teams and when; the score opens the two managers' rivalry
function resultRow(D,se,m){const W=m.win!=null?se.T[m.win]:se.T[m.a],L=se.T[W.id===m.a?m.h:m.a],x=W.id===m.a?m.aw:m.hw,y=W.id===m.a?m.hw:m.aw;
  const verb=m.void?'advanced past':m.win==null?'tied':m.tb?'edged (tiebreak)':'over',a=W.owners[0],b=L.owners[0],txt=m.void?'n/p':scoreTxt(x,y,m.t);
  return `<li><b>${a&&b&&a!==b?sbtn(`hh|${a}|${b}`,txt):txt}</b><span>${esc(W.name)} ${verb} ${esc(L.name)}<small>${pname(se,m)}${m.void?' · not played, no stats':''} · ${ownersHtml(D,W)} vs ${ownersHtml(D,L)}</small></span></li>`}
const coverage=se=>{const n=se.ms.length,c=se.ms.filter(m=>m.cats),wk=[...new Set(c.map(m=>m.w))].sort((a,b)=>a-b);
  const span=wk.length?(wk.length===1?'week '+wk[0]:wk[wk.length-1]-wk[0]+1===wk.length?`weeks ${wk[0]}-${wk[wk.length-1]}`:'weeks '+wk.join(', ')):'';
  return {n,nc:c.length,wk,span,voids:se.ms.filter(m=>m.void).length,tbs:se.ms.filter(m=>m.tb).length}};
// title-bracket rounds with no game at all in the data (e.g. a final the pull could not read)
const missingRounds=se=>{const out=[];if(!se.poN)return out;for(let k=1;k<=se.R;k++)if(!se.ms.some(m=>m.po&&m.tier==='WINNERS_BRACKET'&&se.rnd(m.w)===k))out.push(rname(se,k));return out};
// the opponents worth naming as "best against" / "toughest": enough meetings to mean something
function rivals(p,people){const all=people.filter(q=>q!==p).map(q=>({q,s:hsum(p.H[q.id])})).filter(x=>x.s.n);
  const minN=all.filter(x=>x.s.n>=5).length>=3?5:all.filter(x=>x.s.n>=3).length>=2?3:2,ok=all.filter(x=>x.s.n>=minN);
  const fav=[...ok].sort((a,b)=>b.s.cwp-a.s.cwp||b.s.n-a.s.n)[0],nem=[...ok].sort((a,b)=>a.s.cwp-b.s.cwp||b.s.n-a.s.n)[0];
  return {all,minN,fav:fav&&nem&&fav!==nem?fav:null,nem:fav&&nem&&fav!==nem?nem:null}}
const short=label=>String(label).replace(/^\d\d(\d\d-)/,'$1');
const fmtDiff=se=>{if(!se.nC)return '';const today=CATS.map(c=>c.l),miss=today.filter(c=>!se.cats.includes(c)),extra=se.cats.filter(c=>!today.includes(c));
  return !miss.length&&!extra.length?'':`${extra.length?esc(list(extra))+' instead of '+(miss.length?esc(list(miss)):'nothing'):'no '+esc(list(miss))}`};
const segX=(key,cur,opts,label)=>`<div class="seg" role="group" aria-label="${esc(label)}">${opts.map(([v,l])=>`<button type="button" data-set="${key}=${v}" aria-pressed="${v===cur}">${l}</button>`).join('')}</div>`;
function hsum(arr){const o={n:0,w:0,l:0,t:0,cw:0,cl:0,ct:0,po:0,voids:0,all:arr?arr.length:0};(arr||[]).forEach(g=>{if(g.res==null){o.voids++;return}o.n++;o[g.res==='W'?'w':g.res==='L'?'l':'t']++;o.cw+=g.x;o.cl+=g.y;o.ct+=g.m.t;if(g.m.po)o.po++});
  o.mwp=wp(o.w,o.l,o.t);o.cwp=wp(o.cw,o.cl,o.ct);return o}
const meetings=(D,a,b)=>((D.PP[a]&&D.PP[a].H[b])||[]).slice().sort((x,y)=>x.se.y-y.se.y||x.m.w-y.m.w||x.m.i-y.m.i);
function streaks(gs){let cur=null,n=0,bestW={n:0},bestL={n:0},run=0,rk=null;gs.filter(g=>g.res).forEach((g,k,arr)=>{if(g.res===rk)run++;else{rk=g.res;run=1}
    if(rk==='W'&&run>bestW.n)bestW={n:run,to:g};if(rk==='L'&&run>bestL.n)bestL={n:run,to:g};if(k===arr.length-1){cur=rk;n=run}});return {cur,n,bestW,bestL}}
const stretch=(se,from,to)=>from===to?pname(se,from):`${pname(se,from)} to ${pname(se,to).replace(/^Week /,'week ')}`;

/* ---------- drill: one season ---------- */
DRILL.hs=year=>{const D=model(),se=D.SY[+year];if(!se)return null;css();
  const C=coverage(se),meT=se.teams.find(t=>isMe(D,t)),nmS=t=>esc(t.owners.map(o=>D.PP[o].short).join(' & '));
  const regTop=[...se.teams].filter(t=>t.cwp!=null).sort((a,b)=>b.cwp-a.cwp)[0];
  let h=facts([
    se.champ?fact('Champion',nmS(se.champ),`${esc(se.champ.name)}${se.champ.seed!=null?' · #'+se.champ.seed+' seed':''}`,'own|'+se.champ.owners[0]):fact('Champion','–','not in the data'),
    se.ru?fact('Runner-up',nmS(se.ru),`${esc(se.ru.name)}${se.ru.seed!=null?' · #'+se.ru.seed+' seed':''}`,'own|'+se.ru.owners[0]):'',
    regTop?fact('Best regular season',P(regTop.cwp),`${nmS(regTop)} · ${rec(regTop.cw,regTop.cl,regTop.ct)} categories`,'own|'+regTop.owners[0]):'',
    meT?fact('Your finish',meT.fin!=null?ord(meT.fin):'–',`${esc(meT.name)}${meT.seed!=null?' · #'+meT.seed+' seed':''}`,'own|'+D.me.id):'',
    fact('Matchups',String(C.n),C.nc?`${C.nc} with category totals`:'scores only')]);
  // standings
  h+=drillSec('Final standings',`Sorted by final finish. Category record is the regular season, the standings that set the seeds. Tap a row for that manager's career.`,
    `<div class="scroll"><table><thead><tr><th scope="col">Fin</th><th class="l stick" scope="col">Team</th><th scope="col">Win %</th><th scope="col">Categories</th><th scope="col">Seed</th><th scope="col">Matches</th><th scope="col" title="Title-bracket games won-lost">Bracket</th><th scope="col">Moves</th></tr></thead><tbody>
    ${se.teams.map(t=>`<tr class="click ${isMe(D,t)?'me':''}" ${sxk('own|'+t.owners[0])}><td class="num"><b>${t.fin??'–'}</b></td><td class="l stick h7-nm"><b>${esc(t.name)}</b><small>${esc(ownersTxt(D,t))}</small></td><td class="z ${pcls(t.cwp)}">${P(t.cwp)}</td><td class="num">${rec3(t.cw,t.cl,t.ct)}</td><td class="num">${t.seed??'–'}</td><td class="num">${rec(t.mw,t.ml,t.mt)}</td><td class="num">${t.pw+t.pl?rec(t.pw,t.pl,0):t.made===false?'missed':'–'}</td><td class="num" data-tip="${esc(`${t.mv.adds} adds, ${t.mv.drops} drops, ${t.mv.trades} trades, ${t.mv.ir} IR moves`)}">${t.moves}</td></tr>`).join('')}</tbody></table></div>`);
  // bracket
  const br=bracket(D,se);if(br)h+=drillSec('Title bracket as played',`${se.poN?se.poN+' teams made the playoffs. ':''}Managers shown by first name, winners in bold; hover or tap for the team. Tap opens that manager's career.`,br);
  const other=se.ms.filter(m=>m.po&&m.tier!=='WINNERS_BRACKET');
  if(other.length){const ul=`<ul class="h7-res">${other.map(m=>resultRow(D,se,m)).join('')}</ul>`;h+=drillSec('Placement and consolation games',other.length>6?`${other.length} games decided places below the title bracket.`:'',other.length>6?`<details class="h7-raw"><summary>Show all ${other.length}</summary>${ul}</details>`:ul)}
  // notable results
  const pl=se.ms.filter(m=>!m.void&&m.win!=null),blow=[...pl].sort((a,b)=>b.mg-a.mg||a.w-b.w).slice(0,5),sw=pl.filter(m=>m.sweep),swX=sw.filter(m=>!blow.includes(m)),close=pl.filter(m=>m.mg===1),ties=se.ms.filter(m=>!m.void&&m.win==null);
  const cnt=(n,w,ws)=>n?plural(n,w,ws):'no '+(ws||w+'s');
  if(pl.length)h+=drillSec('Notable results',`${cap(cnt(sw.length,'clean sweep'))} (all ${se.nC||'?'} categories won), ${cnt(close.length,'game')} decided by one category, ${cnt(ties.length,'tied week')}. Tap a score for the two managers' rivalry.`,
    `<h3 class="lbl">Biggest wins</h3><ul class="h7-res">${blow.map(m=>resultRow(D,se,m)).join('')}</ul>
    ${swX.length&&swX.length<=8?`<h3 class="lbl">Other clean sweeps</h3><ul class="h7-res">${swX.map(m=>resultRow(D,se,m)).join('')}</ul>`:''}
    ${close.length?`<h3 class="lbl">Closest finishes${close.length>6?' (latest 6 of '+close.length+')':''}</h3><ul class="h7-res">${close.slice(-6).reverse().map(m=>resultRow(D,se,m)).join('')}</ul>`:''}`);
  // best single weeks, only where category totals exist
  const wc=se.ms.filter(m=>m.cats);
  if(wc.length){const rows=se.cats.map(c=>{let best=null;wc.forEach(m=>[[m.a,0],[m.h,1]].forEach(([id,k])=>{const v=m.cats[c]&&m.cats[c][k];if(v==null||!isFinite(+v))return;
      if(!best||(NEG(c)?+v<best.v:+v>best.v))best={v:+v,id,m}}));return best&&{c,...best}}).filter(Boolean);
    h+=drillSec('Best single weeks',`Only ${C.span} have category totals (${C.nc} of ${C.n} matchups), so this covers those weeks alone.${se.cats.includes('TO')?' Fewest turnovers counts as best.':''} Tap a row for that manager's career.`,
      `<table><thead><tr><th class="l" scope="col">Category</th><th scope="col">Best</th><th class="l" scope="col">Team</th></tr></thead><tbody>${rows.map(r=>{const t=se.T[r.id];
        return `<tr class="click ${isMe(D,t)?'me':''}" ${sxk('own|'+t.owners[0])}><td class="l"><b>${esc(r.c)}</b></td><td class="num">${fmtCat(r.c,r.v)}</td><td class="l h7-nm">${esc(t.name)}<small>${esc(firsts(D,t))} · ${pname(se,r.m)}</small></td></tr>`}).join('')}</tbody></table>`)}
  // moves
  const mv=[...se.teams].sort((a,b)=>b.moves-a.moves);
  if(mv.some(t=>t.moves>0))h+=drillSec('Transactions by team','Moves = adds plus trades (each add usually comes with a drop, so drops are not counted twice). Hover or tap a bar for the full breakdown.',
    CH.hbars(mv.map(t=>({label:`${esc(firsts(D,t))}<small>${esc(t.name)}</small>`,v:t.moves,txt:String(t.moves),me:isMe(D,t),stat:'own|'+t.owners[0],tip:`${t.name}: ${t.mv.adds} adds, ${t.mv.drops} drops, ${t.mv.trades} trades, ${t.mv.ir} IR moves`})),{label:'Moves by team',stack:true}));
  // coverage
  h+=drillSec("What this season's data covers",'',coverageList(se,C));
  h+=how([`Built from ESPN's records for the ${esc(se.label)} season: each team's owners, regular-season category record, seed, final finish and transactions, and the score of every matchup that could be read. Managers are matched by their ESPN member id, not the team name.`,
    `A clean sweep means winning every category scored that season (${se.nC||'?'} in ${esc(se.label)}). "Decided by one category" means the winner took exactly one more category than the loser. Win % counts a tied category as half.`,
    `Bracket is each team's record in title-bracket games (placement and consolation games are listed separately). Playoff games that ended level went to one side on ESPN's tiebreak; they are marked. Nothing missing is estimated: see the coverage list above.`]);
  return {eyebrow:'League history',title:`${esc(se.label)} season`,back:se.label,sub:[`${se.n} teams`,se.nC?`${se.nC} categories (${esc(se.cats.join(', '))})`:'',se.reg!=null?`${se.reg} regular-season weeks`:'',se.poN!=null?`${se.poN} playoff teams`:'',meT&&meT.fin!=null?`you finished ${finStr(meT,se)}`:''].filter(Boolean).join(' · '),html:h}};
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);

function coverageList(se,C){const items=[],cc=se.complete,miss=missingRounds(se);
  items.push(cc.matchups===false?`Matchup results are incomplete: ${C.n} were read, but some playoff games could not be read (the data pull's note below names them). Missing games are left out, never guessed.`:`Matchup results: all ${C.n} were read.`);
  if(se.short.length)items.push(`Regular-season games missing from the data: ${se.short.map(([w,n])=>`week ${w} (${n})`).join(', ')}.`);
  if(miss.length)items.push(`Title-bracket games not in the data: the ${esc(list(miss.map(x=>x.toLowerCase())))}.${se.champ?' Final places still come from ESPN\'s final standings.':''}`);
  if(cc.teams===false)items.push('Team details may be incomplete.');
  items.push(C.nc?`Category totals exist for ${C.nc} of ${C.n} matchups (${C.span}). Every other matchup has its score (categories won) but not the stats behind it.`:'No category totals were available; only the scores (categories won).');
  if(C.voids)items.push(`${plural(C.voids,'playoff game')} had no stats at all (every category tied, nothing played). ESPN still advanced one side; those games are listed but not counted in any record.`);
  if(C.tbs)items.push(`${plural(C.tbs,'game')} ended level and ESPN gave ${C.tbs===1?'it':'them'} to one side on a tiebreak.`);
  if(!se.teams.some(t=>t.moves>0))items.push('No transaction counts were available.');
  if(se.teams.every(t=>t.fin==null))items.push('Final places are not in the data, so the champion is unknown.');
  const d=fmtDiff(se);if(d)items.push(`Scoring differed from today: ${se.nC} categories, ${d}.`);
  return `<ul class="h7-cov">${items.map(x=>`<li>${x}</li>`).join('')}</ul>${cc.note?`<details class="h7-raw"><summary>The data pull's own note</summary><p>${esc(cc.note)}</p></details>`:''}`}

function bracket(D,se){const wb=se.ms.filter(m=>m.po&&m.tier==='WINNERS_BRACKET');if(!wb.length)return '';
  const r1g=wb.filter(m=>se.rnd(m.w)===1),r1=new Set(r1g.flatMap(m=>[m.a,m.h])),byes=r1g.length?se.teams.filter(t=>t.made&&!r1.has(t.id)).sort((a,b)=>a.seed-b.seed):[];
  const RN=k=>rname(se,k);
  const line=(id,won,x)=>{const t=se.T[id];return `<button type="button" class="h7-gt ${won?'w':''}" data-stat="own|${esc(t.owners[0]||'')}" data-tip="${esc(`${t.name} (${ownersTxt(D,t)}), #${t.seed??'–'} seed`)}"><i>${t.seed!=null?'#'+t.seed:''}</i><span>${esc(firsts(D,t))}</span><b>${x}</b></button>`};
  const game=m=>{const hi=(se.T[m.a].seed??99)<=(se.T[m.h].seed??99)?[m.a,m.aw]:[m.h,m.hw],lo=hi[0]===m.a?[m.h,m.hw]:[m.a,m.aw];
    return `<div class="h7-g">${line(hi[0],m.win===hi[0],m.void?'–':hi[1])}${line(lo[0],m.win===lo[0],m.void?'–':lo[1])}${m.void?`<small>Not played: no stats, ESPN advanced the ${m.win===hi[0]?'higher':m.win===lo[0]?'lower':'listed'} seed</small>`:m.tb?`<small>Level ${m.aw}-${m.hw}${m.t?'-'+m.t:''}: decided on ESPN's tiebreak</small>`:m.t?`<small class="h7-tn">${m.t} tied ${m.t===1?'category':'categories'}</small>`:''}</div>`};
  const ks=[];for(let k=1;k<=Math.max(se.R,...wb.map(m=>se.rnd(m.w)));k++)ks.push(k);
  const cols=ks.map(k=>{const gs=wb.filter(m=>se.rnd(m.w)===k).sort((a,b)=>Math.min(se.T[a.a].seed??99,se.T[a.h].seed??99)-Math.min(se.T[b.a].seed??99,se.T[b.h].seed??99));
    if(!gs.length){
      // a final missing from the data: the finalists are the two semifinal winners, the winner is ESPN's final standings; the score stays unknown
      const prevW=k>1?wb.filter(m=>se.rnd(m.w)===k-1&&m.win!=null).map(m=>m.win):[];
      if(k===se.R&&se.champ&&prevW.length===2&&prevW.includes(se.champ.id)){const ids=prevW.sort((x,y)=>(se.T[x].seed??99)-(se.T[y].seed??99));
        return `<div class="h7-rd"><span class="lbl">${RN(k)}</span><div class="h7-gs"><div class="h7-g">${ids.map(id=>line(id,id===se.champ.id,'–')).join('')}<small class="h7-tn">Score not in the data. The semifinal winners met; the winner comes from ESPN's final standings.</small></div></div></div>`}
      return `<div class="h7-rd"><span class="lbl">${RN(k)}</span><div class="h7-gs"><div class="h7-g bye"><small class="h7-tn">Not in the data: ${k===se.R?'the final\'s score could not be read':'these games could not be read'}.${k===se.R&&se.champ?' The champion comes from ESPN\'s final standings.':''}</small></div></div></div>`}
    return `<div class="h7-rd"><span class="lbl">${RN(k)}</span><div class="h7-gs">${k===1?byes.map(t=>`<div class="h7-g bye"><button type="button" class="h7-gt" data-stat="own|${esc(t.owners[0]||'')}" data-tip="${esc(`${t.name}: bye as the #${t.seed} seed`)}"><i>#${t.seed}</i><span>${esc(firsts(D,t))}</span><b>bye</b></button></div>`).join(''):''}${gs.map(game).join('')}</div></div>`});
  const ch=se.champ;
  if(ch)cols.push(`<div class="h7-rd"><span class="lbl">Champion</span><div class="h7-gs"><div class="h7-g champ"><button type="button" class="h7-gt w" data-stat="own|${esc(ch.owners[0]||'')}" data-tip="${esc(`${ch.name} (${ownersTxt(D,ch)})`)}"><i>${ch.seed!=null?'#'+ch.seed:''}</i><span>${esc(firsts(D,ch))}</span><b></b></button><small class="h7-tn">${esc(ch.name)}</small></div></div></div>`);
  return `<div class="h7-br">${cols.join('')}</div>`}

/* ---------- drill: one manager's career ---------- */
DRILL.own=g=>{const D=model(),id=D.alias(g),p=id&&D.PP[id];if(!p||!p.ss.length)return null;css();
  const mine=D.me&&D.me.id===p.id,ss=[...p.ss].sort((a,b)=>a.se.y-b.se.y),N=ss.length,cu=D.cur[p.id];
  const best=[...ss].filter(x=>x.t.cwp!=null).sort((a,b)=>(a.t.fin??99)-(b.t.fin??99)||b.t.cwp-a.t.cwp)[0],worst=[...ss].filter(x=>x.t.cwp!=null).sort((a,b)=>(b.t.fin??0)-(a.t.fin??0)||a.t.cwp-b.t.cwp)[0];
  const busiest=[...ss].sort((a,b)=>b.t.moves-a.t.moves)[0],titles=ss.filter(x=>x.t.fin===1);
  const sizes=[...new Set(ss.map(x=>x.se.n))].sort((a,b)=>a-b);
  let h=facts([
    fact('Titles',String(p.titles),titles.length?titles.map(x=>esc(x.se.label)).join(', '):p.ru?`${plural(p.ru,'runner-up finish','runner-up finishes')}`:'none yet',titles.length?'hs|'+titles[0].se.y:null),
    fact('Playoff trips',`${p.po} of ${N}`,p.po?`${rec(p.pw,p.pl,0)} in title-bracket games`:N===1?'missed the playoffs':'missed them every season'),
    fact('Category record',P1(p.cwp),`${rec3(p.cw,p.cl,p.ct)}${p.cwpRank?' · #'+p.cwpRank+' of '+D.people.length+' managers':''}`),
    fact('Match record',rec(p.mw,p.ml,p.mt),`${P(p.mwp)} of regular-season weeks`),
    fact('Average finish',p.avgFin!=null?p.avgFin.toFixed(1):'–',sizes.length>1?`in ${sizes.join('- and ')}-team seasons`:`of ${sizes[0]} teams`),
    fact(N>1?'Best finish':'Finish',p.bestFin!=null?ord(p.bestFin):'–',best?esc(best.se.label):'',best?'hs|'+best.se.y:null)]);
  const notes=[];
  const ct=cu&&teamById[cu.tid];
  if(ct)notes.push(`This season ${mine?'you run':'they run'} <button type="button" class="tlink" data-team="${ct.id}"><b>${esc(ct.name)}</b></button> (ESPN shows "${esc(cu.mgr)}"; matched by name${cu.how==='partial'?', checked against the last season on record':''}).`);
  else notes.push(`No team in this season's league could be matched to ${esc(p.name)} by name, so no current team is linked.`);
  if(p.took)notes.push(`Joined in ${esc(D.SY[p.y0].label)}, taking over ESPN team #${p.took.tid}, which ${ownersHtml(D,p.took.t)} ran in ${esc(p.took.se.label)}.`);
  if(/^[a-z]$/i.test(p.first))notes.push(`ESPN shows this account only as "${esc(p.name)}". Records are kept per ESPN account, so it is not combined with any other manager.`);
  h+=notes.map(x=>`<p class="note">${x}</p>`).join('');
  if(N>1)h+=drillSec('Category win rate by season','Share of regular-season categories won. The dashed line is 50%. Tap a point for that season.',
    CH.line([{name:p.name,cls:mine?'s2':'s1',pts:ss.filter(x=>x.t.cwp!=null).map(x=>[x.se.y,Math.round(x.t.cwp*1000)/10,'hs|'+x.se.y])}],{xl:y=>short((D.SY[y]||{}).label||y),fmt:v=>Math.round(v)+'%',ref:50,y0:Math.min(30,...ss.map(x=>(x.t.cwp??.5)*100-5)),y1:Math.max(70,...ss.map(x=>(x.t.cwp??.5)*100+5)),label:'Category win rate by season',h:200}));
  h+=drillSec('Season by season','Tap a season for its standings, bracket and results.',`<div class="scroll"><table><thead><tr><th class="l stick" scope="col">Season</th><th class="l" scope="col">Team</th><th scope="col">Finish</th><th scope="col">Win %</th><th scope="col">Categories</th><th scope="col">Seed</th><th scope="col">Matches</th><th scope="col">Moves</th></tr></thead><tbody>
    ${ss.map(x=>{const t=x.t;return `<tr class="click" ${sxk('hs|'+x.se.y)}><td class="l stick"><b>${esc(x.se.label)}</b></td><td class="l h7-nm">${esc(t.name)}${t.owners.length>1?`<small>with ${esc(t.owners.filter(o=>o!==p.id).map(o=>D.PP[o].name).join(' & '))}</small>`:''}</td><td class="z ${t.fin===1?'p3':t.fin===2?'p2':t.made?'p1':''}">${t.fin===1?'Champion':t.fin!=null?ord(t.fin)+' of '+x.se.n:'–'}</td><td class="z ${pcls(t.cwp)}">${P(t.cwp)}</td><td class="num">${rec3(t.cw,t.cl,t.ct)}</td><td class="num">${t.seed??'–'}</td><td class="num">${rec(t.mw,t.ml,t.mt)}</td><td class="num" data-tip="${esc(`${t.mv.adds} adds, ${t.mv.drops} drops, ${t.mv.trades} trades, ${t.mv.ir} IR moves`)}">${t.moves}</td></tr>`}).join('')}</tbody></table></div>`);
  const lines=[],finTxt=t=>t.fin===1?'champion':t.fin!=null?ord(t.fin)+' place':'finish not in the data';
  if(N>1){
    if(best)lines.push(`<li>Best season: ${sbtn('hs|'+best.se.y,esc(best.se.label))}, ${esc(best.t.name)}: ${finTxt(best.t)} from the #${best.t.seed??'–'} seed, ${P(best.t.cwp)} of categories.</li>`);
    if(worst&&worst!==best)lines.push(`<li>Toughest season: ${sbtn('hs|'+worst.se.y,esc(worst.se.label))}, ${finTxt(worst.t)}, ${P(worst.t.cwp)} of categories.</li>`);
    if(busiest&&busiest.t.moves>0)lines.push(`<li>Busiest season: ${sbtn('hs|'+busiest.se.y,esc(busiest.se.label))} with ${plural(busiest.t.mv.adds,'add')} and ${plural(busiest.t.mv.trades,'trade')} (${(p.moves/N).toFixed(0)} moves a season on average).</li>`);
  }else if(ss[0]){const t=ss[0].t;
    lines.push(`<li>Only season: ${sbtn('hs|'+ss[0].se.y,esc(ss[0].se.label))}, ${esc(t.name)}: ${finTxt(t)} from the #${t.seed??'–'} seed, ${P(t.cwp)} of categories, ${plural(t.mv.adds,'add')} and ${plural(t.mv.trades,'trade')}.</li>`)}
  if(p.sweeps)lines.push(`<li>${plural(p.sweeps,'clean sweep')} (won every category of a week): ${Object.entries(p.swBy).map(([y,c])=>sbtn('hs|'+y,esc(D.SY[y].label))+(c>1?` (${c})`:'')).join(', ')}.</li>`);
  h+=drillSec('Highlights','',`<ul class="h7-cov">${lines.join('')}</ul>`);
  // head to head with everyone
  const R=rivals(p,D.people),opp=R.all.concat(D.people.filter(q=>q!==p&&!R.all.some(x=>x.q===q)).map(q=>({q,s:hsum(p.H[q.id])})).filter(x=>x.s.all)).sort((a,b)=>b.s.n-a.s.n||(b.s.cwp??0)-(a.s.cwp??0));
  if(opp.length){
    h+=drillSec('Head to head with every manager',`${R.fav?`Best against ${esc(R.fav.q.name)} (${P(R.fav.s.cwp)} of categories), toughest against ${esc(R.nem.q.name)} (${P(R.nem.s.cwp)}), among opponents met at least ${R.minN} times. `:''}Every meeting counts, playoffs included. Tap a row for the full rivalry.`,
      `<div class="scroll"><table><thead><tr><th class="l stick" scope="col">Opponent</th><th scope="col">Met</th><th scope="col" title="Matchups won-lost-tied">Matches</th><th scope="col" title="Share of categories won (a tie counts half)">Cat %</th><th scope="col">Categories</th><th scope="col" title="Playoff meetings, placement and consolation games included">Playoffs</th></tr></thead><tbody>
      ${opp.map(x=>`<tr class="click ${D.me&&x.q.id===D.me.id?'me':''}" ${sxk(`hh|${p.id}|${x.q.id}`)}><td class="l stick h7-nm"><b>${esc(x.q.name)}</b></td><td class="num">${x.s.n}${x.s.voids?`<small class="rk">+${x.s.voids} unplayed</small>`:''}</td><td class="num">${x.s.n?rec(x.s.w,x.s.l,x.s.t):'–'}</td><td class="z ${pcls(x.s.cwp)}">${P(x.s.cwp)}</td><td class="num">${x.s.n?rec3(x.s.cw,x.s.cl,x.s.ct):'–'}</td><td class="num">${x.s.po||''}</td></tr>`).join('')}</tbody></table></div>`)}
  h+=how([`A manager is followed by their ESPN member id across seasons, whatever the team was called and whichever team number it had.${D.merged.includes(p.name)?` ${esc(p.name)} appears under two ESPN ids that co-owned the same team, so both count as one person here.`:''} A team with two owners counts fully for both. Two ESPN ids are combined only when they carry the same name and co-owned one team; accounts with different names always stay separate.`,
    'Category record and match record cover the regular season only (the category record is what set the seeds); playoff games are shown separately. Win % counts a tie as half. Average finish mixes league sizes when the league changed size.',
    'Head-to-head counts every meeting, regular season and playoffs (placement and consolation games included); playoff games with no stats (nothing played) are listed as unplayed and not counted.',
    "This season's team is matched by the manager name ESPN shows now (often a first name and initial). When the name is too short or fits more than one person, no link is made."]);
  return {eyebrow:mine?'Your career':'Manager career',title:esc(p.name),back:p.short,sub:`${plural(p.nSeasons,'season')} (${esc(D.SY[p.y0].label)}${p.y1!==p.y0?' to '+esc(D.SY[p.y1].label):''}) · ${ss.map(x=>esc(x.t.abbr||x.t.name)).filter((v,i,a)=>a.indexOf(v)===i).join(', ')}`,html:h}};

/* ---------- drill: two managers head to head ---------- */
DRILL.hh=(ga,gb)=>{const D=model(),a=D.alias(ga),b=D.alias(gb),A=a&&D.PP[a],B=b&&D.PP[b];if(!A||!B||A===B)return null;css();
  const gs=meetings(D,a,b),s=hsum(gs),st=streaks(gs);
  const gbt=(d,l)=>`<button type="button" class="btn sm ghost" ${sx(d)}>${l}</button>`,links=`<div class="filters">${gbt('own|'+a,esc(A.short)+"'s career")}${gbt('own|'+b,esc(B.short)+"'s career")}</div>`;
  const span=p=>`${esc(D.SY[p.y0].label)}${p.y1!==p.y0?' to '+esc(D.SY[p.y1].label):''}`;
  if(!s.n){const both=D.SE.filter(se=>se.teams.some(t=>t.owners.includes(a))&&se.teams.some(t=>t.owners.includes(b)));
    const why=both.length?`They were in the league together in ${esc(list(both.map(se=>se.label)))}${gs.length?' and met only in playoff games that were never played (no stats)':' but the schedule never paired them'}.`:`Their seasons never overlapped: ${esc(A.name)} played ${span(A)}, ${esc(B.name)} ${span(B)}.`;
    return {eyebrow:'Head to head',title:`${esc(A.short)} vs ${esc(B.short)}`,back:`${A.short} vs ${B.short}`,sub:`${esc(A.name)} and ${esc(B.name)}`,html:`<div class="empty">These two managers never played a counted game against each other.</div><p class="note">${why}</p>${links}`+how(['Built from every matchup score in the league history, matched by ESPN member id. Playoff games with no stats are not counted.'])}}
  const lead=s.w>s.l?`${esc(A.short)} leads ${s.w}-${s.l}${s.t?'-'+s.t:''}`:s.l>s.w?`${esc(B.short)} leads ${s.l}-${s.w}${s.t?'-'+s.t:''}`:`Level at ${rec(s.w,s.l,s.t)}`;
  const pos=gs.filter(g=>g.m.po&&g.res);
  let h=facts([
    fact('Meetings',String(s.n),s.voids?`plus ${s.voids} not played`:`${plural(new Set(gs.map(g=>g.se.y)).size,'season')}`),
    fact(`${esc(A.short)}'s match record`,rec(s.w,s.l,s.t),lead),
    fact('Categories',rec3(s.cw,s.cl,s.ct),`${esc(A.short)} won ${P(s.cwp)}`),
    fact('Postseason meetings',String(pos.length),pos.length>2?`${esc(A.short)} won ${pos.filter(g=>g.res==='W').length}`:pos.length?pos.map(g=>`${g.res==='T'?'Tied':(g.res==='W'?esc(A.short):esc(B.short))+' won'} the ${esc(g.se.label)} ${esc(pname(g.se,g.m).toLowerCase())}`).join('; '):'never met in the postseason'),
    fact('Current streak',st.cur==='T'?'Tied':st.cur?(st.cur==='W'?esc(A.short):esc(B.short)):'–',st.cur==='T'?(st.n>1?`the last ${st.n} meetings were ties`:'the last meeting was a tie'):st.cur?(st.n>1?`won the last ${st.n} meetings`:'won the last meeting'):''),
    fact('Longest streaks',`${st.bestW.n} / ${st.bestL.n}`,`${esc(A.short)} / ${esc(B.short)} straight wins`)]);
  h+=drillSec('Every meeting in order',`Green: ${esc(A.short)} won. Red: ${esc(B.short)} won. Outlined: a playoff game. Tap one for that season.`,
    `<div class="h7-strip" role="list">${gs.map(g=>`<button type="button" role="listitem" class="${g.res==='W'?'w':g.res==='L'?'l':''} ${g.m.po?'po':''}" data-stat="hs|${g.se.y}" data-tip="${esc(`${g.se.label}, ${pname(g.se,g.m)}: ${g.res?`${A.short} ${g.x}-${g.y}${g.m.t?'-'+g.m.t:''}`:'not played'}${g.m.tb?' (tiebreak)':''}`)}" aria-label="${esc(g.se.label+' '+pname(g.se,g.m))}">${g.res||'·'}</button>`).join('')}</div>`);
  h+=drillSec('Results',`Newest first. Scores are categories won, ${esc(A.short)} first. Tap a row for that season.`,`<table><thead><tr><th class="l" scope="col">When</th><th scope="col">Score</th><th scope="col">Result</th></tr></thead><tbody>
    ${gs.slice().reverse().map(g=>{const ta=g.se.T[g.me],tb=g.se.T[g.op];return `<tr class="click" ${sxk('hs|'+g.se.y)}><td class="l h7-nm h7-when"><b>${esc(g.se.label)} · ${pname(g.se,g.m)}</b><small>${esc(ta.name)} vs ${esc(tb.name)}</small></td><td class="num">${g.res?scoreTxt(g.x,g.y,g.m.t):'–'}</td><td class="z ${g.res==='W'?'p2':g.res==='L'?'n2':''}">${g.res==null?'Not played':g.res==='T'?'Tie':(g.res==='W'?esc(A.short):esc(B.short))+(g.m.tb?'<small class="rk">tiebreak</small>':'')}</td></tr>`}).join('')}</tbody></table>`);
  // category by category, from the meetings that have totals
  const wc=gs.filter(g=>g.m.cats&&g.res);
  if(wc.length){const T={};wc.forEach(g=>{const ka=g.me===g.m.a?0:1;Object.entries(g.m.cats).forEach(([c,v])=>{if(!Array.isArray(v))return;const x=+v[ka],y=+v[1-ka];if(!isFinite(x)||!isFinite(y))return;
      const o=T[c]=T[c]||{w:0,l:0,t:0};if(x===y)o.t++;else if(NEG(c)?x<y:x>y)o.w++;else o.l++})});
    const cs=catSort(Object.keys(T));
    h+=drillSec('Category by category',`Only ${wc.length} of ${s.n} meetings ${wc.length===1?'has':'have'} category totals (early-season weeks), so this is a small sample. Bars show how far ${esc(A.short)} was ahead or behind in each category across those meetings.`,
      CH.hbars(cs.map(c=>{const o=T[c],r=wp(o.w,o.l,o.t);return {label:esc(c),v:r*100-50,txt:rec(o.w,o.l,o.t),tip:`${c}: ${A.short} ${rec3(o.w,o.l,o.t)} against ${B.short} in meetings with totals`}}),{center:true,max:50,label:'Category record in meetings with totals'})+
      `<div class="legend"><span><i class="pos"></i>${esc(A.short)} ahead</span><span><i class="neg"></i>${esc(B.short)} ahead</span></div>`)}
  h+=`<div class="filters">${gbt('own|'+a,esc(A.short)+"'s career")}${gbt('own|'+b,esc(B.short)+"'s career")}${gbt(`hh|${b}|${a}`,'Flip sides')}</div>`;
  h+=how(['Every matchup between teams these two managed, regular season and playoffs (placement and consolation games included), from the league history. A team with two owners counts for both of them.',
    'The match record is matchups won, lost and tied. The category record adds up the categories each side won in those matchups; win % counts a tie as half.',
    'Streaks run over meetings in date order; a tie ends a streak. Playoff games that were never played (no stats) are shown but not counted. Games level on categories that ESPN settled on a tiebreak count for the side ESPN advanced.']);
  return {eyebrow:'Head to head',title:`${esc(A.short)} vs ${esc(B.short)}`,back:`${A.short} vs ${B.short}`,sub:`${esc(A.name)} against ${esc(B.name)} · ${plural(s.n,'meeting')}`,html:h}};

/* ---------- the Stats view ---------- */
function vHistory(){css();const D=model(),SE=D.SE,me=D.me,first=SE[0],last=SE[SE.length-1];
  if(!SE.length)return `<section class="panel">${head('League history','')}<div class="empty">The league history could not be read.</div></section>`;
  let out='';
  // your history
  if(me){const n=me.ss.length,ti=me.ss.filter(x=>x.t.fin===1),bestS=[...me.ss].sort((a,b)=>(a.t.fin??99)-(b.t.fin??99)||b.se.y-a.se.y)[0];
    const R=rivals(me,D.people),most=[...R.all].sort((a,b)=>b.s.n-a.s.n||b.s.cwp-a.s.cwp)[0];
    const lead=`You have ${plural(n,'season')} on record: ${ti.length?`${plural(ti.length,'title')} (${ti.map(x=>esc(x.se.label)).join(', ')})`:'no title yet'}, ${me.po} playoff ${me.po===1?'trip':'trips'} and a best finish of <b>${bestS&&bestS.t.fin!=null?ord(bestS.t.fin):'–'}</b>${bestS?' in '+esc(bestS.se.label):''}. You won <b>${P1(me.cwp)}</b> of regular-season categories${me.cwpRank?`, ${ord(me.cwpRank)} best of ${D.people.length} managers`:''}.`;
    out+=`<section class="panel h7-me">${head("Your league history",`Since ${esc(D.SY[me.y0].label)}. Tap any number for the full story.`)}<p class="h7-lead">${lead}</p>${facts([
      fact('Seasons',String(n),me.ss.map(x=>esc(x.t.abbr||'')).filter((v,i,a)=>v&&a.indexOf(v)===i).join(', '),'own|'+me.id),
      fact('Titles',String(me.titles),me.ru?`${plural(me.ru,'runner-up finish','runner-up finishes')}`:'none yet','own|'+me.id),
      fact('Playoff trips',`${me.po} of ${n}`,me.po?`${rec(me.pw,me.pl,0)} in title-bracket games`:'missed them every season','own|'+me.id),
      fact('Category win rate',P1(me.cwp),`${rec3(me.cw,me.cl,me.ct)}${me.cwpRank?` · #${me.cwpRank} of ${D.people.length}`:''}`,'own|'+me.id),
      fact('Average finish',me.avgFin!=null?me.avgFin.toFixed(1):'–',`best ${bestS&&bestS.t.fin!=null?ord(bestS.t.fin):'–'}`,bestS?'hs|'+bestS.se.y:null),
      most?fact('Most-played rival',esc(most.q.short),`${rec(most.s.w,most.s.l,most.s.t)} in ${plural(most.s.n,'meeting')}`,`hh|${me.id}|${most.q.id}`):'',
      R.fav?fact('Best against',esc(R.fav.q.short),`${P(R.fav.s.cwp)} of categories in ${R.fav.s.n} meetings`,`hh|${me.id}|${R.fav.q.id}`):'',
      R.nem?fact('Toughest opponent',esc(R.nem.q.short),`${P(R.nem.s.cwp)} of categories in ${R.nem.s.n} meetings`,`hh|${me.id}|${R.nem.q.id}`):''])}</section>`}
  // champions
  out+=`<section class="panel" id="h7-champs">${head('Champions by season',`${plural(SE.length,'season')} on record, ${esc(first.label)} to ${esc(last.label)}. Tap a season for its standings and bracket, a name for that manager's career.`)}<div class="h7-champs">${SE.map(se=>{const c=se.champ,r=se.ru,mt=me?se.teams.find(t=>t.owners.includes(me.id)):null;
    return `<div class="h7-cs">${sbtn('hs|'+se.y,esc(se.label),'h7-yr')}<div class="h7-who"><span class="lbl">Champion</span>${c?`<b>${ownersHtml(D,c)}</b><small>${esc(c.name)}${c.seed!=null?' · #'+c.seed+' seed':''}</small>`:'<small>Not in the data</small>'}</div>
    <div class="h7-who"><span class="lbl">Runner-up</span>${r?`<b>${ownersHtml(D,r)}</b><small>${esc(r.name)}${r.seed!=null?' · #'+r.seed+' seed':''}</small>`:'<small>–</small>'}</div>
    ${me?`<div class="h7-mine"><span>You</span>${mt?sbtn('hs|'+se.y,mt.fin===1?'Champion':finStr(mt,se)):'<b>did not play</b>'}</div>`:''}</div>`}).join('')}</div></section>`;
  // all-time manager table
  const [sk,sd]=S.sort[SK],get=(p,k)=>k==='name'?p.name:k==='rank'?p.avgFin:p[k];
  const rows=sortRows([...D.people],sk,sd,get);
  out+=`<section class="panel">${head('All-time managers',`Everyone who has run a team, tracked by ESPN account. Regular season records; tap a heading to sort, a row for the career.`)}
    <div class="scroll"><table><thead><tr>${th(SK,'name','Manager','l stick')}${th(SK,'cwp','Cat %','','Share of regular-season categories won (a tie counts half)')}${th(SK,'titles','Titles')}${th(SK,'po','Playoffs','','Playoff trips')}${th(SK,'nSeasons','Seasons')}${th(SK,'mwp','Matches','','Regular-season weeks won-lost-tied')}<th scope="col">Categories</th>${th(SK,'rank','Avg finish','','Average final finish; lower is better')}${th(SK,'moves','Moves','','Adds plus trades, all seasons')}</tr></thead><tbody>
    ${rows.map(p=>`<tr class="click ${me&&p.id===me.id?'me':''}" ${sxk('own|'+p.id)}><td class="l stick h7-nm"><b>${esc(p.name)}</b><small>${esc(D.SY[p.y0].label)}${p.y1!==p.y0?' to '+esc(short(D.SY[p.y1].label)):''}${D.cur[p.id]&&teamById[D.cur[p.id].tid]?' · now '+esc(teamById[D.cur[p.id].tid].abbr):''}</small></td><td class="z ${pcls(p.cwp)}"><b>${P1(p.cwp)}</b></td><td class="num">${p.titles?'<b>'+p.titles+'</b>':'0'}</td><td class="num">${p.po}</td><td class="num">${p.nSeasons}</td><td class="num">${rec(p.mw,p.ml,p.mt)}<small class="rk">${P(p.mwp)}</small></td><td class="num">${rec3(p.cw,p.cl,p.ct)}</td><td class="num">${p.avgFin!=null?p.avgFin.toFixed(1):'–'}</td><td class="num">${p.moves}</td></tr>`).join('')}</tbody></table></div></section>`;
  out+=heatPanel(D);
  out+=recordBook(D);
  // data coverage: one wrapping column so it reads on a phone without sideways scrolling
  const covs=SE.map(se=>({se,C:coverage(se)})),withT=covs.filter(x=>x.C.nc),noT=covs.filter(x=>!x.C.nc).map(x=>x.se.label),wks=withT.map(x=>x.C.wk.length),lo=Math.min(...wks),hi=Math.max(...wks);
  out+=`<section class="panel">${head('What the history covers','Honest gaps: what each season has and what it is missing. Nothing missing is filled in. Tap a season for its details.')}
    <table class="h7-covt"><thead><tr><th class="l" scope="col">Season</th><th class="l" scope="col">What the data has</th></tr></thead><tbody>
    ${covs.map(({se,C})=>{const d=fmtDiff(se),miss=missingRounds(se),parts=[];
      parts.push(se.complete.matchups===false?`${C.n} results; <b>some playoff games could not be read</b>${miss.length?` (no ${esc(list(miss.map(x=>x.toLowerCase())))} score)`:''}`:`all ${C.n} results`);
      parts.push(C.nc?`category totals for ${C.span} (${C.nc} of ${C.n})`:'<b>no category totals</b>');
      if(C.voids)parts.push(plural(C.voids,'unplayed playoff game'));if(C.tbs)parts.push(plural(C.tbs,'tiebreak'));
      return `<tr class="click" ${sxk('hs|'+se.y)}><td class="l h7-wrap h7-cs1"><b>${esc(se.label)}</b><small>${se.n} teams · ${se.nC||'?'} categories${d?` (${d})`:''}</small></td><td class="l h7-wrap">${cap(parts.join(' · '))}</td></tr>`}).join('')}</tbody></table>
    ${how(['Built from the league\'s ESPN history: for each past season, the teams and their owners, seeds, final finishes, regular-season category records and transactions, and the score of every matchup the data pull could read. Seasons are listed by ESPN season, so the 2018-19 NBA season is ESPN\'s 2019 league.',
      `Managers are tracked by their ESPN member account, never by team name or team number, because team numbers were reused by different people. A team with two owners counts fully for both.${D.merged.length?` Two ESPN accounts with the same name that co-owned one team are treated as one person (${esc(list(D.merged))}). Accounts with different names are never combined.`:''}`,
      'Category record and match record cover the regular season only (the category record is what set the seeds); playoff games are counted separately. Win % counts a tie as half. Average finish mixes league sizes when the league changed size.',
      `Category totals (points, rebounds and so on) exist only for the first ${lo===hi?lo:lo+' to '+hi} weeks of ${noT.length?'most seasons, and none for '+esc(list(noT)):'each season'}, so anything that needs them says which weeks it covers. Everything else uses the scores (categories won). The scoring settings changed over the years, so a clean sweep means winning every category scored that season.`,
      'Your current team is linked to a past manager by the name ESPN shows this season (often a first name and initial); when a name is too short or fits more than one person, no link is made.'])}</section>`;
  return out}

function heatPanel(D){const mode=S_X('h7.hm','cats'),me=D.me;
  const all=[...D.people].sort((a,b)=>b.nSeasons-a.nSeasons||(b.cwp??0)-(a.cwp??0)),cur=all.filter(p=>D.cur[p.id]);
  const canCur=cur.length>=2,whoK=canCur?S_X('h7.who','now'):'all',ps=whoK==='now'?cur:all,past=p=>whoK==='all'&&canCur&&!D.cur[p.id];
  // shade by the row manager's win rate, stretched over 20%-80% so typical rivalries (40-60%) still differ visibly
  const T=v=>v==null?0:Math.max(0,Math.min(1,(v-.2)/.6));
  const ramp=`<span class="h7-ramp" aria-hidden="true">${[0,.25,.5,.75,1].map(t=>`<i style="${CH.seq(t)}"></i>`).join('')}</span>`;
  const cell=(a,b)=>{const pc=past(b)?' h7-past':'';if(a===b)return `<td class="h7-c self${pc}">—</td>`;const s=hsum(a.H[b.id]);if(!s.n)return `<td class="h7-c none${pc}" data-tip="${esc(`${a.name} and ${b.name} never met`)}">·</td>`;
    const v=mode==='cats'?s.cwp:s.mwp;
    return `<td class="h7-c${pc}" style="${CH.seq(T(v))}" ${sxk(`hh|${a.id}|${b.id}`)} data-tip="${esc(`${a.name} vs ${b.name}: ${rec(s.w,s.l,s.t)} in ${plural(s.n,'meeting')} (${P(s.mwp)} of matchups), categories ${rec3(s.cw,s.cl,s.ct)} (${P(s.cwp)})`)}">${P(v).replace('%','')}</td>`};
  const ctl=`<div class="h7-segs">${canCur?segX('h7.who',whoK,[['now',"This season's "+cur.length],['all','Everyone ('+all.length+')']],'Which managers'):''}${segX('h7.hm',mode,[['cats','Category %'],['match','Match %']],'Head-to-head measure')}</div>`;
  return `<section class="panel">${head('All-time head to head',`Each row is one manager against each column: ${mode==='cats'?'the share of categories the row manager won':'the share of matchups the row manager won'} across every meeting (a tie counts half). Tap a cell for the rivalry.`,ctl)}
    <div class="legend"><span>Row manager won:</span><span class="h7-key">20% or less ${ramp} 80% or more</span><span>· never met</span></div>
    ${whoK==='all'&&canCur?`<p class="note h7-ph">On a phone the columns show this season's managers. Tap a name for that manager's full head-to-head list.</p>`:''}
    <div class="scroll"><table class="h7-hm"><thead><tr><th class="l stick" scope="col">Manager</th>${ps.map(q=>`<th scope="col" class="h7-ch${past(q)?' h7-past':''}" title="${esc(q.name)}"><span>${esc(q.short)}</span></th>`).join('')}</tr></thead><tbody>
    ${ps.map(a=>`<tr class="${me&&a.id===me.id?'me':''}"><td class="l stick"><button type="button" class="tlink" ${sx('own|'+a.id)}>${esc(a.short)}</button></td>${ps.map(b=>cell(a,b)).join('')}</tr>`).join('')}</tbody></table></div>
    ${how([`Every meeting between two managers counts, regular season and playoffs. Category % is the share of categories the row manager won across those meetings; match % is the share of matchups won. A tie counts as half in both. Shading uses the cell's measure, from light (20% or less) to dark (80% or more), so read it along a row.`,
      `"This season's" shows the ${cur.length} managers matched by name to a team in this year's league; "Everyone" adds those who have left. Unplayed playoff games (no stats) are not counted. Pairs with only one or two meetings are small samples; the tooltip gives the record.`])}</section>`}

function recordBook(D){const RB=D.RB,me=D.me,mark=t=>me&&t&&t.owners.includes(me.id)?' <span class="pill star">you</span>':'',markP=p=>me&&p.id===me.id?' <span class="pill star">you</span>':'';
  // ranks share a place when the shown value ties (1, 2, 2, 4)
  let prevTxt=null,prevRank=0;
  const li=(i,b,body)=>{const r=b.txt===prevTxt?prevRank:i+1;prevTxt=b.txt;prevRank=r;return `<li><i>${r}</i>${b.html}<span>${body}</span></li>`};
  const big=(d,txt)=>({txt,html:sbtn(d,txt,'h7-big')});
  // cut a sorted list at n, keeping a tie at the cut when that adds only one more row; otherwise say how many more share the last value
  const cut=(arr,n,key)=>{if(arr.length<=n)return {items:arr,more:0};const v=key(arr[n-1]);let k=n;while(k<arr.length&&key(arr[k])===v)k++;return k<=n+1?{items:arr.slice(0,k),more:0}:{items:arr.slice(0,n),more:k-n,v}};
  const card=(title,note,arr,n,key,row)=>{prevTxt=null;const c=cut(arr||[],n,key);return c.items.length?`<div class="h7-rc"><h3>${title}</h3>${note?`<p class="note">${note}</p>`:''}<ol>${c.items.map(row).join('')}</ol>${c.more?`<p class="note">${c.more} more tied at ${esc(String(c.v))}.</p>`:''}</div>`:''};
  const nCs=[...new Set(D.SE.map(se=>se.nC).filter(Boolean))],loC=nCs.length>1?Math.min(...nCs):null,loS=loC?D.SE.filter(se=>se.nC===loC):[];
  const capNote=loC?` In ${esc(loS.length>1?loS[0].label+' to '+loS[loS.length-1].label:loS[0].label)} the league scored ${loC} categories, so ${loC}-0 was the most possible then.`:'';
  const cards=[
    card('Best regular seasons','Share of categories won',RB.best,3,x=>P1(x.t.cwp),(x,i)=>li(i,big('hs|'+x.se.y,P1(x.t.cwp)),`${ownersHtml(D,x.t)}${mark(x.t)}<small>${esc(x.t.name)} · ${esc(x.se.label)} · ${rec3(x.t.cw,x.t.cl,x.t.ct)} · finished ${x.t.fin!=null?ord(x.t.fin):'–'}</small>`)),
    card('Worst regular seasons','',RB.worst,3,x=>P1(x.t.cwp),(x,i)=>li(i,big('hs|'+x.se.y,P1(x.t.cwp)),`${ownersHtml(D,x.t)}${mark(x.t)}<small>${esc(x.t.name)} · ${esc(x.se.label)} · ${rec3(x.t.cw,x.t.cl,x.t.ct)}</small>`)),
    card('Most titles','',RB.titles,5,p=>String(p.titles),(p,i)=>li(i,big('own|'+p.id,String(p.titles)),`${who(p)}${markP(p)}<small>${p.ss.filter(x=>x.t.fin===1).map(x=>esc(x.se.label)).join(', ')}</small>`)),
    card('Biggest blowouts','Categories won in one matchup, winner first.'+capNote,RB.blow,5,x=>{const m=x.m;return m.win===m.a?scoreTxt(m.aw,m.hw,m.t):scoreTxt(m.hw,m.aw,m.t)},(x,i)=>{const m=x.m,W=x.se.T[m.win],L=x.se.T[m.win===m.a?m.h:m.a],s=m.win===m.a?[m.aw,m.hw]:[m.hw,m.aw];
      return li(i,big(`hh|${W.owners[0]}|${L.owners[0]}`,scoreTxt(s[0],s[1],m.t)),`${ownersHtml(D,W)}${mark(W)}<small>over ${esc(ownersTxt(D,L))} · ${sbtn('hs|'+x.se.y,`${pname(x.se,m)}, ${esc(x.se.label)}`)}</small>`)}),
    card('Longest winning streaks','Matchups won in a row in one season: regular season and title bracket',RB.streak,5,x=>String(x.t.streak.n),(x,i)=>li(i,big('hs|'+x.se.y,String(x.t.streak.n)),`${ownersHtml(D,x.t)}${mark(x.t)}<small>${esc(x.t.name)} · ${esc(stretch(x.se,x.t.streak.from,x.t.streak.to))}, ${esc(x.se.label)}</small>`)),
    card('Most moves in a season','Adds plus trades',RB.moves,5,x=>String(x.t.moves),(x,i)=>li(i,big('hs|'+x.se.y,String(x.t.moves)),`${ownersHtml(D,x.t)}${mark(x.t)}<small>${plural(x.t.mv.adds,'add')}, ${plural(x.t.mv.trades,'trade')} · ${esc(x.se.label)}</small>`)),
    card('Most clean sweeps','Weeks winning every category',RB.sweeps,5,p=>String(p.sweeps),(p,i)=>li(i,big('own|'+p.id,String(p.sweeps)),`${who(p)}${markP(p)}<small>${Object.entries(p.swBy).map(([y,c])=>esc(D.SY[y].label)+(c>1?` (${c})`:'')).join(', ')}</small>`)),
    card('Best career win rate','Two or more seasons',RB.career,3,p=>P1(p.cwp),(p,i)=>li(i,big('own|'+p.id,P1(p.cwp)),`${who(p)}${markP(p)}<small>${rec3(p.cw,p.cl,p.ct)} · ${plural(p.nSeasons,'season')}</small>`))];
  return `<section class="panel" id="h7-records">${head('Record book','The best, worst and wildest from every season on record. Tap a number for the season, rivalry or career behind it.')}<div class="h7-rb">${cards.join('')}</div>
    ${how(['Season records use regular-season categories. Blowouts count categories won in one matchup, playoffs included; equal scores are listed newest first and share a rank. Streaks count straight matchup wins inside one season over the regular season and title bracket; a tie or a loss ends one, and placement or consolation games are skipped.','Moves are adds plus trades as ESPN counts them (drops and injured-list moves are left out). A clean sweep means winning every category scored that season.'])}</section>`}

HUB.push({k:'history',label:'History',order:70,note:'Every past season of the league: champions, careers, rivalries and the record book.',render:vHistory});
CMDS.push({label:'League history',sub:'Champions, careers, rivalries and the record book',kw:'history past seasons all time alltime records champions rivalry',tag:'Stats',act:()=>go('stats',{hub:'history'})});
// "champions" is also a keyword of other views' commands; put this exact match first so Enter lands on it
CMDS.unshift({label:'Champions',sub:'Every season\'s champion and runner-up',kw:'champion champions title winners trophy past',tag:'Stats',act:()=>{go('stats',{hub:'history'});setTimeout(()=>scrollToId('h7-champs'),0)}});
CMDS.push({label:'Record book',sub:'Best seasons, biggest wins, longest streaks',kw:'records record book best worst streak blowout sweep',tag:'Stats',act:()=>{go('stats',{hub:'history'});setTimeout(()=>scrollToId('h7-records'),0)}});
// one search command per manager: names come from the cheap identity pass; the numbers in the subtitle are read on demand, after boot
try{Object.values(ident().PP).filter(p=>p.owner).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p0=>CMDS.push({label:`${p0.name} career`,
  get sub(){const p=model().PP[p0.id];return p&&p.ss.length?`${plural(p.nSeasons,'season')} · ${p.titles?plural(p.titles,'title'):'no titles'} · ${P(p.cwp)} of categories`:'League history career'},
  kw:`${p0.name} manager career history owner`,tag:'Drill',act:()=>openStat('own|'+p0.id)}))}catch(e){console.error('h7 cmds',e)}
})();
