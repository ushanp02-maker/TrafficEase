# EC2 readiness validation — 10 November 2026

No AWS resource, account credential, paid service, real certificate order or public deployment was used. All work is on `vidura`; application design and Java 17 remain unchanged.

## Application regression checks

| Check | Result |
| --- | --- |
| Java 17 Maven verification | 41 tests passed |
| Python 3.12 training and tests | Synthetic model regenerated; 15 tests passed |
| Frontend geometry/sensor tests | 21 passed |
| Playwright browser regressions | 25 passed, including routing, forecasts and simulated AR |
| Vite production build | Passed |

The Python suite reports one upstream Starlette/AnyIO deprecation warning. No test result establishes real traffic accuracy, nationwide provider completeness or physical smartphone alignment.

## Actual Ubuntu 24.04 container checks

An isolated amd64 Ubuntu 24.04 container had **no published ports**. The real installer completed with signed APT packages, official Node 22.23.4 and Maven 3.9.11 checksum verification, OpenJDK 17.0.21 and Python 3.12. Cloud proxy/CA settings were test-only configuration; TLS/signature verification stayed enabled.

Two releases were independently built as an ordinary `deploy` user at their final `/opt/trafficease/releases/<id>` paths. Each build ran Maven (41 tests), Python (15 tests), frontend units (21 tests), Vite compilation and actual offline model training. The venv and generated model loaded successfully from the final path; each prepared release occupied about **447 MiB** in this container, excluding shared caches/toolchains. This is a disk observation, not an EC2 resource benchmark.

The following passed using the actual built Java/FastAPI processes:

- First activation with no existing `current` link, read-only runtime files, successful update and manual rollback.
- Deliberately failed readiness on the second release: activation returned failure and restored the previous healthy Java/AI/frontend release.
- Real backend → FastAPI synthetic inference, provenance and model-readiness health checks.
- Loopback listeners, including Java's IPv4-mapped IPv6 representation; a deliberately introduced wildcard internal listener was rejected.
- Deliberately altered JAR rejected by the integrity manifest; restoring the bytes passed verification.
- Actual Nginx HTTPS with an ephemeral locally trusted CA and hostname verification: password required on UI **and API**, React/SPA rendering, same-origin Java/AI forwarding, security headers and missing/protected paths.
- Initial plaintext Nginx exposes only the ACME challenge; app/API paths return 503.
- `nginx -t`, Bash syntax and `systemd-analyze verify` for both installed unit files.

Test helpers under `infra/ec2/tests/` require `/run/trafficease-disposable-test` and must **never** be installed/run as production service controls. The container does not run systemd as PID 1: `activation-check.sh` uses a service simulator that launches the real applications from the actual unit/environment files. It does not prove boot ordering, kernel sandbox enforcement, cgroup limits or systemd crash recovery. The production units use real systemd, not this simulator. Local TLS testing created no public CA order and never disabled certificate validation.

## Optional MySQL check

Ubuntu MySQL **8.0.46** installed, the three bootstrap tables were imported, local root `auth_socket` authentication was verified, and both 3306/33060 listened only on 127.0.0.1. The backup script produced a valid gzip dump with a root-only 0700 directory/0600 file. MySQL remains optional and disconnected from the application.

The first container lacked a process-reaping PID 1, so Ubuntu's installer timed out waiting for an already-exited temporary MySQL process. Retrying in a disposable container with `--init` resolved that test-environment issue. Tests also caught the cloud shell's permissive inherited umask: deployment scripts now set 022 and explicitly root-own/mode 0644 the generated MySQL and Nginx configuration, preventing MySQL from ignoring a world-writable config. Runtime process control was still simulated; a real systemd boot and a backup restore are manual acceptance checks.

## Remaining manual validation

Before any public demo, an operator must verify actual AWS credits/regional pricing and explicitly launch/configure the host; validate security-group reachability, reboot/startup, systemd restrictions/resource limits and realistic memory/CPU load; configure DNS, password access and a trusted certificate; test Certbot renewal; and complete the M4 physical-smartphone checklist. Test off-host backup restoration before keeping valuable data. These were not proven by the container tests.

The official Nominatim and tile policies were re-read from the OSMF operations GitHub sources (their website was proxy-denied), and the OSRM demo policy from its official wiki, on 10 November 2026. They require limited usage, attribution/identification and caching; OSRM explicitly restricts its demo to reasonable non-commercial use and ≤1 request/second. Public Nominatim/OSRM/OSM tiles retain the M1 policy restrictions; deployment tests did not load-test or repeatedly probe donated services. Keep one backend process, explicit geocoder searches, attribution and global rate limits. Production/multiple replicas need provider and rate-limiter review. AWS pricing pages were proxy-denied: guide costs are transparent planning assumptions, not verified current regional quotes or a guarantee of Free Plan eligibility.
