from fastapi.testclient import TestClient
from main import create_app


def test_health_reports_untrained_model(tmp_path):
    response = TestClient(create_app(tmp_path)).get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "trafficease-ai",
        "model_status": "not_trained",
    }
