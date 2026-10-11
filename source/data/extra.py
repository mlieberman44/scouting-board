"""Keeps roster_extra.txt: rostered players that ESPN's mRoster page cuts off (REFRESH.md step 1b).
Lines use the rosters_raw.txt format, so refresh.py reads them with the same parser.
Per-game lines are 13 numbers copied from ESPN's athlete stats (regular-season averages):
  "G FGM FGA 3PM 3PA FTM FTA REB AST STL BLK TO PTS"   (FG/3PT/FT columns read made-attempted)
Commands (run from anywhere):
  python3 extra.py list
  python3 extra.py set TEAM "NAME" ESPN_ID NBA INJ POS "<2025-26 per-game>" [--src TEXT] [--slot BN|IL|UTIL|PG|..] [--games N]
        NBA = ESPN abbreviation like SAC, or ? if unsigned; INJ = ACTIVE, DAY_TO_DAY or OUT; POS like PG/SG
        Projection = the per-game line over projected games: G pulled two-thirds of the way up to 70 (one bad
        season says little about the next), or exactly N with --games when you know better (a long injury).
        A --src starting "Estimate" (rookie guess, older season) shows an EST tag and keeps no last-season line.
  python3 extra.py drop ESPN_ID               player left the league's rosters
  python3 extra.py move ESPN_ID TEAM          player traded to another fantasy team
  python3 extra.py inj ESPN_ID INJ            injury status changed
  python3 extra.py nba ESPN_ID NBA            NBA team changed
  python3 extra.py cur ESPN_ID "<2026-27 per-game>"   season-so-far line (G = games played)
"""
import json,os,re,sys
PATH=os.environ.get('EXTRA_PATH','/mnt/project-files/league/data/roster_extra.txt')
PRO={'ATL':1,'BOS':2,'NOP':3,'CHI':4,'CLE':5,'DAL':6,'DEN':7,'DET':8,'GSW':9,'HOU':10,'IND':11,'LAC':12,'LAL':13,'MIA':14,'MIL':15,'MIN':16,'BKN':17,'NYK':18,'ORL':19,'PHI':20,'PHX':21,'POR':22,'SAC':23,'SAS':24,'OKC':25,'UTA':26,'WAS':27,'TOR':28,'MEM':29,'CHA':30,'?':0,
     'GS':9,'NO':3,'NY':18,'SA':24,'UTAH':26,'WSH':27}
PI={'PG':0,'SG':1,'SF':2,'PF':3,'C':4}
KEYS=['42','13','14','17','18','15','16','6','3','2','1','11','0']  # G FGM FGA 3PM 3PA FTM FTA REB AST STL BLK TO PTS
INJ={'ACTIVE','DAY_TO_DAY','OUT','INJURY_RESERVE','SUSPENSION'}
SLOTS={'PG':0,'SG':1,'SF':2,'PF':3,'C':4,'G':5,'F':6,'UTIL':11,'BN':12,'IL':13}
def die(msg): sys.exit('extra.py: '+msg)
def pergame(s):
  v=[float(x) for x in s.replace(',',' ').split()]
  if len(v)!=13: die(f'need 13 numbers (G FGM FGA 3PM 3PA FTM FTA REB AST STL BLK TO PTS), got {len(v)}')
  g,fgm,fga,tpm,tpa,ftm,fta=v[:7]; pts=v[12]
  if g<1 or fgm>fga or tpm>tpa or ftm>fta or tpm>fgm: die('numbers look out of order; copy them as G FGM FGA 3PM 3PA FTM FTA REB AST STL BLK TO PTS')
  if abs(2*fgm+tpm+ftm-pts)>0.35: die(f'points check failed: 2*FGM+3PM+FTM = {2*fgm+tpm+ftm:.1f} but PTS = {pts}; re-read the line')
  return v
def totals(v,g): return {k:(int(g) if k=='42' else round(x*g)) for k,x in zip(KEYS,v)}
def js(d): return 'none' if d is None else json.dumps(d,separators=(',',':'))
def elig(pos):
  try: s={PI[p] for p in pos.upper().split('/')}
  except KeyError: die('POS must be slash-separated PG, SG, SF, PF, C')
  for slot,need in ((5,{0,1}),(6,{2,3}),(7,{1,2}),(8,{0,1,2,3}),(9,{3,4}),(10,{2,3,4})):
    if s&need: s.add(slot)
  return sorted(s|{11,12,13})
