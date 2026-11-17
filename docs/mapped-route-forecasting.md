# Experimental forecasting on genuine mapped journeys

The previous scenario model describes fictional regions/roads, so it cannot justify route-specific congestion differences. This extension retains it unchanged at `/ai-predictions` and adds `/route-forecasts`, linked from Route Planner and AI Predictions. The unrestricted nationwide baseline planner, AR prototype, government demonstration and optional database remain independent.

## Request flow and API

1. `GET /api/route-forecasts/catalog`: 30 reviewed journeys, 35 geocoded endpoint landmarks, source metadata, verification evidence, departure capabilities and separate model availability.
2. `POST /api/route-forecasts`: `{ "journeyId":"pettah--piliyandala", "mode":"LEAVE_NOW", "weatherMode":"AUTO" }`. Scheduled departures use existing `LATER_TODAY` / `FUTURE_DATE` and ISO `departureAt` including offset. Asia/Colombo and the strict now–seven-days boundary are shared with the baseline planner. Leave Now resolves inference time after provider latency.
3. Spring Boot validates the journey/time/weather mode before calling providers. It obtains genuine OSRM full GeoJSON alternatives with the existing dual 300 m road-snapping check, caches successful routes for at most five minutes (30 entries, one process), then retrieves weather. Historic verification geometries never substitute for failed runtime routing.
4. It calls private FastAPI `POST /route-predict` with journeyId, forecastAt, and each actual candidate's id, geometry, distanceMeters, durationSeconds and weather category. `GET /route-model` reports separate artifact readiness. FastAPI confirms catalog endpoints within 305 m, finite Sri Lankan geometry, distance/shape consistency and time horizon. Unsupported candidates carry reasons and no invented congestion label.
5. The frontend shows mapped genuine alternatives, baseline minutes/km, weather provenance, per-route synthetic classification, measured/unknown features and an abstaining or experimental recommendation. Changing inputs aborts requests and clears stale results. Weather/model outages preserve valid baseline geometry. Routing errors do not produce fabricated routes.

`MANUAL_SIMULATION` additionally requires manualWeather `CLEAR`, `RAIN` or `HEAVY_RAIN`. It is an explicitly selected fallback, never a silent substitute for automatic weather. AUTO rejects manualWeather. No route forecasts or coordinates are persisted into the old scenario-history schema.

## Automatic Open-Meteo weather

Spring Boot uses `https://api.open-meteo.com/v1/forecast` with hourly precipitation (mm), precipitation probability (%) and weather_code, eight forecast days, timezone Asia/Colombo. Samples lie at 10%, 50%, 90% of each route's cumulative mapped distance, rounded to four decimals. A multi-coordinate request fetches all candidate samples. The departure's local hourly interval is selected, never an unrelated current-weather value. Each sample records requested point, actual model-grid point, validFor and retrievedAt. Open-Meteo does not supply the model issue timestamp here, so forecastIssueTime is null; retrieval time is not relabeled as issue time.

Mapping (a documented demonstration choice, not a validated traffic relationship):

| Conditions | Model category |
|---|---|
| WMO 0–3 and precipitation <0.1 mm/hour | CLEAR (dry category, not guaranteed visibility) |
| WMO 51/53/55/61/63/80/81 or precipitation ≥0.1 | RAIN |
| WMO 65/82/95/96/99 or precipitation ≥7.5 | HEAVY_RAIN |
| Fog, freezing precipitation, snow, unknown code, missing rain/code/hour/timezone/units or grid >0.25° away | Unavailable/unsupported, never assumed CLEAR |

Worst supported category across the three samples supplies each route's classifier input. This is conservative route-level aggregation, not segment-specific weather/traffic simulation. Probability is displayed but does not invent rain amounts. The three samples cannot capture all local conditions, and using departure-hour weather across a long journey does not model passage times.

Successful multi-point responses cache 30 minutes (128 entries); requests for an absent hour refresh. Shared provider throttling is ≥1.1 s per request. Additional conservative budgets count requested sample locations: 60 per rolling minute window and 1,000 per 24-hour window per process, including failed attempts. A restart resets in-memory budgets/cache; run one demonstration instance, not a multi-node public service. No retry loop or automatic background collection. Open-Meteo free service is intended for noncommercial use; its current terms, volume accounting, forecast model coverage and attribution obligations must be reviewed before public/commercial operation. Source/attribution: https://open-meteo.com/ and https://open-meteo.com/en/terms , weather data CC BY 4.0. No credentials required for this intended free endpoint.

**Environment limitation during this implementation:** both api.open-meteo.com and open-meteo.com returned proxy HTTP 403. Automatic weather integration is tested using explicit fixtures, including absent data and failure. Live automatic-weather success is not claimed. Allow those domains through the managed environment, restart if necessary, and perform a deliberate AUTO request before presenting live weather. A user-visible UNAVAILABLE state and opt-in manual simulation work without weather access.

## Separate reproducible model

`route_features.py` schema `mapped-route-shape-v1` measures whole-route directness (provider length / endpoint geodesic distance) and ≥30° direction changes per km after distance-based 250 m resampling. Raw vertex density is not a road classification. Geometry bounds, finite values, LineString cardinality, 0.1–600 km distance, ≤8%/100 m geometry-length disagreement and directness 0.95–6 are checked. This envelope is a study guard, not evidence of real-traffic validity. Road class, lanes and speed limits remain null/unknown: OSRM does not supply these tags. No OSM enrichment is fabricated.

Inputs: directness, turns_per_km, hour, weekday, weather. Distance is displayed context; route IDs, candidate index, baseline duration and journey name are excluded from model features. Holidays, actual demand, incidents and school calendars are unavailable in this new model (the independent scenario model retains its holiday demonstration). No baseline-to-delay multiplier exists.

