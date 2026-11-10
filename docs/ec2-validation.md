# Current validation — 11 November 2026 (Asia/Colombo)

Work is on `vidura`. No AWS resources/credits/account credentials, public deployment or real certificate order were used. The [historical Ubuntu record](ec2-ubuntu-validation.md) is preserved separately and must not be mistaken for current native Amazon Linux installation evidence.

## Application tests

| Check | Current result |
| --- | --- |
| Java 17 Maven verify, including actual MySQL integration | **55 passed**, none skipped in the enabled test run |
| Python 3.12 tests | **15 passed**, one upstream Starlette/AnyIO deprecation warning |
| Frontend geometry/sensor/time unit tests | **24 passed** |
| Playwright desktop/mobile browser regressions | **29 passed** |
| Vite production build | Passed |

Date tests cover 10 AM → 7 PM, Colombo midnight, offset conversion, past/expired selections, invalid/offsetless timestamps, contradictory modes and the inclusive seven-day horizon. A provider-mock test verifies scheduled context never changes genuine returned route data or adds invented provider traffic parameters. Browser tests cover shared planner → AI → AR context, scheduled map-only behavior, model evaluation access and history opt-in. Existing routing, model error states, camera/sensor permission/cleanup/uncertainty and responsive tests remain passing. Browser sensor/provider fixtures do **not** prove real-phone alignment or live provider availability.

Real MySQL **8.0.46 and 8.4.13 LTS** tests verify Flyway migration/re-run, inserts, UTC timestamp preservation, mandatory synthetic provenance, absence of GPS columns, seven-day expiry deletion, capacity refusal and the no-DB profile. API tests verify saving requires explicit opt-in and a storage failure does not alter the inference result.

## Amazon Linux application/runtime compatibility

The official Amazon Linux 2023 image and official **amazoncorretto:17-al2023** image were started locally. Observed platform: **Amazon Linux 2023.12.20261102**, x86-64; Corretto **17.0.21**, correct `/usr/lib/jvm/java-17-amazon-corretto.x86_64` path. All 55 Java tests, including real MySQL, passed inside the AL/Corretto container.

The cloud policy rejected `cdn.amazonlinux.com` with **HTTP 403** when `dnf` requested the native repository mirror list. Therefore **native dnf installation and the complete final-path release activation/rollback lifecycle have not been revalidated on AL2023**. Repository access was requested; no policy bypass, unsigned RPM, disabled TLS check, host-network workaround or unrelated production host was used.

To test application compatibility despite that limitation, temporary test-only verified tool distributions were used inside the real AL2023 container: official Node **22.23.4** and Maven **3.9.11**, and checksum-verified Astral python-build-standalone CPython **3.12.16**. The production installer still uses **native dnf Python 3.12**, not that standalone download. Maven reused the already resolved dependency cache. Cloud CA/proxy trust was supplied only for tests, with certificate verification enabled. These application checks do not imply that every native package/installation command succeeded.

Inside AL2023, Node installed the locked frontend dependencies, ran 24 units and built Vite successfully. Python installed the unchanged locked AI dependencies, passed all 15 tests, loaded the trusted model and regenerated it from synthetic data. Model ID remains `synthetic-v1-4058148f38bb4d73`, Random Forest, test macro-F1 **0.7176** / unseen-road **0.7299**, baseline test macro-F1 **0.2201**. These are synthetic benchmark metrics, not actual Sri Lankan traffic accuracy. No model algorithm change or ETA model was introduced.

The primary optional deployment uses digest-pinned MySQL **8.4 LTS**. Its authenticated readiness command passed, and an actual dump was gzip/content-checked and restored into a separate disposable schema; both history and Flyway tables were readable. This is not encrypted off-host disaster-recovery validation.

The exact pinned Certbot **5.9.0** dependency lock installed in `/opt/trafficease-certbot`, and `certbot --version` succeeded. No ACME order/renewal or AWS resource action was executed. Bash/Python syntax checks passed for both platform script sets; relative documentation links were checked. Real AL systemd boot, sandbox/cgroup enforcement and SELinux policies remain manual gates.

## Local HTTPS and real-provider integration

Actual built Java/FastAPI apps ran inside AL2023 with the optional MySQL profile. An official Nginx container shared only their private container network namespace, using the new AL-style `nginx.conf`/`conf.d` layout, current built frontend and an ephemeral trusted local CA/hostname. This tested real Nginx configuration and TLS, **not installation of Amazon's Nginx RPM**. No application ports were published publicly; no proxy policy was bypassed.

Verified: UI/API 401 without Basic auth; authenticated React index/JS assets; sensor/CSP/Referer-compatible headers; same-origin backend health, departure capabilities, actual trained AI inference, explicit SAVED synthetic history and no GPS fields. Certificate verification was enabled throughout; temporary keys/passwords stayed outside Git and were discarded with the test environment.

A deliberately limited live probe made **two explicit Nominatim searches** (Kandy, Matale), spaced more than one second apart, then **one OSRM route request** through Nginx → AL Java. It returned **1 genuine route**, **53,877.1 m**, **4,051.5 baseline seconds**, **2,344 geometry vertices**, and endpoint snapping **11.3 m / 178.0 m** (within the 300-m normal planning gate). Future departure context was accepted and explicitly returned `trafficAware=false`, `futureEstimatesSupported=false`, `BASELINE_ONLY`. These are sampled provider outputs at test time, not permanent values, a future ETA or nationwide coverage evidence. Existing nine-province M1 evidence remains separately documented; no coverage sweep/load test was repeated. Frontend geographic drawing is covered by browser fixtures; this new probe is API/proxy evidence, not a new live-browser map/phone test.

Commercial traffic documentation probes (TomTom/HERE/Google) were also policy-denied with HTTP 403. No account, cost/coverage entitlement or map-display license was assumed. See [provider review](m2-provider-review.md).

## Remaining gates

Native AL dnf install and full non-root final-path release lifecycle; actual EC2 launch/credit eligibility/regional pricing, SSH/SG/DNS/reboot/systemd/SELinux/limits; trusted public certificate issuance/renewal; realistic memory/CPU/disk load including optional Docker/MySQL; encrypted off-host backup restoration; and physical Android/iOS camera/GPS/compass validation. AWS pricing pages are blocked, so cost figures are transparent illustrative assumptions, not verified current quotes.

The [implementation matrix](implementation-status.md) distinguishes working demonstration flows, experimental forecasts and external validation. The [beginner launch guide](ec2-deployment.md) provides the manual steps; it does not imply any site has been deployed.
