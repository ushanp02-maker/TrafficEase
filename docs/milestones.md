# Delivery milestones

Complete one functional slice at a time. Commit tested work on `vidura`; never merge into `main` without a new instruction. Existing foundation and navy/yellow design are retained, not reapplied. This roadmap does not authorize environment publication, paid services or AWS provisioning.

## M0 — Architecture and delivery plan

Deliver authoritative nationwide requirements, component/data-flow design, provenance and departure-time contracts, provider evaluation gates and milestones. Inspect actual repository capabilities and distinguish design from implementation.

Status: documentation completed. Runtime remains the existing demo foundation.

## M1 — Nationwide search and genuine route calculations (first functional milestone)

1. Evaluate/select geocoder, road-routing engine and compatible map display; record terms, pricing, attribution, coverage and limits. Verify actual configured access without exposing credentials. Use a suitable no-cost development option where its terms permit; no assumed entitlement to public demo servers.
2. Implement Java provider adapters and validated API contracts, with country validation, timeout/quota/error handling and clear capability reporting. Do not route solely between typed labels: require selected geographic results.
3. Connect the existing frontend location inputs to user-triggered nationwide search; render genuine route geometry on a suitable map and show only genuine returned durations/distances.
4. Rank duration/distance independently, handle identical winners/ties and label the scope as among returned candidates. Support a dedicated shortest-distance objective only when the engine provides it.
5. Keep UI demonstration mode visually separate. Expose traffic/future capabilities honestly; baseline routing is not live traffic. Do not add fabricated congestion or departure-based duration adjustments.

Acceptance: real searches and routes for representative journeys in Western, Central, Southern, Northern, Eastern, North Western, North Central, Uva and Sabaragamuwa provinces. Candidate pairs include Colombo–Negombo, Kandy–Matale, Galle–Matara, Jaffna–Point Pedro, Trincomalee–Batticaloa, Kurunegala–Puttalam, Anuradhapura–Polonnaruwa, Badulla–Bandarawela and Ratnapura–Kegalle. These are test cases, not claims of verified coverage. Add cross-province journeys and Sinhala/Tamil name checks where supported. Record source/time/results and any misses; do not overstate coverage from sampled successes.

Automated tests cover parsing, coordinates/country checks, no-route responses, single/multiple alternatives, identical winners, ties, invalid numbers, upstream timeouts/quota failures and stale frontend requests. Browser checks cover search selection, map/results, loading/no-data/error states and mobile layout. External smoke checks must be identified separately from fixtures.

Status: M1 integration implemented and automated checks pass; live geocoding/tiles acceptance checks remain blocked by the cloud allowlist. OSRM is reachable, with nine sampled province-level probes documented in [m1-coverage.md](m1-coverage.md). See [m1-routing.md](m1-routing.md) for endpoints, policies, test results and pending checks. No credentialed traffic provider is configured.

## M2 — Departure planning and licensed traffic information

Add Asia/Colombo Leave Now/Later Today/Future Date controls and server validation through seven days. Integrate verified current/future provider estimates and a live-information view when supported. Include explicit regional/time limitations; never infer traffic support from baseline routes. Keep source labels on every duration.

Acceptance: deterministic time tests, 10 AM → 7 PM, local midnight, past/expired selections, horizon endpoints, unsupported forecast periods, stale feed data and real provider smoke evidence. No claim of seven-day provider forecasts without provider support.

## M3 — Experimental congestion forecasts

Create labeled synthetic scenarios, reproducible training/evaluation, model registry and inference API; connect nationwide road/region/time forecast UI. Add weather provenance and coverage/OOD handling. Keep forecasts separate from provider journey durations. Prepare migrations for actual observations without claiming they already exist.

Acceptance: dataset/model provenance, leakage-aware evaluation, metrics and synthetic-only caveats; tests for missing features, unsupported regions, seven-day limits and untrained model; later real-data validation is a separate gate.

## M4 — AR contextual recommendations

Prototype camera/GPS/heading lifecycle and mapped candidate-road selection; reuse destination/departure and routing contracts. Overlay supported information only when alignment is reliable. Add manual/map fallback and stationary/passenger guidance.

Acceptance: Android/iOS HTTPS testing with permissions granted/denied, compass absent, poor/stale positioning, ambiguous roads, current/future labels, stream cleanup and no invented time savings. Camera permission or a visual overlay alone does not complete AR navigation.

## M5 — Persistence, administration and deployment readiness

Introduce versioned MySQL migrations, permitted observations, authenticated road/forecast administration and audited data quality. Harden services and operational readiness. Evaluate AWS cost, IAM, networking, monitoring, backup and recovery before a separately authorized deployment.

Acceptance: migration/integration tests, admin access controls, retention/license policy, readiness probes, rollback and reproducible release checks. No AWS resources are created as part of architecture planning.
