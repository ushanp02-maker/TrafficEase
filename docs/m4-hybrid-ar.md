# Automatic Hybrid AR Navigation

TrafficEase now has one AR experience: an immediate **Guided Preview HUD** with an automatic, confidence-gated transition to **Live Route** guidance. There is no Demo AR / Live AR selector. Existing navy/yellow branding, location search, map fallback, Java 17, prediction services and deployment configuration remain intact. No AWS resources or paid services were created or deployed.

## Using it

Open `/ar-navigation`. The local, animated preview is already running without GPS, routing, geocoding, weather or AI services. It uses five predefined fictional instructions in a repeatable 40-second loop, with explicitly labeled preview distance, time, progress and congestion. Missing/denied cameras keep the same interactive HUD over a styled background; this is not represented as camera footage.

Confirm that you are stationary or a passenger, then use **Start rear camera**. That single gesture requests orientation permission, GPS and camera access together. Camera permission, and iOS orientation permission in particular, cannot be bypassed or universally triggered without a user gesture. The app does not silently open a camera or repeatedly prompt denied permissions. A bounded alternative-camera request can show a front webcam in preview, but only a verified rear-camera setting can qualify for live alignment.

Select a destination using the existing explicit Sri Lankan location search. The camera's Add destination control focuses that selector; Map opens the existing manual fallback. With no destination the HUD remains preview and no GPS-origin routing request is sent. Sensor acquisition continues within its limits. Once usable real positioning and a complete genuine route are available, the HUD transitions automatically. Users never choose preview versus live.

Only current journeys can activate live camera guidance. A scheduled journey remains guided preview plus map planning. The existing shared departure context and nationwide manual planner remain functional.

## Source boundaries

| HUD field | Guided Preview | Live Route |
|---|---|---|
| Instructions/arrows | Predefined fictional journey sequence | Validated OSRM maneuver type/modifier/road name; symbolic maneuver arrow with approximate compass-relative straight direction |
| Distance/progress | Simulated, labeled preview | GPS projection along selected genuine route geometry; remaining provider distance scaled by geometric progress |
| Duration | Simulated preview minutes | Remaining baseline estimate from OSRM step durations; partial current-step duration scales by distance progress |
| Congestion | Simulated LOW / MODERATE / HIGH | Unavailable; no live traffic or synthetic classifier is passed off as actual congestion |
| Clock | Actual device clock | Actual device clock |
| Compass | Actual fresh measurement if available, otherwise “—” | Actual fresh usable measurement; approximation/error-reporting limits remain |

No traffic-adjusted ETA, observed traffic, camera road recognition, lane detection, world-anchored WebXR or certified turn-by-turn navigation is claimed. An arrow is a screen HUD cue, not a calibrated overlay physically registered onto a road. Preview values never become measured values merely because camera/GPS permissions succeed.

## Confidence and hysteresis

`frontend/src/ar/hybrid.js` prepares and validates the route and evaluates current positioning. Complete maneuvers must belong to a GPS-origin OSRM baseline response for the selected destination, with consistent totals and valid Sri Lankan geometry. Recorded/manual/synthetic routes cannot activate Live Route.

Entry requires:

- Verified rear camera, active safety confirmation, selected destination and Leave Now context.
- GPS reported accuracy ≤20 m, age ≤5 s, finite coordinates/timestamp and no future timestamp beyond 1 s.
- Upright portrait, stable absolute orientation or WebKit compass. Heading age ≤1.5 s, reported error ≤15° when provided. Android absolute orientation can lack an error estimate; the HUD/help retain that limitation.
- Route age ≤120 s, no future generation timestamp beyond 5 s.
- Unambiguous nearest route projection within `min(15 m, GPS accuracy + 3 m)`; direction difference ≤30°. Nonadjacent route sections more than 50 m apart along the route cannot compete within the uncertainty band.
- Three continuous seconds satisfying the gates. Long clock/tick gaps do not count toward qualification.

Holding live uses ≤30 m GPS accuracy, ≤10 s GPS age, ≤2 s heading age, ≤20° reported compass error, projection within `min(25 m, GPS accuracy + 8 m)` and ≤45° heading difference. These slightly wider limits resist harmless jitter. A failed hold gate immediately removes genuine instructions and returns visibly labeled preview. Reentry waits at least five seconds and must qualify continuously again. The UI also checks the current route/session key and evaluation freshness before drawing Live Route; an old state cannot briefly label a changed destination or suspended session as live.

Destination changes, stop, unmount, background/pagehide and scheduled-departure changes abort pending work. The camera/video and HUD stay mounted during normal data transitions. On Stop/background, camera tracks and sensors are released and preview animation pauses; explicit restart resumes it.

## Bounded acquisition and routing

The browser uses one GPS watch at a time, not repeated per-frame permission requests. Location state accepts at most one callback per second. Acquisition has a 20-second window, then 15/30-second retry backoff, at most three windows per activation. Denial stops automatic retries. Reconnect sensors is an explicit new user-requested acquisition attempt. Compass permission is requested once per Start/Reconnect action; events are throttled to 100 ms and checked for stable samples. Stop and unmount clear watches, listeners, pending camera work and retry timers, including late permission/camera resolutions.

GPS is not sent to providers until a destination and usable fix are available. Automatic loading waits at least 1.2 seconds after selecting a geocoded destination, respecting the shared search/reverse-geocoding cooldown. Route loading runs independently of compass availability so a genuine map can be useful while the camera stays in preview. Healthy routes refresh after 60 seconds. There is no routing/geocoder loop per GPS frame. The page allows at most twelve automatic route requests in a rolling ten minutes, with four consecutive failed attempts and 5/15/30/60-second failure backoff. Healthy responses have a 30-second request cooldown. Reconnect retains the per-page route-volume budget. Backend provider throttles still apply; multi-user production service would need reviewed licensed infrastructure.

Incomplete directions can preserve valid genuine map geometry, but cannot activate the live HUD. Connection failure disables genuine guidance; a later successful bounded retry requalifies automatically. After retry limits are exhausted, preview continues and the user can reconnect deliberately. An exhausted/denied acquisition is not labeled as actively connecting GPS.

## API extension

`POST /api/ar/routes` retains its existing GPS-origin request, routing, destination and candidate fields. It now adds:

```json
{"directions":[{"routeId":"route-1","complete":true,"steps":[{"type":"turn","modifier":"right","roadName":"Provider road name","location":[80.0,7.0],"exit":null,"distanceMeters":111.0,"durationSeconds":45.0}]}]}
```

These are provider values, not locally fabricated instructions. `ArDirections` validates known textual maneuver fields, finite nonnegative distances/durations, coordinate/step continuity, geometry/length consistency, route totals and endpoint agreement. It bounds step count and total points. Missing/inconsistent step data produces `complete:false` with no invented maneuvers. Existing route parsing, independent 50 m GPS-route snapping and country verification remain in place. The frontend also checks provenance, geometry, totals, endpoint match and freshness.

The manual fallback uses the existing `/api/routes`; it never supplies “live” camera guidance from a manually chosen origin. Predictions, both Random Forest models, MySQL, administration and Windows startup remain independent of this local preview.

## Validation and real devices

See [recorded tests, live-provider evidence and captures](m4-hybrid-validation.md). Physical iOS Safari/Android permission sequencing, camera settings, magnetic calibration, real receiver error, road alignment and motion need real-device testing. Browser simulations do not validate field accuracy or safety. Trusted HTTPS is required on phone/LAN connections; localhost is treated as a secure context on the local computer. No TLS checks were disabled and no AWS redeployment occurred.
