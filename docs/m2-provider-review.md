# M2 traffic-provider gate — 11 November 2026 (Asia/Colombo)

OSRM is integrated for genuine driving geometry, distances and baseline graph durations. Its public route API has no traffic feed or departure-time traffic model. Sending an invented `departAt` parameter or multiplying its duration by a synthetic congestion category would not establish a valid future ETA; TrafficEase does neither. The fastest/shortest labels remain limited to returned candidates, not a true shortest-distance objective.

## Candidates for a separately authorized integration

| Candidate | Documentation to evaluate | Unresolved acceptance gates |
| --- | --- | --- |
| TomTom Routing / Traffic | [Routing parameters](https://developer.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route), [coverage](https://developer.tomtom.com/traffic-api/documentation/market-coverage), [pricing](https://developer.tomtom.com/store/maps-api) | Verify Sri Lankan road-level traffic/history coverage, future horizon, account entitlements, cost and map-display license. API feature availability globally does not prove local coverage. |
| HERE Routing v8 / Traffic | [Routing](https://www.here.com/docs/bundle/routing-api-v8-api-reference/page/index.html), [traffic](https://www.here.com/docs/bundle/traffic-api-v7-api-reference/page/index.html), [pricing](https://www.here.com/get-started/pricing) | Verify Sri Lankan traffic coverage, departure-time semantics, allowed storage/display on Leaflet, plan restrictions and cost. |
| Google Routes | [Traffic-aware routing](https://developers.google.com/maps/documentation/routes/traffic_opt), [coverage](https://developers.google.com/maps/coverage), [policies](https://developers.google.com/maps/documentation/routes/policies) | Verify Sri Lankan coverage and future horizon, billable SKU/account terms and map-display restrictions before using results on the current OSM map. |
| Sri Lankan public observations | Road Development Authority and other official transport/public-data sources | No licensed, reliable machine-readable nationwide historical/live road feed is configured or validated in this repository. Static counts/reports are not a live forecast feed. |

No account, API key, free-quota entitlement, current regional quote, licensed Sri Lankan traffic coverage or production display permission has been verified for these commercial candidates. Their documentation sites may be blocked by this cloud environment; links are operator review gates, not evidence of available credentials/coverage. Do not provision a paid integration or change providers until those gates pass. No commercial traffic request was made.

## Implemented fallback contract

`GET /api/journeys/capabilities` reports the authoritative server time, Asia/Colombo timezone, exact rolling seven-day maximum, supported planning modes and `futureEstimatesSupported=false`, `trafficAware=false`, `status=BASELINE_ONLY`.

`POST /api/routes` and `/api/ar/routes` accept `mode` (`LEAVE_NOW`, `LATER_TODAY`, `FUTURE_DATE`) plus an offset-bearing `departureAt` for scheduled requests. Legacy calls default to Leave Now. Later Today must use today's Sri Lankan date; Future Date begins tomorrow. Past timestamps, invalid/missing offsets, contradictory modes and times beyond now + 168 hours fail before calling public providers. Exact horizon endpoints are inclusive. Server validation is authoritative even when browser clocks differ or selections expire.

Responses attach a validated `departure` context but keep `estimateKind=BASELINE_ROUTING_ESTIMATE`; OSRM receives no fabricated traffic parameter. Distances/durations are not changed by departure. No departure-specific arrival time is displayed. AI scenarios can reuse the chosen time only after navigating to the explicitly fictional catalog; they do not represent actual routed segments. Scheduled AR uses map planning and suppresses directional camera recommendations. Existing compass/GPS cannot establish future conditions.
