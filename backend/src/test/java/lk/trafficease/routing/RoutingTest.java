package lk.trafficease.routing;

import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static lk.trafficease.routing.RoutingModels.*;

class RoutingTest {
    final ObjectMapper mapper = new ObjectMapper();
    ProviderClient provider;
    LocationService locations;
    final Location origin = new Location("1", "Kandy", 7.29, 80.63, "LK");
    final Location destination = new Location("2", "Matale", 7.47, 80.62, "LK");
    @BeforeEach void setup() {
        provider = mock(ProviderClient.class);
        locations = new LocationService(provider, "https://nominatim.openstreetmap.org", true);
    }
    JsonNode json(String value) throws Exception { return mapper.readTree(value); }
    String searchResult = """
        [{"place_id":1,"display_name":"Kandy, Sri Lanka","lat":"7.29","lon":"80.63","address":{"country_code":"lk"}},
         {"place_id":2,"display_name":"Foreign place","lat":"7.30","lon":"80.64","address":{"country_code":"in"}},
         {"place_id":3,"display_name":"Invalid coordinate","lat":"NaN","lon":"80.64","address":{"country_code":"lk"}}]
        """;
    JsonNode routeBody() throws Exception {
        return json("""
        {"code":"Ok","waypoints":[{"distance":2,"location":[80.63,7.29]},{"distance":3,"location":[80.62,7.47]}],
        "routes":[{"distance":25000,"duration":1800,"geometry":{"type":"LineString","coordinates":[[80.63,7.29],[80.62,7.47]]}},
        {"distance":23000,"duration":2100,"geometry":{"type":"LineString","coordinates":[[80.63,7.29],[80.62,7.47]]}}]}
        """);
    }
    @Test void searchFiltersByCountryAndCoordinates() throws Exception {
        when(provider.get(eq("geocoding"), anyString())).thenReturn(json(searchResult));
        var results = locations.search("Kandy");
        assertEquals(1, results.size()); assertEquals("LK", results.get(0).countryCode());
        assertEquals(results.get(0), locations.selected("1"));
        verify(provider).get(eq("geocoding"), contains("countrycodes=lk"));
    }
    @Test void repeatedSearchUsesCache() throws Exception {
        when(provider.get(eq("geocoding"), anyString())).thenReturn(json(searchResult));
        assertEquals(locations.search(" Kandy "), locations.search("kandy"));
        verify(provider, times(1)).get(anyString(), anyString());
    }
    @Test void explicitPublicOptOutIsEnforced() {
        var optedOut = new LocationService(provider, "https://nominatim.openstreetmap.org", false);
        assertEquals("GEOCODING_NOT_CONFIGURED", assertThrows(ApiFailure.class, () -> optedOut.search("Kandy")).code);
        verifyNoInteractions(provider);
    }
    @Test void invalidQueriesDoNotCallProvider() {
        for (String input : new String[]{"", "a", "x".repeat(161)}) assertEquals(400, assertThrows(ApiFailure.class, () -> locations.search(input)).status);
        verifyNoInteractions(provider);
    }
    @Test void malformedSearchResponseFails() throws Exception {
        when(provider.get(anyString(), anyString())).thenReturn(json("{}"));
        assertEquals(502, assertThrows(ApiFailure.class, () -> locations.search("Kandy")).status);
    }
    @Test void unknownSelectionCannotSupplyArbitraryCoordinates() {
        assertEquals("LOCATION_SELECTION_REQUIRED", assertThrows(ApiFailure.class, () -> locations.selected("999")).code);
    }
    @Test void emptySearchIsNotReplacedByDemo() throws Exception {
        when(provider.get(anyString(), anyString())).thenReturn(json("[]"));
        assertTrue(locations.search("Unknown location").isEmpty());
    }
    @Test void coordinateSanityChecksRejectNonFiniteAndOutsideRange() {
        assertFalse(LocationService.validCoordinates(Double.NaN,80));
        assertFalse(LocationService.validCoordinates(51,0));
        assertFalse(LocationService.validCoordinates(7,Double.POSITIVE_INFINITY));
    }
    @Test void winnersAreRankedIndependently() throws Exception {
        var response = RouteService.parse(routeBody(), origin, destination, 300);
        assertTrue(response.routes().get(0).fastestAvailable()); assertFalse(response.routes().get(0).shortestAvailable());
        assertTrue(response.routes().get(1).shortestAvailable()); assertFalse(response.routes().get(1).fastestAvailable());
        assertFalse(response.trueShortestSupported()); assertEquals("BASELINE_ROUTING_ESTIMATE", response.estimateKind());
    }
    @Test void sameRouteCanWinBothComparisons() throws Exception {
        var body = routeBody().deepCopy(); ((com.fasterxml.jackson.databind.node.ArrayNode)body.path("routes")).remove(1);
        var route = RouteService.parse(body, origin, destination, 300).routes().get(0);
        assertTrue(route.fastestAvailable() && route.shortestAvailable());
    }
    @Test void tiesArePreserved() throws Exception {
        var body = routeBody().deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("routes").get(1)).put("duration",1800).put("distance",25000);
        assertTrue(RouteService.parse(body, origin, destination, 300).routes().stream().allMatch(r -> r.fastestAvailable() && r.shortestAvailable()));
    }
    @Test void knownTwoPointEightKilometerSnapIsRejected() throws Exception {
        var body = routeBody().deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("waypoints").get(1)).put("distance",2776.446072);
        ApiFailure ex = assertThrows(ApiFailure.class, () -> RouteService.parse(body, origin, destination, 300));
        assertEquals("EXCESSIVE_SNAPPING",ex.code); assertEquals(422,ex.status); assertTrue(ex.getMessage().contains("2776"));
    }
    @Test void snapDistanceIsIndependentlyChecked() throws Exception {
        var body = routeBody().deepCopy();
        ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("waypoints").get(1)).set("location",json("[80.62,7.50]"));
        assertEquals("EXCESSIVE_SNAPPING", assertThrows(ApiFailure.class, () -> RouteService.parse(body, origin, destination, 300)).code);
    }
    @Test void missingWaypointsFailClosed() throws Exception {
        var body = routeBody().deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode)body).remove("waypoints");
        assertEquals(502,assertThrows(ApiFailure.class, () -> RouteService.parse(body, origin, destination, 300)).status);
    }
    @Test void noRouteReturnsUnavailableNotSamples() throws Exception {
        var body = json("{\"code\":\"NoRoute\"}");
        assertEquals("NO_ROUTE",assertThrows(ApiFailure.class, () -> RouteService.parse(body, origin, destination, 300)).code);
    }
    @Test void invalidGeometryIsRejected() throws Exception {
        var body = routeBody().deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("routes").get(0).path("geometry")).put("type","Polygon");
        assertEquals(502,assertThrows(ApiFailure.class, () -> RouteService.parse(body, origin, destination, 300)).status);
    }
    @Test void negativeDurationIsRejected() throws Exception {
        var body = routeBody().deepCopy(); ((com.fasterxml.jackson.databind.node.ObjectNode)body.path("routes").get(0)).put("duration",-10);
        assertEquals(502,assertThrows(ApiFailure.class, () -> RouteService.parse(body, origin, destination, 300)).status);
    }
    @Test void routeRequiresSelectedLocations() {
        var service = new RouteService(provider,locations,"https://router.project-osrm.org",300);
        assertEquals(400,assertThrows(ApiFailure.class, () -> service.calculate(new RouteRequest("1","2"))).status);
        verifyNoInteractions(provider);
    }
}
