package lk.trafficease.routing;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

@RestController
@RequestMapping("/api/ar")
public class ArRoutingController {
    public record GpsOrigin(double latitude, double longitude, double accuracyMeters, long timestamp) {}
    public record Request(GpsOrigin origin, String destinationId, String mode, String departureAt) {
        public Request(GpsOrigin origin, String destinationId) { this(origin, destinationId, null, null); }
    }
    public record Candidate(String name, String routeId, Geometry geometry) {}
    public record Result(RouteResponse routing, List<Candidate> candidates, Location destination, String originSource, List<String> limitations) {}
    private final ProviderClient client;
    private final LocationService locations;
    private final String baseUrl;
    private record CountryCheck(boolean sriLanka, Instant expires) {}
    private final Map<String, CountryCheck> countries = new LinkedHashMap<>();
    public ArRoutingController(ProviderClient client, LocationService locations,
        @Value("${trafficease.routing-url}") String baseUrl) {
        this.client = client; this.locations = locations; this.baseUrl = baseUrl;
    }
    static void validate(GpsOrigin origin, long now) {
        if (origin == null || !LocationService.validCoordinates(origin.latitude(), origin.longitude())
            || !Double.isFinite(origin.accuracyMeters()) || origin.accuracyMeters() <= 0 || origin.accuracyMeters() > 30
            || origin.timestamp() < now - 15000 || origin.timestamp() > now + 5000)
            throw new ApiFailure(422, "GPS_UNRELIABLE", "Use a fresh Sri Lankan GPS fix with reported accuracy of 30 m or better, or select a manual starting point.");
    }
    @PostMapping("/routes")
    public Result routes(@RequestBody Request request) {
        if (request == null) throw new ApiFailure(400, "INVALID_REQUEST", "Provide a GPS origin and selected destination.");
        var departure = JourneyTime.resolve(request.mode(), request.departureAt(), java.time.Clock.systemUTC());
        GpsOrigin origin = request.origin(); validate(origin, System.currentTimeMillis());
        Location destination = locations.selected(request.destinationId());
        verifyCountry(origin);
        String coordinates = origin.longitude() + "," + origin.latitude() + ";" + destination.longitude() + "," + destination.latitude();
        JsonNode data = client.get("routing", baseUrl + "/route/v1/driving/" + coordinates
            + "?geometries=geojson&overview=full&alternatives=true&steps=true&generate_hints=false");
        Location start = new Location("gps", "GPS origin", origin.latitude(), origin.longitude(), "LK");
        RouteResponse routing = RouteService.parse(data, start, destination, 50).withDeparture(departure);
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < data.path("routes").size(); i++) {
            JsonNode route = data.path("routes").get(i);
            int included = 0;
            for (JsonNode leg : route.path("legs")) for (JsonNode step : leg.path("steps")) {
                if (included >= 8) break;
                JsonNode geometry = step.path("geometry");
                if (!"LineString".equals(geometry.path("type").asText()) || !geometry.path("coordinates").isArray()) continue;
                List<List<Double>> points = new ArrayList<>();
                for (JsonNode point : geometry.path("coordinates")) {
                    if (!point.isArray() || point.size() != 2 || !point.get(0).isNumber() || !point.get(1).isNumber()
                        || !LocationService.validCoordinates(point.get(1).asDouble(), point.get(0).asDouble()))
                        throw new ApiFailure(502, "INVALID_PROVIDER_RESPONSE", "Invalid nearby step geometry.");
                    points.add(List.of(point.get(0).asDouble(), point.get(1).asDouble()));
                }
                if (points.size() < 2) continue;
                candidates.add(new Candidate(step.path("name").asText("").isBlank() ? "Unnamed routed road" : step.path("name").asText(),
                    "route-" + (i + 1), new Geometry("LineString", points))); included++;
            }
        }
        return new Result(routing, candidates, destination, "GPS",
            List.of("Candidate roads are limited to returned route steps, not the entire surrounding road network.",
                "GPS and compass do not visually recognize roads. Overlay alignment is approximate and requires real-device validation.",
                "Driving baseline estimates only; no live traffic, future forecast or turn-by-turn guarantee."));
    }
    private synchronized void verifyCountry(GpsOrigin origin) {
        String key = String.format(Locale.ROOT, "%.5f,%.5f", origin.latitude(), origin.longitude());
        CountryCheck check = countries.get(key);
        if (check == null || check.expires().isBefore(Instant.now())) {
            boolean sriLanka = locations.gpsIsSriLankan(origin.latitude(), origin.longitude());
            if (countries.size() >= 128) countries.remove(countries.keySet().iterator().next());
            check = new CountryCheck(sriLanka, Instant.now().plusSeconds(300)); countries.put(key, check);
        }
        if (!check.sriLanka()) throw new ApiFailure(422, "UNSUPPORTED_LOCATION", "The geocoder did not identify this GPS location as Sri Lankan. Use a supported manual location.");
    }
    @ExceptionHandler(ApiFailure.class)
    public ResponseEntity<Map<String, String>> error(ApiFailure error) {
        return ResponseEntity.status(error.status).body(Map.of("code", error.code, "message", error.getMessage()));
    }
}
