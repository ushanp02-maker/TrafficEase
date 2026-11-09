package lk.trafficease.routing;

import java.util.List;

public final class RoutingModels {
    private RoutingModels() {}
    public record Location(String id, String name, double latitude, double longitude, String countryCode) {}
    public record RouteRequest(String originId, String destinationId) {}
    public record Geometry(String type, List<List<Double>> coordinates) {}
    public record RoadRoute(String id, double distanceMeters, double durationSeconds, Geometry geometry,
                           boolean fastestAvailable, boolean shortestAvailable) {}
    public record Snap(String endpoint, double distanceMeters, double latitude, double longitude) {}
    public record RouteResponse(String source, String estimateKind, String generatedAt,
                                String comparisonScope, boolean trueShortestSupported,
                                List<String> limitations, List<Snap> snapping, List<RoadRoute> routes) {}
}
