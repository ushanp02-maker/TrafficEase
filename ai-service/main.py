"""Synthetic-only inference; training is an explicit offline command."""

import hashlib
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo
import joblib
import pandas as pd
import sklearn
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from scenarios import CLASSES, FEATURES, TARGETS, WEATHER, features_for

COLOMBO = ZoneInfo("Asia/Colombo")


class ForecastRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    target_id: str = Field(alias="targetId", min_length=1, max_length=128)
    forecast_at: datetime | None = Field(default=None, alias="forecastAt")
    weather: Literal["CLEAR", "RAIN", "HEAVY_RAIN"]
    is_holiday: bool = Field(default=False, alias="isHoliday", strict=True)


def fail(status, code, message):
    raise HTTPException(status, detail={"code": code, "message": message})


def create_app(artifact_dir=None, clock=None):
    app = FastAPI(title="TrafficEase Experimental AI", version="0.3.0")
    app.state.clock = clock or (lambda: datetime.now(COLOMBO))
    app.state.model = None
    app.state.metadata = None
    app.state.model_status = "not_trained"
    directory = Path(
        artifact_dir or os.getenv("MODEL_DIR", Path(__file__).parent / "artifacts")
    )
    if (directory / "metadata.json").exists() or (directory / "model.joblib").exists():
        try:
            meta = json.loads((directory / "metadata.json").read_text())
            artifact = directory / "model.joblib"
            if (
                meta["features"] != FEATURES
                or meta["dataSource"] != "SYNTHETIC"
                or meta["experimental"] is not True
                or meta["libraries"]["sklearn"] != sklearn.__version__
                or hashlib.sha256(artifact.read_bytes()).hexdigest()
                != meta["artifactSha256"]
            ):
                raise ValueError("Model schema, version or checksum mismatch")
            # Never load uploaded or untrusted pickle/joblib artifacts.
            model = joblib.load(artifact)
            if set(model.classes_) != set(CLASSES):
                raise ValueError("Invalid classes")
            app.state.model, app.state.metadata, app.state.model_status = (
                model,
                meta,
                "ready",
            )
        except Exception:
            app.state.model_status = "unavailable"

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        return JSONResponse(
            status_code=error.status_code,
            content=(
                error.detail
                if isinstance(error.detail, dict)
                else {"code": "REQUEST_FAILED", "message": str(error.detail)}
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse(
            status_code=422,
            content={
                "code": "INVALID_REQUEST",
                "message": "Select a supported target, weather scenario, boolean holiday flag and valid offset-aware forecast time.",
            },
        )

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "service": "trafficease-ai",
            "model_status": app.state.model_status,
        }

    @app.get("/catalog")
    def catalog():
        now = app.state.clock().astimezone(COLOMBO)
        return dict(
            experimental=True,
            dataSource="SYNTHETIC",
            timezone="Asia/Colombo",
            now=now.isoformat(),
            maxForecastAt=(now + timedelta(days=7)).isoformat(),
            modelStatus=app.state.model_status,
            targets=TARGETS,
            weatherOptions=WEATHER,
            coverageNote="Fictional scenarios in nine provinces only. Region choices are representative arterials, not regional aggregates or measured coverage.",
        )

    @app.get("/models/current")
    def metadata():
        return dict(
            modelStatus=app.state.model_status,
            experimental=True,
            dataSource="SYNTHETIC",
            metadata=app.state.metadata,
        )

    @app.post("/predict")
    def predict(body: ForecastRequest):
        target = next((item for item in TARGETS if item["id"] == body.target_id), None)
        if target is None:
            fail(
                422,
                "UNSUPPORTED_LOCATION",
                "Location outside the hypothetical scenario catalog. No forecast was extrapolated.",
            )
        now = app.state.clock().astimezone(COLOMBO)
        at = body.forecast_at or now
        if at.tzinfo is None or at.utcoffset() is None:
            fail(
                422,
                "TIMEZONE_REQUIRED",
                "Use an offset-aware time; UI times are Asia/Colombo (+05:30).",
            )
        at = at.astimezone(COLOMBO)
        if not now <= at <= now + timedelta(days=7):
            fail(
                422,
                "OUTSIDE_FORECAST_HORIZON",
                "Choose now or a future time within the next seven days in Asia/Colombo.",
            )
        if app.state.model is None:
            fail(
                503,
                "MODEL_UNAVAILABLE",
                "Experimental model unavailable. Run offline training and restart the AI service.",
            )
        features = features_for(target, at, body.weather, body.is_holiday)
        category = str(
            app.state.model.predict(pd.DataFrame([features], columns=FEATURES))[0]
        )
        if category not in CLASSES:
            fail(503, "MODEL_UNAVAILABLE", "Model returned an unsupported category.")
        meta = app.state.metadata
        return dict(
            congestion=category,
            experimental=True,
            dataSource="SYNTHETIC",
            estimateKind="EXPERIMENTAL_AI",
            forecastAt=at.isoformat(),
            generatedAt=now.isoformat(),
            timezone="Asia/Colombo",
            target=target,
            features=features,
            weatherSource="USER_SCENARIO",
            holidaySource="USER_SCENARIO",
            modelVersion=meta["modelVersion"],
            datasetVersion=meta["datasetVersion"],
            supportsJourneyDuration=False,
            speedKph=None,
            journeyDurationSeconds=None,
            limitations=meta["limitations"],
        )

    return app


app = create_app()
