# Implementation matrix — 11 November 2026 (Asia/Colombo)

All changes remain on `vidura`. No AWS resource/credit, commercial traffic account, public certificate order or real-device measurement was used. The coursework deadline is **13 November 2026**; this report describes evidence, not a promise that external validation can be completed automatically.

| Area | Implemented and demonstrated | Experimental / unsupported / external gates |
| --- | --- | --- |
| Dashboard and navigation | Consistent navy/yellow responsive interface; working planner, AI and AR navigation; shared journey context | No unnecessary admin/decorative pages or personal-account system |
| M1 locations/routes | Nationwide Sri Lankan search scope, real OSRM geometry/distances/baseline durations, alternative comparison when returned, excessive-snap errors, attribution/global limits | Sampled coverage is not nationwide completeness; OSRM may return one route; no true shortest-distance objective or live traffic |
| M2 departure planning | Leave Now, Later Today, Future Date; authoritative Asia/Colombo validation through exactly seven days; evening planning, midnight/offset/past tests; context sent through normal and GPS-origin route APIs | Baseline route values do not vary with departure; verified traffic-aware/current/future estimates unavailable; no future ETA |
| M3 forecasting | Existing reproducible Random Forest preserved; model regenerated/loaded on AL2023; user weather/holiday scenarios, version/evaluation UI; journey time can be reused | All forecasts EXPERIMENTAL/SYNTHETIC; fictional targets cannot be mapped to actual OSRM segments; no speed/ETA/savings inference or real traffic validation |
| Database | Optional MySQL 8 profile, Flyway V1, two connections, explicit opt-in shared synthetic history, UTC timestamps, source/category constraints, capacity/retention, disabled/unavailable states | Off by default; no precise GPS or observed traffic stored; no personal identities; physical expiry deletion waits for next read/save; EC2/off-host restore validation still manual |
| M4 AR | Existing rear camera/GPS/heading/geometry prototype retained; permission/cleanup/uncertainty/map tests; shared departure context; scheduled trips use map planning only | Approximate sensor HUD, not camera road recognition/world anchoring/validated turn-by-turn; Android/iOS field alignment and safety checks outstanding |
| AL2023 deployment | Primary scripts use dnf/Corretto 17/Python 3.12, AL Nginx layout, systemd, Certbot venv/timer, secure env, immutable releases/rollback/health, optional pinned MySQL container; Ubuntu retained separately | Actual AL application tests pass, but native dnf install and final-path lifecycle need revalidation after repository access; actual EC2 boot/SG/SELinux/limits/public TLS not tested |
| Cost/operations | 2 vCPU/4 GiB/30-GiB encrypted gp3 estimate, Standard credits, minimal services, backup/rollback/update/stopping guidance | Credit balance/eligibility and current regional price must be verified by account holder; stopped EBS/IP/snapshot charges can persist |

## Completion estimate

**Approximately 80% of the broader coursework delivery/readiness target**, as a planning estimate, not a measured product-quality statistic. The transparent weighting is: M1 baseline routing 20/20, M2 scheduled context/provider capability 10/15, M3 synthetic demonstration 20/20, M4 prototype/device validation 12/20, optional persistence 10/10, deployment/operations validation 7/15 = 79/100, rounded. Other weighting could reasonably change that estimate. It does **not** mean 80% of a production nationwide traffic-prediction system is validated.

The demonstrable software flows are implemented. The remaining gap is mainly **external evidence and real data**: licensed Sri Lankan traffic/future coverage, native AL package installation/real-host validation, public trusted TLS/renewal, backup restore and physical smartphone tests. Real traffic-model validation requires observations and cannot be made complete by adding fictional data or UI pages. Full AWS launch remains deliberately unperformed.

Before the deadline, prioritize validating one small host and a real phone, preparing a clear demonstration of genuine baseline routes plus separately labeled synthetic forecasts, and recording any unavailable providers. Do not spend remaining credits on extra infrastructure or conceal unsupported capabilities.

See [current validation](ec2-validation.md), [manual launch steps](ec2-deployment.md), [provider review](m2-provider-review.md), [persistence](persistence.md) and [M4 real-device checklist](m4-ar-navigation.md).
