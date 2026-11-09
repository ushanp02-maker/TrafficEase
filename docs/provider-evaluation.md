# Provider evaluation record

Status: preliminary; no provider selected for production, paid account created or credentials added. Evaluation on 2026-11-09. This record does not establish traffic coverage.

## OSRM baseline-routing candidate

Official source read successfully: [OSRM README](https://github.com/Project-OSRM/osrm-backend/blob/master/README.md). It describes Route as finding the fastest route between coordinates and links its [HTTP contract](https://github.com/Project-OSRM/osrm-backend/blob/master/docs/http.md) and [demo-server usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server).

Implications: alternatives from its fastest-route service must not be called a globally shortest path. No evidence from this inspection establishes live traffic, seven-day forecasts, Sri Lankan coverage completeness, production entitlement, availability guarantee or licensed map-display compatibility. Those remain evaluation gates.

A single read-only development probe attempted:

```text
GET https://router.project-osrm.org/route/v1/driving/79.8612,6.9271;79.8378,6.8433?overview=false&alternatives=true
```

Observed result: `curl: (56) CONNECT tunnel failed, response 403`, with no upstream response (`HTTP status: 000`). Current cloud policy is enforced/restricted and does not list `router.project-osrm.org`. No route result, distance or duration was obtained. This is an environment access blocker, not evidence that the roads or provider are unavailable. No attempt was made to bypass the proxy or change environment configuration.

Next: permit `router.project-osrm.org` in environment Internet access settings for evaluation, recheck the policy and retry a fresh request. Review demo terms before further probes, then perform the small representative nationwide coverage matrix in `milestones.md`. If unsuitable, select another licensed engine or evaluate self-hosting with Sri Lankan road data. Do not fabricate routes while access is blocked.

## Other pending decisions

- Geocoding: evaluate a Sri Lanka-capable source, language/name support, country validation, rate limits and caching terms. Public Nominatim is a candidate, not yet selected or verified; its usage policy must be reviewed before calling it or designing autocomplete.
- Basemap: verify attribution, tile usage and compatibility with the selected routing provider before adding requests.
- Traffic/current/future estimates: no provider credentials are configured in the inspected environment. Evaluate Google Routes or alternatives against Sri Lankan geographic and temporal coverage, fees and storage/display restrictions. No traffic-aware or seven-day claim is supported yet.
- Weather: select a source with appropriate historic/forecast horizon and license before using future weather as a model feature.

## M1 update

The original CONNECT 403 OSRM blocker is resolved. OSRM routing, developer-approved public Nominatim and standard OSM tiles are now integrated for this single-instance coursework prototype, with policy limits and attribution. Nominatim/tiles remain denied by the cloud allowlist; live end-to-end search/map validation is pending. See [M1 provider decisions and verification](m1-routing.md) and [coverage evidence](m1-coverage.md). Earlier notes above are historical; they do not describe the current OSRM connectivity status.
