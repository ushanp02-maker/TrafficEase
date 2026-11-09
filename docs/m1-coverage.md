# M1 sampled OSRM coverage

Checked 2026-11-09T17:08:32Z. These are serial real OSRM driving requests from **manually selected approximate town coordinates**, not Nominatim search results. All nine responses were HTTP 200 / `Ok`. This sample does not prove full provincial or nationwide coverage, traffic accuracy, accessible entrances or geocoding quality.

| Province | Sample journey | Returned routes | Endpoint snapping (m) | Meets 300 m limit? |
| --- | --- | --- | --- | --- |
| Western | Colombo–Negombo | 1 | 2.1 / 12.4 | Yes |
| Central | Kandy–Matale | 1 | 51.6 / 5.9 | Yes |
| Southern | Galle–Matara | 1 | 21.7 / 12.4 | Yes |
| Northern | Jaffna–Point Pedro | 2 | 41.1 / 32.4 | Yes |
| Eastern | Trincomalee–Batticaloa | 1 | 502.2 / 174.0 | No — app would reject |
| North Western | Kurunegala–Puttalam | 1 | 3.9 / 31.6 | Yes |
| North Central | Anuradhapura–Polonnaruwa | 1 | 2.5 / 16.2 | Yes |
| Uva | Badulla–Bandarawela | 1 | 60.8 / 2.7 | Yes |
| Sabaragamuwa | Ratnapura–Kegalle | 1 | 10.8 / 4.0 | Yes |

The Eastern probe must be repeated with a road-accessible selected start: its approximate Trincomalee coordinate snapped 502.2 m. This is a safety/accuracy rejection, not evidence that all Eastern roads lack coverage. The earlier 2776 m snapping case is independently covered by a regression test. Baseline durations are never current traffic estimates.

Reproduce cautiously with `python scripts/check-routing-coverage.py --output /tmp/coverage-new.json`. The helper reuses an existing output file rather than repeating requests; do not automate periodic or parallel probes against the public service. Input coordinates are recorded in the helper.
