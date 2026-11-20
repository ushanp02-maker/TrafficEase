# Team integration — 20 November 2026

Target: `main` only. Original remote `main` and protected `vidura` were both
`d1986002f69a8cf6276f781ff518a828445055c1`.

Before merging, the original main commit was pushed to
`backup/main-before-team-merge-20261120-034425` (suffix is UTC).

## Preserved history and conflict resolution

- Normal non-squash merge of `ishan` at `87640e7109b9cc69c533aa594c9334e0f69d9d41`: all 11 original commits retained.
- Then normal non-squash merge of `lahiru` at `870afbd782b0a4230b25811dca10b110594d1cb4`: both original commits retained.
- No rebase, cherry-pick, squash, force-push or author rewriting.
- RoutePlanner conflicts preserved the current consumer layout, existing labels, retry feedback and structured friendly API error codes. Ishan's null-safe error handling, Unicode search, identical-location guard, and route distance/duration/geometry validation were integrated.
- Lahiru's supported-target and Asia/Colombo forecast date validation merged without conflicts.
- The contributed browser test now targets the current Find routes control. Additional integration cases cover null/malformed route results, null HTTP error bodies, Sinhala/Tamil search and identical locations.
- The backend-to-AI PowerShell check explicitly requests recorded simulation and asserts its source. It still calls actual Spring Boot and FastAPI/model inference, without depending on public routing availability or misrepresenting simulation as current roads/traffic.

## Validation

- Java 17 Maven verify: 86 passed, zero skipped, including isolated MySQL 8.4 tests.
- Frontend unit tests: 55 passed.
- Full browser regression: 64 passed, zero skipped, including contributed route validation, consumer routing/AI, all-30-journey inference, administration, responsive layouts and hybrid AR simulation/cleanup.
- Production Vite build: passed (upstream React Router module-directive warnings).
- Python regression: 31 passed (one upstream Starlette/AnyIO deprecation warning).
- All four contributed PowerShell service/API/proxy/backend-to-AI checks: passed with local running services and PowerShell 7 on Linux. Native Windows execution remains a platform validation requirement.
- Actual-service application check: both trained models ready; all 30 journeys and 42 recorded candidates passed synthetic-provenance/inference checks.
- Portable deployment integrity regression: passed. No deployment was performed.

Browser sensors and provider fixtures are simulation tests, not physical smartphone alignment evidence. Existing live provider, weather and physical-device limitations remain documented in the previous validation reports. No AWS resource, configuration or deployment was changed; no credentials or generated model/build artifacts were added to Git.
