# Scouting Board modules: build spec (v14 "Stats lab")

The Scouting Board is one static HTML page for ESPN league 99907173 (10 teams, H2H each-category, 9 categories:
PTS REB AST STL BLK TO FG% FT% 3P%; TO is lower-is-better; 3P% replaces 3PM). The owner is Matt, team id 1 (`ME`).
Goal of v14, in Matt's words: "make it the ultimate app for fantasy basketball and this league by making every statistic
interactive and diving deep with league stats" and "make it feel like the most advanced fantasy basketball tool there is".

## Files

- Core: `/mnt/project-files/league/app/dev/app_src.html` (one classic `<script>` with all core code, then `<!--MODULES-->`, then a boot script).
  Read it before writing a module: everything below is defined there. Only the wiring job edits it.
- Modules: `/mnt/project-files/league/app/dev/mods/<name>.js`. `make_page.py` inlines each one as its own `<script>` between the
  core and the boot script, sorted by file name. Production (`app/app_src.html`, `app/mods/`) is untouched until release.
- Build a test page (never write `app/scouting-board.html`, the production output):
  `python3 /mnt/project-files/league/app/make_page.py --src /mnt/project-files/league/app/dev/app_src.html --modsdir /mnt/project-files/league/app/dev/mods --mods <your module names, comma-separated> --out <your scratch dir>/test.html`
- Playwright + Chromium are installed: `NODE_PATH=$(npm root -g) node yourtest.js` with `const {chromium}=require('playwright')`.
  The only expected console error is a font CDN certificate error (`ERR_CERT_AUTHORITY_INVALID`); ignore it.

## Module rules

1. Wrap the whole file in `(()=>{ ... })();`. Top-level `const`/`function` names in separate classic scripts share one
   global scope, so an unwrapped name that collides with another module's kills that module. Register only through the
   core registries below.
2. No network, no external libraries, no `localStorage` directly (use `S.x` via `data-set`/`data-setk`, or `store.get/set`
   with a key prefixed by your module name). No `alert/confirm/prompt`, no `window.open`, no downloads.
3. Escape every name or string from data with `esc()`. Player names can contain apostrophes and periods.
4. Plain, friendly English in the UI, like the rest of the board: short sentences, numbers with context, no jargon without
   an explanation (each view and drill ends with a `how([...])` "How this works" block). Use they/them for players and managers.
5. Must work at 390px wide (no horizontal page scroll; wide tables go inside `<div class="scroll">`) and at 1280px; in light
   and dark themes (use the CSS tokens and classes below, never literal colors); fast (a drill renders in under ~50 ms;
   a heavy computation is wrapped in `memo(key, fn)` so it runs once per model state).
6. Preseason now (games start Oct 20, 2026); everything must also work once games start (`p.cur`, `p.rec`, team records,
   `DATA.live`, `weeksDone`). Never assume a value exists: `p.pg` can be null ("No data"), `p.cur`/`p.rec`/`p.last` can be null,
   free agents have `team 0`, `draftPick` can be null.
7. Every number you show should either open a deeper drill (`data-stat`) or be self-explanatory. Prefer linking into the
   shared drill catalog below over writing a near-duplicate.

## Registries (defined in the core)

```js
DRILL[type] = (...args) => ({eyebrow, title, sub, html})   // args are strings from data-stat="type|arg|arg"; return null if not applicable
HUB.push({k, label, note, order, render})                   // a view in the Stats tab (render returns one or more <section class="panel">)
CMDS.push({label, sub, kw, tag, act})                       // extra search results; act() runs on Enter/click, e.g. ()=>go('stats',{hub:'cats'})
PANELS.home.push(()=>html)  PANELS.team.push(teamId=>html)  PANELS.player.push(name=>html)  PANELS.matchup.push((teamId,oppId,week)=>html)
memo(key, fn)                                               // cache per model state
```
- Open a drill from any element: `sx('pc|'+name+'|pts')` returns the attribute string `data-stat="..."`;
  `sbtn(desc, html, cls)` returns a focusable underlined button. Table cells: `<td class="num" ${sx(desc)}>…</td>`.
  Drills open in the side sheet (bottom sheet on phones) with a Back button, so drills can link to other drills freely.
- State for controls: `<button data-set="key=value">` or `<select data-setk="key">` set `S.x[key]` (a string) and re-render;
  read it with `S_X(key, default)`. Namespace keys by module, e.g. `cats.k`, `teams.cmp`.
