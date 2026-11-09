# Foundation validation

Validated in the current Linux cloud machine on 2026-11-09. Branch: `development/foundation`.

| Check | Command / method | Outcome |
| --- | --- | --- |
| Frontend clean dependency installation | `npm ci --prefix frontend --cache /workspace/.cache/npm --no-audit --no-fund` | Passed; npm lockfile retained |
| Frontend production build | `npm run build --prefix frontend` | Passed, Vite 7.2.2 |
| Browser interaction | Playwright with system Chromium at desktop 1440×1100 and mobile 390×844 | Passed: initial render, route selection, custom journey warning, all four navigation views, no mobile horizontal overflow or JavaScript runtime errors |
| Java tests and executable JAR | `mvn verify` with cloud settings from `cloud-setup.md` | Passed: 1 test, 0 failures/errors/skips; executable Spring Boot JAR packaged |
| Backend process smoke | Start packaged JAR; `curl -f http://127.0.0.1:8080/api/health` | Passed: status `ok`, service `trafficease-backend`, scope `process-only` |
| Python tests | `cd ai-service && .venv/bin/python -m pytest -q` | Passed: 1 test; one upstream Starlette/AnyIO deprecation warning |
| Python dependency integrity | `.venv/bin/pip check` | Passed, no broken requirements |
| Python repeat installation | `.venv/bin/pip install -r requirements.lock.txt` | Passed |
| AI process smoke | Start Uvicorn; `curl -f http://127.0.0.1:8000/health` | Passed: status `ok`, model status `not_trained` |
| MySQL schema | MySQL 8.0.46 in a temporary container with no network and no published ports | Passed: schema applied twice, all three tables present, valid linked fixtures inserted, synthetic predictions default experimental |
| MySQL constraints | Negative insert checks | Passed: synthetic/non-experimental prediction rejected (3819); invalid road reference rejected (1452) |
| Patch whitespace | `git diff --check` | Passed |

Screenshots: `dashboard-desktop.png` and `dashboard-mobile.png`. They intentionally show a custom journey warning and a selected alternate demo route. Browser tooling was installed outside the repository at `/workspace/.cache/trafficease-browser`; it is not an application runtime dependency. The temporary MySQL container and its fixtures were removed after validation.

Initial setup failures were resolved: unwritable home caches (workspace caches), missing Maven (checksum-verified local install), missing JDK compiler (checksum-verified Temurin install), Maven proxy and CA trust (explicit proxy settings and system truststore). No signature, checksum or TLS verification was disabled.

Not exercised or implemented: live traffic, geographic map tiles, geocoding, GPS, AR hardware, trained AI, database-backed REST endpoints, administrator dashboard/authentication and AWS. The health endpoints demonstrate process operation, not database/provider/model readiness. This milestone does not validate real Sri Lankan traffic conditions.

## Changed files

- `.gitignore`
- `README.md`
- `ai-service/.env.example`
- `ai-service/main.py`
- `ai-service/requirements.lock.txt`
- `ai-service/requirements.txt`
- `ai-service/tests/test_health.py`
- `backend/.env.example`
- `backend/pom.xml`
- `backend/src/main/java/lk/trafficease/HealthController.java`
- `backend/src/main/java/lk/trafficease/TrafficEaseApplication.java`
- `backend/src/main/resources/application.properties`
- `backend/src/test/java/lk/trafficease/HealthControllerTest.java`
- `database/schema.sql`
- `docs/architecture.md`
- `docs/cloud-install.sh`
- `docs/cloud-setup.md`
- `docs/dashboard-desktop.png`
- `docs/dashboard-mobile.png`
- `docs/validation.md`
- `frontend/.env.example`
- `frontend/index.html`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/src/main.jsx`
- `frontend/src/style.css`
- `frontend/vite.config.js`
- `infra/README.md`

## Reusable cloud configuration

The draft service could not verify the current draft, and the attempted install/start configuration save returned `INVALID_ARGUMENT`; persistence is unconfirmed. No publication was performed. Tested installation steps are retained in `docs/cloud-install.sh`, with startup and proxy/trust instructions in `README.md` and `docs/cloud-setup.md`. The helper assumes the verified tools retained in this cloud filesystem.
