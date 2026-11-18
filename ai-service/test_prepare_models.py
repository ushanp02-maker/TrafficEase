from types import SimpleNamespace
from pathlib import Path
import pytest
import prepare_models
import train
import train_routes

@pytest.mark.parametrize('scenario,mapped,expected',[
    ('ready','ready',[]),('not_trained','ready',['scenario']),('ready','unavailable',['mapped']),('unavailable','not_trained',['scenario','mapped'])])
def test_startup_repairs_only_unavailable_models_and_rechecks(monkeypatch,tmp_path,scenario,mapped,expected):
    calls=[];loads=[]
    def app(directory):
        loads.append(directory)
        first=len(loads)==1
        return SimpleNamespace(state=SimpleNamespace(model_status=scenario if first else 'ready',metadata={'modelVersion':'scenario'},route_engine=SimpleNamespace(status=mapped if first else 'ready',metadata={'modelVersion':'mapped'})))
    monkeypatch.setattr(prepare_models,'create_app',app)
    def capture(name):
        def run(output,report):
            assert Path(report).is_relative_to(tmp_path)
            calls.append(name)
        return run
    monkeypatch.setattr(train,'train',capture('scenario'));monkeypatch.setattr(train_routes,'train',capture('mapped'))
    assert prepare_models.ensure(tmp_path)['routes']=='ready'
    assert calls==expected and len(loads)==2

def test_startup_never_claims_ready_if_repair_does_not_load(monkeypatch,tmp_path):
    state=SimpleNamespace(model_status='ready',metadata={'modelVersion':'old'},route_engine=SimpleNamespace(status='unavailable'))
    monkeypatch.setattr(prepare_models,'create_app',lambda directory:SimpleNamespace(state=state))
    monkeypatch.setattr(train_routes,'train',lambda *args:None)
    with pytest.raises(RuntimeError,match='Both trained models'):prepare_models.ensure(tmp_path)
