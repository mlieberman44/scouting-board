"""Merge a fresh ESPN pull into league_2027.json.
Inputs (all in this folder):
  rosters_raw.txt  one line per rostered player (see REFRESH.md), '#T <teamId>' headers
  live.txt         optional: current matchup scores (see REFRESH.md)
Keeps freeAgents/schedule/week1Games/draft info from the existing JSON."""
import json,re,sys,datetime
D='/mnt/project-files/league/data/'
exec(open(D+'build_common.py').read())
old=json.load(open(D+'league_2027.json'))
picks=json.load(open(D+'draft_picks_by_id.json'))
oldby={p['name']:p for p in old['players']}
ros={p['name']:p.get('rosRank') for p in old['players']+old['freeAgents']}
players=parse_rosters(D+'rosters_raw.txt')
# ESPN's mRoster page cuts off after 13 entries per team; roster_extra.txt carries the rest (REFRESH.md step 1b)
try:
  have={p['espnId'] for p in players}|{p['name'] for p in players}
  extra=parse_rosters(D+'roster_extra.txt')
  shown=[p['name'] for p in extra if p['espnId'] in have or p['name'] in have]
  players+=[p for p in extra if p['espnId'] not in have and p['name'] not in have]
  if shown: print('roster_extra players that rosters_raw now shows (its fresh line wins):',shown)
except FileNotFoundError: pass
for p in players:
  o=oldby.get(p['name'],{})
  p['draftPick']=picks.get(str(p.get('espnId'))) if p.get('espnId') else o.get('draftPick')
  p['rosRank']=ros.get(p['name'])
  # a fetch that loses a projection the last pull had: keep the last good one
  if o.get('src','').startswith('ESPN 2027 projection') and not p['src'].startswith('ESPN 2027 projection') and not p.get('cur'):
    p['pg'],p['gp'],p['src']=o['pg'],o['gp'],o['src']
  # ESPN sometimes ships a projection with zero FT or 3P attempts (LaVine did); keep the earlier numbers then
  if p['pg'] and o.get('pg'):
    for a,b in (('ftm','fta'),('tpm','tpa')):
      if not p['pg'][b] and o['pg'].get(b): p['pg'][a],p['pg'][b]=o['pg'][a],o['pg'][b]
rostered={p['name'] for p in players}
fas=[f for f in old['freeAgents'] if f['name'] not in rostered]
# players who were dropped become free agents (keep their projection)
for n,o in oldby.items():
  if n not in rostered and not any(f['name']==n for f in fas):
    fas.append({**o,'team':0,'slot':'FA','draftPick':None})
old.update(players=players,freeAgents=fas,asOf=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'))
try:
  lines=[l.strip() for l in open(D+'live.txt') if l.strip() and not l.startswith('#')]
  hdr=dict(x.split(':') for x in lines[0].split())  # 'week:N' and optionally 'day:<latestScoringPeriod>'
  wk=int(hdr['week']); day=int(hdr['day']) if 'day' in hdr else None; ms=[]
  for l in lines[1:]:
    a,h,rec,cats=[x.strip() for x in l.split('|')]
    aw,hw,t=[int(x) for x in rec.split('-')]
    ms.append(dict(away=int(a),home=int(h),aw=aw,hw=hw,t=t,cats=json.loads(cats)))
  old['live']=dict(week=wk,day=day,matchups=ms)
except FileNotFoundError: pass
try:  # standings: one line per team, 'teamId | W-L-T' (category wins, losses, ties)
  rec={}
  for l in open(D+'records.txt'):
    l=l.strip()
    if not l or l.startswith('#'): continue
    tid,wlt=[x.strip() for x in l.split('|')]
    w,lo,t=[int(x) for x in wlt.split('-')]; rec[int(tid)]=dict(w=w,l=lo,t=t)
  for t in old['teams']:
    if t['id'] in rec: t['record']=rec[t['id']]
except FileNotFoundError: pass
json.dump(old,open(D+'league_2027.json','w'),separators=(',',':'))
print(len(players),'rostered,',len(fas),'FA; live:',old.get('live',{}).get('week'),'asOf',old['asOf'])
print('season stats for',sum(1 for p in players if p.get('cur')),'players; changed injuries:',
  [(p['name'],oldby[p['name']].get('inj'),p['inj']) for p in players if p['name'] in oldby and oldby[p['name']].get('inj')!=p['inj']])
cnt={}
for p in players: cnt[p['team']]=cnt.get(p['team'],0)+1
print('players per team:',dict(sorted(cnt.items())),'(15 when full, up to 17 with IL)')
moved=[(p['name'],oldby[p['name']]['team'],p['team']) for p in players if p['name'] in oldby and oldby[p['name']]['team']!=p['team']]
if moved: print('MOVED between fantasy teams (name, from, to):',moved)
left=[n for n in oldby if n not in rostered]
if left: print('LEFT ROSTERS, now free agents:',left,'- confirm in the league activity feed (kona_league_communication); a player who was only cut off goes in roster_extra.txt (extra.py set)')
