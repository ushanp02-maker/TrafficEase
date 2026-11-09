from fastapi.testclient import TestClient
from main import app

def test_health_reports_untrained_model():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "trafficease-ai", "model_status": "not_trained"}
