# M3: Experimental synthetic congestion forecasting

Status: implemented on `vidura`; not a real traffic forecasting product. No AWS or AR work is included. OSRM routing code and provider durations are not changed by predictions.

## Scope and dataset provenance

`ai-service/generate_dataset.py` deterministically creates **77,760 wholly synthetic rows**: 120 hypothetical days from 2025-01-01 through 2025-04-30, hourly, for 27 fictional corridors (three road archetypes in each of Sri Lanka's nine named provinces). These are invented scenarios, not mapped roads, actual Sri Lankan observations or evidence of regional traffic coverage. No external dataset, weather feed or routing response is used in training.

Features: region, hypothetical road class, lanes, hypothetical posted speed limit, Colombo-local hour, weekday (Monday=0), holiday flag and weather (`CLEAR`, `RAIN`, `HEAVY_RAIN`). Road identity and timestamps are retained for splitting/provenance but excluded from model features. Targets are `LOW`, `MODERATE`, `HIGH` categories from a declared latent scenario score plus seeded noise; the latent score is never an input.

The generator assumes weekday morning/evening peaks, an arterial effect, weather effects, a small explicitly invented Western-region effect and holiday reductions. Thresholds 0.9/1.8 map the score to categories. These assumptions are coursework hypotheses, not research findings about Sri Lanka. Every seventeenth synthetic day is a hypothetical holiday; this is **not an official Sri Lankan holiday calendar**. Weather is independently sampled from a fixed hypothetical distribution, without claims about monsoons, seasons or actual weather history. Read the generator for the exact coefficients and noise distribution.

Seed: `20261109`; dataset version: `hypothetical-lk-v1`. Dataset SHA-256, model version, artifact checksum, parameters, library versions, features, timestamps, held-out roads and all evaluation metrics are recorded in [evaluation.json](../ai-service/reports/evaluation.json). The dependency lock records the complete tested environment. Generated CSV/model binaries are ignored in Git; the evaluation report is committed. No real traffic history exists yet: lagged observations/history features are deliberately absent rather than fabricated as measurements.

The API offers 27 road scenarios and nine region scenarios. A region means a **representative hypothetical arterial**, not aggregation across that region. There is no mapping from these IDs to OSM/OSRM road segments. Arbitrary/unlisted locations are rejected rather than extrapolated.

## Leakage prevention and model selection

Partition by complete chronological days, not random rows. Rotate one held-out road archetype per province so that all road classes occur in training elsewhere. Held-out road identities are absent from training and validation; their earlier rows are deliberately excluded rather than used as history.

| Split | Rows | Colombo-local date range | Roads |
| --- | --- | --- | --- |
| Training | 31,104 | Jan 1–Mar 13, 2025 | 18 known roads |
| Validation | 10,368 | Mar 14–Apr 6, 2025 | Same 18 roads, later dates |
| Chronological test | 10,368 | Apr 7–30, 2025 | Same 18 roads, still later dates |
| Unseen-road stress test | 5,184 | Apr 7–30, 2025 | 9 entirely held-out roads |

One-hot encoding and both classifiers fit on training rows only. Region/time/road/weather are available scenario inputs; no target label, latent score, road ID or future observation is fed to the model. The pipeline compares a majority-class `DummyClassifier` against a Random Forest (120 trees, maximum depth 14, minimum leaf size 5, balanced class weights, seed fixed, two worker threads). Hyperparameters are fixed in code. The winner is chosen **only by validation macro-F1**; neither test metric selects or refits the model. No final refit on validation/test is performed. The unseen-road score tests generalization within the same fictional generator, not unseen real roads.

An independent full rerun reproduced the CSV checksum, selected model version, every evaluation metric and serialized model checksum. Generation/training are explicit offline commands and never run during requests or silently on API startup.

## Reported synthetic-only performance

Model `synthetic-v1-4058148f38bb4d73` selected Random Forest.

| Candidate | Validation macro-F1 | Chronological test macro-F1 | Unseen-road macro-F1 | Chronological test accuracy |
| --- | --- | --- | --- | --- |
| Majority baseline | 0.2227 | 0.2201 | 0.2211 | 0.4928 |
| Random Forest | **0.7254** | **0.7176** | **0.7299** | **0.7253** |

Full confusion matrices, class supports, precision/recall/F1 and accuracy for both candidates and all evaluation splits are in the report. These metrics quantify learning of a noisy hypothetical rule system. **They do not validate actual Sri Lankan traffic, reliable seven-day forecasts or future geographic transfer.** No confidence percentages are displayed because probabilities have not been calibrated against real data.

No speed/travel-time regressor was trained: the dataset has no measured average-speed or duration target, and inventing a regression label from congestion classes would not justify accurate route times. The hypothetical posted speed-limit input is a road characteristic, not an estimated road speed. API outputs set `supportsJourneyDuration=false`, `speedKph=null` and `journeyDurationSeconds=null`.

## Reproduce and start

Prerequisites are unchanged: Python 3.12 and the locked dependencies, Java 17/Maven, Node/npm. From the root:

```sh
python -m venv ai-service/.venv
ai-service/.venv/bin/pip install -r ai-service/requirements.lock.txt
(cd ai-service && .venv/bin/python train.py)
(cd ai-service && .venv/bin/python -m pytest -q)
```

For a standalone dataset, run `python generate_dataset.py --output data/generated/traffic.csv` from `ai-service`. `train.py --output-dir /tmp/model-check --report /tmp/evaluation-check.json` creates an independent training run. Model/data bytes are deterministic in the locked environment; `trainedAt` correctly changes across runs. Use the committed lockfile, not unconstrained package upgrades.

Start three processes in separate terminals:

```sh
(cd ai-service && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000)
(cd backend && mvn spring-boot:run)
npm run dev --prefix frontend
```

Cloud JDK/Maven proxy/cache options remain in [cloud-setup.md](cloud-setup.md). FastAPI loads `ai-service/artifacts` by default; `MODEL_DIR` selects another trusted local artifact directory. Train first, then restart FastAPI to load a changed model. Missing artifacts leave the catalog usable and return model-unavailable for inference. Failed checksums, incompatible Scikit-learn versions or invalid classes likewise disable inference. Only load artifacts produced by trusted local training: joblib/pickle is not a safe upload format, and the checksum detects corruption rather than proving the author is trusted.

Spring Boot uses `AI_SERVICE_URL=http://127.0.0.1:8000` by default, configurable for another internal endpoint. It has connection/read timeouts and does not require external API credentials. Browser calls remain same-origin through Vite's `/api` proxy. Production should keep FastAPI private behind the backend; no deployment, public service authentication or AWS configuration is added here. `.env.example` files are templates; export variables rather than assuming Spring/Uvicorn auto-load them.

## API and time contracts

| Browser/backend endpoint | Internal FastAPI endpoint | Purpose |
| --- | --- | --- |
| `GET /api/forecasts/catalog` | `GET /catalog` | Supported hypothetical targets, model state, server now and seven-day maximum |
| `GET /api/forecasts/model` | `GET /models/current` | Availability plus model provenance/evaluation metadata |
| `POST /api/forecasts` | `POST /predict` | Experimental scenario inference |

Request example:

```json
{"targetId":"region-uva","forecastAt":null,"weather":"HEAVY_RAIN","isHoliday":false}
```

`forecastAt=null` uses authoritative server now. Otherwise use an offset-aware ISO timestamp; the React date/time control always sends `+05:30` and labels Asia/Colombo regardless of laptop timezone. Requests must be between server now and exactly `now + 7 days`, inclusive. Past times, naive timestamps and times beyond the rolling horizon are rejected. The final calendar day is not accepted beyond that exact rolling boundary. Tests inject a fixed clock and cover Colombo midnight, UTC conversion, exact endpoints and one-second violations. Date bounds in the UI are advisory; the server revalidates stale selections.

Weather and holidays are explicitly **user-selected scenarios**, not weather forecasts or observed/official calendar facts. Road characteristics come from the versioned fictional target catalog. Responses include category, target/type, requested/generated timestamps, features, data/model versions, `EXPERIMENTAL_AI`, `SYNTHETIC`, `experimental=true`, scenario provenance and limitations. Future segment-level route integration can use these structured fields, but accurate route durations would require real segment mapping, representative observations, a separately evaluated duration model and provider-compatible contracts.

Errors distinguish unsupported target (422 `UNSUPPORTED_LOCATION`), outside horizon, timezone required, invalid inputs, missing/corrupt model (503 `MODEL_UNAVAILABLE`), unavailable FastAPI (503 `AI_UNAVAILABLE`) and invalid upstream provenance (502). No prediction is generated as an error fallback. UI includes catalog loading, running inference, error/unsupported state, model-unavailable state, availability refresh and stale-request cancellation. Editing any scenario clears the prior result. No new request is sent to OSRM by this page, and no existing route duration is overridden.

## Verification

- **15 Python tests passed**: deterministic generation, disjoint date/road partitions, model comparison/provenance, current-time and seven-day boundaries, naive timestamps, Colombo midnight/UTC conversion, unsupported targets/weather/extra fields, region scope, missing/corrupt artifacts. One upstream Starlette/AnyIO deprecation warning remains.
- **34 Java 17 tests passed**, including the existing routing suite and six forecasting adapter tests. Compiler target remains 17. Provenance validation and model-unavailable/unsupported states are covered.
- **14 browser tests passed**: eight existing routing regressions and six forecast tests, including explicit Colombo datetime serialization, loading/error/model states, stale-response cancellation and responsive widths 320–1440. Browser regression fixtures are not evidence of actual inference.
- Production frontend build passed.
- Actual three-service smoke passed: React AI Predictions page → Java 17 → running FastAPI → trained Random Forest. A hypothetical Uva region/heavy-rain/holiday scenario produced an experimental category; a future Northern-region request also returned a valid labeled result. No AI endpoint was mocked in that smoke.
- Desktop/mobile screenshots: [m3-desktop.png](m3-desktop.png), [m3-mobile.png](m3-mobile.png). Data/model binaries and virtual environments are excluded from Git.

## Limits and next steps

The seven-day limit is a request contract, not evidence of seven-day real forecasting skill. This system has no observed traffic history, weather forecasts, incident reports, actual holiday feed or real-world calibration. Synthetic road classes, region effects and target thresholds cannot establish actual congestion or speeds. Real readiness requires licensed representative Sri Lankan observations, quality checks, leakage-aware real temporal/geographic holdouts, drift monitoring and validation by region before any route-time integration. MySQL persistence/model-serving authentication, production scaling, live traffic, AR and AWS are not implemented in this task.