- Navigation: `data-go="league"` (+ `data-lg="cats"`), `go('stats',{hub:'draft'})`, `data-team="3"` opens a team page,
  `data-player="Name"` opens a player profile, `data-wkteam`/`data-week` open a matchup.

## Drill catalog (descriptor → content). Use exactly these descriptors.

Player drills (module `d_player.js`):
- `pc|<name>|<cat>`: one player in one category. Per-game value and z-score; rank and percentile among rostered players
  (and among all including free agents); dot strip of every rostered player with this one highlighted (`CH.strip`, `rev` for TO);
  the top 10 in the category (each a `pc` link); share of their fantasy team's category total and rank within the roster;
  for FG%/FT%/3P%: makes, attempts and "impact" (how far above league average times volume) and why volume matters;
  projection vs last season vs season so far vs last 15 when present; what a punt of this category does to their value.
- `pv|<name>`: fantasy value breakdown. Contribution of each category (diverging `CH.hbars` of z-scores, punted ones greyed),
  per game vs full-season value (games factor), rank among rostered, the 5 players closest in value (links), similar players
  by category shape (nearest neighbours in 9-category z space, links).
- `ptv|<name>`: trade value breakdown. Model / draft slot / ROS rank components with their blend weights (`BLEND`), the
  model's parts (`p.tvParts`: per-game value, games factor, injury, data confidence, position flexibility), tier, rank, and the
  players just above and below on the chart (links), plus which teams need what this player provides (their weak categories).
- `pgm|<name>`: games outlook. NBA games per fantasy week for the whole season (`gamesIn(p.nba,w)` over `WEEKS`; playoff weeks
  marked), vs the league average for that week, four-game and two-game weeks, total games in fantasy playoffs, projected games played.

Team drills (module `d_team.js`):
- `tc|<teamId>|<cat>`: one team in one category. Team total (`t.line[k]`) and rank; bar chart of all 10 teams (links to `tc`);
  each roster player's contribution (bars, links to `pc`); gap to the team above and below in plain numbers ("+2.3 REB a game
  passes Team X"); the best free agents for this category (links to `pc`).
- `tval|<teamId>`: team value and grade: value by player (bars), stars vs depth (share of value from the top 3), value by
  position, category z totals.
- `tpr|<teamId>`: power rank breakdown: weekly strength (`t.rr`), roster value, real record weight; the formula in plain words;
  the teams just above and below and what separates them.
- `tpo|<teamId>`: playoff odds: seed probabilities 1-10 (`CH.dist` from `seasonSim()[id].seed`), projected final record,
  average finish, #1 seed odds; the remaining schedule with win chance per week (links to `mw`); hardest and easiest weeks.
- `trec|<teamId>`: category record vs the field: result against each other team (`M.mx`), wins and losses by category
  (how many teams they beat in each), and the real record when games have been played.
- `tgm|<teamId>`: games by week for this roster (`projTeam(id,w,0).games` and `.bench`) vs the league average, playoff weeks.
- `h2h|<teamA>|<teamB>`: roster against roster, category by category: both totals, who wins each, the margin, the players
  driving each side; link to their real matchup week(s) on the schedule.

Matchup drills (module `d_matchup.js`):
- `mw|<teamA>|<teamB>|<week>`: the week. Distribution of categories won 0-9 (`mp(a,b,w).dist`, bars ≥5 coloured as wins),
  win chance, each category's win chance (links to `mc`), expected player-games and benched games for both sides,
  the day-by-day games (who plays each day), the swing categories, and what would most improve the chance (e.g. the best streamer
  from `weekAdds(w,drop)` when teamA is ME).
- `mc|<teamA>|<teamB>|<week>|<cat>`: one category in that week. Both projected totals and the overlap of their ranges
  (`CH.normals` from `da/db` means and `sqrt(v)`), the chance, which players contribute most on each side (per-game × expected
  starts that week from `Pa.days`), how many games each side has, and how much more of the stat would flip it to a lean.

League drill (module `h2_cats.js`):
- `lc|<cat>`: the category across the league: leaders (rostered and free agents), team totals and ranks, distribution,
  scarcity (how concentrated it is), who is punting it (teams ranked 9-10 that look deliberate), links everywhere.

## Stats tab views (HUB, sorted by `order`)

