"""TrafficEase experimental AI service foundation. No model is trained yet."""
from fastapi import FastAPI
app = FastAPI(title="TrafficEase AI", version="0.1.0")
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "trafficease-ai", "model_status": "not_trained"}
