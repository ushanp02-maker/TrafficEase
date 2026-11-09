# TrafficEase

HNDSE Emerging Technologies coursework: a Sri Lanka-focused smart routing, experimental AI congestion prediction and AR navigation project. This milestone builds the initial development foundation, focused on Colombo.

## What exists

- `frontend/`: React 19, Vite 7 and Tailwind 4 responsive dashboard, route planner, AI and AR navigation views. Selectable route cards use fixed illustrative Colombo Fort–Wellawatte values and an SVG schematic, **not a geographic map or live traffic**. Custom inputs do not generate real routes.
- `backend/`: Java 21 / Spring Boot REST service; `GET /api/health` reports process health only.
- `ai-service/`: Python / FastAPI service; `GET /health` explicitly reports an untrained model. Scikit-learn and Pandas dependencies are installed for future work.
- `database/schema.sql`: MySQL 8 roads, observations and predictions schema with provenance labels, foreign keys and synthetic-data flags.
- `docs/architecture.md`: boundaries and next-stage requirements; `infra/`: deployment notes.

The original repository contained only this README and a Java-oriented `.gitignore`. Development uses `development/foundation`; nothing has been deployed or pushed.

## Prerequisites

Node.js 22.12+ (tested on 24), npm, JDK 21, Maven 3.9+, Python 3.12 and optionally MySQL 8. No API keys or paid integrations are required. Use this existing checkout in isolated cloud tasks; no additional Git worktree is needed.

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

In this cloud machine, export `JAVA_HOME=/workspace/tools/jdk-21.0.9+10` (the base image has only a JRE). Maven is at `/workspace/tools/apache-maven-3.9.11/bin/mvn`. If home caches are unwritable, pass `--cache /workspace/.cache/npm` to npm and `-Dmaven.repo.local=/workspace/.cache/m2` to Maven, together with `-s /workspace/tools/maven-settings.xml` for the cloud proxy and `-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts` for CA trust. See `docs/cloud-setup.md`. Pip can use `--cache-dir /workspace/.cache/pip`.

## Run locally

Use separate terminals from the repository root:

```sh
npm run dev --prefix frontend
(cd backend && mvn spring-boot:run)
(cd ai-service && .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000)
```

Frontend uses port 5173, backend 8080 and AI service 8000. Check services with `curl -f http://localhost:8080/api/health` and `curl -f http://localhost:8000/health`. FastAPI exposes interactive API documentation at `/docs`. Frontend is currently a standalone UI and does not call these services.

Each component has an `.env.example`. Vite loads `.env.local` when needed; Spring and Uvicorn require exported shell variables (they do not automatically load these templates). No variables are needed by default. Never commit credentials.

## Optional database setup

With a local MySQL 8 server and an authorized account:

```sh
mysql -u YOUR_USER -p < database/schema.sql
```

The schema creates and selects `trafficease`; the account must have database/table creation privileges. Password is requested interactively. The script creates missing tables without dropping data; it is a bootstrap schema, not a migration system. Services do not yet connect to MySQL. Datetimes are UTC by convention; future UI presentation should use Asia/Colombo.

## Scope and limitations

No provider routing, real traffic, trained model, camera/compass/GPS integration, AR.js/A-Frame runtime, administrator dashboard or authentication yet. Those belong to subsequent milestones. Synthetic training and predictions must be clearly experimental and separate from any future live traffic results. AR must provide reliability fallbacks and be designed for stationary users or passengers. GPS alone cannot visually recognize roads. Do not retain provider-restricted data without permission. AWS deployment is deferred.

See `docs/validation.md` for checks and their outcomes.
