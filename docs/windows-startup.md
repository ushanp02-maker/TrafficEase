# Start TrafficEase on Windows

From the `TrafficEase` repository folder on branch `vidura`, open PowerShell and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-TrafficEase.ps1 -Simulation
```

The execution-policy option applies only to this process; it does not change the machine’s persistent policy. If your organization restricts scripts, follow its rules rather than changing system policy.

This prepares the application, verifies both trained models, checks actual inference for all 30 recorded journeys and opens **http://localhost:5173**. Home opens with a working supported-journey form in Simulation mode. Choose a starting point/destination, then **Find My Route**. Traffic Predictions has the full **Predict Traffic** workflow. Nothing is deployed to AWS and no paid services are enabled.

Install these prerequisites once, then reopen PowerShell so PATH is refreshed:

- Windows 10/11 x64 with Windows PowerShell 5.1 or PowerShell 7.
- A complete **JDK 17**, with JAVA_HOME and PATH pointing to that JDK (both java and javac are checked).
- Maven 3.9+ (`mvn.cmd` available through PATH).
- Node.js 22.12+ and npm.
- Python **3.12**, available as `py -3.12` or `python` through PATH.

The first preparation needs internet access for Maven/npm/Python packages. Runtime simulation works without public geocoding, routing, weather or map tiles once dependencies are installed. It still requires the local Java and Python services; missing inference never becomes a fabricated successful prediction.

To stop the application:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-TrafficEase.ps1 -Stop
```

To use online providers by default, omit `-Simulation`. You can also switch Online/Simulation explicitly inside Traffic Predictions. Online mode needs Nominatim, OSRM, OpenStreetMap tiles and Open-Meteo connectivity. Congestion remains experimental/synthetic in either mode. Online durations remain OSRM baseline estimates. Open-Meteo access is currently blocked in the managed cloud environment; simulation provides a complete working alternative without representing scenario weather as a real forecast.

Useful options:

| Option | Purpose |
|---|---|
| `-Simulation` | Opens Home and Traffic Predictions in explicitly labeled simulation mode. |
| `-NoBrowser` | Starts and verifies services without opening the default browser. |
| `-SkipInstall` | Reuses an already prepared venv and frontend dependencies; models and backend are still checked/built. |
| `-Stop` | Stops only the recorded process trees after checking identity. |

The launcher refuses occupied ports or an existing saved session instead of attaching to unrelated processes. It records process identities under ignored `.local-run/`, keeps logs there and runs Java from a private run-specific JAR copy so a later build cannot corrupt a running classpath. It starts Vite directly with Node in non-interactive mode. This prevents the development server from exiting when the startup command returns.

Both models are loaded and integrity-checked before service startup. Missing or incompatible artifacts are regenerated through the existing reproducible training functions; outputs and startup evaluation reports go to ignored artifacts folders. The checked-in evaluation reports and model algorithms are preserved. Explicit UTF-8 catalog/metadata I/O avoids Windows locale failures. The locked Python dependency set includes the timezone database needed for Asia/Colombo on Windows.

If preparation fails, inspect `.local-run/setup.log`. Runtime logs are `ai.log`, `ai.err.log`, `backend.log`, `backend.err.log`, `frontend.log` and `frontend.err.log` in the same folder. Do not publish logs containing private environment settings or personal journey locations. No password or default government account is created. Administration sign-in uses the existing operator-configured environment credentials; instructions are in `ui-redesign.md`.

For camera testing, localhost is a browser secure context. A phone opening a laptop’s LAN HTTP address needs trusted HTTPS for camera/sensor access. Existing DEV_HTTPS_CERT and DEV_HTTPS_KEY settings remain supported; when configured, the launcher uses **https://localhost:5173** and validates its certificate normally. Do not disable TLS checks. See `m4-ar-navigation.md` for real-device and certificate requirements.

**Validation boundary:** the script was parsed and exercised end-to-end using PowerShell 7 on this Linux cloud machine, with real Java 17, FastAPI, Vite and trained models. Start, readiness, all 30 journeys, browser rendering, process persistence, stop/restart, occupied-port rejection and unrelated-PID protection were tested. A native Windows machine and default Windows browser launch were not available; those platform-specific checks remain manual. The script uses PowerShell 5.1-compatible syntax and Windows .cmd/process-tree handling, but Linux testing is not proof of native Windows execution.
