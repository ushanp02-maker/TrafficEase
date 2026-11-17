"""One-time serial OSRM verification. Cached snapshots are evidence/training, NEVER live fallback."""
import json,time,urllib.request,math
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
def hav(a,b):
 p,q=map(math.radians,[a[1],b[1]]);x=math.sin((q-p)/2)**2+math.cos(p)*math.cos(q)*math.sin(math.radians(b[0]-a[0])/2)**2
 return 6371000*2*math.asin(min(1,math.sqrt(x)))
if __name__=='__main__':
 catalog=json.loads((ROOT/'backend/src/main/resources/experimental/journeys.json').read_text());path=ROOT/'data/journeys/routing-observations.json';cache=json.loads(path.read_text()) if path.exists() else {}
 for journey in catalog['journeys']:
  if journey['id'] in cache:continue
  a,b=[catalog['places'][journey[k]] for k in ['origin','destination']]
  url=f"https://router.project-osrm.org/route/v1/driving/{a['longitude']},{a['latitude']};{b['longitude']},{b['latitude']}?geometries=geojson&overview=full&alternatives=true&steps=true&generate_hints=false"
  try:
   req=urllib.request.Request(url,headers={'User-Agent':'TrafficEase-Coursework/0.5 (+https://github.com/ushanp02-maker/TrafficEase)'})
   with urllib.request.urlopen(req,timeout=30) as r:body=json.load(r)
   snaps=[max(w['distance'],hav([p['longitude'],p['latitude']],w['location'])) for p,w in zip([a,b],body.get('waypoints',[]))]
   routes=[{k:r[k] for k in ['distance','duration','geometry']}|{'roadNames':list(dict.fromkeys(s.get('name','') for l in r.get('legs',[]) for s in l.get('steps',[]) if s.get('name')))} for r in body.get('routes',[])]
   status='ROUTABLE' if body.get('code')=='Ok' and routes and len(snaps)==2 and max(snaps)<=300 else 'EXCESSIVE_SNAPPING_OR_NO_ROUTE'
   cache[journey['id']]={'id':journey['id'],'name':journey['name'],'verifiedAt':datetime.now(timezone.utc).isoformat(),'sourceUrl':url,'status':status,'providerCode':body.get('code'),'snappingMeters':snaps,'waypoints':body.get('waypoints',[]),'routes':routes}
   path.write_text(json.dumps(cache,ensure_ascii=False,separators=(',',':'))+'\n')
   print(journey['name'],status,len(routes),'routes',list(map(lambda x:round(x,1),snaps)),flush=True)
  except Exception as error:
   cache[journey['id']]={'id':journey['id'],'name':journey['name'],'status':'PROVIDER_ERROR','message':str(error),'verifiedAt':datetime.now(timezone.utc).isoformat()};path.write_text(json.dumps(cache,ensure_ascii=False,separators=(',',':'))+'\n');print(journey['name'],'PROVIDER_ERROR',str(error),flush=True)
   break # no retry loop on quota/network failures
  time.sleep(1.3)
