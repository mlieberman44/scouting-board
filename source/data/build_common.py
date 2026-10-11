import json,re
NBA={1:'ATL',2:'BOS',3:'NOP',4:'CHI',5:'CLE',6:'DAL',7:'DEN',8:'DET',9:'GSW',10:'HOU',11:'IND',12:'LAC',13:'LAL',14:'MIA',15:'MIL',16:'MIN',17:'BKN',18:'NYK',19:'ORL',20:'PHI',21:'PHX',22:'POR',23:'SAC',24:'SAS',25:'OKC',26:'UTA',27:'WAS',28:'TOR',29:'MEM',30:'CHA',0:'?'}
POS={0:'PG',1:'SG',2:'SF',3:'PF',4:'C'}
SLOT={0:'PG',1:'SG',2:'SF',3:'PF',4:'C',5:'G',6:'F',11:'UTIL',12:'BN',13:'IL'}
K=["0","6","3","2","1","11","13","14","15","16","17","18"]
F=["pts","reb","ast","stl","blk","to","fgm","fga","ftm","fta","tpm","tpa"]
EST={"RJ Barrett":(65,dict(pts=19.5,reb=5.8,ast=4.2,stl=.8,blk=.3,to=2.6,fgm=7.3,fga=15.5,ftm=3.4,fta=5.0,tpm=1.9,tpa=5.5)),
"Andrew Nembhard":(70,dict(pts=10.5,reb=3.0,ast=5.0,stl=.9,blk=.2,to=1.8,fgm=4.0,fga=8.7,ftm=1.4,fta=1.7,tpm=1.2,tpa=3.4)),
"Kevin Porter Jr.":(50,dict(pts=13.5,reb=4.3,ast=4.8,stl=1.4,blk=.4,to=2.6,fgm=5.1,fga=11.4,ftm=1.8,fta=2.3,tpm=1.5,tpa=4.3)),
"Darius Acuff Jr.":(65,dict(pts=12.0,reb=2.8,ast=4.0,stl=.8,blk=.2,to=2.3,fgm=4.4,fga=10.6,ftm=1.7,fta=2.1,tpm=1.5,tpa=4.4))}  # rookie PG (SAC); ESPN always cuts his entry off
PRIOR=15  # games of projection the season-to-date line is shrunk toward
def _p(rest,tag):
  m=re.search(tag+r':(\{.*?\}|none)',rest)
  if not m or m.group(1)=='none': return None
  d=json.loads(m.group(1).replace('none','null'))
  return d if d.get("42") else None
def per(d): return {f:round((d.get(k) or 0)/d["42"],3) for k,f in zip(K,F)}
def parse_rosters(path):
  players=[];tid=None
  for line in open(path):
    line=line.strip()
    if not line: continue
    if line.startswith('#T'): tid=int(line.split()[1]); continue
    if line.startswith('#'): continue
    parts=[p.strip() for p in line.split(' | ')]
    name,pro,dpos,elig,slot,inj,own=parts[:7]; rest=' | '.join(parts[7:])
    P,C,L,R=_p(rest,'P'),_p(rest,'C'),_p(rest,'L'),_p(rest,'R')
    m=re.search(r'ID:(\d+)',rest); eid=int(m.group(1)) if m else None
    src='ESPN 2027 projection' if P else ('2025-26 actual' if L else None); d=P or L
    m=re.search(r'SRC:([^|]+)',rest)
    if m and d: src=m.group(1).strip()  # roster_extra.txt names its own source
    if d: gp,pg=d["42"],per(d)
    elif name in EST: (gp,pg),src=EST[name],'Estimate (ESPN data unreadable)'
    else: gp,pg,src=0,None,'No data'
    cur=None
    if C:
      cur=per(C); cur['gp']=C["42"]
      if pg:  # blend the season so far into the projection, weighted by games played
        a=C["42"]/(C["42"]+PRIOR); pg={f:round(a*cur[f]+(1-a)*pg[f],3) for f in F}; src+=' + season stats'
      else: pg,gp,src=per(C),max(gp,C["42"]),'Season stats'
    rec=None
    if R and C and R["42"]<=C["42"]: rec=per(R); rec['gp']=R["42"]  # last 15 days (ESPN stats id 022027); more games than the season so far means preseason games leaked in
    ll=None
    if L: ll={f:round((L.get(k) or 0)/L["42"],2) for k,f in zip(K,F)}; ll['gp']=L["42"]
    el=json.loads(elig) if elig.startswith('[') else [int(x) for x in elig.split(',') if x]
    pos=[POS[s] for s in el if s in POS] or [POS.get(int(dpos)-1,'?')]
    players.append(dict(name=name,team=tid,nba=NBA[int(pro)],pos='/'.join(pos),slot=SLOT.get(int(slot),'?'),
      inj={'ACTIVE':'','NORMAL':'','DAY_TO_DAY':'DTD','OUT':'OUT','INJURY_RESERVE':'OUT','SUSPENSION':'OUT'}.get(inj,inj),
      own=float(own) if own not in ('none','') else None,gp=gp,pg=pg,src=src,last=ll,cur=cur,rec=rec,espnId=eid))
  return players