- `order:10 k:'overview' label:'Overview'` (module `h1_overview.js`): league at a glance: the most notable numbers in the league
  right now, each a card that opens its drill: category leaders, closest category races between teams, the most lopsided and
  closest matchups this week, best values, biggest strengths and holes for your team, playoff race summary. Also adds an
  "Insights" panel to Home (`PANELS.home`) with the 4-6 most useful insights for Matt's team.
- `order:20 k:'cats' label:'Categories'` (`h2_cats.js`): category centre.
- `order:30 k:'teams' label:'Teams'` (`h3_teams.js`): team lab: radar comparison of up to 3 teams (category percentiles among
  the 10 teams; default Matt, this week's opponent, the #1 power team), a team × category rank heat map (cells open `tc`),
  team archetypes (which categories each roster is built for), stars vs depth, positions, injuries, games. Also a "Team DNA"
  radar panel on each team page (`PANELS.team`).
- `order:40 k:'sim' label:'Season sim'` (`h4_sim.js`): playoff and title odds: a seed probability heat map (team × seed,
  `CH.seq`), playoff odds, title odds from simulating the 5-team bracket (weeks 21-23: seeds 4 v 5 in round one while seeds 1-3
  have byes, then 1 v lowest remaining and 2 v 3, then the final; say this is the assumed ESPN format), a team × week win
  probability heat map for the regular season (cells open `mw`), strength of schedule remaining.
- `order:50 k:'draft' label:'Draft'` (`h5_draft.js`): draft lab for this league's Sep 27 snake draft (pick numbers are on each
  player as `draftPick`; derive each team's draft slot from its round-one pick, snake order, verify every pick maps to the right team):
  the draft board grid (rounds × teams) coloured by value against what that pick usually returns (steal / reach), a pick vs
  trade value scatter with the expected curve, best steals and biggest reaches (links), team draft grades, value by round,
  position runs.
- `order:60 k:'pos' label:'Positions'` (`h6_pos.js`): positional scarcity: value curves by position (`CH.line`, value by rank
  within each position), replacement level per position (the Nth best where N = how many each position fills league-wide),
  team × position strength heat map, multi-position flexibility, best free agent at each position.
- `order:70 k:'history' label:'History'` (`h7_history.js`, built later from `DATA.history`).

## Core globals you can use

Model: `M.players` (rostered), `M.fas` (free agents), `M.all`, `M.teams`, `M.mx[a][b]={w,l,t}`, `M.lg` (league shooting
averages), `M.st[k]={m,s}`, `M.avgGp`. `tm(id)`, `findP(name)`, `teamById[id]` (raw), `rosterOf(id)`, `ME`, `DATA`.
Player fields: `name team nba pos slot inj('',DTD,OUT) own gp pg{pts reb ast stl blk to fgm fga ftm fta tpm tpa} src last cur rec`
(each line has `gp`), `espnId draftPick rosRank z zpg pct value nv nvPG prio tv tvModel tvDraft tvRos tvParts tvRank rank`.
Team fields: `id name abbr mgr record{w,l,t} roster catZ line catRank rec{w,l,t,mw} value nv risk count tvSum rr score grade pr`.
Schedule/weeks: `WEEKS`, `REGW` (20), `PO_WEEKS` ([21,22,23]), `PER[w]` (days), `curWeek`, `weeksDone`, `preseason`,
`weekName(w)`, `weekLabel(w)`, `oppOf(team,w)`, `DATA.schedule` ([week,away,home]), `gamesIn(nba,w,from)`, `poGames(p)`,
`plays(nba,day)`, `spDate(day)`, `fmtD(date)`, `todaySP`.
Matchups: `mp(a,b,w)` → `{p:{cat:prob a wins}, exp, expL, win, dist[0..9], Pa, Pb, da, db, live}`; `projTeam(id,w,from)`,
`weekProj(roster,w,from)`, `catDist`, `catProbs`, `matchOdds`, `seasonSim()[id]={po, seed[10], w, l, top}`.
Moves: `weekAdds(w,drop)`, `rosAdds(drop,targets)`, `dropDefault(id)`, `evalDeal`, `suggestTrades`.
Helpers: `CATS` ([{k,l,n,neg?,pct?}]), `KEYS`, `catOf(k)`, `catV(line,c)`, `fmtC(c,v)`, `better(c,a,b)`, `pctl(arr,v,neg)`,
`rankIn(arr,v,neg)`, `ord(n)`, `zOf(line)`, `lineOf(players)`, `recordOf(line,id)`, `ranksOf(line,id)`, `tierOf(tv)`,
`pickStr(n)`, `pills(p)`, `pcell(p,sub)`, `playerCells(p,line,z)`, `catHeads()`, `teamOpts(sel)`, `posOpts(sel)`, `head(t,note,act)`,
`how([...])`, `seg(id,cur,opts,label)`, `kpi(l,big,small)`, `fact(l,big,small,stat)`, `drillSec(title,note,html)`,
`zc(z)`/`rc(rank)`/`winCls(p)`/`tag(p)` (cell classes), `scoreStr(r)`, `pc(x)`, `f1 f2 f3 sg`, `esc`, `norm`, `mean`, `sdev`,
`rng(seed)`, `Phi`, `icon(k)`, `teamAbbr(p)`, `slotName(s)`, `S` (state: `S.punt` Set of punted cats, `S.mode` 'pg'|'season').

Value model in one paragraph: each category's raw value is the per-game stat (FG%/FT%/3P% use impact = (player% − league%)
× attempts); z = (raw − mean of rostered players) / sd, sign flipped for TO; `value` = sum of z over non-punted categories
(per game, or scaled by games in season mode). Team `line` = summed per-game stats of the roster with percentages as made/attempted.

