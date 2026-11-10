# M4: Sensor-assisted smartphone camera navigation prototype

Implemented on `vidura`. This is a **camera-and-compass contextual HUD with a geographic map fallback**, not visual road recognition, a world-anchored WebXR scene or a validated turn-by-turn navigation system. No AWS resources, paid services, AI traffic values or new datasets are used.

## Current capabilities and evidence

| Capability | Implementation | Validation in this task |
| --- | --- | --- |
| Camera | Explicit user action requests rear-facing `getUserMedia`, audio disabled; live video uses `muted`, `autoplay`, `playsInline` | Simulated canvas MediaStream in desktop Chromium, including denial/missing API, stream stop and late-resolution cleanup; **not a physical rear camera** |
| GPS | Explicit `watchPosition`, reported accuracy/freshness checks, clearWatch on stop/exit | Simulated browser positions and denial/missing API; server validation tests; **not real receiver accuracy** |
| Compass | Explicit permission action (including iOS-style `requestPermission`), WebKit heading or absolute orientation events | Simulated WebKit and Android-style absolute events; pose/math unit tests; **not real hardware calibration** |
| Road geometry | New GPS-origin API reuses actual OSRM road routing/geometry and Nominatim country metadata | Real Java 17 → Nominatim reverse country check → OSRM steps smoke, with an explicitly simulated position at a public station |
| Nearby direction candidates | Project GPS onto nearby returned step segments; compare route-direction bearings to estimated heading | Geometry/ambiguity tests and simulated camera UI; **no real scene/road alignment proof** |
| Alternative recommendation | Only a uniquely associated returned route can be compared with faster alternatives from the same baseline response | Unit tests cover genuine comparable differences, shared geometry and rejection of AI/invalid comparisons; no live alternative was invented |
| Map fallback | Reuse M1 Leaflet map, explicit destination search and optional manual starting-point search; no sensor permissions needed in manual mode | Browser tests cover manual routing with camera/GPS/compass denied, plus existing M1 map/search regressions |
| Mobile/HTTPS | Responsive navy/yellow interface; secure-context checks; optional trusted local TLS in Vite; same-origin API proxy | Chromium viewport checks at 320/390/768/1440 px and simulated insecure-context handling. Real Safari/Android browser/HTTPS testing remains pending |

**No physical smartphone test was performed.** These results cannot establish real-world AR accuracy or production navigation readiness. Browser/API simulations test behavior, not the truth of reported GPS/compass accuracy.

## User workflow

1. Open AR Navigation and read the stationary/passenger safety guidance. Confirm that you are not operating the application as a driver.
2. Start the rear camera, enable GPS and enable compass using separate explicit buttons. Permissions are requested only after user action. For directional estimates, hold the phone upright in primary portrait orientation. Calibrate the phone compass using its platform guidance; the app does not calibrate magnetic bias itself.
3. Search explicitly for a Sri Lankan destination with the existing location-search system, then select a returned place. Searches are not autocomplete.
4. With a fresh usable fix, calculate a GPS-origin route. Country validation and road snapping may reject the point; use a specific supported road-accessible location or manual fallback. Leave at least one second between new search/country-check requests.
5. When all heuristic alignment gates pass, the camera HUD labels an **approximate candidate road**, estimated bearing and straight-line destination direction. A destination-bearing arrow is not a turn instruction or a camera-plane/world anchor.
6. The map remains available even when the HUD has a candidate match. If sensors/permissions/pose/coverage are uncertain, it is the primary fallback. Select a manual origin to calculate genuine map routes without camera/GPS/compass. Internet/provider availability is still required; tile failures are explicitly labeled and never replaced by a fake basemap.
7. Stop the camera and sensors when finished. Navigating away, hiding the page or a `pagehide` event also stops streams/watches/listeners. Re-enabling permissions after denial may require changing browser/site settings.

A moving passenger may use the map; directional matching is conservatively paused when a reported GPS speed exceeds 1.5 m/s. This is not a reliable driver-detection mechanism. Stationary/passenger confirmation is guidance, not proof of safe use.

## Geometry and uncertainty rules

`frontend/src/ar/geometry.js` implements WGS84 bearing/haversine utilities and a local tangent-plane nearest-segment projection suitable for the small 50 m candidate search radius. OSRM supplies route step names and LineStrings; the client does not infer road names from pixels. It searches the first **eight returned steps per route**, not every road near the camera. Unreturned parallel roads, bridges, road levels, nearby branches and map errors can still defeat this heuristic.

