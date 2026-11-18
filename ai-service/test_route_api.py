"""Offline tests use real captured OSRM geometry; weather is explicitly simulated."""
import copy
import json
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
import pytest
from fastapi import HTTPException
from route_api import RouteEngine, RouteInput, recommendation, CATALOG
from route_features import extract, FEATURES
from train_routes import train, dataset, ROOT

NOW=datetime(2026,11,18,12,tzinfo=ZoneInfo('Asia/Colombo'))
OBS=json.loads((ROOT/'data/journeys/routing-observations.json').read_text(encoding='utf-8'))
CAT=json.loads(CATALOG.read_text(encoding='utf-8'))

@pytest.fixture(scope='module')
def engine(tmp_path_factory):
    directory=tmp_path_factory.mktemp('route-model')
    train(directory,directory/'report.json')
    return RouteEngine(directory)

def payload(jid):
    return dict(journeyId=jid, forecastAt=NOW.isoformat(), candidates=[dict(id=f'route-{i+1}',geometry=r['geometry'],distanceMeters=r['distance'],durationSeconds=r['duration'],weather='RAIN') for i,r in enumerate(OBS[jid]['routes'])])

def test_all_thirty_real_geometries_and_provenance(engine):
    assert engine.status=='ready'
    assert len(CAT['journeys'])==len(OBS)==30
    for jid in OBS:
        response=engine.predict(RouteInput(**payload(jid)),NOW)
        assert response['dataSource']=='SYNTHETIC' and response['experimental']
        assert response['supportsJourneyDuration'] is False and response['adjustedDurationSeconds'] is None
        for p in response['routePredictions']:
            assert p['status']=='SUPPORTED', (jid,p)
            assert p['congestion'] in ['LOW','MODERATE','HIGH']
            assert p['geometryFeatures']['laneCount'] is None
            assert p['geometryFeatures']['roadClass'] is None
            assert p['geometryFeatures']['speedLimitKph'] is None
            assert set(p['features'])==set(FEATURES)
            assert p['adjustedDurationSeconds'] is None
    assert set(FEATURES).isdisjoint({'journey_id','route_index','durationSeconds','distanceMeters'})

def test_chronological_and_heldout_journey_split():
    frame,parts,heldout=dataset()
    assert len(frame)==272160
    assert parts['train'].date.max()<parts['validation'].date.min()<parts['test'].date.min()
    assert set(parts['train'].journey_id).isdisjoint(heldout)
    assert set(parts['unseen_journey_test'].journey_id)==set(heldout)
    assert parts['validation'].date.max()<parts['test'].date.min()

@pytest.mark.parametrize('offset',[timedelta(seconds=-1),timedelta(days=7,seconds=1)])
def test_reject_time_outside_horizon(engine,offset):
    body=payload(next(iter(OBS)));body['forecastAt']=(NOW+offset).isoformat()
    with pytest.raises(HTTPException) as error:engine.predict(RouteInput(**body),NOW)
    assert error.value.detail['code']=='OUTSIDE_FORECAST_HORIZON'

def test_exact_seven_days_and_timezone(engine):
    body=payload(next(iter(OBS)));body['forecastAt']=(NOW+timedelta(days=7)).isoformat()
    assert engine.predict(RouteInput(**body),NOW)['forecastAt'].endswith('+05:30')
    body['forecastAt']='2026-11-18T12:00:00'
    with pytest.raises(HTTPException) as error:engine.predict(RouteInput(**body),NOW)
    assert error.value.detail['code']=='TIMEZONE_REQUIRED'

def test_unknown_journey_and_duplicate_id(engine):
    body=payload(next(iter(OBS)));body['journeyId']='fictional'
    with pytest.raises(HTTPException) as error:engine.predict(RouteInput(**body),NOW)
    assert error.value.detail['code']=='UNSUPPORTED_JOURNEY'
    body=payload(next(iter(OBS)));body['candidates']*=2
    with pytest.raises(HTTPException):engine.predict(RouteInput(**body),NOW)

def test_missing_and_tampered_model(tmp_path,engine):
    assert RouteEngine(tmp_path).status=='not_trained'
    (tmp_path/'metadata.json').write_text(json.dumps(engine.metadata))
    (tmp_path/'model.joblib').write_bytes(b'untrusted')
    assert RouteEngine(tmp_path).status=='unavailable'

def test_foreign_or_malformed_shape_is_unsupported(engine):
    body=payload(next(iter(OBS)))
    body['candidates'][0]['geometry']={'type':'LineString','coordinates':[[0,51],[0,52]]}
    response=engine.predict(RouteInput(**body),NOW)
    assert response['routePredictions'][0]['status']=='UNSUPPORTED_FEATURES'
    assert response['recommendation']['routeId'] is None

def test_identical_geometry_never_gets_arbitrary_differences(engine):
    body=payload(next(iter(OBS)));a=body['candidates'][0];b=copy.deepcopy(a);b['id']='route-2';b['durationSeconds']+=300
    body['candidates']=[a,b]
    response=engine.predict(RouteInput(**body),NOW)
    p,q=response['routePredictions']
    assert p['syntheticBurden']==q['syntheticBurden']
    assert response['recommendation']['status']=='TIE_OR_INSUFFICIENT_DIFFERENTIATION'
    body['candidates'].reverse()
    reversed_response=engine.predict(RouteInput(**body),NOW)
    assert {p['routeId']:p['syntheticBurden'] for p in response['routePredictions']}=={p['routeId']:p['syntheticBurden'] for p in reversed_response['routePredictions']}

def test_recommendation_requires_distinct_supported_candidates():
    p=dict(routeId='route-1',status='SUPPORTED',syntheticBurden=.1,congestion='LOW',features={'directness':1.1,'turns_per_km':.2,'weather':'CLEAR'})
    q=dict(routeId='route-2',status='SUPPORTED',syntheticBurden=1.3,congestion='HIGH',features={'directness':1.5,'turns_per_km':.8,'weather':'RAIN'})
    assert recommendation([p])['status']=='SINGLE_ROUTE'
    assert recommendation([q,p])['routeId']=='route-1'
    q['status']='UNSUPPORTED_FEATURES'
    assert recommendation([p,q])['status']=='INSUFFICIENT_SUPPORTED_ROUTES'

def test_http_route_contract_and_unavailable_model(tmp_path):
    from main import create_app
    from fastapi.testclient import TestClient
    app=create_app(tmp_path,clock=lambda:NOW)
    client=TestClient(app)
    assert client.get('/route-model').json()['modelStatus']=='not_trained'
    missing=client.post('/route-predict',json=payload(next(iter(OBS))))
    assert missing.status_code==503 and missing.json()['code']=='ROUTE_MODEL_UNAVAILABLE'
    invalid=client.post('/route-predict',json={'candidates':[]})
    assert invalid.status_code==422 and invalid.json()['code']=='INVALID_REQUEST'
