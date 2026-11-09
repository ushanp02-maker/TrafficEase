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

Screenshots: `dashboard-desktop.png` and `dashboard-mobile.png`. They show the updated navy-and-yellow interface and the illustrative Colombo journey. Browser tooling was installed outside the repository at `/workspace/.cache/trafficease-browser`; it is not an application runtime dependency. The temporary MySQL container and its fixtures were removed after validation.

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

## Java 17 compatibility update

The backend now targets Java 17 via `java.version`; Spring Boot 3.5.7's parent also defaults to Java 17 and derives `maven.compiler.release` from that property. No other backend compiler overrides or Java 21-specific source features/APIs were found. Dependencies remain unchanged.

Verified with Temurin JDK **17.0.17+10**, including `java`, `javac` and Maven reporting Java 17:

```sh
cd /workspace/TrafficEase/backend
export JAVA_HOME=/workspace/tools/jdk-17.0.17+10
export PATH="$JAVA_HOME/bin:/workspace/tools/apache-maven-3.9.11/bin:$PATH"
mvn -B -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts \
  -s /workspace/tools/maven-settings.xml \
  -Dmaven.repo.local=/workspace/.cache/m2 clean verify
```

Result: **BUILD SUCCESS**, 1 test passed, 0 failures/errors/skips. Compiled application bytecode is class-file major version 61 (Java 17). The packaged JAR was started on Java 17 using port 8081 to avoid the existing development server, and `/api/health` returned status `ok` and service `trafficease-backend`. The temporary validation server was stopped afterward. Frontend and Python service files were unchanged.

## Navy and yellow visual update

Restyled the frontend using the supplied reference: navy gradients, golden yellow accents, top navigation, a curved coastal road illustration and raised feature cards. Existing demo warnings, route selection and planned-feature boundaries remain.

Validation: Vite production build passed. Chromium/Playwright checks passed for navigation, hero journey button, route selection and custom journey warning, with no JavaScript runtime errors. Checked widths of 320, 390, 768, 1024 and 1440 pixels with no horizontal overflow. Desktop and mobile screenshots were refreshed. Backend and AI service files were unchanged.

## M1 nationwide routing

See [M1 verification](m1-routing.md) for the current checks: 28 Java tests, 8 browser tests, frontend build, real OSRM coverage samples and packaged-backend smoke checks. Live geocoding/tiles validation remains blocked by network access; fixture-based tests do not establish live provider availability. Original foundation screenshots and test reports above are historical.

## Live M1 acceptance follow-up

With the published three-domain network policy, real provider browser flows were tested without mocked search/routing responses or map tiles. See [live verification](m1-live-verification.md) for the exact samples, screenshots and browser certificate setup. Java 17 clean build: 28 tests passed. Browser regression suite: 8 passed. Frontend production build passed. Historical network-denial notes above are superseded by the new live results.
