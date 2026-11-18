package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class JourneySimulationTest {
 @Test void allThirtySnapshotsAreValidatedRepeatableAndClearlyRecorded()throws Exception {
  var mapper=new ObjectMapper();var catalog=new ForecastJourneyCatalog(mapper);var at=Instant.parse("2026-11-19T12:30:00Z");
  for(var j:catalog.data().path("journeys")) {
   var road=JourneySimulation.routing(mapper,j,catalog,JourneyTime.resolve(null,null,Clock.systemUTC()));
   assertEquals("RECORDED_OSRM_DEMONSTRATION",road.source());assertFalse(road.trueShortestSupported());assertFalse(road.routes().isEmpty());
   assertEquals(JourneySimulation.weather(road,j.path("id").asText(),at),JourneySimulation.weather(road,j.path("id").asText(),at));
  }
 }
 @Test void simulationCallsModelWithoutAnyPublicProviderAndNeverFakesModelSuccess()throws Exception {
  var mapper=new ObjectMapper();var routes=mock(RouteService.class);var weather=mock(RouteWeatherService.class);var ai=mock(RouteAiClient.class);
  when(ai.predict(any())).thenThrow(new ApiFailure(503,"ROUTE_MODEL_UNAVAILABLE","not trained"));
  var controller=new RouteForecastController(new ForecastJourneyCatalog(mapper),routes,weather,ai,mapper);
  var result=controller.predict(new RouteForecastController.Input("pettah--piliyandala",null,null,null,null,"SIMULATION"));
  assertEquals("SIMULATION",result.get("dataMode"));assertFalse(result.get("attribution").toString().contains("Weather by Open-Meteo"));assertEquals("MODEL_UNAVAILABLE",((java.util.Map<?,?>)result.get("forecast")).get("status"));verifyNoInteractions(routes,weather);verify(ai).predict(any());
 }
}
