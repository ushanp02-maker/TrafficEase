# Optional MySQL synthetic prediction history

The default application has **no database connection**. `SPRING_PROFILES_ACTIVE=mysql` explicitly enables a loopback MySQL 8 datasource, at most two pooled connections, and Flyway migrations under `backend/src/main/resources/db/migration`. Credentials are supplied only in protected host configuration. An enabled profile fails startup if connection/migration fails; it never claims database readiness from process health alone.

## Meaningful stored data

AI Predictions offers an unchecked-by-default opt-in to shared coursework history. `saveHistory=true` on `/api/forecasts` requests persistence **after a genuine successful synthetic inference**; ordinary predictions, route searches and AR do not write records. The FastAPI request does not receive this persistence flag, and no Python training/model behavior changes.

V1 stores fictional target ID, requested forecast instant (UTC), creation instant, LOW/MODERATE/HIGH category, weather/holiday **scenario**, model/dataset versions and mandatory `SYNTHETIC`/experimental provenance. It stores **no GPS, actual origin/destination, road geometry, camera frames, IP addresses or observed traffic**. The old roads/observations schema is not used as if it contained real measurements. No road-scenario-to-OSRM-segment mapping is inferred.

This is shared demonstration history, **not a personal account feature**. Anyone allowed through the Nginx demo password can view it. The UI explains this before opt-in. Do not enable it for confidential data or an untrusted public audience. No user/admin management dashboard was added merely to populate a page.

## Contract and retention

- `GET /api/forecasts/history/status`: enabled flag, shared nature, seven-day policy and maximum 1,000 records.
- `GET /api/forecasts/history`: latest 20 unexpired records or explicit DISABLED/UNAVAILABLE status.
- `POST /api/forecasts`: normal experimental result plus `historyStatus`: NOT_REQUESTED, SAVED, DISABLED, REJECTED, CAPACITY_REACHED or UNAVAILABLE. Database failure does not fabricate or alter a prediction; UNAVAILABLE means saving could not be confirmed, not a guarantee that no commit occurred during an interrupted connection.

Seven days are measured from creation, not the selected future forecast time. Expired records are hidden and deleted on the next history read/save. Physical deletion can be delayed while the application is stopped or no history access occurs; there is intentionally no extra scheduler/service. A full history refuses new saves until expiry; it does not silently discard recent user records. One backend process and synchronized history operations bound this prototype; multiple writers/replicas would need transactional capacity enforcement and a broader service review.

SQL uses parameters, source/category CHECK constraints and a creation-time retention index. Invalid provenance is rejected. Versioned Flyway checksums protect migration history. Legacy bootstrap tables can be baselined at 0 and remain untouched; V1 creates only the separate history table. Later migrations must be additive/backward-compatible for code rollback or have a tested restore plan. Application rollback does not roll back MySQL schema/data or passwords.

## Deployment and evidence

The [AL2023 guide](ec2-deployment.md) keeps MySQL optional, managed by a systemd-controlled digest-pinned official MySQL 8.4 LTS container with only `127.0.0.1:3306` published. X protocol is disabled. MariaDB is not substituted for MySQL 8. Leave this off if Docker/database/build memory competes with Java/AI on the 4-GiB host. The [Ubuntu alternative](ec2-ubuntu-deployment.md) retains native MySQL installation; enabling the same application profile there still requires a schema-scoped account and protected credentials.

Run `mvn verify` normally for default-profile regressions. For the **disposable local MySQL integration test only**, create an empty test `trafficease` schema with test user `te_history`, bind its port to loopback 3306, and supply a temporary root-only password file via `MYSQL_TEST_PASSWORD_FILE`. The test is destructive to its test history table; never point it at production data. It verifies repeatable Flyway migrations, actual inserts, UTC timestamps, source constraints, retention deletion, capacity refusal and absence of GPS columns. Without that environment variable the two real-DB tests explicitly skip; the default no-DB test always runs.

Backups must be protected, copied encrypted off-host and restore-tested before valuable data is retained. Saved scenarios are still fictional; accumulating them does not create a real traffic training dataset. See [current validation](ec2-validation.md) for the distinction between real MySQL/AL application checks and unperformed EC2 boot, public TLS and phone validation.