For each step, take its closest non-degenerate segment within 50 m. Merge essentially coincident (<0.1 m projected separation, <1° heading difference) same-name segments across returned routes to retain their shared route IDs. Merely nearby parallel roads are not merged. Matching additionally requires distance ≤ `min(40 m, reported GPS accuracy + 15 m)`, a heading difference ≤20° and at least a 15° advantage over another nearby candidate. Ambiguous matches fall back to the map.

Other gates:

- The rear-facing track must report `facingMode=environment`, and its video must be running. Unverified/front-camera tracks do not enable alignment.
- GPS must report positive accuracy ≤30 m, be no more than 10 seconds old (future timestamps beyond five seconds are rejected), and remain within 25 m of the route request's original GPS point. Client-reported uncertainty is not a guarantee of actual positional error.
- Absolute heading must be fresh (≤2 seconds) and stable: at least four samples over ≥300 ms with <8° dispersion around the latest value. Unreported compass precision is explicitly shown as unknown; stability does not detect systematic bias.
- WebKit compass error must be reported between 0° and 20°. Relative-only alpha is not accepted. For standard absolute events, a rear-camera horizontal-axis estimate is derived from alpha/beta/gamma; no numerical error bound is available from those events.
- Pose is restricted to primary portrait (screen angle 0°, with legacy `window.orientation` fallback), beta 45–135° and absolute gamma ≤35°. Landscape, upside-down, flat/tilted phone or unavailable screen orientation uses the map.
- GPS route data must be no more than two minutes old with a valid timestamp. Recalculate explicitly after moving or expiration. The app never starts an automatic reverse-geocoding/routing loop.

These thresholds are conservative prototype heuristics, **not empirically validated accuracy bounds**. GPS uncertainty circles, magnetic interference, declination, device reference frames, camera axis differences and missing nearby roads can produce a wrong apparent match even when every gate passes. The HUD says approximate/not visually recognized and keeps the map visible. No camera images are analyzed or uploaded, no plane detection is performed and no AR.js/A-Frame dependency is needed for this screen-fixed overlay approach.

## Routing contracts and provenance

Existing `/api/locations` and `/api/routes` remain backward compatible; M1 components are exported for reuse rather than replaced. A new Java 17 endpoint accepts:

```text
POST /api/ar/routes
```

```json
{
  "origin": {"latitude":7.2894112,"longitude":80.6322495,"accuracyMeters":5,"timestamp":1794330000000},
  "destinationId":"a-current-selected-Nominatim-result-id"
}
```

Coordinates/timestamp above illustrate the shape only; clients send a fresh browser fix. The backend rejects non-finite/out-of-range positions, accuracy >30 m, GPS age >15 seconds and future timestamps >5 seconds. It requires the selected destination from M1's cache, and checks Sri Lankan country metadata using a user-triggered Nominatim reverse request. A bounding rectangle alone is not treated as country proof. This is still provider-reported country metadata, not a survey-grade border determination.

Country checks are cached for five minutes on coordinates rounded to five decimals, bounded to 128 entries, without database persistence or coordinate logging. Reverse requests share M1's application-wide geocoder limiter and public-service opt-in. No user-controlled provider URL is accepted.

OSRM uses driving profile with `steps=true`, `alternatives=true`, `geometries=geojson`. Existing route-response validation/ranking is reused, with a stricter **50 m snapping limit on both endpoints in AR mode**; excessive offsets return an explicit error rather than silently moving the user. Manual map mode retains M1's 300 m limit. Named candidate step geometry is validated before returning it. The response wraps `routing`, `candidates`, `destination`, `originSource=GPS` and explicit limitations. If no usable steps/candidate match exists, the route may still be useful on the map; no road direction is fabricated.

All durations/distances are genuine **OSRM baseline estimates**, not live traffic, measured congestion, synthetic AI predictions or future forecasts. AR currently supports only current baseline-route calculation; no future departure selection is added. Fastest/shortest labels refer to returned candidates, not globally optimized shortest distance.

A better directional alternative is shown only if the matched candidate belongs to exactly one returned route and another route in the **same response** has at least one second less baseline duration. Shared initial geometry cannot identify which alternative is faced, so the HUD withholds such a recommendation. The display says baseline-duration difference, never actual traffic savings. Manual map selection does not create a camera match. No recommendation overwrites a route result or uses M3 model output.

## Resource lifecycle, privacy and secure deployment

Rear-camera request generations ensure that a late permission result is immediately stopped after Stop/unmount. GPS and compass have independent generations so starting/restarting the camera cannot silently invalidate already-enabled GPS/compass. Late compass permission after Stop does not attach listeners. Tracks are stopped, `video.srcObject` cleared, `clearWatch` called and orientation listeners removed on Stop, hidden-page/pagehide and unmount. Outstanding route/search requests are aborted on edits/unmount. Sensor freshness is reevaluated every 500 ms without new provider requests.