## Charts and styles

Charts (`CH.*`, SVG/HTML strings using the theme tokens; every mark gets a `data-tip` tooltip and may carry `stat` to open a drill):
`CH.hbars(rows,{fmt,max,label})` rows `{label,v,txt,hi,me,stat,tip,cls}` (diverging when any v<0);
`CH.strip(items,{fmt,rev,label})` items `{v,label,hi,me,stat}`; `CH.radar(series,axes,{of,label})` series `{name,cls:'s1'|'s2'|'s3',vals[0..1],stats?}`;
`CH.dist(items,{label,legend})` items `{x,p,cls:'bar-w'|'bar-l'|'bar-n',tip,em,stat}`; `CH.normals([{m,s,name,cls}],{fmt,rev})`;
`CH.line(series,{xl,fmt,y0,y1,ref,h})` series `{name,cls,pts:[[x,y,stat?]]}`; `CH.scatter(pts,{xl,yl,fx,fy,ref,rx,h})`
pts `{x,y,label,tip,hi,me,stat}`; `CH.seq(t)` returns an inline style for a 0..1 heat cell; `CH.ticks(lo,hi,n)`.
Colours: `s1` orange (first series / "this one"), `s2` blue (Matt's team, second series), `s3` green (third). Never more than
three series in one chart. Text stays in ink/muted tokens. Status colours: `p1 p2 p3` (good), `n1 n2 n3` (bad) cell classes.
Classes: `panel`, `ph`, `note`, `lbl`, `eyebrow`, `btn` (`ghost`, `sm`), `linkbtn`, `seg`, `chips`/`chip`, `filters`, `cols`
(two columns that stack), `cards`, `kpis`/`kpi`, `facts`/`fact`, `scroll` (+`tall`), `table` with `th.l td.l stick num z`,
`tr.me` (Matt's row), `tr.click`, `pill` (+ `p1..p3 n1..n3 live star dtd out est`), `grade g-A g-Bp g-B g-Cp g-C`, `sub`, `empty`,
`legend`, `drill-sec`. Sortable headers: `th(view,key,label)` with your own `S.sort[view]` entry (add one in your module: `S.sort['mymod']=['v','desc']`).

## Core additions (Oct 7, after the first two modules)

- `CH.hbars(rows,{center:true})` always draws the diverging layout around 0 (bars coloured by sign: give rows `cls:'pos'|'neg'`,
  or leave it to the sign). `CH.hbars(rows,{stack:true})` puts each label on its own line at 560px and below, for long names.
  Legend swatches `.legend .pos` and `.legend .neg` match signed bars.
- SVG chart text (`.ch text`) is 15px under 560px so it stays readable once the viewBox scales down; leave room for it.
- A drill result may set `back:'Short label'`, which the Back button shows instead of the title.
- `addCSS(id, css)` adds a module's own layout CSS once (theme tokens only, ids prefixed with the module name).
- `TVK={repl,maxRaw}`: the trade value curve's replacement level and range, so a module can show the arithmetic
  `tvModel = 100 * ((adj - repl) / maxRaw) ^ 0.85`.
