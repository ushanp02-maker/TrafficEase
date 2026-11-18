# Consumer redesign validation

Changes remain on `vidura`. No AWS deployment/resources, paid APIs, default passwords or main-branch changes were made.

## Checks and results

| Check | Result |
|---|---|
| Java 17 Maven verify | **81 passed, zero skipped**, including actual disposable MySQL 8.4 integration, security/CSRF, existing routing/forecast tests and new recorded-simulation tests. |
| Python regression | **31 passed**; one upstream Starlette/AnyIO deprecation warning. Existing and mapped-route models/inference remain separate. |
| Frontend unit tests | **24 passed**. |
| Browser tests | **46 passed**, including all existing scenario/history, AR permission/uncertainty/cleanup, routing and government publish/edit/withdraw flows adapted to the new navigation, plus consumer failure/retry, Home simulation and all-30 mapped journeys. |
| Production Vite build | Passed. |
| Portable deployment integrity tests | Passed for both existing deployment platforms, including legacy rollback compatibility. |
| PowerShell parser | No syntax errors in the available PowerShell 7 runtime. |
| Launcher lifecycle | Actual preparation, startup, model readiness, all-30 inference check, frontend proxy, persistent background services, stop and restart passed. Both normal dependency preparation and SkipInstall were exercised. |
| Launcher safety | Occupied port refused before preparation; unrelated/reused process record refused; running app unaffected. Shell argument/environment construction checked with isolated helper execution. |
| Missing model recovery | A fresh empty temporary model directory generated and loaded **both** models through prepare_models.py. Models are not merely assumed ready from existing files. |
| Live baseline flow | Actual browser search/selection for Colombo Fort railway station → Piliyandala clock tower returned one genuine OSRM route, **19.42 km**, with endpoint snapping about **8.6 m / 6.7 m**. No unreturned alternative was invented. |

The 30-journey browser integration blocks all external HTTPS requests and verifies that every journey produces actual trained-model inference using recorded genuine geometry. It checks `dataMode=SIMULATION`, `RECORDED_OSRM_DEMONSTRATION`, synthetic provenance, supported categories, unchanged/null adjusted-duration fields and candidate count. It also verifies route geometry stays within the map after desktop/mobile resize. These are not real-traffic accuracy or live-weather coverage tests.

Model versions remain `synthetic-v1-4058148f38bb4d73` and `route-shape-synthetic-v1-79238a397010`. Training algorithms, seeds, comparison rules and checked-in evaluation metrics were not changed. Training code changes are explicit text encoding and startup orchestration. Both internal AI clients use HTTP/1.1, avoiding inappropriate upgrade warnings.

The launcher was tested **independently** of Playwright’s optional development server: after the startup command exited, all three recorded processes stayed running, a fresh browser opened Home, selected a journey and rendered real model inference. Earlier checks caught and fixed a background Vite lifetime problem; the final launcher uses Node directly rather than a long-running npm wrapper and runs it non-interactively. The verified state is not a test runner silently replacing the launcher’s server.

## Platform and provider limitations

- Native Windows/Windows PowerShell 5.1/default-browser launching was **not available** on this Linux machine. Actual PowerShell 7 orchestration and core process/quoting behavior were exercised; native Windows validation remains manual. See the exact command and prerequisites in [Windows startup](windows-startup.md). No claim of a physical Windows run is made.
- Open-Meteo is still outside the enforced cloud allowlist. The actual client received a proxy CONNECT **403**. Add `api.open-meteo.com` and `open-meteo.com` to the environment before claiming live automatic-weather verification. Online weather success/error/timezone handling remains fixture-tested; the working simulation does not claim to supply provider weather.
- Camera/GPS/compass permissions and cleanup are browser-simulated. A physical smartphone, trusted HTTPS when connecting over LAN, and field alignment validation remain necessary.
- Public Nominatim, OSRM and OSM tiles remain suitable only for this low-volume noncommercial demonstration, subject to their policies/attribution. This change does not establish nationwide traffic coverage, a true shortest-distance routing objective, observed congestion accuracy or future traffic-aware ETA.

## Reproduce

Use the startup script first (Simulation mode). In a development environment with test dependencies installed:

```sh
mvn -f backend/pom.xml verify
(cd ai-service && .venv/bin/python -m pytest -q)
npm run test:unit --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
python3 -m unittest discover -s scripts/tests -v
ai-service/.venv/bin/python scripts/check_app.py
```

Cloud Maven requires the documented JDK 17/proxy/truststore/cache settings in `cloud-setup.md`; npm/pip use writable workspace caches. The gated actual-service browser tests require `CONSUMER_INTEGRATION=1` and a running Simulation launch. Government end-to-end tests additionally use a private temporary GOV_E2E_CREDENTIAL_FILE for an explicitly configured ephemeral local test account. No credentials are committed. MYSQL_TEST_PASSWORD_FILE enables the real database tests against an isolated local MySQL instance. Without those opt-ins, provider-independent browser fixtures still exercise the corresponding UI states.

## Desktop and mobile captures

All captures come from the running application. Home/Traffic Predictions use **explicit Simulation mode**, actual archived OSRM geometry and real trained-model inference. The alerts capture uses a deliberately published DEMONSTRATION notice, which was withdrawn after capture. Admin charts remain marked as example/synthetic data. No fake successful API response or disguised weather fixture was inserted for these screenshots.

| Page | Desktop | Mobile (390 px) |
|---|---|---|
| Home | [View](screenshots/consumer/home-desktop.png) | [View](screenshots/consumer/home-mobile.png) |
| Plan Journey | [View](screenshots/consumer/plan-journey-desktop.png) | [View](screenshots/consumer/plan-journey-mobile.png) |
| Traffic Predictions | [View](screenshots/consumer/traffic-predictions-desktop.png) | [View](screenshots/consumer/traffic-predictions-mobile.png) |
| AR Navigation | [View](screenshots/consumer/ar-navigation-desktop.png) | [View](screenshots/consumer/ar-navigation-mobile.png) |
| Traffic Alerts | [View](screenshots/consumer/traffic-alerts-desktop.png) | [View](screenshots/consumer/traffic-alerts-mobile.png) |
| About | [View](screenshots/consumer/about-desktop.png) | [View](screenshots/consumer/about-mobile.png) |
| Administration sign-in | [View](screenshots/consumer/sign-in-desktop.png) | [View](screenshots/consumer/sign-in-mobile.png) |
| Administration dashboard | [View](screenshots/consumer/administration-dashboard-desktop.png) | [View](screenshots/consumer/administration-dashboard-mobile.png) |
| Administration analytics | [View](screenshots/consumer/administration-analytics-desktop.png) | [View](screenshots/consumer/administration-analytics-mobile.png) |
| Administration alerts | [View](screenshots/consumer/administration-alerts-desktop.png) | [View](screenshots/consumer/administration-alerts-mobile.png) |

Screenshots reported no browser page exceptions or horizontal overflow. Viewport tests cover 320, 390, 768 and 1440 px. Live HTTPS OSM basemaps rendered through Chromium’s normal trusted certificate store; no TLS validation was disabled. Simulation uses a local geographic grid and does not require tiles. The skip link remains keyboard-accessible without leaking into offscreen captures.
