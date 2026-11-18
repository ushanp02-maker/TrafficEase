"""Internal route-level synthetic inference, with conservative comparison/abstention."""
import hashlib
import json
from datetime import timedelta
from pathlib import Path
from typing import Literal
import joblib
import pandas as pd
import sklearn
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from route_features import FEATURES, CLASSES, FEATURE_VERSION, extract, metres, feature_row

CATALOG=Path(__file__).resolve().parents[1]/'backend/src/main/resources/experimental/journeys.json'

class Candidate(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    id: str=Field(pattern=r'^route-[1-8]$')
    geometry: dict
    distanceMeters: float=Field(gt=0,le=600000)
    durationSeconds: float=Field(gt=0,le=172800)
    weather: Literal['CLEAR','RAIN','HEAVY_RAIN']

class RouteInput(BaseModel):
    model_config=ConfigDict(extra='forbid')
    journeyId: str=Field(min_length=3,max_length=128)
    forecastAt: datetime|None=None
    candidates: list[Candidate]=Field(min_length=1,max_length=8)


def problem(code,message,status=422):
    raise HTTPException(status,detail={'code':code,'message':message})


def recommendation(predictions):
    if len(predictions)==1:
        return dict(status='SINGLE_ROUTE',routeId=None,message='OSRM returned one genuine route; no alternative is available to recommend.')
    if any(p['status']!='SUPPORTED' for p in predictions):
        return dict(status='INSUFFICIENT_SUPPORTED_ROUTES',routeId=None,message='At least one returned route is unsupported. No complete congestion comparison is established.')
    ranked=sorted(predictions,key=lambda p:p['syntheticBurden'])
    best,second=ranked[:2]
    margin=second['syntheticBurden']-best['syntheticBurden']
    shape_difference=abs(best['features']['directness']-second['features']['directness'])>=.05 or abs(best['features']['turns_per_km']-second['features']['turns_per_km'])>=.1
    weather_difference=best['features']['weather']!=second['features']['weather']
    if margin<.25 or best['congestion']==second['congestion'] or not (shape_difference or weather_difference):
        return dict(status='TIE_OR_INSUFFICIENT_DIFFERENTIATION',routeId=None,message='The returned routes cannot be meaningfully distinguished by this synthetic model. Compare genuine baseline time/distance instead.')
    return dict(status='EXPERIMENTAL_PREFERENCE',routeId=best['routeId'],syntheticBurdenMargin=round(margin,4),message='Lower synthetic expected category burden among all supported returned routes. Not a guarantee of avoiding real traffic; no ETA or time saving is inferred.')


class RouteEngine:
    def __init__(self,directory):
        self.status='not_trained';self.model=None;self.metadata=None;self.catalog={}
        try:self.catalog=json.loads(CATALOG.read_text(encoding='utf-8'))
        except Exception:self.status='unavailable'
        directory=Path(directory)
        if (directory/'metadata.json').exists() or (directory/'model.joblib').exists():
            try:
                meta=json.loads((directory/'metadata.json').read_text(encoding='utf-8'));artifact=directory/'model.joblib'
                if meta['features']!=FEATURES or meta['featureVersion']!=FEATURE_VERSION or meta['dataSource']!='SYNTHETIC' or meta['experimental'] is not True or meta['libraries']['sklearn']!=sklearn.__version__ or meta['artifactSha256']!=hashlib.sha256(artifact.read_bytes()).hexdigest():
                    raise ValueError('Route model schema/provenance/checksum mismatch')
                if not self.catalog:raise ValueError('Verified journey catalog missing')
                model=joblib.load(artifact) # Only trusted, locally generated, checksum-verified artifacts.
                if set(model.classes_)!=set(CLASSES):raise ValueError('Unexpected classes')
                self.model,self.metadata,self.status=model,meta,'ready'
            except Exception:self.status='unavailable'

    def predict(self,request,now):
        journey=next((j for j in self.catalog.get('journeys',[]) if j['id']==request.journeyId),None)
        if journey is None:problem('UNSUPPORTED_JOURNEY','Choose a verified journey from the 30-journey catalog.')
        at=request.forecastAt or now
        if at.tzinfo is None or at.utcoffset() is None:problem('TIMEZONE_REQUIRED','Use an explicit offset; the journey timezone is Asia/Colombo.')
        at=at.astimezone(now.tzinfo)
        if not now<=at<=now+timedelta(days=7):problem('OUTSIDE_FORECAST_HORIZON','Departure must be now through seven days ahead.')
        if self.status!='ready':problem('ROUTE_MODEL_UNAVAILABLE','Train the separate route-shape model before inference.',503)
        ids=[c.id for c in request.candidates]
        if len(set(ids))!=len(ids):problem('INVALID_REQUEST','Duplicate route identifiers are not comparable.')
        endpoints=[self.catalog['places'][journey[k]] for k in ['origin','destination']]
        predictions=[]
        for c in request.candidates:
            try:
                shape=extract(c.model_dump())
                if any(metres(p,[e['longitude'],e['latitude']])>305 for p,e in zip([c.geometry['coordinates'][0],c.geometry['coordinates'][-1]],endpoints)):
                    raise ValueError('Route endpoints do not match the verified journey')
                row=feature_row(shape,at,c.weather)
                probabilities=self.model.predict_proba(pd.DataFrame([row],columns=FEATURES))[0]
                probability={name:float(value) for name,value in zip(self.model.classes_,probabilities)}
                category=max(probability,key=probability.get)
                burden=sum(CLASSES.index(name)*p for name,p in probability.items())
                predictions.append(dict(routeId=c.id,status='SUPPORTED',congestion=category,features=row,geometryFeatures=shape,syntheticClassProbabilities=probability,syntheticBurden=round(burden,6),baselineDurationSeconds=c.durationSeconds,adjustedDurationSeconds=None,experimental=True,dataSource='SYNTHETIC'))
            except (ValueError,KeyError,TypeError,IndexError) as error:
                predictions.append(dict(routeId=c.id,status='UNSUPPORTED_FEATURES',reason=str(error),congestion=None,experimental=True,dataSource='SYNTHETIC'))
        return dict(estimateKind='EXPERIMENTAL_ROUTE_CONGESTION',experimental=True,dataSource='SYNTHETIC',modelVersion=self.metadata['modelVersion'],featureVersion=FEATURE_VERSION,forecastAt=at.isoformat(),generatedAt=now.isoformat(),routePredictions=predictions,recommendation=recommendation(predictions),supportsJourneyDuration=False,adjustedDurationSeconds=None,limitations=self.metadata['limitations'])


def register_route_api(app,directory):
    engine=RouteEngine(directory);app.state.route_engine=engine
    @app.get('/route-model')
    def route_model():
        return dict(experimental=True,dataSource='SYNTHETIC',modelStatus=engine.status,metadata=engine.metadata,featureVersion=FEATURE_VERSION)
    @app.post('/route-predict')
    def route_predict(body:RouteInput):
        return engine.predict(body,app.state.clock())
