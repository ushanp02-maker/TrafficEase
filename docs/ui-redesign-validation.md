# Redesign validation — 16 November 2026 (Asia/Colombo)

All work is on `vidura`. No AWS resources, paid services, public certificate orders, real government accounts or citizen mobility collection were created.

## Executed application checks

| Check | Final successful result |
| --- | --- |
| Java 17 Maven verify | **66 tests passed, 0 failures/errors/skips**, including actual MySQL integration |
| Python/FastAPI tests | **15 passed**, one upstream Starlette/AnyIO deprecation warning |
| Frontend geometry/sensor/departure units | **24 passed** |
| Playwright/Chromium full suite | **36 passed**, including real local Java/FastAPI/government flows |
| Vite production build | Passed |
| Nginx configuration and HTTPS SPA fallback | Passed for **11 deep-link paths**, with trusted local TLS verification |
| Nginx → AL2023 Corretto 17 authentication integration | Secure session, role/CSRF, publication/withdrawal and logout checks passed |

Java tests cover anonymous 401, non-government role 403, missing CSRF, wrong credentials, Basic-header role bypass denial, session-ID rotation, logout invalidation, bounded failed logins, oversized login inputs, notice validation, expired publication rejection, category/province filters, draft invisibility, editing/revision conflicts, publication/withdrawal and audit records. Existing routing, forecasting, departure and no-DB regressions remain passing.

Real MySQL **8.4** tests applied V1/V2 and repeated migration safely, retained prior synthetic history behavior, persisted/reloaded announcements/audit, rejected missing/false demonstration provenance, and verified transaction rollback when an audit insertion fails. Government tables contain no credential/GPS columns. The SQL tests used a disposable local schema/user, not production data.

Browser tests verify direct URL/refresh of all citizen pages, Home hero exclusivity, actual link navigation/active state, back/forward, mobile menu behavior, 320/390/768/1440-pixel widths, notice filters/details/empty/error states, protected government URLs and the full real-server create → publish → citizen visibility → edit → withdraw → logout flow. Government layouts were also checked at those widths. A real local FastAPI result rendered its explicit synthetic labels and no-ETA limitations. Other routing/forecast/sensor tests use their existing controlled fixtures; this does not establish nationwide provider coverage or physical AR accuracy.

## Deployment checks and limits

An actual official Nginx container used the AL-style configuration, built React assets, an ephemeral locally trusted CA/hostname and password gate. HTTPS verification stayed enabled. `/`, all six citizen destinations, government paths and an unknown SPA path served the React entry point on refresh. Anonymous gateway access was denied; CSP and sensor headers remained present.

A separate Nginx/Corretto container pair sharing a private network namespace exercised the actual backend on **Amazon Linux 2023 / Corretto Java 17**. It verified the shared gateway password alone receives backend 401; session cookies carry Secure/HttpOnly/SameSite Strict; login rotates the session; missing CSRF receives 403; authenticated role operations publish and withdraw a demo notice visible to an unauthenticated citizen session behind the outer gate; logout removes privileges. Only loopback test ports were published. No host-network/proxy bypass or public CA order was used. One initial local probe timed out under concurrent test load; the completed probe with a realistic bounded read timeout passed.

Both deployment script sets passed Bash syntax checks and documentation links were checked. Native AL `dnf` installation, EC2 security groups/reboot/systemd/SELinux/resource limits, public DNS/certificate renewal and actual smartphone alignment are **not** newly validated by these local tests. Existing launch/cost/provider limitations remain in the [EC2 guide](ec2-deployment.md).

## Evidence and test isolation

See [screenshots](screenshots/redesign/README.md). Home, mobile menu/layouts, tool pages, actual local synthetic prediction, published test notice and government workspace were captured. Donated map-tile requests were aborted in browser regressions, resulting in an explicit map-background unavailable state rather than a fake basemap. No new public geocoder/router coverage sweep was performed; M1 component/API tests and earlier sampled live evidence remain the source for provider integration claims.

Testing found and fixed the initial government CSRF matcher, logout navigation timing and router-effect cleanup assertions. Rebuilding a JAR while the temporary server still used it caused test-harness class-loading failures; the final full browser run used an immutable JAR copy and frozen source. Final successful counts above exclude those failed intermediate runs. The normal deployment already uses immutable release paths.

Random test credentials, local TLS keys, session cookies and database passwords stayed outside Git and are removed with the temporary test services. No default government password was introduced. The operator must configure a private account before using the demo. Memory-only notices/audit reset on server restart; persistent records require the optional MySQL profile. Demand/corridor visuals are explicitly fixed synthetic illustrations, not actual trips or synthetic AI history reclassified as observed traffic.
