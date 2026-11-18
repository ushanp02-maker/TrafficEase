# Hybrid AR validation

Implemented and tested on `vidura`. No AWS redeployment/resources, paid APIs or main-branch changes.

## Automated results

| Check | Result |
|---|---|
| Java 17 Maven verify | **86 passed, zero skipped**, including actual disposable MySQL 8.4 checks, existing routing/security/history suites and five new maneuver/serialization validation tests. |
| Frontend unit tests | **45 passed**: existing geometry/time tests plus 21 hybrid preview/projection/provenance/confidence/hysteresis/budget/maneuver checks. |
| Browser regression | **55 passed**, including 20 AR cases and all existing consumer, prediction/model, history, routing and administration flows. |
| Python model regression | **31 passed**, one upstream Starlette/AnyIO deprecation warning. No model algorithm/metrics changes. |
| Production frontend build | Passed. |
| Existing deployment integrity regression | Passed for both deployment platforms. No deployment was performed. |

AR browser coverage includes immediate network-independent preview; a single Start gesture; actual source/metric labels; synthetic sensor qualification into live-route state; no routing without a destination; poor GPS and automatic recovery; missing compass with a genuine map fallback; immediate instruction removal and cooldown on confidence loss; routing failure/backoff/recovery; interrupted and late route requests; denied/insecure/missing devices; front-camera preview-only fallback; late camera/compass cleanup; pagehide/unmount cleanup; Android-style absolute orientation; mobile layouts/reduced motion; bounded three-window GPS retries; interrupted-sensor recovery; incomplete directions remaining preview-only; and an interactive on-HUD destination control.

The sensor/camera browser fixtures are explicitly simulated. Canvas MediaStreams are not physical rear cameras. DeviceOrientation events and GPS fixes are injected only in tests, never fabricated by the application to qualify a real user. Tests prove state transitions and guards, not field accuracy. The plain startup-preview test blocks all API requests and verifies zero calls; no road, weather, map or AI service is required to render its HUD. Existing mapped-forecast integration still evaluates all 30 journeys using the actual trained model.

The full suite uses a simulation-default frontend and actual local Java/FastAPI services, with a private generated administrator account for the gated authentication/publishing test. No credentials or model binaries are committed. The browser runner must inherit `VITE_DEMO_MODE=true` when it starts its own server for that consumer Home integration check; this is a test precondition, not an AR source-mode selector.

## Live provider check

A real request traversed Spring Boot → Nominatim country verification → OSRM, using a **test coordinate at the public Colombo Fort railway landmark**, not a real GPS receiver. Destination selection used actual geocoding for Piliyandala clock tower and respected provider spacing.

The response contained one genuine baseline route: **19,420 m**, **1,537.3 baseline seconds**, **24 complete validated maneuver steps**, with origin/destination road snapping approximately **8.6 m / 6.7 m**. Existing routing and candidate fields remained available. There was no fabricated alternative, congestion or traffic-adjusted ETA. See [captured summary](m4-hybrid-live-summary.json). A successful single journey does not establish nationwide route coverage or physical alignment.

## Reproduce

Use JDK 17 and the existing local setup/startup guide. From the repository root:

```sh
mvn -f backend/pom.xml verify
npm run test:unit --prefix frontend
npm run build --prefix frontend
(cd ai-service && .venv/bin/python -m pytest -q)
npm run test:e2e --prefix frontend
```

Cloud-specific Maven trust/proxy/cache settings remain documented in `cloud-setup.md`. Actual-service browser checks additionally enable CONSUMER_INTEGRATION and the private test account fixture, as described in `consumer-redesign-validation.md`. Set VITE_DEMO_MODE=true for the consumer simulation Home check. MYSQL_TEST_PASSWORD_FILE enables the disposable MySQL tests. AR tests themselves use controlled device/provider fixtures and no external provider requests. Only the deliberately executed live smoke above calls public services.

## UI captures

- Guided Preview, no services/camera needed: [desktop](screenshots/hybrid-ar/guided-preview-desktop.png) · [mobile](screenshots/hybrid-ar/guided-preview-mobile.png).
- Qualified route HUD with **simulated sensors and provider response**, visibly stamped as validation rather than field evidence: [desktop](screenshots/hybrid-ar/qualified-route-simulation-desktop.png) · [mobile](screenshots/hybrid-ar/qualified-route-simulation-mobile.png).

The captures reported no page exceptions or horizontal overflow. Responsive tests cover 320, 390, 768 and 1440 px, with reduced-motion preferences honored. The camera/video/HUD stay mounted across ordinary source transitions.

## Remaining physical-device and data limitations

- A camera cannot be forced open without browser permission. iOS orientation access may require a direct gesture. One Start action requests the supported APIs; actual Safari/Android permission sequencing still needs testing.
- Devices that do not report a verifiable rear facingMode, a usable absolute compass or a reliable upright pose remain in preview/map fallback. A front webcam may show preview video but never qualify for live camera alignment.
- GPS reported error and compass stability do not guarantee true positional/directional accuracy. Indoor interference, magnetic bias, parallel/unreturned roads, tunnels, urban canyons, rapid movement and real-screen orientation need field validation. Only returned geometry is available; there is no complete surrounding-road detector or camera recognition.
- The HUD is approximate screen guidance, not physically registered WebXR, lane guidance or certified turn-by-turn navigation. Remain stationary or use as a passenger; never operate it while driving.
- Baseline remaining time is derived from provider step duration and distance progress, not measured speed, observed delay or a traffic-adjusted ETA. Live congestion remains unavailable.
- Public routing/geocoding services are low-volume demonstration providers, with availability/usage restrictions. If unavailable or incomplete, preview continues; the application does not fabricate live guidance. The automatic request budget is per mounted page, with backend throttling still active.
- Trusted HTTPS is required when testing a phone over a LAN/public host. No certificates, AWS resources or paid services were provisioned in this task. No physical smartphone road-alignment test was performed.
