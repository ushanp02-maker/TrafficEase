# TrafficEase

HNDSE Emerging Technologies coursework: a Sri Lanka-focused smart routing, experimental AI congestion prediction and AR navigation project. The target application supports Sri Lanka nationwide wherever usable data is available. M1 now implements nationwide geographic search and genuine baseline road routing; provider coverage and network availability remain limited.

## What exists

- `frontend/`: React 19, Vite 7 and Tailwind 4 responsive dashboard, route planner, AI and AR navigation views. Explicit Nominatim place selection, Leaflet/OpenStreetMap map and genuine OSRM route geometry, durations/distances and scoped comparisons. No live traffic or future estimates.
- `backend/`: Java 17 / Spring Boot REST service; `GET /api/health` reports process health only; `/api/locations` and `/api/routes` provide validated search and road routing.
- `ai-service/`: Python / FastAPI service; `GET /health` explicitly reports an untrained model. Scikit-learn and Pandas dependencies are installed for future work.
- `database/schema.sql`: MySQL 8 roads, observations and predictions schema with provenance labels, foreign keys and synthetic-data flags.
- `docs/requirements.md`: authoritative nationwide specification; `docs/architecture.md`: target system design; `docs/milestones.md`: staged delivery and acceptance checks; `infra/`: deployment notes.

The original repository contained only this README and a Java-oriented `.gitignore`. Development now uses `vidura`; the completed foundation is on GitHub. No AWS deployment has been performed.

## Prerequisites

Node.js 22.12+ (tested on 24), npm, JDK 17, Maven 3.9+, Python 3.12 and optionally MySQL 8. No API keys or paid integrations are required. Use this existing checkout in isolated cloud tasks; no additional Git worktree is needed.

## Install and validate

Run from the repository root:

```sh
npm ci --prefix frontend
npm run build --prefix frontend
python -m venv ai-service/.venv
ai-service/.venv/bin/pip install -r ai-service/requirements.lock.txt
(cd ai-service && .venv/bin/python -m pytest -q)
(cd backend && mvn verify)
```

Python direct dependencies are declared in `requirements.txt`; `requirements.lock.txt` freezes the validated full dependency set.

In this cloud machine, export `JAVA_HOME=/workspace/tools/jdk-17.0.17+10` (the base image has only a JRE). Maven is at `/workspace/tools/apache-maven-3.9.11/bin/mvn`. If home caches are unwritable, pass `--cache /workspace/.cache/npm` to npm and `-Dmaven.repo.local=/workspace/.cache/m2` to Maven, together with `-s /workspace/tools/maven-settings.xml` for the cloud proxy and `-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts` for CA trust. See `docs/cloud-setup.md`. Pip can use `--cache-dir /workspace/.cache/pip`.

For IntelliJ IDEA, select JDK 17 as the Project SDK, the backend module SDK and Maven Runner JRE, then reload Maven. Confirm `java -version`, `javac -version` and `mvn -version` use Java 17. Spring Boot 3.5.7 supports Java 17; no backend dependency downgrade is needed.

## Run locally

Use separate terminals from the repository root:

```sh
npm run dev --prefix frontend
(cd backend && mvn spring-boot:run)
(cd ai-service && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000)
```

Frontend uses port 5173, backend 8080 and AI service 8000. Check services with `curl -f http://localhost:8080/api/health` and `curl -f http://localhost:8000/health`. FastAPI exposes interactive API documentation at `/docs`. Frontend calls Spring Boot through Vite’s same-origin `/api` proxy. Production needs an equivalent reverse proxy. The AI service remains independent.

Each component has an `.env.example`. Vite loads `.env.local` when needed; Spring and Uvicorn require exported shell variables (they do not automatically load these templates). Prototype defaults require no credentials. Provider endpoints/limits and public geocoder opt-out are configurable; see `docs/m1-routing.md`. Never commit credentials.

## Optional database setup

With a local MySQL 8 server and an authorized account:

```sh
mysql -u YOUR_USER -p < database/schema.sql
```

The schema creates and selects `trafficease`; the account must have database/table creation privileges. Password is requested interactively. The script creates missing tables without dropping data; it is a bootstrap schema, not a migration system. Services do not yet connect to MySQL. Datetimes are UTC by convention; future UI presentation should use Asia/Colombo.

## Scope and limitations

Baseline provider routing is implemented. Live geocoding and tiles are currently blocked in the cloud pending Internet allowlist changes. No real traffic, trained model, camera/compass/GPS integration, AR.js/A-Frame runtime, administrator dashboard or authentication yet. Those belong to subsequent milestones. Synthetic training and predictions must be clearly experimental and separate from any future live traffic results. AR must provide reliability fallbacks and be designed for stationary users or passengers. GPS alone cannot visually recognize roads. Do not retain provider-restricted data without permission. AWS deployment is deferred.

See `docs/validation.md` for checks and their outcomes.

## Nationwide development roadmap

The updated specification replaces the earlier Colombo-first product scope. See [requirements](docs/requirements.md), [architecture](docs/architecture.md) and [milestones](docs/milestones.md). The first functional milestone is nationwide geographic search and genuine route calculations; provider access, coverage, licensing and traffic/future capabilities must be verified before integration. Architecture documents describe planned behavior, not completed functionality. The UI now requests genuine road routes; it does not calculate traffic forecasts. See [M1 setup and test results](docs/m1-routing.md) and [sampled coverage](docs/m1-coverage.md).
