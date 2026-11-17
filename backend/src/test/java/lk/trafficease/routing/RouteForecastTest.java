package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.*;
import java.time.*;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class RouteForecastTest {
    final ObjectMapper mapper=new ObjectMapper();
    RouteResponse road() {
        var r=new RoadRoute("route-1",2200,300,new Geometry("LineString",List.of(List.of(79.85,6.9),List.of(79.87,6.9))),true,true);
        return new RouteResponse("OSRM","BASELINE_ROUTING_ESTIMATE",Instant.now().toString(),"RETURNED_ROUTES",false,List.of(),List.of(),List.of(r),JourneyTime.resolve(null,null,Clock.systemUTC()));
    }
    @Test void reviewedCatalogHasThirtyUniqueGeocodedJourneys() throws Exception {
        var catalog=new ForecastJourneyCatalog(mapper);var data=catalog.data();assertEquals(30,data.path("journeys").size());
        var ids=new HashSet<String>();
        for(var j:data.path("journeys")) {
            assertTrue(ids.add(j.path("id").asText()));assertEquals("ROUTABLE",j.path("verification").path("status").asText());
            for(var end:List.of("origin","destination")) {var p=catalog.place(j,end);assertEquals("LK",p.countryCode());assertTrue(LocationService.validCoordinates(p.latitude(),p.longitude()));}
        }
        assertEquals(422,assertThrows(ApiFailure.class,()->catalog.selected("fictional")).status);
    }
    @Test void weatherCategoriesRejectUnknownConditionsRatherThanInventClear() {
        assertEquals("CLEAR",RouteWeatherService.category(0,3));assertEquals("RAIN",RouteWeatherService.category(0,61));assertEquals("HEAVY_RAIN",RouteWeatherService.category(8,3));
        for(int code:new int[]{45,48,56,71,999})assertThrows(IllegalArgumentException.class,()->RouteWeatherService.category(0,code));
        assertThrows(IllegalArgumentException.class,()->RouteWeatherService.category(Double.NaN,0));
    }
    ArrayNode weatherFixture(RouteResponse road,String hour) {
        var a=mapper.createArrayNode();
        for(var point:RouteWeatherService.representativePoints(road.routes().get(0))) {
            var n=a.addObject();n.put("latitude",point.latitude());n.put("longitude",point.longitude());n.put("timezone","Asia/Colombo");n.put("utc_offset_seconds",19800);
            n.putObject("hourly_units").put("precipitation","mm");var h=n.putObject("hourly");h.putArray("time").add(hour);h.putArray("precipitation").add(1.0);h.putArray("weather_code").add(61);h.putArray("precipitation_probability").add(70);
        }
        return a;
    }
    @Test void weatherSamplesUseMappedDistanceAndColomboRequestedHour() {
        var road=road();var p=RouteWeatherService.representativePoints(road.routes().get(0));assertEquals(3,p.size());assertEquals(79.852,p.get(0).longitude(),.0001);assertEquals(79.868,p.get(2).longitude(),.0001);
        var fixture=weatherFixture(road,"2026-11-20T19:00");((ObjectNode)fixture.get(2).path("hourly")).putArray("precipitation").add(9);
        var result=RouteWeatherService.parse(fixture,road,p,"2026-11-20T19:00","2026-11-18T12:00:00Z");
        assertEquals("AVAILABLE",result.status());assertEquals("HEAVY_RAIN",result.routes().get(0).category());assertTrue(result.validFor().endsWith("+05:30"));assertNull(result.forecastIssueTime());
        assertThrows(IllegalArgumentException.class,()->RouteWeatherService.parse(fixture,road,p,"2026-11-21T19:00","now"));
        ((ObjectNode)fixture.get(0)).put("utc_offset_seconds",0);
        assertThrows(IllegalArgumentException.class,()->RouteWeatherService.parse(fixture,road,p,"2026-11-20T19:00","now"));
    }
    @Test void missingWeatherValuesUnitsAndDistantGridNeverProduceClear() {
        var road=road();var points=RouteWeatherService.representativePoints(road.routes().get(0));String hour="2026-11-20T19:00";
        for(String problem:List.of("rain","units","code","grid","count")) {
            var fixture=weatherFixture(road,hour);var first=(ObjectNode)fixture.get(0);
            switch(problem) {
                case "rain" -> ((ObjectNode)first.path("hourly")).putArray("precipitation").addNull();
                case "units" -> ((ObjectNode)first.path("hourly_units")).put("precipitation","inch");
                case "code" -> ((ObjectNode)first.path("hourly")).putArray("weather_code").add(45);
                case "grid" -> first.put("latitude",8.0);
                case "count" -> fixture.remove(0);
            }
            assertThrows(IllegalArgumentException.class,()->RouteWeatherService.parse(fixture,road,points,hour,"now"),problem);
        }
    }
    @Test void automaticWeatherCachesAndFailsExplicitlyWithoutManualDefault() {
        var provider=mock(ProviderClient.class);var service=new RouteWeatherService(provider,"https://weather.invalid/forecast");var at=Instant.now();String hour=at.atZone(JourneyTime.ZONE).withMinute(0).withSecond(0).withNano(0).toLocalDateTime().toString();
        when(provider.get(anyString(),anyString())).thenReturn(weatherFixture(road(),hour));
        assertEquals("AVAILABLE",service.automatic(road(),at).status());assertEquals("AVAILABLE",service.automatic(road(),at).status());verify(provider,times(1)).get(eq("weather"),contains("timezone=Asia%2FColombo"));
        var failed=mock(ProviderClient.class);when(failed.get(anyString(),anyString())).thenThrow(new ApiFailure(503,"BLOCKED","Weather network unavailable"));
        var unavailable=new RouteWeatherService(failed,"https://weather.invalid").automatic(road(),at);assertEquals("UNAVAILABLE",unavailable.status());assertTrue(unavailable.routes().isEmpty());assertTrue(unavailable.manualSimulationAvailable());
    }
    @Test void fullOrchestrationKeepsBaselineAndUsesExplicitWeather() throws Exception {
        var catalog=new ForecastJourneyCatalog(mapper);var routing=mock(RouteService.class);var weather=mock(RouteWeatherService.class);var ai=mock(RouteAiClient.class);var road=road();
        when(routing.calculateVerified(any(),any(),any())).thenReturn(road);
        when(weather.automatic(any(),any())).thenReturn(new RouteWeatherService.WeatherResult("AVAILABLE","Open-Meteo","now","hour","test fixture",List.of(new RouteWeatherService.RouteWeather("route-1","RAIN",List.of())),true,null));
        when(ai.predict(any())).thenReturn(mapper.createObjectNode().put("experimental",true));
        var controller=new RouteForecastController(catalog,routing,weather,ai,mapper);
        var result=controller.predict(new RouteForecastController.Input("pettah--piliyandala",null,null,"AUTO",null));
        assertSame(road,result.get("routing"));assertEquals("AVAILABLE",((Map<?,?>)result.get("forecast")).get("status"));assertEquals("UNAVAILABLE",((Map<?,?>)result.get("trafficAwareDuration")).get("status"));
        var capture=org.mockito.ArgumentCaptor.forClass(JsonNode.class);verify(ai).predict(capture.capture());var candidate=capture.getValue().path("candidates").get(0);assertEquals("RAIN",candidate.path("weather").asText());assertEquals(300,candidate.path("durationSeconds").asDouble());assertTrue(capture.getValue().path("forecastAt").isNull());
        String future=Instant.now().plusSeconds(86400).atZone(JourneyTime.ZONE).toOffsetDateTime().toString();
        var later=controller.predict(new RouteForecastController.Input("pettah--piliyandala","FUTURE_DATE",future,"AUTO",null));
        verify(routing,times(1)).calculateVerified(any(),any(),any());verify(weather).automatic(any(),eq(OffsetDateTime.parse(future).toInstant()));
        assertEquals(future,((RouteResponse)later.get("routing")).departure().departureAt());
    }
    @Test void unavailableWeatherNeverCallsModelAndBadInputsNeverCallProviders() throws Exception {
        var catalog=new ForecastJourneyCatalog(mapper);var routing=mock(RouteService.class);var weather=mock(RouteWeatherService.class);var ai=mock(RouteAiClient.class);var controller=new RouteForecastController(catalog,routing,weather,ai,mapper);
        assertThrows(ApiFailure.class,()->controller.predict(new RouteForecastController.Input("fictional",null,null,null,null)));
        assertThrows(ApiFailure.class,()->controller.predict(new RouteForecastController.Input("pettah--piliyandala",null,null,"AUTO","RAIN")));verifyNoInteractions(routing,weather,ai);
        when(routing.calculateVerified(any(),any(),any())).thenReturn(road());when(weather.automatic(any(),any())).thenReturn(new RouteWeatherService.WeatherResult("UNAVAILABLE","Open-Meteo",null,null,"Blocked test fixture",List.of(),true,null));
        var r=controller.predict(new RouteForecastController.Input("pettah--piliyandala",null,null,"AUTO",null));assertEquals("WEATHER_UNAVAILABLE",((Map<?,?>)r.get("forecast")).get("status"));verifyNoInteractions(ai);
    }
}
