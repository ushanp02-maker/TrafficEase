# TrafficEase foundation
React/Vite + Tailwind presents a Sri Lankan journey-planning demo. Spring Boot owns future routing and persistence APIs; FastAPI will own experimental congestion models. MySQL 8 stores registered roads, observations and predictions with explicit provenance. Services are intentionally independent in this milestone.

No route provider, model training, admin authentication, GPS, camera or AR integration is implemented yet. Future Google Routes evaluation must establish Sri Lankan coverage, billing and storage permissions. Provider travel times and experimental predictions must remain separate in both API contracts and the UI.

Future AR.js/A-Frame guidance must combine GPS, device orientation and mapped road geometry, expose uncertainty and provide a map fallback. GPS alone does not visually recognize roads. Camera features require HTTPS, permissions and real-device testing; design for stationary users or passengers.

Future AI training uses explicitly synthetic Sri Lankan scenarios, evaluates held-out data and records model version and provenance. Synthetic performance is not validation against actual Sri Lankan traffic. Administration will require authenticated access before exposing or editing real observations.
