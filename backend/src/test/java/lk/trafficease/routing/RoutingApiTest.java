package lk.trafficease.routing;

import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RoutingApiTest {
    LocationService locations;
    RouteService routes;
    MockMvc mvc;
    @BeforeEach void setup() {
        locations = mock(LocationService.class); routes = mock(RouteService.class);
        mvc = MockMvcBuilders.standaloneSetup(new RoutingController(locations,routes)).build();
    }
    @Test void searchResponseCarriesAttribution() throws Exception {
        when(locations.search("Jaffna")).thenReturn(List.of(new RoutingModels.Location("1","Jaffna",9.66,80.02,"LK")));
        mvc.perform(get("/api/locations").param("query","Jaffna")).andExpect(status().isOk())
            .andExpect(jsonPath("$.locations[0].countryCode").value("LK"))
            .andExpect(jsonPath("$.attribution").value("© OpenStreetMap contributors (ODbL)"));
    }
    @Test void missingQueryIsRejected() throws Exception {
        mvc.perform(get("/api/locations")).andExpect(status().isBadRequest());
        verifyNoInteractions(locations);
    }
    @Test void malformedRouteRequestIsRejected() throws Exception {
        mvc.perform(post("/api/routes").contentType("application/json").content("broken")).andExpect(status().isBadRequest());
        verifyNoInteractions(routes);
    }
    @Test void rateLimitHasStructuredErrorAndRetryHeader() throws Exception {
        when(locations.search("Kandy")).thenThrow(new ApiFailure(429,"RATE_LIMITED","Wait one second"));
        mvc.perform(get("/api/locations").param("query","Kandy")).andExpect(status().isTooManyRequests())
            .andExpect(header().string("Retry-After","1")).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }
    @Test void snappingErrorIsExposedWithoutRouteData() throws Exception {
        when(routes.calculate(any())).thenThrow(new ApiFailure(422,"EXCESSIVE_SNAPPING","Destination is 2776 m from road"));
        mvc.perform(post("/api/routes").contentType("application/json").content("{\"originId\":\"1\",\"destinationId\":\"2\"}"))
            .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("EXCESSIVE_SNAPPING"))
            .andExpect(jsonPath("$.routes").doesNotExist());
    }
}
