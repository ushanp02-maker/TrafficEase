# TrafficEase development specification

The user's updated nationwide specification is authoritative. Scope: Sri Lanka nationwide, with honest limitations wherever geographic, traffic or AI data is unreliable. Working branch `vidura`; preserve the established design and never modify `main`.

| Area | Required behavior | Acceptance evidence |
| --- | --- | --- |
| Geographic coverage | Search and select origins/destinations across Sri Lanka; no Colombo-only filter | Real geocoding and routing checks across provinces; unsupported-region states |
| Forecast period | Today through seven days ahead, in Asia/Colombo | Boundary tests including past times, midnight and exact seven-day horizon |
| Journey modes | Leave Now, Later Today, Future Date | A 10 AM user can select 7 PM the same day; unsupported provider futures labeled |
| Route objectives | Compare by genuine duration and distance; fastest and shortest can coincide | Independent minimum/tie tests and honest optimization scope |
| Information source | Separate current traffic, provider futures, baseline estimates, experimental AI and UI samples | Visible source/time/coverage labels on each result |
| No fabricated routing | No invented road geometry, times, alternative routes or savings | Upstream failure/empty response never generates sample results in genuine mode |
| AI | Python/FastAPI/Scikit-learn; road/history/time/weekday/weather features when available | Versioned training, evaluation and coverage metadata; untrained/unsupported states |
| Synthetic data | Clearly experimental; no actual Sri Lankan traffic validation claim | Labels on dataset, inference response, evaluation and UI |
| Live information | Show only licensed usable traffic observations | Timestamp, provider, stale/no-data/error states |
| AR | Permissioned camera, GPS, heading and mapped road candidates | Real-device tests, destination/departure context, directional uncertainty and fallback |
| AR safety | Stationary users/passengers; GPS alone is not road recognition | Explicit entry guidance and no misleading sensor claims |
| Responsive frontend | React/Vite/Tailwind, preserve navy/yellow design | Desktop/mobile browser and accessibility checks |
| Backend/data | Java 17/Spring Boot, MySQL 8 | JDK 17 build/tests, migrations and provenance constraints |
| Cloud | AWS architecture suitable for later deployment | Cost/security/operations review before resource creation |

Not all requirements are implemented. Existing Colombo samples are illustrations only. Delivery status and gates are in [milestones.md](milestones.md).
