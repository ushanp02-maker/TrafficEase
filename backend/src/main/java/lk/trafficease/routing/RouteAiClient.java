package lk.trafficease.routing;
import com.fasterxml.jackson.databind.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.*;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
@Service
public class RouteAiClient {
    private final RestClient client;
    @org.springframework.beans.factory.annotation.Autowired
    public RouteAiClient(@Value("${trafficease.ai-service-url:http://127.0.0.1:8000}") String url) {
        var factory=new JdkClientHttpRequestFactory(HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(3)).build());factory.setReadTimeout(Duration.ofSeconds(15));
        client=RestClient.builder().baseUrl(url).requestFactory(factory).build();
    }
    RouteAiClient(RestClient client) { this.client=client; }
    public JsonNode metadata() { return call("/route-model",null); }
    public JsonNode predict(JsonNode request) {
        JsonNode response=call("/route-predict",request);
        if(!response.path("adjustedDurationSeconds").isNull()||!response.path("routePredictions").isArray()||response.path("routePredictions").size()!=request.path("candidates").size()||!response.has("supportsJourneyDuration")||response.path("supportsJourneyDuration").asBoolean()||response.path("modelVersion").asText().isBlank()||!"EXPERIMENTAL_ROUTE_CONGESTION".equals(response.path("estimateKind").asText())||!response.path("recommendation").isObject())throw invalid();
        var expected=new HashSet<String>();var durations=new HashMap<String,Double>();request.path("candidates").forEach(c->{expected.add(c.path("id").asText());durations.put(c.path("id").asText(),c.path("durationSeconds").asDouble());});
        for(var p:response.path("routePredictions")) {
            if(!expected.remove(p.path("routeId").asText())||!p.path("experimental").asBoolean()||!"SYNTHETIC".equals(p.path("dataSource").asText())||!Set.of("SUPPORTED","UNSUPPORTED_FEATURES").contains(p.path("status").asText()))throw invalid();
            if(p.path("status").asText().equals("SUPPORTED")&&(!Set.of("LOW","MODERATE","HIGH").contains(p.path("congestion").asText())||!p.path("features").isObject()||!p.path("syntheticBurden").isNumber()||!Double.isFinite(p.path("syntheticBurden").asDouble())||p.path("syntheticBurden").asDouble()<0||p.path("syntheticBurden").asDouble()>2||!p.path("adjustedDurationSeconds").isNull()||!p.path("baselineDurationSeconds").isNumber()||Double.compare(p.path("baselineDurationSeconds").asDouble(),durations.get(p.path("routeId").asText()))!=0))throw invalid();
        }
        if(!expected.isEmpty())throw invalid();
        String recommendation=response.path("recommendation").path("status").asText();
        if(!Set.of("SINGLE_ROUTE","INSUFFICIENT_SUPPORTED_ROUTES","TIE_OR_INSUFFICIENT_DIFFERENTIATION","EXPERIMENTAL_PREFERENCE").contains(recommendation))throw invalid();
        if(recommendation.equals("EXPERIMENTAL_PREFERENCE")) {
            String id=response.path("recommendation").path("routeId").asText();
            if(java.util.stream.StreamSupport.stream(response.path("routePredictions").spliterator(),false).anyMatch(p->!p.path("status").asText().equals("SUPPORTED"))||response.path("routePredictions").size()<2||!java.util.stream.StreamSupport.stream(response.path("routePredictions").spliterator(),false).anyMatch(p->p.path("routeId").asText().equals(id)&&p.path("status").asText().equals("SUPPORTED")))throw invalid();
        }
        return response;
    }
    private JsonNode call(String path,JsonNode request) {
        try {
            JsonNode data=request==null?client.get().uri(path).retrieve().body(JsonNode.class):client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(request).retrieve().body(JsonNode.class);
            if(data==null||!data.path("experimental").asBoolean()||!"SYNTHETIC".equals(data.path("dataSource").asText()))throw invalid();
            return data;
        } catch(RestClientResponseException e) { throw new ApiFailure(503,"ROUTE_MODEL_UNAVAILABLE",e.getStatusCode().value()==422?"Route model rejected an unsupported feature, journey or expired departure. Select a supported journey and future time.":"Separate route model unavailable. Run train_routes.py and restart FastAPI."); }
        catch(RestClientException e) { throw new ApiFailure(503,"AI_UNAVAILABLE","Cannot reach the route-model service. Baseline routes are still genuine; no forecast was invented."); }
    }
    private static ApiFailure invalid() { return new ApiFailure(502,"INVALID_AI_RESPONSE","Route AI returned inconsistent provenance or unsupported duration/recommendation data."); }
}