`train_routes.py` generates 272,160 synthetic scenarios from all 42 captured real shapes × 90 days × 24 hours × three weather categories, seed 20261118. The target simulator adds Gaussian weekday rush peaks (08:00 and 17:30), reduced weekend peaks, rain weights (0/.38/.75), small clipped directness/turn weights and normal noise SD .13. Thresholds <.6, <1.3, otherwise define LOW/MODERATE/HIGH. The exact reproducible formula is code, not a claim about Sri Lankan drivers.

Chronological splits: training Jan–Feb 2025, validation March 1–15, test March 16–31. Six deterministic held-out journey IDs are absent from training/validation; evaluated separately on future March dates. Different journeys share physical roads, so held-out IDs do not imply independent physical-road or spatial traffic validation. Candidate/route/date rows never leak target labels into features. Selection uses validation macro-F1 only, no test refit. Majority baseline compared against Random Forest (100 trees, max depth 12, min leaf 8, balanced classes).

| Synthetic evaluation | Majority macro-F1 | Random Forest macro-F1 |
|---|---:|---:|
| Validation | 0.2153 | 0.8702 |
| Known journeys, future test dates | 0.2142 | 0.8703 |
| Held-out journeys, future test dates | 0.2155 | 0.8650 |

Selected version `route-shape-synthetic-v1-79238a397010`. Full accuracy, confusion matrices, row counts, dataset/snapshot/artifact checksums, parameters, split dates, versions and limitations: `ai-service/reports/route-evaluation.json`. Artifacts are generated locally under ignored `ai-service/artifacts/routes/`; existing scenario artifacts/report remain intact. Training is explicit, never an HTTP side effect. Load only trusted locally generated joblib; checksum is integrity checking, not a sandbox. Model retraining is required after schema changes.

**These metrics measure recovery of a toy label generator. They do not establish accuracy, calibration, safety or traffic coverage for any real Sri Lankan road.** Real shape + real forecast weather + synthetic targets still gives synthetic, experimental traffic results. Independent observed travel times/traffic labels and spatial-temporal validation are required before operational use.

## Recommendation and duration provenance

Every supported returned route receives probabilities over synthetic classes. Burden = `0×P(LOW)+1×P(MODERATE)+2×P(HIGH)`, bounded 0–2, not minutes or calibrated real-world probability. A preference requires all candidates supported, different top predicted categories, burden margin ≥0.25 between the best and next-best candidate, and either directness difference ≥0.05, turn-density difference ≥0.1/km or different sampled-weather categories. Otherwise abstain with tie/insufficient differentiation. One route means no verified alternative. Identical shapes/weather receive identical predictions regardless of IDs/baseline times. Preference is over returned candidates only; not guaranteed traffic avoidance or a fastest real trip.

OSRM baseline duration is retained exactly. No traffic-aware or simulated ETA is produced; `supportsJourneyDuration=false`, adjustedDurationSeconds=null. Spring rejects model responses that change baseline duration or claim live data/adjusted duration. Cards clearly explain the unavailable adjusted estimate. OSRM does not offer true shortest-distance routing; shortest available is scoped to returned candidates.

Provider investigation: Google Routes, HERE and TomTom require current Sri Lankan traffic-product coverage, account/billing, price and map/display/licensing review before integration. The current environment could not verify those documentation/coverage conditions, and no provider account is configured. Generic country-map availability does not prove traffic prediction coverage or permission to overlay results on Leaflet/OSM. No billable API was enabled. See existing `m2-provider-review.md`; no live or future traffic-aware ETA is implied.

## Local commands and AWS update

From the repository root, use JDK 17, Python 3.12 and supported Node:

```sh
python3.12 -m venv ai-service/.venv
ai-service/.venv/bin/python -m pip install -r ai-service/requirements.lock.txt
(cd ai-service && .venv/bin/python train.py && .venv/bin/python train_routes.py && .venv/bin/python -m pytest -q)
mvn -f backend/pom.xml verify
npm ci --prefix frontend
npm run test:unit --prefix frontend
npm run build --prefix frontend
```

Run FastAPI on 127.0.0.1:8000 (`cd ai-service; .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000`), backend jar on 127.0.0.1:8080 (`SERVER_ADDRESS=127.0.0.1 java -jar backend/target/trafficease-backend-0.1.0-SNAPSHOT.jar`), then `npm run dev --prefix frontend`. Visit `/route-forecasts`. Existing README explains optional MySQL/demo accounts; neither is needed for mapped forecasts. Cloud-specific Maven trust/proxy settings remain in `cloud-setup.md`. Tests are offline unless deliberately enabling documented live/DB checks.

Both Amazon Linux and Ubuntu EC2 build scripts now train/load-check both models, include route files/artifacts in release integrity manifests and check the internal route catalog/model without calling public providers. Redeploy only using the existing reviewed `docs/ec2-ubuntu-deployment.md` or `docs/ec2-deployment.md` reserve/build/activate/update sequence on vidura; retain the previous release for rollback. A clean committed checkout is required. Build is heavier (~272k training rows plus tests); use existing swap/memory guidance and build sequentially. Public Nominatim, OSRM and OSM tiles remain low-volume coursework-only services; do not scale them to public production or cache tiles offline. Enable outbound HTTPS to Open-Meteo plus existing map/routing domains. Same-origin `/api` proxy already covers the new endpoints; internal ports stay private. No new AWS resources, credentials, services or purchases are needed or created by this change. HTTPS/smartphone AR requirements remain unchanged.
