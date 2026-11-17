package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;
@Component
public class ForecastJourneyCatalog {
    private final JsonNode catalog;
    public ForecastJourneyCatalog(ObjectMapper mapper) throws Exception {
        try(var stream=new ClassPathResource("experimental/journeys.json").getInputStream()) { catalog=mapper.readTree(stream); }
        if(catalog.path("journeys").size()!=30)throw new IllegalStateException("Thirty reviewed journeys are required");
        var ids=new HashSet<String>();
        for(var j:catalog.path("journeys")) {
            if(!ids.add(j.path("id").asText()))throw new IllegalStateException("Duplicate catalog journey");
            for(String end:List.of("origin","destination")) {
                var p=place(j,end);
                if(!LocationService.validCoordinates(p.latitude(),p.longitude()) || !"LK".equals(p.countryCode()))throw new IllegalStateException("Invalid verified endpoint");
            }
        }
    }
    public JsonNode data() { return catalog.deepCopy(); }
    public JsonNode selected(String id) {
        if(id!=null)for(var j:catalog.path("journeys"))if(j.path("id").asText().equals(id))return j;
        throw new ApiFailure(422,"UNSUPPORTED_JOURNEY","Select one of the 30 verified experimental journeys. Other journeys remain available in the unrestricted baseline planner.");
    }
    public Location place(JsonNode journey,String end) {
        var p=catalog.path("places").path(journey.path(end).asText());
        return new Location(p.path("id").asText(),p.path("name").asText(),p.path("latitude").asDouble(Double.NaN),p.path("longitude").asDouble(Double.NaN),p.path("countryCode").asText());
    }
}
