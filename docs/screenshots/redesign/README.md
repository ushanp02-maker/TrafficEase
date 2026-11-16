# Redesign browser evidence

Captured with headless Chromium/Playwright on the local application. These are interface/test artifacts, not an AWS deployment, official government system or real-device AR evidence.

- [Home desktop](home-desktop.png) / [mobile](home-mobile.png): landing hero appears only on `/`.
- [Route planner](route-planner-desktop.png): dedicated map workspace; donated tile requests were intentionally aborted in browser tests, with an honest unavailable-background state. No sample routes are substituted.
- [AI page](ai-predictions-desktop.png) / [actual local synthetic result](ai-actual-synthetic-result-desktop.png): experimental classifier, not real traffic.
- [AR workspace](ar-navigation-desktop.png): camera off and map fallback; no physical alignment claim.
- [Citizen empty notices](announcements-desktop.png) / [published browser-created test notice](announcements-published-desktop.png).
- [Government login](government-login-desktop.png), [dashboard](government-dashboard-desktop.png), [analytics](government-analytics-desktop.png), [alert management desktop](government-alerts-desktop.png) / [mobile](government-alerts-mobile.png).

The government workflow used a random, temporary test credential outside Git; it is discarded after testing. Demand/corridor chart numbers are explicitly fictional, not inferred from AI history or real journeys. Notice counts reflect administrator-created test records. Screenshots contain no passwords, session cookies or actual GPS history.
