# Multi-page redesign and government demonstration — 16 November 2026

## Implementation and page structure

The earlier `useState(page)` screen switch and shared large hero have been replaced with React Router URL routes. The hero and introductory technology/citizen–government sections exist only in `Home.jsx`; application tools are not rendered on Home. Shared header/footer, an accessible mobile menu, active links, route-specific titles, main-content focus, a skip link and reduced-motion support provide consistent navigation without reusing the landing composition.

| URL | Dedicated page |
| --- | --- |
| `/` | Navy/yellow landing page, original conceptual road illustration, CTAs, AI/AR/cloud overview |
| `/navigation` | Genuine route planner, departures, geographic map and scoped comparisons |
| `/ai-predictions` | Scenario dashboard, category indicator, actual model evaluation meters and optional history |
| `/ar-navigation` | Camera-focused smartphone workspace, sensor status, safety guidance and manual map fallback |
| `/traffic-information` | Published demo notices, category/province filters, event/publication times and details |
| `/about` | Architecture and explicit capability boundaries |
| `/government/login` | Separate government-demo authentication, disabled until configured |
| `/government/dashboard` | Admin-created notice counts, recent notices, audit activity and labeled fictional demand/corridor illustrations |
| `/government/analytics` | Separated notice counts and synthetic chart illustrations; actual mobility collection disabled |
| `/government/alerts` | Create/edit drafts, publish/withdraw, affected area, province, category and relevant date window |

Browser back/forward and direct URLs/refresh use the router. Unknown routes have a dedicated not-found view. Both Nginx configurations retain `try_files $uri $uri/ /index.html` and disable API proxy caching; refreshed government URLs load the SPA but receive no administrative data until server authorization succeeds.

Reusable M1/M2/M3/M4 components and backend contracts remain in use. No route, congestion feed, future ETA, model statistic or camera recognition capability was invented. Model evaluation visualizations read the actual metadata endpoint; the classifier/dataset are unchanged. Real-device AR alignment remains unvalidated.

## Government security and operator setup

This is **not a real government system**. The portal is a role-protected coursework demonstration with one operator-provisioned account. There is no hardcoded/default login and no real government affiliation. Public notices always retain their DEMO / NOT OFFICIAL labels.

The server uses Spring Security, bcrypt (accepted cost 10–14; provisioning tool uses 12), HTTP-only session cookies, SameSite Strict, 20-minute idle expiry, session-ID rotation at login, explicit role authorization, logout invalidation and CSRF protection on government mutations including login/logout. Only the existing public route/AR-route/forecast POST contracts are exempted from CSRF. No JWT/password/session credential is written to localStorage or frontend code. The CSRF token is kept in memory and refreshed after login/logout. HTTP Basic is **not** government authentication; Nginx's shared password is merely the outer demonstration access gate.

Five failed logins per source address within ten minutes trigger 429. The single-process limiter is bounded to 1,000 source entries; this is not a distributed identity/security platform. There is no self-service registration, official-account verification, MFA or multi-agency user management. Use a small trusted demonstration audience and HTTPS. Username/hash changes require restarting the backend, which also invalidates memory sessions.

On EC2, generate a hash privately using the built Java application in a **real terminal**, not a password command argument:

```sh
cd /opt/trafficease/current
/usr/lib/jvm/java-17-amazon-corretto.x86_64/bin/java \
  -Dloader.main=lk.trafficease.government.GovernmentPasswordTool \
  -cp backend/app.jar org.springframework.boot.loader.launch.PropertiesLauncher
```

The tool prompts twice without echoing the password. Use a strong unique password (14+ characters, at most 72 UTF-8 bytes). Keep its bcrypt hash outside Git. With `sudoedit /etc/trafficease/backend.env`, add **your own** username and privately generated hash:

```text
GOV_DEMO_USERNAME=your-demo-account
GOV_DEMO_PASSWORD_HASH="your-privately-generated-bcrypt-hash"
SESSION_COOKIE_SECURE=true
```

