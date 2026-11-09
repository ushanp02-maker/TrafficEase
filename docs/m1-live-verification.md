# Live search-to-map verification

Validated on 2026-11-09 against the running Java 17 backend and React/Vite UI on `vidura`. No location, routing or tile responses were mocked. The published policy permits all three provider domains. This report supersedes earlier cloud network-denial notes.

## End-to-end evidence

For each journey the browser entered both queries, clicked explicit Search buttons, checked that results belonged to `LK`, selected actual returned places, submitted `/api/routes`, verified real LineString geometry and snapping ≤300 m, and observed route paths plus fully loaded OpenStreetMap tiles after Leaflet's zoom animation settled. Route comparisons remain scoped to returned routes and marked baseline, not live traffic. Each sample returned one route, so the same returned route won both comparisons naturally. Alternate-route switching is covered by the fixture-based regression suite; no live alternative was invented.

| Province | Search queries (origin → destination) | Baseline road distance | Baseline duration | Snap offsets (origin / destination) | Loaded tiles | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Central | Kandy railway station → Matale railway station | 26.3 km | 34.8 min | 46.7 / 31.9 m | 9 | Passed |
| Northern | Jaffna railway station → Chunnakam railway station | 11.1 km | 15.2 min | 69.0 / 25.5 m | 6 | Passed |
| Southern | Galle railway station → Matara railway station | 48.3 km | 46.7 min | 45.8 / 30.1 m | 12 | Passed |
| Western | Colombo Fort railway station → Negombo railway station | 38.0 km | 37.2 min | 8.6 / 25.4 m | 12 | Passed |
| Eastern | Trincomalee railway station → Batticaloa railway station | 136.0 km | 171.8 min | 9.6 / 19.5 m | 16 | Passed |
| North Western | Kurunegala railway station → Puttalam railway station | 87.4 km | 110.2 min | 19.6 / 51.4 m | 9 | Passed |
| North Central | Anuradhapura railway station → Polonnaruwa railway station | 106.9 km | 125.1 min | 55.0 / 19.7 m | 13 | Passed |
| Uva | Badulla railway station → Bandarawela railway station | 29.6 km | 34.1 min | 46.2 / 13.0 m | 12 | Passed |
| Sabaragamuwa | Ratnapura bus station → Kegalle bus station | 90.7 km | 104.6 min | 17.6 / 24.6 m | 8 | Passed |

These figures are point-in-time OSRM baseline calculations, **not current traffic or forecasts**. Queries select the first actual result for an explicit station/terminal search; they do not establish town-wide access, exhaustive country coverage or language quality. Distances are rounded for the report. Provider data: © OpenStreetMap contributors (ODbL); geocoding via Nominatim, driving routes via OSRM, basemap from OpenStreetMap.

The initial North Western location search returned `503 PROVIDER_UNAVAILABLE`. A later explicit location check succeeded, and a targeted full browser rerun passed. The failure was retained as evidence of public-provider availability limits; no automatic retry loop or fabricated data was added. The Eastern railway-station sample succeeded within 300 m; this does not invalidate the earlier 502 m rejection for a different approximate Trincomalee coordinate.

## Checks and screenshots

- Java 17 `clean verify`: **28 passed**, no failures/errors/skips.
- Existing browser regression suite: **8 passed** (controlled fixtures, separate from the nine live journeys).
- Vite production build: passed.
- Live browser: nine eventual successful province-level journeys, no JavaScript runtime errors, real map images loaded and no tile-failure warning in successful runs.
- Central journey also checked at 390 px mobile width without horizontal overflow, with the map scrolled into view and tiles repainted after resizing; existing regression checks cover 320–1440 px.
- [Desktop screenshot](m1-desktop.png) and [mobile screenshot](m1-mobile.png) now show the live Kandy–Matale route. Screenshots were visually inspected. Earlier foundation screenshots remain historical.

## Browser trust diagnosis

Initial sandboxed Chromium runs rejected map HTTPS requests with `ERR_CERT_AUTHORITY_INVALID`, despite successful backend requests and curl tile HTTP 200. The browser peer chain matched the environment's supplied trusted proxy CA and verified with OpenSSL. Chromium required approved access to its writable NSS certificate database outside the command sandbox; subsequent live browser runs loaded real tiles successfully. TLS verification stayed enabled throughout: no `ignoreHTTPSErrors`, insecure switches or certificate-check bypass was used.

This was test-environment access/trust handling, not an application routing defect. No application design, backend compiler setting or runtime feature change was necessary. No environment configuration was published or replaced during this task. On ordinary laptops, use their normal trusted browser/HTTPS setup; managed-cloud browser tests need access to the platform's supplied CA trust.

## Repeat deliberately

Start the Java backend and Vite frontend using the README. For a small, one-off live check:

```sh
cd frontend
RUN_LIVE_ROUTING=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:live
```

Use `LIVE_BASE_URL` to select another running frontend and `LIVE_OUTPUT` for local results/screenshots (default `/tmp/trafficease-live`). `LIVE_PROVINCES='North Western'` restricts the run to an exact province name; comma-separated names are supported. Run serially and deliberately, never as an ordinary CI job or periodic provider probe. Distinct searches are spaced by at least 1.2 seconds, and the backend separately limits upstream calls and caches queries. The helper exits unsuccessfully on provider failure, geometry/selection problems, missing map tiles or browser errors. It captures only public test journeys, not credentials.

The helper waits for two animation frames, the end of Leaflet zoom animation and all map images to load before taking screenshots. Merely finding one old low-resolution tile was insufficient to establish a finished geographic map.

## Remaining limitations

Nine sampled journeys do not prove complete nationwide coverage. Sinhala/Tamil name variants, cross-province journeys and every rural/remote road have not been exhaustively validated in this run. Local road restrictions and mapping completeness still need checking. Best-effort provider availability, application-wide rate limits and production hosting review remain. Live traffic, future-time estimates, true shortest-distance optimization, AI and AR remain unsupported. No API key is required for the approved small public-service prototype; production scaling needs a reviewed hosted/self-hosted solution and shared limits.
