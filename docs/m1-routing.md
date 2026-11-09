# M1: Nationwide search and genuine baseline routing

## Delivered and remaining validation

Implemented on `vidura`: explicit nationwide Nominatim search, selected-place REST contracts, OSRM driving routes, real GeoJSON on a Leaflet geographic map, duration/distance comparisons, snapping validation, provider identification/rate limits/cache, responsive navy/yellow UI and honest loading/unavailable/error states. No hardcoded route results remain in the application. Test fixtures exist only in tests.

Live OSRM requests and the packaged backend have been verified. **Live Nominatim search and OSM basemap tile rendering remain unverified in this cloud environment**: both destinations are denied by its Internet allowlist. Their integrations are implemented and tested with controlled fixtures/failure cases, not described as live end-to-end validation. M1's full acceptance gate remains open until those destinations are allowed and search/selection/map checks are repeated with real providers. AI, AR, forecasts and AWS are outside this milestone.

## Provider decisions and policies

Reviewed 2026-11-09:

| Service | Choice and constraints | Official policy |
| --- | --- | --- |
| Geocoding | Public Nominatim explicitly chosen by the project developer in this chat for the small coursework prototype. User-triggered Search buttons only, no autocomplete or bulk place harvesting. App-identifying User-Agent and OSM attribution. Maximum one new upstream request/second across the single app instance; cache normalized queries/results for 24 h. | [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) |
| Road routes | OSRM public demo, driving profile, reasonable non-commercial use only, at most one upstream request/second. Genuine baseline graph durations, not live traffic or forecasts; alternatives may be absent. | [OSRM demo policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) |
| Basemap | Standard `https://tile.openstreetmap.org/{z}/{x}/{y}.png` in Leaflet, visible attribution, browser Referer and normal HTTP cache behavior. No bulk/offline download, prefetch or cache-busting. Best-effort availability. | [Tile policy](https://operations.osmfoundation.org/policies/tiles/) |

The OSMF policy sources were read from their [official operations website repository](https://github.com/openstreetmap/owg-website/tree/master/policies). OpenStreetMap data is attributed under ODbL. These donated services are not a commercial SLA or verified production capacity. Rate limiting is deliberately **single-process**; do not run multiple replicas or installations sharing public services without a shared application-wide limiter and provider review. At larger scale configure hosted/self-hosted endpoints and a reviewed map service. Search cache is bounded to 256 queries and held in memory; restart/eviction loses selections. No geocoder result is saved to MySQL. Provider usage must remain moderate and directly end-user-triggered.

The public geocoder can be disabled using `PUBLIC_GEOCODING_ENABLED=false`. A compatible hosted/self-hosted Nominatim endpoint can be selected using `GEOCODING_URL` without a software update. Public opt-in defaults to true following the developer's explicit choice; disable it for other deployments until their developer reviews the policy. No API credentials are required for these public prototype services.

## Running and network configuration

Use JDK 17. Start Spring Boot as documented in the root README, then `npm run dev --prefix frontend`. Vite proxies same-origin `/api` to `http://127.0.0.1:8080`; override `BACKEND_PROXY_TARGET` for a different backend port. This server variable must be set on the Vite process. Production requires an HTTPS reverse proxy for `/api`; Vite preview is not a production API gateway. Do not enable unrestricted CORS to work around deployment configuration.

Required environment Internet destinations:

- `router.project-osrm.org` — currently reachable.
- `nominatim.openstreetmap.org` — currently blocked; needed by Spring Boot.
- `tile.openstreetmap.org` — currently blocked; needed by the browser.

The environment draft service also failed to load during this task; no network settings were changed or published. Add missing destinations in environment settings, then retry actual requests. On a laptop these domains must likewise be accessible. Cloud Java commands use `-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts` to trust the supplied proxy CA; never disable certificate checks. Ordinary laptop installations use their normal trusted HTTPS configuration.

`backend/.env.example` lists optional service URLs, identification and snap threshold. Export values before starting Java; Spring does not auto-load this file. `frontend/.env.example` lists the same-origin API base and tile URL. Vite client variables are public and build-time; never place secrets there. Tiles load directly from the browser; do not use a restrictive no-referrer policy. Changing tile providers requires reviewing attribution and usage rights.

## API contracts

- `GET /api/locations?query=...`: query length 2–160, URL encoded; returns `locations`, source and attribution. Requests restrict Nominatim to `countrycodes=lk`; returned country metadata must also equal Sri Lanka. A coordinate sanity range is an additional check, **not** country-boundary proof. No Colombo bias/bounds are applied. Naming/language quality depends on OSM data.
- `POST /api/routes`: JSON `{ "originId": "selected-place-id", "destinationId": "selected-place-id" }`. IDs must come from this server's unexpired search cache. Arbitrary coordinates cannot bypass geocoder country validation. The same selected origin/destination is rejected.
- Response: genuine `routes` with GeoJSON LineStrings, `distanceMeters`, `durationSeconds`, independent `fastestAvailable`/`shortestAvailable` flags; `snapping`, `source`, `generatedAt`, `estimateKind`, `comparisonScope`, `trueShortestSupported` and limitations. No alternative is invented when the provider returns only one.
- A selected location may represent a town centroid rather than a suitable road entrance. We validate OSRM's waypoint offset **and independently calculate the distance** from requested to snapped coordinates. Default limit is 300 m; `MAX_SNAP_METERS` must be positive and no more than 500. Excessive offset returns 422 `EXCESSIVE_SNAPPING` with endpoint and distance. Choose a specific road-accessible street/landmark; do not silently accept a 2.8 km shift.
- Duration and distance minima are calculated independently over returned routes, retaining ties. One route can win both; the UI explicitly explains that. `comparisonScope=RETURNED_ROUTES_ONLY`, `trueShortestSupported=false`. OSRM optimizes routing weight and does not expose a true shortest-distance objective; no globally shortest or globally fastest claim is made.
- `estimateKind=BASELINE_ROUTING_ESTIMATE` is displayed as **not live traffic**. No departure controls, traffic-aware durations, future forecasts, AI or AR are implemented.

Errors distinguish invalid query/selection (400), no route or excessive snapping (422), app request limit (429), invalid provider response (502) and unavailable/blocked/quota-limited providers (503). Failed requests never create sample routes. Search and route requests have timeouts; no automatic upstream retries are made. Provider Retry-After seconds trigger a cooldown (HTTP-date values conservatively fall back to 60 seconds). Users see an actionable failure. Editing a location cancels pending work and clears old results, and navigation cleans up map instances and requests. A tile failure leaves real geometry available on an explicitly unavailable background, not a fake map.

## Verification

```sh
# Backend (JDK 17)
cd backend
mvn clean verify
# Frontend
cd ../frontend
npm ci
npm run build
npx playwright install chromium  # if Chromium is not already installed
npm run test:e2e
# On this cloud image, use system Chromium:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Current-run results:

- Java 17 clean build and executable JAR: **28 tests passed**, no failures/errors/skips. Covers country/coordinate validation, cache and opt-out, search shape, no-route/malformed geometry/negative duration, identical and tied winners, independent comparisons, expired/unknown selections, 2776 m snapping and independent offset checks, API errors, identification, throttling and provider failures.
- Frontend production build: passed. Browser suite: **8 tests passed**, covering explicit search/no autocomplete, selection, geometry rendering, comparison/alternatives, empty and error states, denied tiles, loading, stale-response cancellation, navigation and widths 320–1440 px. Browser API responses and tiles are controlled test fixtures; this does not establish live geocoder/map availability.
- Real packaged backend process smoke: `/api/health` succeeds. Actual blocked Nominatim request becomes structured 503 `PROVIDER_UNAVAILABLE`, no fake results.
- Packaged backend integration smoke: a **local fixture geocoder** supplied Kandy/Matale coordinates, then the backend called **real OSRM**, returning one route and **1862 real geometry vertices**, with snapping below 300 m. This verifies the Java HTTP/proxy/OSRM path but is not a live Nominatim end-to-end test.
- Real OSRM coverage probes: nine province-level journeys, serial requests more than one second apart; see [m1-coverage.md](m1-coverage.md). Nine returned routes; eight met the 300 m snapping threshold. This is sampled evidence, not nationwide coverage proof.
- Current screenshots `m1-desktop.png` / `m1-mobile.png` show the actual tile-denial fallback, not a functioning basemap or fixture route. Earlier `dashboard-*.png` are historical foundation screenshots.

Outstanding acceptance checks: allow live geocoding and tiles, test actual name selection and map display across regions/languages, and repeat selected journeys end-to-end. Provider service limits and incomplete mapping can still prevent routes even with network access. No deployment or environment publication was performed.
