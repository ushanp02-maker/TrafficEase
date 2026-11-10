package lk.trafficease.routing;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.time.Instant;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

@Service
public class RouteService {
    private final ProviderClient client;
    private final LocationService locations;
    private final String baseUrl;
    private final double maxSnap;
    public RouteService(ProviderClient client, LocationService locations,
        @Value("${trafficease.routing-url}") String baseUrl,
        @Value("${trafficease.max-snap-meters:300}") double maxSnap) {
        this.client = client; this.locations = locations; this.baseUrl = baseUrl; this.maxSnap = maxSnap;
        if (!Double.isFinite(maxSnap) || maxSnap <= 0 || maxSnap > 500) throw new IllegalArgumentException("Snap threshold must be between 0 and 500 meters");
    }
    public RouteResponse calculate(RouteRequest request) {
        if (request == null) throw new ApiFailure(400, "INVALID_REQUEST", "Select an origin and destination.");
        var departure = JourneyTime.resolve(request.mode(), request.departureAt(), java.time.Clock.systemUTC());
        Location origin = locations.selected(request.originId());
        Location destination = locations.selected(request.destinationId());
        if (origin.id().equals(destination.id())) throw new ApiFailure(400, "IDENTICAL_LOCATIONS", "Choose a different destination.");
        String coordinates = origin.longitude() + "," + origin.latitude() + ";" + destination.longitude() + "," + destination.latitude();
        JsonNode body = client.get("routing", baseUrl + "/route/v1/driving/" + coordinates
            + "?geometries=geojson&overview=full&alternatives=true&steps=false&generate_hints=false");
        return parse(body, origin, destination, maxSnap).withDeparture(departure);
    }
    static RouteResponse parse(JsonNode body, Location origin, Location destination, double maxSnap) {
        String code = body.path("code").asText();
        if (Set.of("NoRoute", "NoSegment", "NoTable").contains(code))
            throw new ApiFailure(422, "NO_ROUTE", "No usable road route was found. Choose a more specific road-accessible location.");
        if (!"Ok".equals(code)) throw invalid();
        JsonNode waypoints = body.path("waypoints");
        if (!waypoints.isArray() || waypoints.size() != 2) throw invalid();
        List<Snap> snapping = new ArrayList<>();
        Location[] endpoints = {origin, destination};
        for (int i = 0; i < 2; i++) {
            JsonNode point = waypoints.get(i), coordinate = point.path("location");
            if (!point.path("distance").isNumber() || !coordinate.isArray() || coordinate.size() != 2
                || !coordinate.get(0).isNumber() || !coordinate.get(1).isNumber()) throw invalid();
            double lon = coordinate.get(0).asDouble(), lat = coordinate.get(1).asDouble();
            double reported = point.path("distance").asDouble();
            if (!LocationService.validCoordinates(lat, lon) || !Double.isFinite(reported) || reported < 0) throw invalid();
            double distance = Math.max(reported, haversine(endpoints[i].latitude(), endpoints[i].longitude(), lat, lon));
            if (distance > maxSnap) throw new ApiFailure(422, "EXCESSIVE_SNAPPING",
                (i == 0 ? "Starting point" : "Destination") + " is approximately " + Math.round(distance)
                + " m from the routed road (limit " + Math.round(maxSnap) + " m). Search for a specific nearby street or landmark.");
            snapping.add(new Snap(i == 0 ? "origin" : "destination", distance, lat, lon));
        }
        JsonNode raw = body.path("routes");
        if (!raw.isArray() || raw.isEmpty()) throw new ApiFailure(422, "NO_ROUTE", "No routes were returned by OSRM.");
        List<RoadRoute> parsed = new ArrayList<>();
        for (JsonNode r : raw) {
            double distance = r.path("distance").asDouble(Double.NaN), duration = r.path("duration").asDouble(Double.NaN);
            JsonNode geometry = r.path("geometry"), coordinates = geometry.path("coordinates");
            if (!r.path("distance").isNumber() || !r.path("duration").isNumber() || !Double.isFinite(distance) || !Double.isFinite(duration) || distance <= 0 || duration <= 0
                || !"LineString".equals(geometry.path("type").asText()) || !coordinates.isArray() || coordinates.size() < 2) throw invalid();
            List<List<Double>> points = new ArrayList<>();
            for (JsonNode point : coordinates) {
                if (!point.isArray() || point.size() != 2 || !point.get(0).isNumber() || !point.get(1).isNumber()
                    || !LocationService.validCoordinates(point.get(1).asDouble(), point.get(0).asDouble())) throw invalid();
                points.add(List.of(point.get(0).asDouble(), point.get(1).asDouble()));
            }
            parsed.add(new RoadRoute("route-" + (parsed.size() + 1), distance, duration, new Geometry("LineString", points), false, false));
        }
        double minTime = parsed.stream().mapToDouble(RoadRoute::durationSeconds).min().orElseThrow();
        double minDistance = parsed.stream().mapToDouble(RoadRoute::distanceMeters).min().orElseThrow();
        List<RoadRoute> ranked = parsed.stream().map(r -> new RoadRoute(r.id(), r.distanceMeters(), r.durationSeconds(), r.geometry(),
            r.durationSeconds() == minTime, r.distanceMeters() == minDistance)).toList();
        return new RouteResponse("OSRM / OpenStreetMap", "BASELINE_ROUTING_ESTIMATE", Instant.now().toString(), "RETURNED_ROUTES_ONLY", false,
            List.of("Baseline driving durations are not live traffic or future forecasts.",
                "Fastest and shortest labels compare returned routes only. OSRM does not optimize a true shortest-distance route.",
                "Coverage, alternatives, road access and data freshness are not guaranteed; verify local restrictions."), snapping, ranked, JourneyTime.resolve(null, null, java.time.Clock.systemUTC()));
    }
    private static ApiFailure invalid() { return new ApiFailure(502, "INVALID_PROVIDER_RESPONSE", "Routing provider returned incomplete or invalid data."); }
    private static double haversine(double a, double b, double c, double d) {
        double x = Math.pow(Math.sin(Math.toRadians(c-a)/2),2) + Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*Math.pow(Math.sin(Math.toRadians(d-b)/2),2);
        return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
    }
}
