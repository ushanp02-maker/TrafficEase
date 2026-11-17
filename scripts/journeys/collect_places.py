"""Operator-invoked, one-time small catalog collection. Single thread, cached, >1 s/request.
Never invoked by application startup/build/tests. Review candidates before accepting endpoints.
"""
import json,time,urllib.parse,urllib.request
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[2]
QUERIES={
'Pettah':'Pettah, Colombo, Sri Lanka','Piliyandala':'Piliyandala, Western Province, Sri Lanka','Avissawella':'Avissawella, Sri Lanka','Homagama':'Homagama, Western Province, Sri Lanka','Kaduwela':'Kaduwela, Colombo District, Sri Lanka','Maharagama':'Maharagama, Western Province, Sri Lanka','Moratuwa':'Moratuwa, Sri Lanka','Panadura':'Panadura, Sri Lanka','Negombo':'Negombo, Sri Lanka','Colombo Fort':'Colombo Fort railway station, Sri Lanka','Kandy':'Kandy, Sri Lanka','Gampaha':'Gampaha, Sri Lanka','Nugegoda':'Nugegoda, Western Province, Sri Lanka','Kottawa':'Kottawa, Colombo District, Sri Lanka','Kadawatha':'Kadawatha, Sri Lanka','Malabe':'Malabe, Sri Lanka','Battaramulla':'Battaramulla, Sri Lanka','Dehiwala':'Dehiwala, Sri Lanka','Kesbewa':'Kesbewa, Sri Lanka','Kalutara':'Kalutara, Sri Lanka','Katunayake':'Katunayake, Sri Lanka','Peradeniya':'Peradeniya, Sri Lanka','Kurunegala':'Kurunegala, Sri Lanka','Nittambuwa':'Nittambuwa, Sri Lanka','Galle':'Galle, Sri Lanka','Matara':'Matara, Sri Lanka','Tangalle':'Tangalle, Sri Lanka','Ratnapura':'Ratnapura, Sri Lanka','Anuradhapura':'Anuradhapura, Sri Lanka','Badulla':'Badulla, Sri Lanka','Ella':'Ella, Badulla District, Sri Lanka','Jaffna':'Jaffna, Sri Lanka','Kilinochchi':'Kilinochchi, Sri Lanka','Trincomalee':'Trincomalee, Sri Lanka','Batticaloa':'Batticaloa, Sri Lanka'}
if __name__=='__main__':
 path=ROOT/'data/journeys/place-candidates.json'
 cache=json.loads(path.read_text()) if path.exists() else {}
 for name,query in QUERIES.items():
  if name in cache:continue
  url='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode(dict(q=query,format='jsonv2',countrycodes='lk',addressdetails=1,namedetails=1,limit=4))
  request=urllib.request.Request(url,headers={'User-Agent':'TrafficEase-Coursework/0.5 (+https://github.com/ushanp02-maker/TrafficEase)','Accept':'application/json'})
  try:
   with urllib.request.urlopen(request,timeout=25) as r:rows=json.load(r)
   cache[name]={'query':query,'source':'Nominatim / OpenStreetMap (ODbL)','sourceUrl':url,'retrievedAt':datetime.now(timezone.utc).isoformat(),'candidates':rows}
   path.write_text(json.dumps(cache,ensure_ascii=False,indent=2)+'\n')
   print(name,[(r.get('name'),r.get('type'),r.get('lat'),r.get('lon'),r.get('display_name')) for r in rows],flush=True)
  except Exception as error:
   print('FAILED',name,str(error),flush=True)
   break # Do not retry in a loop after a policy/quota/network failure.
  time.sleep(1.3)
