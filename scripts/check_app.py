"""Local end-to-end startup check. No public providers, credentials or fabricated inference."""
import json,urllib.request

def call(path,body=None):
    data=None if body is None else json.dumps(body).encode()
    request=urllib.request.Request('http://127.0.0.1:8080/api'+path,data=data,headers={'Content-Type':'application/json'})
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request,timeout=30) as response:return json.load(response)
def check():
    scenario=call('/forecasts',dict(targetId='region-uva',forecastAt=None,weather='CLEAR',isHoliday=False))
    assert scenario['experimental'] and scenario['dataSource']=='SYNTHETIC' and scenario['congestion'] in ['LOW','MODERATE','HIGH']
    catalog=call('/route-forecasts/catalog');assert len(catalog['journeys'])==30 and catalog['model']['modelStatus']=='ready'
    count=0
    for journey in catalog['journeys']:
        data=call('/route-forecasts',dict(journeyId=journey['id'],dataMode='SIMULATION',mode='LEAVE_NOW',weatherMode='AUTO'))
        assert data['dataMode']=='SIMULATION' and data['forecast']['status']=='AVAILABLE',journey['id']
        assert data['routing']['source']=='RECORDED_OSRM_DEMONSTRATION' and data['weather']['status']=='SIMULATED'
        result=data['forecast']['result'];assert result['adjustedDurationSeconds'] is None and not result['supportsJourneyDuration']
        for route in result['routePredictions']:
            assert route['status']=='SUPPORTED' and route['congestion'] in ['LOW','MODERATE','HIGH'] and route['dataSource']=='SYNTHETIC',journey['id']
            count+=1
    return {'scenarioModel':'ready','mappedModel':'ready','journeys':30,'recordedRouteCandidates':count}
if __name__=='__main__':print(json.dumps(check()))
