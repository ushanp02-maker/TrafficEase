package lk.trafficease.routing;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static lk.trafficease.routing.RoutingModels.*;

class ArRoutingTest {
    ProviderClient provider;
    LocationService locations;
    ArRoutingController controller;
    final ArRoutingController.GpsOrigin gps = new ArRoutingController.GpsOrigin(7,80,5,System.currentTimeMillis());
    @BeforeEach void setup() throws Exception {
        provider = mock(ProviderClient.class); locations = mock(LocationService.class);
        controller = new ArRoutingController(provider,locations,"https://router.project-osrm.org");
        when(locations.selected("destination")).thenReturn(new Location("destination","Mapped destination",7.001,80,"LK"));
        when(locations.gpsIsSriLankan(7,80)).thenReturn(true);
        var data = new ObjectMapper().readTree("""
        {"code":"Ok","waypoints":[{"distance":0,"location":[80,7]},{"distance":0,"location":[80,7.001]}],
        "routes":[{"distance":120,"duration":60,"geometry":{"type":"LineString","coordinates":[[80,7],[80,7.001]]},
        "legs":[{"steps":[{"name":"Mapped Road","geometry":{"type":"LineString","coordinates":[[80,7],[80,7.001]]}}]}]}]}
        """);
        when(provider.get(eq("routing"),anyString())).thenReturn(data);
    }
    @Test void gpsRoutesCarryGenuineStepNamesAndGeometry() {
        var result = controller.routes(new ArRoutingController.Request(gps,"destination"));
        assertEquals("Mapped Road",result.candidates().get(0).name());
        assertEquals("GPS",result.originSource());
        assertEquals("BASELINE_ROUTING_ESTIMATE",result.routing().estimateKind());
        assertFalse(result.routing().trueShortestSupported());
        verify(provider).get(eq("routing"),contains("steps=true"));
    }
    @Test void gpsCountryCheckIsCachedNotRepeatedOnEachFrame() {
        controller.routes(new ArRoutingController.Request(gps,"destination"));
        controller.routes(new ArRoutingController.Request(gps,"destination"));
        verify(locations,times(1)).gpsIsSriLankan(7,80);
    }
    @Test void foreignGpsNeverCallsRouting() {
        when(locations.gpsIsSriLankan(7,80)).thenReturn(false);
        assertEquals("UNSUPPORTED_LOCATION",assertThrows(ApiFailure.class,()->controller.routes(new ArRoutingController.Request(gps,"destination"))).code);
        verifyNoInteractions(provider);
    }
    @Test void accuracyGateFailsBeforeAnyProvider() {
        var poor = new ArRoutingController.GpsOrigin(7,80,60,System.currentTimeMillis());
        assertEquals("GPS_UNRELIABLE",assertThrows(ApiFailure.class,()->controller.routes(new ArRoutingController.Request(poor,"destination"))).code);
        verifyNoInteractions(provider,locations);
    }
    @Test void timestampAndCoordinateValidation() {
        long now = 1_700_000_000_000L;
        for (var point : new ArRoutingController.GpsOrigin[]{
            new ArRoutingController.GpsOrigin(7,80,5,now-15001),new ArRoutingController.GpsOrigin(7,80,5,now+5001),
            new ArRoutingController.GpsOrigin(7,80,5,Long.MIN_VALUE),new ArRoutingController.GpsOrigin(7,80,Double.NaN,now),
            new ArRoutingController.GpsOrigin(51,0,5,now)})
            assertThrows(ApiFailure.class,()->ArRoutingController.validate(point,now));
        assertDoesNotThrow(()->ArRoutingController.validate(new ArRoutingController.GpsOrigin(7,80,30,now),now));
    }
    @Test void manualSelectionStillRequiresKnownDestination() {
        when(locations.selected("missing")).thenThrow(new ApiFailure(400,"LOCATION_SELECTION_REQUIRED","Select a destination"));
        assertEquals("LOCATION_SELECTION_REQUIRED",assertThrows(ApiFailure.class,()->controller.routes(new ArRoutingController.Request(gps,"missing"))).code);
        verifyNoInteractions(provider);
    }
    @Test void tighterSnapGateRejectsSixtyMeters() throws Exception {
        var data = new ObjectMapper().readTree("""
        {"code":"Ok","waypoints":[{"distance":60,"location":[80,7]},{"distance":0,"location":[80,7.001]}],
        "routes":[{"distance":120,"duration":60,"geometry":{"type":"LineString","coordinates":[[80,7],[80,7.001]]}}]}
        """);
        when(provider.get(eq("routing"),anyString())).thenReturn(data);
        assertEquals("EXCESSIVE_SNAPPING",assertThrows(ApiFailure.class,()->controller.routes(new ArRoutingController.Request(gps,"destination"))).code);
    }
}
