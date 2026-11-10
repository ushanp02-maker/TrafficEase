package lk.trafficease.routing;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.*;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

@RestController
@RequestMapping("/api")
public class RoutingController {
    private final LocationService locations;
    private final RouteService routes;
    public RoutingController(LocationService locations, RouteService routes) { this.locations = locations; this.routes = routes; }
    @GetMapping("/locations")
    public Map<String, Object> search(@RequestParam String query) {
        return Map.of("locations", locations.search(query), "source", "Nominatim / OpenStreetMap", "attribution", "© OpenStreetMap contributors (ODbL)");
    }
    @GetMapping("/journeys/capabilities")
    public Map<String, Object> capabilities() { return JourneyTime.capabilities(java.time.Clock.systemUTC()); }
    @PostMapping("/routes")
    public RouteResponse routes(@RequestBody RouteRequest request) { return routes.calculate(request); }
    @ExceptionHandler(ApiFailure.class)
    public ResponseEntity<Map<String, String>> failure(ApiFailure ex) {
        return ResponseEntity.status(ex.status).header("Retry-After", "PROVIDER_RATE_LIMITED".equals(ex.code) ? "60" : "1")
            .body(Map.of("code", ex.code, "message", ex.getMessage()));
    }
}
