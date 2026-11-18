"""Local startup preparation; generate missing/invalid trusted models, never on HTTP requests."""
import json,os
from pathlib import Path
from main import create_app

def ensure(directory=None):
    directory=Path(directory or os.getenv('MODEL_DIR',Path(__file__).parent/'artifacts')).resolve()
    app=create_app(directory)
    if app.state.model_status!='ready':
        from train import train
        train(directory,directory/'startup-evaluation.json')
    if app.state.route_engine.status!='ready':
        from train_routes import train
        train(directory/'routes',directory/'routes'/'startup-evaluation.json')
    app=create_app(directory)
    if app.state.model_status!='ready' or app.state.route_engine.status!='ready':
        raise RuntimeError('Both trained models must load before startup can continue')
    return {'scenario':'ready','routes':'ready','scenarioVersion':app.state.metadata['modelVersion'],'routeVersion':app.state.route_engine.metadata['modelVersion']}
if __name__=='__main__':print(json.dumps(ensure()))
