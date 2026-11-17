package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.http.MediaType;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
class RouteAiClientTest {
 final ObjectMapper mapper=new ObjectMapper();MockRestServiceServer server;RouteAiClient client;
 @BeforeEach void setup(){var builder=RestClient.builder().baseUrl("http://ai.invalid");server=MockRestServiceServer.bindTo(builder).build();client=new RouteAiClient(builder.build());}
 JsonNode request()throws Exception{return mapper.readTree("{\"candidates\":[{\"id\":\"route-1\",\"durationSeconds\":300}]}");}
 ObjectNode response()throws Exception{return (ObjectNode)mapper.readTree("""
 {"experimental":true,"dataSource":"SYNTHETIC","estimateKind":"EXPERIMENTAL_ROUTE_CONGESTION","modelVersion":"test-synthetic","supportsJourneyDuration":false,"adjustedDurationSeconds":null,"routePredictions":[{"routeId":"route-1","status":"SUPPORTED","experimental":true,"dataSource":"SYNTHETIC","features":{},"congestion":"LOW","syntheticBurden":0.2,"baselineDurationSeconds":300,"adjustedDurationSeconds":null}],"recommendation":{"status":"SINGLE_ROUTE","routeId":null}}
 """);}
 void reply(JsonNode data){server.expect(requestTo("http://ai.invalid/route-predict")).andRespond(withSuccess(data.toString(),MediaType.APPLICATION_JSON));}
 @Test void acceptsUnchangedBaselineAndSyntheticProvenance()throws Exception{reply(response());assertEquals("LOW",client.predict(request()).path("routePredictions").get(0).path("congestion").asText());server.verify();}
 @Test void rejectsSilentlyChangedDuration()throws Exception{var r=response();((ObjectNode)r.path("routePredictions").get(0)).put("baselineDurationSeconds",100);reply(r);assertThrows(ApiFailure.class,()->client.predict(request()));}
 @Test void rejectsUnsupportedAdjustedEta()throws Exception{var r=response();r.put("adjustedDurationSeconds",100);reply(r);assertThrows(ApiFailure.class,()->client.predict(request()));}
 @Test void rejectsRealTrafficProvenance()throws Exception{var r=response();r.put("dataSource","LIVE");reply(r);assertThrows(ApiFailure.class,()->client.predict(request()));}
 @Test void rejectsInventedPreferredRoute()throws Exception{var r=response();((ObjectNode)r.path("recommendation")).put("status","EXPERIMENTAL_PREFERENCE").put("routeId","route-9");reply(r);assertThrows(ApiFailure.class,()->client.predict(request()));}
}