Camera frames stay on the device. Precise coordinates are transmitted to the backend/Nominatim/OSRM only on explicit route calculation, not on each GPS update. Do not submit confidential journey/location information to public prototype providers. No camera recording, credential, SQL trace history or new personal-data persistence is added.

Production browser camera/geolocation/orientation APIs require a secure context. Localhost is a development exception; `http://laptop-LAN-address` on a phone is not. Vite now supports optional **trusted** development TLS:

```sh
DEV_HTTPS_CERT=/absolute/path/to/trusted/fullchain.pem \
DEV_HTTPS_KEY=/absolute/path/to/trusted/private-key.pem \
npm run dev --prefix frontend -- --host 0.0.0.0
```

Both paths must be supplied. Use a certificate trusted by the phone and matching a reachable host; do not bypass certificate verification. Keep certificates/private keys outside the checkout or in ignored `.local-tls/`. Export these Vite-process variables; `.env.example` is not automatically sourced into `process.env` for server configuration. No certificate/key was generated or committed here.

An eventual HTTPS reverse proxy must forward same-origin `/api` to Spring Boot and permit same-origin camera/geolocation/accelerometer/gyroscope/magnetometer features as supported by the browser. Example deployment policy to review: `Permissions-Policy: camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self), magnetometer=(self)`. Avoid cross-origin iframe restrictions; top-level use is recommended. Keep OSM attribution and a browser Referer for map tiles. No AWS resources or deployment configuration were applied in this task.

## Validation performed

| Check | Result |
| --- | --- |
| Java 17 clean Maven build | **41 tests passed**, no failures/errors/skips; includes 34 existing tests and 7 GPS/AR route tests |
| Python regressions | **15 passed**; one pre-existing upstream Starlette/AnyIO deprecation warning |
| Geometry/unit tests | **21 passed**: bearing/projection, absolute/WebKit pose handling, freshness/accuracy/movement, shared/parallel road ambiguity and comparable-route limits |
| Browser regression tests | **25 passed**: 14 existing M1/M3 checks plus 11 AR cases in desktop Chromium |
| Frontend production build | Passed |
| Real provider/API smoke | Simulated GPS at Kandy station → real Nominatim country metadata → real OSRM route to selected Matale station; one route and eight named/unnamed genuine candidate steps; both snapping distances ≤50 m |

Browser AR cases cover simulated granted/denied/missing camera, GPS and orientation; working manual map routing; poor GPS; insecure context; streams/listeners/watches stopped on navigation/pagehide; late camera/compass permission; sensor enable-order independence; stale heading; Android-style absolute events; and responsive 320–1440 px layouts. The camera fixture is a canvas-backed MediaStream, not an actual device camera. Provider responses in browser tests are fixtures, while the separate API smoke used live services with a simulated coordinate.

Reproduce from the repository root (use the existing documented cloud JDK/Maven flags when needed):

```sh
(cd backend && mvn clean verify)
(cd ai-service && .venv/bin/python -m pytest -q)
npm run test:unit --prefix frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e --prefix frontend
npm run build --prefix frontend
```

Screenshots [m4-simulated-desktop.png](m4-simulated-desktop.png) and [m4-simulated-mobile.png](m4-simulated-mobile.png) are visibly labeled **SIMULATION TEST**. They do not show a real camera scene or establish real AR alignment. Set `M4_SCREENSHOT_DIR` explicitly when running the simulated success test to regenerate them; normal tests do not write tracked screenshots.

## Required real-smartphone validation (not performed)

M4 remains a field-validation prototype. Before relying on it, test real Android Chrome and iOS Safari over trusted HTTPS:

- Rear-camera selection, autofocus/field of view, inline playback, rotation and browser/OS permission granted, denied and later revoked.
- Real GPS reported versus actual error outdoors, urban canyons, indoor/multi-level roads, poor/stale fixes, motion and route refresh behavior.
- Compass calibration, magnetic/true north bias, interference, upright/landscape/tilted poses, absolute-event availability and device-camera coordinate frames against known road bearings.
- Parallel roads, intersections, shared initial routes, road geometry completeness and false-match rates. Verify map fallback remains available whenever alignment is questionable.
- Actual sensor/stream shutdown indicators on navigation, tab switching, screen lock, BFCache/pagehide, browser interruptions and late permission dialogs.
- Safe stationary/passenger interaction, readability/accessibility, battery/thermal behavior and end-to-end timing on a phone network.

There is no proof of real-world camera alignment, real iOS/Android browser compatibility, full surrounding-road coverage, dynamic traffic awareness, accurate live time savings, world-locked spatial arrows or turn-by-turn safety from these desktop tests. No paid services or AWS deployment occurred.
