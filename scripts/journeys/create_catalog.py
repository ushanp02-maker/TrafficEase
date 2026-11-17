"""Reviewed selections. Index choices are deliberate and recorded, not first-result heuristics."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PAIRS=[('Pettah','Piliyandala'),('Pettah','Avissawella'),('Pettah','Homagama'),('Pettah','Kaduwela'),('Pettah','Maharagama'),('Pettah','Moratuwa'),('Pettah','Panadura'),('Pettah','Negombo'),('Colombo Fort','Kandy'),('Colombo Fort','Gampaha'),('Nugegoda','Piliyandala'),('Nugegoda','Kottawa'),('Maharagama','Homagama'),('Kottawa','Kadawatha'),('Kaduwela','Malabe'),('Battaramulla','Colombo Fort'),('Dehiwala','Panadura'),('Kesbewa','Moratuwa'),('Panadura','Kalutara'),('Negombo','Katunayake'),('Kandy','Peradeniya'),('Kandy','Kurunegala'),('Gampaha','Nittambuwa'),('Galle','Matara'),('Matara','Tangalle'),('Ratnapura','Avissawella'),('Kurunegala','Anuradhapura'),('Badulla','Ella'),('Jaffna','Kilinochchi'),('Trincomalee','Batticaloa')]
# The distractors include districts, a pier, commercial premises and a playground.
CHOICES={'Pettah':(1,'Bus station named Pettah in Colombo; rejected pier, pharmacy and tree.'),'Piliyandala':(1,'Town clock tower road-access landmark; rejected playground/commercial premises.'),'Colombo Fort':(0,'Mapped Fort railway station point, not a broad city label.'),'Panadura':(1,'Mapped Panadura railway station, not its platform or DS division.'),'Gampaha':(1,'Gampaha city, not the district centroid.'),'Kalutara':(1,'Kalutara city, not the district centroid.'),'Ratnapura':(1,'Ratnapura city, not district centroid.'),'Batticaloa':(1,'Batticaloa city, not district centroid.')}
def slug(name):return re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-')
def build():
 raw=json.loads((ROOT/'data/journeys/place-candidates.json').read_text());places={}
 for name in sorted(set(v for pair in PAIRS for v in pair)):
  index,reason=CHOICES.get(name,(0,'Reviewed named town/city/suburb candidate and country/province; rejected district/other-category distractors where present.'))
  candidate=raw[name]['candidates'][index]
  assert candidate['address']['country_code']=='lk'
  places[slug(name)]={'id':slug(name),'name':name,'selectedLandmark':candidate.get('name',name),'latitude':float(candidate['lat']),'longitude':float(candidate['lon']),'countryCode':'LK','osmType':candidate['osm_type'],'osmId':str(candidate['osm_id']),'placeId':str(candidate['place_id']),'displayName':candidate['display_name'],'mapType':candidate['type'],'source':'Nominatim / OpenStreetMap','sourceUrl':raw[name]['sourceUrl'],'verifiedAt':raw[name]['retrievedAt'],'selectionReason':reason,'coordinateStatus':'GEOCODER_VERIFIED_NOT_FIELD_SURVEY'}
 catalog={'version':'lk-journeys-v1','attribution':'© OpenStreetMap contributors (ODbL); geocoding by Nominatim; baseline routing by OSRM','coordinateNote':'Named-place/transport-landmark points reviewed against returned mapping metadata; not field-surveyed. Runtime road snapping is independently limited to 300 m.','places':places,'journeys':[{'id':slug(a)+'--'+slug(b),'name':a+' → '+b,'origin':slug(a),'destination':slug(b)} for a,b in PAIRS]}
 observations=ROOT/'data/journeys/routing-observations.json'
 if observations.exists():
  records=json.loads(observations.read_text())
  for j in catalog['journeys']:
   row=records.get(j['id'],{})
   j['verification']={k:row.get(k) for k in ['status','verifiedAt','snappingMeters']}|{'routeCount':len(row.get('routes',[]))}
 (ROOT/'backend/src/main/resources/experimental/journeys.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':build()
