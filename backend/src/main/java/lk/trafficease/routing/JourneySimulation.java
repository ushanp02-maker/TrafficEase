package lk.trafficease.routing;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.core.io.ClassPathResource;
import java.time.*;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

/** Opt-in recorded-route playback. Never called as an automatic live fallback. */
final class JourneySimulation {
    private static JsonNode observations;
    private static synchronized JsonNode observations(ObjectMapper mapper) {
        if(observations==null) {
            try(var stream=new ClassPathResource("experimental/routing-observations.json").getInputStream()) { observations=mapper.readTree(stream); }
            catch(Exception error) { throw new ApiFailure(503,"SIMULATION_UNAVAILABLE","Journey simulation is temporarily unavailable."); }
        }
        return observations;
    }
    static RouteResponse routing(ObjectMapper mapper,JsonNode journey,ForecastJourneyCatalog catalog,JourneyTime.Departure departure) {
        var saved=observations(mapper).path(journey.path("id").asText());
        if(!saved.path("status").asText().equals("ROUTABLE"))throw new ApiFailure(503,"SIMULATION_UNAVAILABLE","This journey simulation is unavailable.");
        ObjectNode body=mapper.createObjectNode();body.put("code","Ok");body.set("routes",saved.path("routes"));body.set("waypoints",saved.path("waypoints"));
        var verified=RouteService.parse(body,catalog.place(journey,"origin"),catalog.place(journey,"destination"),300);
        return new RouteResponse("RECORDED_OSRM_DEMONSTRATION","RECORDED_BASELINE_ESTIMATE",saved.path("verifiedAt").asText(),verified.comparisonScope(),false,
            List.of("Simulation uses genuine recorded OSRM roads and historic baseline times, not a new routing request or current traffic.","Weather is a deterministic scenario; congestion comes from the synthetic-trained model. No live traffic or adjusted ETA."),verified.snapping(),verified.routes(),departure);
    }
    static RouteWeatherService.WeatherResult weather(RouteResponse routes,String journeyId,Instant at) {
        var local=at.atZone(JourneyTime.ZONE);
        int index=Math.floorMod(journeyId.hashCode()+local.getDayOfWeek().getValue()+local.getHour(),3);
        String category=List.of("CLEAR","RAIN","HEAVY_RAIN").get(index);
        return new RouteWeatherService.WeatherResult("SIMULATED","DEMONSTRATION_SCENARIO",null,null,"Repeatable weather scenario; not a weather forecast.",routes.routes().stream().map(r->new RouteWeatherService.RouteWeather(r.id(),category,List.of())).toList(),false,null);
    }
}
