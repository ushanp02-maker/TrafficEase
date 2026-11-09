package lk.trafficease.forecast;

import org.junit.jupiter.api.*;
import org.springframework.http.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class ForecastServiceTest {
    MockRestServiceServer upstream;
    ForecastService service;
    final ForecastService.ForecastRequest request = new ForecastService.ForecastRequest("region-uva", null, "RAIN", false);
    @BeforeEach void setup() {
        var builder = RestClient.builder().baseUrl("http://ai.test");
        upstream = MockRestServiceServer.bindTo(builder).build(); service = new ForecastService(builder.build());
    }
    @AfterEach void verified() { upstream.verify(); }
    @Test void forwardsForecastWithoutRoutingOverride() {
        upstream.expect(requestTo("http://ai.test/predict")).andExpect(method(HttpMethod.POST))
            .andExpect(content().json("{\"targetId\":\"region-uva\",\"weather\":\"RAIN\",\"isHoliday\":false,\"forecastAt\":null}"))
            .andRespond(withSuccess("{\"experimental\":true,\"dataSource\":\"SYNTHETIC\",\"estimateKind\":\"EXPERIMENTAL_AI\",\"congestion\":\"HIGH\",\"supportsJourneyDuration\":false,\"target\":{},\"features\":{},\"forecastAt\":\"2026-11-10T08:00:00+05:30\",\"modelVersion\":\"test\"}",MediaType.APPLICATION_JSON));
        assertEquals("HIGH",service.predict(request).path("congestion").asText());
    }
    @Test void preservesUnsupportedLocationState() {
        upstream.expect(requestTo("http://ai.test/predict")).andRespond(withStatus(HttpStatus.UNPROCESSABLE_ENTITY)
            .body("{\"code\":\"UNSUPPORTED_LOCATION\",\"message\":\"Outside hypothetical catalog\"}").contentType(MediaType.APPLICATION_JSON));
        assertEquals("UNSUPPORTED_LOCATION",assertThrows(ForecastService.Failure.class,()->service.predict(request)).code);
    }
    @Test void modelUnavailableDoesNotCreatePrediction() {
        upstream.expect(requestTo("http://ai.test/predict")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        assertEquals("MODEL_UNAVAILABLE",assertThrows(ForecastService.Failure.class,()->service.predict(request)).code);
    }
    @Test void invalidProvenanceIsRejected() {
        upstream.expect(requestTo("http://ai.test/catalog")).andRespond(withSuccess("{\"experimental\":false,\"dataSource\":\"REAL\"}",MediaType.APPLICATION_JSON));
        assertEquals(502,assertThrows(ForecastService.Failure.class,()->service.catalog()).status);
    }
    @Test void invalidWeatherDoesNotCallAi() {
        assertEquals(400,assertThrows(ForecastService.Failure.class,()->service.predict(new ForecastService.ForecastRequest("x",null,"SNOW",false))).status);
    }
    @Test void catalogAvailableWhenModelNotTrained() {
        upstream.expect(requestTo("http://ai.test/catalog")).andRespond(withSuccess("{\"experimental\":true,\"dataSource\":\"SYNTHETIC\",\"modelStatus\":\"not_trained\",\"targets\":[],\"weatherOptions\":[],\"now\":\"2026-11-09T12:00:00+05:30\",\"maxForecastAt\":\"2026-11-16T12:00:00+05:30\"}",MediaType.APPLICATION_JSON));
        assertEquals("not_trained",service.catalog().path("modelStatus").asText());
    }
}
