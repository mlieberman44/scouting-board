import json,re
NBA={1:'ATL',2:'BOS',3:'NOP',4:'CHI',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GSW',10:'HOU',11:'IND',12:'LAC',13:'LAL',14:'MIA',15:'MIL',16:'MIN',17:'BKN',18:'NYK',19:'ORL',20:'PHI',21:'PHX',22:'POR',23:'SAC',24:'SAS',25:'OKC',26:'UTA',27:'WAS',28:'TOR',29:'MEM',30:'CHA',0:'?'}
POS={0:'PG',1:'SG',2:'SF',3:'PF',4:'C'}
SLOT={0:'PG',1:'SG',2:'SF',3:'PF',4:'C',5:'G',6:'F',11:'UTIL',12:'BN',13:'IL'}
TEAMS={1:("Coward-ly Acts of Fears","NUT","Matt L."),2:("Hillbilly Kobe","BOUL","Kirolos"),3:("Obi Wan Ginobili","Meat","Collin"),4:("Midrange Merchants","MIDY","Glynn"),5:("Team Pritika","PRIT","Matt P."),6:("P Giddey","PGDD","Cole"),7:("EL ARROZ C0N Banchero","Nick","N"),9:("The Grimey Clingers Pod","DYER","Luke"),11:("Big White Niks","BRAG","Eli"),12:("Dan's Dangerous Team","DDT","Dan")}
K=["0","6","3","2","1","11","13","14","15","16","17","18"]
F=["pts","reb","ast","stl","blk","to","fgm","fga","ftm","fta","tpm","tpa"]
# per-game estimates where ESPN data was unreadable (my own estimates, flagged)
EST={"RJ Barrett":(65,dict(pts=19.5,reb=5.8,ast=4.2,stl=.8,blk=.3,to=2.6,fgm=7.3,fga=15.5,ftm=3.4,fta=5.0,tpm=1.9,tpa=5.5)),
"Andrew Nembhard":(70,dict(pts=10.5,reb=3.0,ast=5.0,stl=.9,blk=.2,to=1.8,fgm=4.0,fga=8.7,ftm=1.4,fta=1.7,tpm=1.2,tpa=3.4)),
"Kevin Porter Jr.":(50,dict(pts=13.5,reb=4.3,ast=4.8,stl=1.4,blk=.4,to=2.6,fgm=5.1,fga=11.4,ftm=1.8,fta=2.3,tpm=1.5,tpa=4.3))}
players=[];tid=None
for line in open('/mnt/project-files/league/data/rosters_raw.txt'):
  line=line.strip()
  if not line: continue
  if line.startswith('#T'): tid=int(line.split()[1]); continue
  parts=[p.strip() for p in line.split(' | ')]
  name,pro,dpos,elig,slot,inj,own=parts[:7]
  rest=' | '.join(parts[7:])
  m=re.search(r'P:(\{.*?\}|none)',rest); l=re.search(r'L:(\{.*?\}|none)',rest)
  def parse(s):
    if not s or s.group(1)=='none': return None
    d=json.loads(s.group(1)); 
    if not d.get("42"): return None
    return d
  P,L=parse(m),parse(l)
  src='ESPN 2027 projection' if P else ('2025-26 actual' if L else None)
  d=P or L
  if d:
    gp=d["42"]; pg={f:round((d.get(k) or 0)/gp,3) for k,f in zip(K,F)}
  elif name in EST:
    gp,pg=EST[name]; src='Estimate (ESPN data unreadable)'
  else:
    gp,pg,src=0,None,'No data'
  ll=None
  if L:
    ll={f:round((L.get(k) or 0)/L["42"],2) for k,f in zip(K,F)}; ll['gp']=L["42"]
  el=json.loads(elig) if elig.startswith('[') else [int(x) for x in elig.split(',') if x]
  pos=[POS[s] for s in el if s in POS] or [POS.get(int(dpos)-1,'?')]
  players.append(dict(name=name,team=tid,nba=NBA[int(pro)],pos='/'.join(pos),slot=SLOT.get(int(slot),'?'),
    inj={'ACTIVE':'','NORMAL':'','DAY_TO_DAY':'DTD','OUT':'OUT'}.get(inj,inj),own=float(own),gp=gp,pg=pg,src=src,last=ll))
data=dict(teams=[dict(id=k,name=v[0],abbr=v[1],mgr=v[2]) for k,v in TEAMS.items()],players=players,myTeam=1,asOf="2026-09-30")
json.dump(data,open('/mnt/project-files/league/data/league_2027.json','w'),separators=(',',':'))
print(len(players),sum(1 for p in players if p['pg']), [p['name'] for p in players if p['src']!='ESPN 2027 projection'])