def load():
  head,rows,tid=[],[],None
  for l in open(PATH):
    l=l.rstrip('\n')
    if l.startswith('#T'): tid=int(l.split()[1])
    elif l.startswith('#') or not l.strip(): head.append(l) if not rows else None
    else: rows.append([tid,l])
  return head,rows
def save(head,rows):
  out=list(head);cur=None
  for tid,l in sorted(rows,key=lambda r:r[0]):
    if tid!=cur: out.append(f'#T {tid}'); cur=tid
    out.append(l)
  open(PATH,'w').write('\n'.join(out)+'\n')
def find(rows,eid):
  hit=[r for r in rows if re.search(rf'\| ID:{eid}( |$)',r[1])]
  if not hit: die(f'no line with ID {eid}; see: python3 extra.py list')
  return hit[0]
def field(l,i,val):
  p=l.split(' | '); p[i]=str(val); return ' | '.join(p)
def tag(l,t,val):
  return re.sub(rf'\| {t}:(\{{.*?\}}|none)',f'| {t}:{val}',l,count=1)
a=sys.argv[1:]
if not a or a[0] in ('help','-h','--help'): print(__doc__); sys.exit()
head,rows=load();cmd=a[0]
if cmd=='list':
  for tid,l in sorted(rows,key=lambda r:r[0]):
    p=l.split(' | ');m=re.search(r'ID:(\d+)',l);s=re.search(r'SRC:(.*)$',l)
    nba=[k for k,v in PRO.items() if v==int(p[1])][0]
    print(f'team {tid:>2} | {p[0]} | {nba} | {p[5]} | ID {m.group(1)} | {s.group(1) if s else ""}{" | has 2026-27 line" if "C:{" in l else ""}')
  print(len(rows),'players')
elif cmd=='set':
  opts=dict(zip(a[8::2],a[9::2])) if len(a)>8 else {}
  if len(a)<8: die('set needs TEAM "NAME" ESPN_ID NBA INJ POS "<per-game line>"')
  tid,name,eid,nba,inj,pos,line=int(a[1]),a[2],int(a[3]),a[4].upper(),a[5].upper(),a[6],a[7]
  if nba not in PRO: die(f'unknown NBA team {nba}')
  if inj not in INJ: die(f'INJ must be one of {sorted(INJ)}')
  v=pergame(line);g=int(v[0]);gp=int(opts['--games']) if '--games' in opts else (g if g>=70 else int(round(70-(70-g)/3)))
  src=opts.get('--src','2025-26 actual');slot=SLOTS.get(opts.get('--slot','BN').upper())
  if slot is None: die('--slot must be one of '+', '.join(SLOTS))
  rows=[r for r in rows if not re.search(rf'\| ID:{eid}( |$)',r[1])]
  last=None if src.startswith('Estimate') else totals(v,g)
  dpos=PI[pos.upper().split('/')[0]]+1
  rows.append([tid,f'{name} | {PRO[nba]} | {dpos} | {js(elig(pos))} | {slot} | {inj} | none | P:{js(totals(v,gp))} | C:none | R:none | L:{js(last)} | ID:{eid} | SRC:{src}'])
  save(head,rows); print('set',name,'on team',tid,'projected games',gp)
elif cmd in ('drop','move','inj','nba','cur'):
  if len(a)<2: die(f'{cmd} needs ESPN_ID')
  r=find(rows,int(a[1]))
  if cmd=='drop': rows.remove(r)
  elif cmd=='move': r[0]=int(a[2])
  elif cmd=='inj':
    if a[2].upper() not in INJ: die(f'INJ must be one of {sorted(INJ)}')
    r[1]=field(r[1],5,a[2].upper())
  elif cmd=='nba':
    if a[2].upper() not in PRO: die(f'unknown NBA team {a[2]}')
    r[1]=field(r[1],1,PRO[a[2].upper()])
  elif cmd=='cur': v=pergame(a[2]); r[1]=tag(r[1],'C',js(totals(v,v[0])))
  save(head,rows); print(cmd,'done:',r[1].split(' | ')[0])
else: die(f'unknown command {cmd}; run: python3 extra.py help')
