# Verified mapped-journey catalog and routing evidence

Recorded 18 November 2026 (Asia/Colombo). These are one-time public-provider observations, not a promise of future availability or nationwide completeness. All 35 unique endpoints were resolved through Nominatim with country filter LK, reviewed for ambiguous city/district/landmark matches and saved with OSM IDs and source URLs. All 30 journeys returned OSRM routes; 12 returned two candidates, 18 one (42 total). No provider failures were replaced with examples.

Endpoint selections are named-place/transport-landmark coordinates, not field-surveyed entrance positions. Pettah uses the mapped private bus station (rejecting the floating pier and unrelated businesses); Piliyandala uses its clocktower (rejecting the playground/commercial matches); Colombo Fort and Panadura use railway-station landmarks, not district centroids or platforms. The catalog records the exact selected landmark for every place. Other ambiguous town/district candidates were reviewed explicitly.

| Journey | Returned candidates | Maximum endpoint snap (m) |
|---|---:|---:|
| Pettah → Piliyandala | 2 | 6.7 |
| Pettah → Avissawella | 1 | 17.2 |
| Pettah → Homagama | 2 | 7.3 |
| Pettah → Kaduwela | 2 | 5.6 |
| Pettah → Maharagama | 2 | 10.3 |
| Pettah → Moratuwa | 2 | 60.0 |
| Pettah → Panadura | 2 | 31.9 |
| Pettah → Negombo | 1 | 5.3 |
| Colombo Fort → Kandy | 2 | 11.3 |
| Colombo Fort → Gampaha | 1 | 8.6 |
| Nugegoda → Piliyandala | 1 | 6.7 |
| Nugegoda → Kottawa | 2 | 40.4 |
| Maharagama → Homagama | 1 | 10.3 |
| Kottawa → Kadawatha | 1 | 40.4 |
| Kaduwela → Malabe | 1 | 5.6 |
| Battaramulla → Colombo Fort | 1 | 8.6 |
| Dehiwala → Panadura | 1 | 31.9 |
| Kesbewa → Moratuwa | 1 | 60.0 |
| Panadura → Kalutara | 1 | 47.9 |
| Negombo → Katunayake | 1 | 5.3 |
| Kandy → Peradeniya | 1 | 11.3 |
| Kandy → Kurunegala | 1 | 11.3 |
| Gampaha → Nittambuwa | 1 | 59.8 |
| Galle → Matara | 2 | 3.5 |
| Matara → Tangalle | 2 | 65.0 |
| Ratnapura → Avissawella | 1 | 17.2 |
| Kurunegala → Anuradhapura | 2 | 10.7 |
| Badulla → Ella | 1 | 14.2 |
| Jaffna → Kilinochchi | 2 | 31.3 |
| Trincomalee → Batticaloa | 1 | 27.2 |

All recorded endpoint snap distances are under the runtime 300 m limit. Runtime requests re-check provider offsets AND independent geodesic distances, addressing the earlier ~2.8 km snap failure. Returning a single route means no verified alternative; even with two, OSRM optimizes its routing profile, not a true minimum-distance objective. Fastest/shortest labels refer only to returned candidates.

## Provenance, storage and reproducibility

- Canonical application catalog: `backend/src/main/resources/experimental/journeys.json`.
- Full reviewed geocoder candidates: `data/journeys/place-candidates.json`.
- Compact genuine route geometries and response metadata: `data/journeys/routing-observations.json`. These are evidence/training inputs only, never an outage fallback.
- © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright . Geocoding: Nominatim. Routes: OSRM public demonstration service. Preserve attribution and assess ODbL obligations before distributing a substantially expanded derived database.
- Operator-only scripts in `scripts/journeys/` use serial 1.3 s spacing and saved responses. Do not run them on startup, in tests or as recurring bulk jobs. Public Nominatim has already been deliberately selected for this small noncommercial coursework prototype; no autocomplete. Public-service policies/terms can change.
- To repeat a reviewed collection deliberately: `python scripts/journeys/collect_places.py`, review candidates/selections, `python scripts/journeys/create_catalog.py`, `python scripts/journeys/collect_routes.py`, then regenerate catalog verification metadata. Scripts reuse cached observations; deleting caches is an explicit operator action, not an automatic refresh. Retrain/re-evaluate when snapshots change.
- Service availability, road restrictions and map completeness vary; these checks do not establish safe navigation or national traffic coverage.
