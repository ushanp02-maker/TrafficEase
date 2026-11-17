# Mapped-route forecasting validation

18 November 2026, Asia/Colombo. Branch `vidura`; no main changes, AWS deployment, paid APIs or credentials. Public provider verification and offline/simulated evidence are separated below.

## Live mapping evidence

35 named-place/landmark endpoints were reviewed from actual Nominatim results. All 30 specified journeys returned genuine OSRM geometry with acceptable independently checked snapping. 12 journeys returned two candidates and 18 one, totaling 42. See [all journeys, endpoint review and exact source records](mapped-journey-coverage.md). The earlier ~2.8 km snapping problem was not silently accepted; runtime uses the original dual 300 m check. Public OSRM results are baseline profile times, not traffic or future estimates, and returned alternatives do not establish true shortest-distance routing.

A deliberate low-volume browser integration used the real Spring Boot service, live OSRM, real mapped geometry and the separately trained FastAPI model with **explicit manual weather simulation**. Classification/provenance and geometry rendering passed; this does not validate actual congestion. Cached verification snapshots were not used as a runtime fallback.

## Automatic weather: fixture-tested, live blocked

The environment proxy returned HTTP 403 for both `api.open-meteo.com` and `open-meteo.com`. No bypass, billable API or invented live forecast was used. The operator must allow these domains and confirm a genuine AUTO request before presenting automatic weather as live-verified.

A local HTTP fixture reproducing the documented multi-coordinate hourly response format was connected to the actual Java weather client via a temporary test-only WEATHER_URL. A real browser request traversed Spring → real OSRM → fixture weather → trained FastAPI → comparison cards/geometry. It passed with automatic-mode request serialization, selected Colombo hour, supported category inference, unchanged baseline durations and null adjusted duration. The fixture is not Open-Meteo availability/coverage evidence, observed weather or real traffic. Production default remains the official public HTTPS endpoint; test URL/credentials are not committed.

Unit tests cover missing precipitation, missing hour, invalid units, fog/unknown codes, distant grids, insufficient samples, timezone mismatch, cached requests and provider failure. No missing data becomes a synthetic CLEAR forecast. Model unavailable states preserve valid baseline routes and do not invent classifications.

## Automated checks

Commands and results from this change:

- JDK 17 Maven `verify`: **79 passed, zero skipped**, with disposable local MySQL 8.4 enabled through MYSQL_TEST_PASSWORD_FILE. Includes legacy routing/snap/time/security/history tests, government persistence and new weather/catalog/orchestration/AI contract tests. New mapped POST is public; government authorization/CSRF still enforced.
- Python `pytest -q` from ai-service: **26 passed**. Separate model trained into a temporary directory in tests; all 30 actual captured geometries/candidates infer within the supported envelope. Chronological/held-out journey split assertions, future horizon, model integrity/unavailable state, unsupported geometry, identical-route invariance, burden tie/preference and HTTP contract tests pass. Existing scenario suite remains intact. One upstream Starlette/AnyIO deprecation warning remains.
- Frontend `npm run test:unit`: **24 passed**, including existing geometry/orientation/time logic.
- Vite production build: passed.
- Browser regression suite: **43 tests**, including existing routing, scenario forecasting, government login/publish/edit/withdraw, mobile layouts, AR permission/uncertainty/cleanup simulations, and seven new mapped-forecast tests. The full final run explicitly enables local service credentials, one live OSRM journey and the local weather fixture. No desktop simulation proves real smartphone alignment.
- `python3 -m unittest discover -s scripts/tests -v`: portable release check passes for both deployment platforms, covering required new artifacts, tampering rejection, complete legacy-manifest rollback support and rejection of partial model manifests.
- Both EC2 health helpers pass against actual loopback Java/FastAPI services; no external-provider call is made by health checks.
- Updated deployment scripts pass shell/Python syntax checks and `git diff --check`. No EC2/systemd boot/public DNS/certificate renewal deployment was run in this task.

See [implementation/model guide](mapped-route-forecasting.md) for the synthetic evaluation metrics and precise abstention rules. They measure a reproducible toy label generator, not observed Sri Lankan traffic.

## UI evidence

[Desktop capture](screenshots/mapped-journey-desktop.png) · [390 px mobile capture](screenshots/mapped-journey-mobile.png). Both are stamped as local weather-fixture validation, using genuine OSRM route geometry and synthetic congestion. Navy/yellow styling and existing pages are preserved. The shared map now refits returned geometry on viewport rotation/resize. Chromium rendered live HTTPS OpenStreetMap tiles alongside genuine route paths and endpoint markers when it had access to its normal trusted certificate store; restricted sandbox runs correctly showed the tile-unavailable fallback. Mobile width 390 px had no horizontal overflow. Screenshots are evidence of this UI session, not live weather or traffic.

## Files and operating boundaries

New implementation groups:

- `scripts/journeys/`, `data/journeys/`, `backend/src/main/resources/experimental/journeys.json`: reviewed endpoint catalog and genuine mapping evidence.
- `ai-service/{route_features,train_routes,route_api,test_route_api}.py`, `reports/route-evaluation.json`: separate feature extraction, training, inference and evaluation. `main.py` registers new endpoints without replacing old ones.
- Java `ForecastJourneyCatalog`, `RouteWeatherService`, `RouteAiClient`, `RouteForecastController` and corresponding tests: orchestration, rate-limited weather, model contracts and fallbacks. Existing RouteService exposes the same verified routing implementation; security exempts only the new public endpoint; configuration adds WEATHER_URL.
- React `pages/RouteForecasts.jsx`, routing/links/scoped page styles and browser tests: mapped workflow; existing RoutePlanner map resize behavior improved.
- Both `infra/ec2` and `infra/ec2-ubuntu` build, environment-template, readiness and manifest scripts plus portable tests: both models are generated and checked in clean releases. Deployment guides/README/architecture/status and new coverage/model/validation documents updated.

No generated model binaries, venv, Maven outputs, frontend builds, test passwords, `.env` secrets or private keys belong in Git. No adjusted travel time, observed congestion, guaranteed traffic avoidance or real traffic accuracy is supported. Real Open-Meteo connectivity, commercial traffic-provider eligibility and real-world validation remain operator/data prerequisites, not completed claims.