Keep root ownership/mode 0640. Replace placeholders; do not commit this host file. EnvironmentFile treats `$` in the bcrypt hash literally; do not execute these lines as an unquoted shell expansion. Restart `trafficease-backend`. Existing installations must explicitly add `SESSION_COOKIE_SECURE=true`; the installer preserves existing env files rather than overwriting them. For localhost HTTP development only, the secure-cookie flag defaults to false. Never use that setting for an internet-facing deployment.

For a local Maven-built JAR, use the same PropertiesLauncher command with your JDK 17 and `backend/target/trafficease-backend-0.1.0-SNAPSHOT.jar`; keep the resulting hash in your private local launch configuration. The frontend has no credential configuration.

## API and storage behavior

- `GET /api/government/session`: authentication/role/configuration status and session CSRF token. Anonymous users receive no username or privileged data.
- `POST /api/government/login`: URL-encoded username/password plus `X-CSRF-TOKEN` from the session endpoint. JSON errors, no redirect to an unrelated login page.
- `POST /api/government/logout`: CSRF-protected session invalidation.
- Role-protected `/api/government/announcements`: list/create; `PUT .../{id}` edits with the expected revision; `POST .../{id}/state` publishes/withdraws with an expected revision.
- Role-protected `/api/government/analytics` and `/api/government/audit` expose only the demo workspace's counts, labeled illustrations and recent audit records.
- Public `GET /api/announcements?category=...&region=...`: only published, unexpired notices; a province filter includes nationwide notices. Future events can be announced early and display their relevant dates. No records are seeded automatically. Invalid filters fail honestly.

Titles/body/areas, enums, timezone-bearing dates and 90-day event windows are validated. Revisions prevent stale overwrites; missing/expired/unauthorized states are explicit. All displayed notice text is plain React text, not injected HTML.

Default mode uses **volatile memory**: at most 500 notices and the latest 5,000 audit events, reset on backend restart. The UI clearly states this. Enable the existing `mysql` profile for persistent announcements/audit. Additive Flyway **V2** creates only `government_demo_announcements` and `government_demo_audit`; V1 synthetic history and legacy observations remain untouched. Announcement payloads enforce demonstration provenance. Update + audit share a transaction; failed audit insertion rolls back the change. SQL-backed audit records older than 90 days are purged on the next audit append; the API returns the latest 30. Committed events also go to structured application logs without passwords, request bodies or GPS. Login audit-storage failures emit a warning rather than silently granting an unofficial new role or blocking valid credential verification.

No precise GPS history or real citizen travel-demand collection was added. Demand/corridor charts use fixed, labeled fictional illustrations; actual notice counts are clearly identified separately. Synthetic AI prediction history is never treated as citizen mobility data.

## Local development and redeployment

```sh
npm ci --prefix frontend --cache /workspace/.cache/npm
npm run dev --prefix frontend
# Separate terminals:
(cd backend && mvn spring-boot:run)       # JDK 17
(cd ai-service && .venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000)
```

The cloud-specific Maven proxy/JDK instructions in [cloud setup](cloud-setup.md) still apply here. Configure the government credentials privately before starting Java if testing admin pages. Without them, all existing public tools remain usable and the login page explains that demo sign-in is disabled.

For an already authorized EC2 host: back up the optional database, review the `vidura` revision and run `bash infra/ec2/update.sh`. It builds the new frontend/backend/model and activates the release. With `mysql` enabled, V2 runs automatically. Keep V2 when rolling back; it is additive. Configure the government account and secure-cookie flag privately, restart the backend, and check HTTPS login/CSRF/citizen visibility. Reapply reviewed proxy changes separately; updates do not overwrite live Nginx/env files. Do not overwrite unrelated sites or open internal ports.

No AWS instance, public certificate, paid service or real government account was created during this task. The [AL2023 guide](ec2-deployment.md) remains the launch procedure; native installation/actual EC2 boot/SELinux/public TLS renewal gates remain separate from local application and Nginx validation.

## Validation and evidence

See [redesign validation](ui-redesign-validation.md) for actual counts and limitations. [Screenshots](screenshots/redesign/README.md) cover desktop/mobile landing, dedicated tools, test notices and the authenticated demo workspace. They do not establish real traffic accuracy or smartphone alignment.
