# Consumer journey experience

TrafficEase now leads with planning a journey, comparing routes and checking traffic categories. The navy/white/yellow branding remains. Framework descriptions, training explanations and repeated warnings have moved out of the main consumer flow.

## Pages

- **Home**: working start/destination/departure form, Find My Route, route map and short benefits. A Simulation launch embeds the supported-journey workflow so the demonstration starts on Home without external providers. Normal launch retains unrestricted nationwide search.
- **Plan Journey** (`/navigation`): nationwide explicit location search, compact departure controls, clickable baseline route cards and a large geographic map. An unsuccessful provider request shows a short retry message and a link to deliberately switch to simulation.
- **Traffic Predictions** (`/ai-predictions`, also `/route-forecasts`): mapped-journey selection by From/To, automatic weather online, collapsed advanced manual-weather controls, loading skeletons and a result dashboard. It displays selected congestion category, distance, baseline duration, weather indicator, real available alternatives and an abstaining or experimental suggestion. The map highlights the selected candidate.
- **Independent research tool** (`/research/scenarios`): preserves the older model, evaluation/history controls and endpoints. It is accessible through secondary links, not the main citizen navigation.
- **AR Navigation**: camera/route interface, essential stationary/passenger safety guidance and concise map fallback. Sensor/provenance explanations are in Help. Existing permissions, road matching, uncertainty gates and cleanup are retained. Desktop simulation does not validate real-world smartphone alignment.
- **Traffic Alerts**: filterable notice feed with timestamps and small DEMO / NOT OFFICIAL labels. No invented notices are inserted on provider/storage failure.
- **About**: traveller benefits and accessible source/limitation disclosures.
- **Administration**: discreet sign-in, existing server authentication/authorization/CSRF and actual publishing/edit/withdraw workflows. The dashboard/charts remain labeled as demonstration information; no government affiliation or measured citizen demand is claimed.

## Sources and expected failures

Consumer errors are short, contextual and retryable. Raw upstream messages, stack traces and model-not-trained diagnostics are not rendered on consumer pages. This is paired with actual model preparation, internal health/inference checks and genuine fallback modes; failed requests never receive fabricated successful forecasts. Detailed source context remains accessible through native keyboard-accessible details controls and internal documentation. Technical evaluation is available in the research tool.

Congestion is always experimental/synthetic. Duration is baseline (or recorded baseline in simulation), never a traffic-adjusted or verified future ETA. Suggestions are only made when the unchanged comparison algorithm establishes sufficient synthetic differentiation. Otherwise the UI says no clear congestion advantage. Geometry is genuine returned OSRM geometry online, or genuine archived OSRM geometry when the user selects simulation. Shortest means among returned candidates only.

## Complete, opt-in simulation

`POST /api/route-forecasts` accepts optional `dataMode: "LIVE" | "SIMULATION"` (default LIVE; existing request bodies remain compatible). Simulation reads the version-controlled observations packaged into the Java JAR as `experimental/routing-observations.json`. Each route is validated with the same route parser and 300 m snapping checks. The original capture timestamp and `RECORDED_OSRM_DEMONSTRATION` source are retained; playback never masquerades as a fresh provider request.

Scenario weather is a deterministic choice among CLEAR, RAIN and HEAVY_RAIN using journey ID, Colombo hour and weekday. Java’s defined String hash and fixed modulo mapping make repeated identical contexts reproducible. There are no invented precipitation measurements or forecast timestamps. The weather source/status is `DEMONSTRATION_SCENARIO` / `SIMULATED`, and Open-Meteo is not credited as supplying simulation weather.

The actual separately trained FastAPI model then predicts each recorded candidate. Its loading, feature validation, classifier, probabilities, burden/ranking thresholds and abstention logic are unchanged. Missing model/service returns an unavailable result, not a hard-coded category. The old scenario model remains separate and working.

The simulation map uses a geographic coordinate grid and archived real route lines, with normal pan/zoom/selection and attribution. No OSM tile download or cache is required, and no fictitious basemap/alternative road is invented. The Online map continues to use OpenStreetMap tiles with an honest tile-unavailable state. Public Nominatim remains explicit-search-only with rate limits; there is no new geocoder autocomplete or recurring collection job.

## Startup and portability

[One-command Windows startup](windows-startup.md) installs application dependencies, prepares both missing models, builds Java 17, starts private Java/FastAPI services plus Vite, checks both model paths and runs all 30 recorded journeys. `prepare_models.py` writes generated reports under ignored artifacts instead of modifying committed evaluation evidence. UTF-8 I/O fixes Windows locale-sensitive catalog loading. Legacy internal AI HTTP uses explicit HTTP/1.1 to avoid unnecessary upgrade warnings.

AWS deployment configurations, optional MySQL, model versions/accuracy reports and provider APIs are preserved. Maven additionally packages the recorded observations into the backend JAR. No AWS deployment, resource creation, purchases or paid API enablement occurred.

See [validation and screenshots](consumer-redesign-validation.md).
