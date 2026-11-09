from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from generate_dataset import generate
from scenarios import FEATURES, REGIONS
from train import splits, train
from main import create_app

NOW = datetime(2026, 11, 9, 23, 50, tzinfo=ZoneInfo("Asia/Colombo"))


@pytest.fixture(scope="module")
def trained(tmp_path_factory):
    directory = tmp_path_factory.mktemp("model")
    return directory, train(directory, directory / "evaluation.json")


@pytest.fixture
def client(trained):
    return TestClient(create_app(trained[0], clock=lambda: NOW))


def payload(**changes):
    return {
        **dict(
            targetId="western-urban",
            forecastAt=(NOW + timedelta(hours=1)).isoformat(),
            weather="RAIN",
            isHoliday=False,
        ),
        **changes,
    }


def test_generator_reproducible_and_explicit():
    a, b = generate(days=3), generate(days=3)
    assert a.equals(b) and not a.equals(generate(seed=1, days=3))
    assert set(a.source) == {"SYNTHETIC"} and a.experimental.all()
    assert set(a.region) == set(REGIONS) and set(a.congestion) == {
        "LOW",
        "MODERATE",
        "HIGH",
    }


def test_no_temporal_or_road_leakage():
    parts, heldout = splits(generate(days=10))
    assert parts["train"].timestamp.max() < parts["validation"].timestamp.min()
    assert parts["validation"].timestamp.max() < parts["test"].timestamp.min()
    assert set(parts["train"].road_id).isdisjoint(heldout)
    assert set(parts["unseen_road_test"].road_id) == set(heldout)
    indices = [set(data.index) for data in parts.values()]
    assert all(a.isdisjoint(b) for i, a in enumerate(indices) for b in indices[i + 1 :])
    assert not set(FEATURES) & {
        "congestion",
        "timestamp",
        "road_id",
        "source",
        "experimental",
    }


def test_selection_and_metrics(trained):
    meta = trained[1]
    assert meta["experimental"] and meta["dataSource"] == "SYNTHETIC"
    assert meta["modelType"] == "random_forest" and meta["totalGeneratedRows"] == 77760
    scores = meta["evaluation"]
    assert (
        scores["random_forest"]["validation"]["macro_f1"]
        > scores["majority_baseline"]["validation"]["macro_f1"]
    )
    assert len(scores["random_forest"]["test"]["confusion_matrix"]) == 3


@pytest.mark.parametrize(
    "offset", [timedelta(0), timedelta(minutes=20), timedelta(days=7)]
)
def test_valid_horizon(client, offset):
    response = client.post(
        "/predict", json=payload(forecastAt=(NOW + offset).isoformat())
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["congestion"] in ["LOW", "MODERATE", "HIGH"]
    assert body["experimental"] and body["dataSource"] == "SYNTHETIC"
    assert body["speedKph"] is None and not body["supportsJourneyDuration"]
    assert body["forecastAt"].endswith("+05:30")


@pytest.mark.parametrize(
    "offset", [timedelta(seconds=-1), timedelta(days=7, seconds=1)]
)
def test_invalid_horizon(client, offset):
    r = client.post("/predict", json=payload(forecastAt=(NOW + offset).isoformat()))
    assert r.status_code == 422 and r.json()["code"] == "OUTSIDE_FORECAST_HORIZON"


def test_midnight_and_utc_conversion(client):
    assert (
        client.post("/predict", json=payload(forecastAt=None)).json()["features"][
            "hour"
        ]
        == 23
    )
    body = client.post(
        "/predict", json=payload(forecastAt="2026-11-10T00:05:00+05:30")
    ).json()
    assert body["features"]["hour"] == 0 and body["features"]["weekday"] == 1
    assert (
        client.post("/predict", json=payload(forecastAt="2026-11-09T18:35:00Z")).json()[
            "forecastAt"
        ]
        == body["forecastAt"]
    )


def test_naive_time(client):
    assert (
        client.post("/predict", json=payload(forecastAt="2026-11-10T00:05:00")).json()[
            "code"
        ]
        == "TIMEZONE_REQUIRED"
    )


def test_unsupported_inputs(client):
    assert (
        client.post("/predict", json=payload(targetId="unknown")).json()["code"]
        == "UNSUPPORTED_LOCATION"
    )
    assert client.post("/predict", json=payload(weather="SNOW")).status_code == 422
    assert client.post("/predict", json=payload(extra="override")).status_code == 422


def test_catalog_and_region_scope(client):
    catalog = client.get("/catalog").json()
    assert len(catalog["targets"]) == 36 and catalog["timezone"] == "Asia/Colombo"
    response = client.post("/predict", json=payload(targetId="region-uva")).json()
    assert response["target"]["kind"] == "REGION_SCENARIO"
    assert "not regional aggregates" in response["limitations"][1]


def test_missing_model(tmp_path):
    client = TestClient(create_app(tmp_path, clock=lambda: NOW))
    assert client.get("/catalog").json()["modelStatus"] == "not_trained"
    assert client.post("/predict", json=payload()).status_code == 503


def test_corrupt_model(trained, tmp_path):
    (tmp_path / "metadata.json").write_bytes(
        (trained[0] / "metadata.json").read_bytes()
    )
    (tmp_path / "model.joblib").write_bytes(b"invalid")
    client = TestClient(create_app(tmp_path, clock=lambda: NOW))
    assert client.get("/health").json()["model_status"] == "unavailable"
    assert client.post("/predict", json=payload()).json()["code"] == "MODEL_UNAVAILABLE"
