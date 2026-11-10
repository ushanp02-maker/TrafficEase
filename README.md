# TrafficEase

HNDSE Emerging Technologies coursework: a Sri Lanka-focused smart routing, experimental AI congestion prediction and AR navigation project. The target application supports Sri Lanka nationwide wherever usable data is available. M1 now implements nationwide geographic search and genuine baseline road routing; provider coverage and network availability remain limited.

## What exists

- `frontend/`: React 19, Vite 7 and Tailwind 4 responsive dashboard, route planner, AI and AR navigation views. Explicit Nominatim place selection, Leaflet/OpenStreetMap map and genuine OSRM route geometry, durations/distances and scoped comparisons. No live traffic or future estimates.
- `backend/`: Java 17 / Spring Boot REST service; `GET /api/health` reports process health only; `/api/locations` and `/api/routes` provide validated search and road routing.
- `ai-service/`: Python / FastAPI experimental congestion service; explicit synthetic data generation, offline Random Forest training/evaluation and scenario forecasts. `GET /health` reports actual model availability.
- `database/schema.sql`: MySQL 8 roads, observations and predictions schema with provenance labels, foreign keys and synthetic-data flags.
- `docs/requirements.md`: authoritative nationwide specification; `docs/architecture.md`: target system design; `docs/milestones.md`: staged delivery and acceptance checks; `infra/`: deployment notes.

The original repository contained only this README and a Java-oriented `.gitignore`. Development now uses `vidura`; the completed foundation is on GitHub. No AWS deployment has been performed.

## Prerequisites

Node.js 22.12+ (tested on 22.23.4 in Amazon Linux and 24 in development), npm, JDK 17, Maven 3.9+, Python 3.12 and optionally MySQL 8. No API keys or paid integrations are required. Use this existing checkout in isolated cloud tasks; no additional Git worktree is needed.

## Install and validate

Run from the repository root:

```sh
npm ci --prefix frontend
npm run build --prefix frontend
python -m venv ai-service/.venv
ai-service/.venv/bin/pip install -r ai-service/requirements.lock.txt
(cd ai-service && .venv/bin/python train.py)
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
(cd ai-service && .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000)
```

Frontend uses port 5173, backend 8080 and AI service 8000. Check services with `curl -f http://localhost:8080/api/health` and `curl -f http://localhost:8000/health`. FastAPI exposes interactive API documentation at `/docs`. Frontend calls Spring Boot through Vite’s same-origin `/api` proxy. The primary Amazon Linux deployment includes an equivalent Nginx HTTPS proxy. The AI Predictions page calls the separate FastAPI service through Spring Boot; its synthetic outputs never override OSRM routes.

Each component has an `.env.example`. Vite loads `.env.local` when needed; Spring and Uvicorn require exported shell variables (they do not automatically load these templates). Prototype defaults require no credentials. Provider endpoints/limits and public geocoder opt-out are configurable; see `docs/m1-routing.md`. Never commit credentials.

## Optional database setup

With a local MySQL 8 server and an authorized account:

```sh
mysql -u YOUR_USER -p < database/schema.sql
```

The schema creates and selects `trafficease`; the account must have database/table creation privileges. Password is requested interactively. The script creates missing tables without dropping data; it is a bootstrap schema, not a migration system. Default services do not connect to MySQL; the opt-in `mysql` profile enables Flyway-managed synthetic scenario history. See [persistence](docs/persistence.md). Database timestamps use UTC; user-facing forecast/history controls use Asia/Colombo.

## Scope and limitations

Baseline provider routing is implemented. Live geocoding, OSRM routes and map tiles have now been verified together; see `docs/m1-live-verification.md` for the sampled journeys and limits. A synthetic-only model is now trained for M3. No real traffic validation, validated real-device AR alignment, world-anchored AR runtime, administrator dashboard or personal-account authentication yet (deployment has a shared Nginx demo password). M4 now implements a sensor-assisted camera HUD and manual map fallback. Those belong to subsequent milestones. Synthetic training and predictions must be clearly experimental and separate from any future live traffic results. AR must provide reliability fallbacks and be designed for stationary users or passengers. GPS alone cannot visually recognize roads. Do not retain provider-restricted data without permission. AWS deployment is deferred.

See `docs/validation.md` for checks and their outcomes.

## Nationwide development roadmap

The updated specification replaces the earlier Colombo-first product scope. See [requirements](docs/requirements.md), [architecture](docs/architecture.md) and [milestones](docs/milestones.md). The first functional milestone is nationwide geographic search and genuine route calculations; provider access, coverage, licensing and traffic/future capabilities must be verified before integration. Architecture documents describe planned behavior, not completed functionality. The UI now requests genuine road routes; it does not calculate traffic forecasts. See [M1 setup and test results](docs/m1-routing.md) and [sampled coverage](docs/m1-coverage.md).

## Experimental AI forecasts (M3)

See [M3 model card, setup and evaluation](docs/m3-forecasting.md). Train offline before starting FastAPI, then use AI Predictions to select a fictional road/region, weather/holiday scenario and current or future Colombo time within seven days. All forecasts are **EXPERIMENTAL / SYNTHETIC**. No model binaries are committed; a fresh checkout must run `train.py`. These classifications cannot produce accurate journey times, speeds or actual regional traffic conditions.

## Camera and map navigation prototype (M4)

See [M4 capabilities, HTTPS setup and validation](docs/m4-ar-navigation.md). AR Navigation now offers rear camera, explicit GPS/compass permissions, genuine GPS-origin route geometry and an approximate road/destination-direction HUD with manual map fallback. Remain stationary or use it as a passenger, never as the driver. **Physical smartphone alignment remains unvalidated**; desktop tests use simulated camera/sensor data. No visual road recognition, live traffic, future route forecasts or fabricated alternatives are provided.

## EC2 deployment readiness

See [Amazon Linux EC2 deployment guide](docs/ec2-deployment.md) and [readiness test results](docs/ec2-validation.md). One Amazon Linux 2023 x86-64 2-vCPU/4-GiB host with 30-GiB encrypted gp3 is recommended, with Nginx HTTPS, internal Java 17/FastAPI services and optional MySQL 8. Installation, release build/model training, health checks, updates and rollback scripts are under `infra/ec2`. This prepares deployment only; no AWS resources or certificates have been created. Verify actual credits and regional prices before launching.

## Scheduled journeys and integration status

Leave Now, Later Today and Future Date share an Asia/Colombo departure context through seven days. Scheduled routes remain genuine **OSRM baseline** calculations, with traffic-aware/future ETAs explicitly unsupported. AI may reuse time but requires a separate fictional scenario; AR uses map planning for scheduled journeys. Optional shared synthetic history has explicit opt-in, Flyway migrations, provenance and retention limits. See the [implementation matrix](docs/implementation-status.md), [M2 provider review](docs/m2-provider-review.md), [persistence](docs/persistence.md) and [current validation](docs/ec2-validation.md). The [Ubuntu alternative](docs/ec2-ubuntu-deployment.md) is preserved separately.
