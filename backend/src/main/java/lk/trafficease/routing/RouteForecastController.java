package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import java.time.*;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;
@RestController
@RequestMapping("/api/route-forecasts")
public class RouteForecastController {
    public record Input(String journeyId,String mode,String departureAt,String weatherMode,String manualWeather,String dataMode) {
        public Input(String journeyId,String mode,String departureAt,String weatherMode,String manualWeather) { this(journeyId,mode,departureAt,weatherMode,manualWeather,"LIVE"); }
    }
    private record Cached(RouteResponse response,Instant until) {}
    private final Map<String,Cached> cache=new LinkedHashMap<>();
    private final ForecastJourneyCatalog catalog;
    private final RouteService routing;
    private final RouteWeatherService weather;
    private final RouteAiClient ai;
    private final ObjectMapper mapper;
    public RouteForecastController(ForecastJourneyCatalog catalog,RouteService routing,RouteWeatherService weather,RouteAiClient ai,ObjectMapper mapper) { this.catalog=catalog;this.routing=routing;this.weather=weather;this.ai=ai;this.mapper=mapper; }
    @GetMapping("/catalog") public ObjectNode catalog() {
        var result=(ObjectNode)catalog.data();
        var clock=JourneyTime.capabilities(Clock.systemUTC());result.set("departure",mapper.valueToTree(clock));
        try { result.set("model",ai.metadata()); } catch(ApiFailure error) { result.set("model",mapper.valueToTree(Map.of("modelStatus","unavailable","experimental",true,"dataSource","SYNTHETIC","message",error.getMessage()))); }
        return result;
    }
    private synchronized RouteResponse routes(JsonNode j,JourneyTime.Departure departure) {
        String id=j.path("id").asText();var previous=cache.get(id);
        if(previous!=null&&previous.until().isAfter(Instant.now()))return previous.response().withDeparture(departure);
        var result=routing.calculateVerified(catalog.place(j,"origin"),catalog.place(j,"destination"),departure);
        if(result.routes().size()>8)throw new ApiFailure(422,"TOO_MANY_ROUTES","Provider returned more routes than this prototype can safely compare.");
        if(cache.size()>=30)cache.remove(cache.keySet().iterator().next());cache.put(id,new Cached(result,Instant.now().plusSeconds(300)));return result;
    }
    @PostMapping public Map<String,Object> predict(@RequestBody Input input) {
        if(input==null)throw new ApiFailure(400,"INVALID_REQUEST","Choose a supported journey and departure.");
        String dataMode=input.dataMode()==null?"LIVE":input.dataMode();
        if(!Set.of("LIVE","SIMULATION").contains(dataMode))throw new ApiFailure(400,"INVALID_DATA_MODE","Choose online or simulation mode.");
        var j=catalog.selected(input.journeyId());var departure=JourneyTime.resolve(input.mode(),input.departureAt(),Clock.systemUTC());
        String mode=input.weatherMode()==null?"AUTO":input.weatherMode();
        if(!Set.of("AUTO","MANUAL_SIMULATION").contains(mode)||mode.equals("AUTO")&&input.manualWeather()!=null)throw new ApiFailure(400,"INVALID_WEATHER_MODE","Choose automatic weather or an explicitly labeled manual simulation.");
        if(mode.equals("MANUAL_SIMULATION")&&(input.manualWeather()==null||!Set.of("CLEAR","RAIN","HEAVY_RAIN").contains(input.manualWeather())))throw new ApiFailure(400,"INVALID_WEATHER_SIMULATION","Choose a supported manual weather category.");
        var road=dataMode.equals("SIMULATION")?JourneySimulation.routing(mapper,j,catalog,departure):routes(j,departure);boolean now=departure.mode().equals("LEAVE_NOW");
        Instant at=now?Instant.now():OffsetDateTime.parse(departure.departureAt()).toInstant();
        var forecastWeather=dataMode.equals("SIMULATION")?JourneySimulation.weather(road,input.journeyId(),at):mode.equals("MANUAL_SIMULATION")?weather.manual(road,input.manualWeather()):weather.automatic(road,at);
        Map<String,Object> forecast;
        if(forecastWeather.status().equals("UNAVAILABLE"))forecast=Map.of("status","WEATHER_UNAVAILABLE","message","Automatic weather unavailable. No congestion predictions generated. Choose explicit manual weather simulation if desired.");
        else {
            var request=mapper.createObjectNode();request.put("journeyId",input.journeyId());request.put("forecastAt",now?null:departure.departureAt());
            var candidates=request.putArray("candidates");
            for(int i=0;i<road.routes().size();i++) {
                var r=road.routes().get(i);var candidate=candidates.addObject();candidate.put("id",r.id());candidate.put("distanceMeters",r.distanceMeters());candidate.put("durationSeconds",r.durationSeconds());candidate.set("geometry",mapper.valueToTree(r.geometry()));candidate.put("weather",forecastWeather.routes().get(i).category());
            }
            try { forecast=Map.of("status","AVAILABLE","result",ai.predict(request)); }
            catch(ApiFailure error) { org.slf4j.LoggerFactory.getLogger(getClass()).warn("Route inference unavailable: {}",error.code); forecast=Map.of("status","MODEL_UNAVAILABLE","message",error.getMessage(),"code",error.code); }
        }
        return Map.of("dataMode",dataMode,"journey",j,"routing",road,"weather",forecastWeather,"forecast",forecast,"experimental",true,"dataSource","SYNTHETIC","trafficAwareDuration",Map.of("status","UNAVAILABLE","message","No licensed Sri Lankan traffic-aware duration provider is configured/verified. OSRM baseline times are unchanged; no simulated or traffic-aware ETA is calculated."),"attribution","© OpenStreetMap contributors (ODbL) · OSRM"+(forecastWeather.status().equals("AVAILABLE")?" · Weather by Open-Meteo (CC BY 4.0)":" · Weather scenario or unavailable; no provider forecast supplied"));
    }
    @ExceptionHandler(ApiFailure.class) public ResponseEntity<?> failure(ApiFailure error) { return ResponseEntity.status(error.status).body(Map.of("code",error.code,"message",error.getMessage())); }
}
