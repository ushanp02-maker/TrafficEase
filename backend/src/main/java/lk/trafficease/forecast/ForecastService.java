package lk.trafficease.forecast;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.*;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Set;

@Service
public class ForecastService {
    public record ForecastRequest(String targetId, String forecastAt, String weather, Boolean isHoliday) {}
    public static class Failure extends RuntimeException {
        final int status; final String code;
        Failure(int status, String code, String message) { super(message); this.status = status; this.code = code; }
    }
    private final RestClient client;
    @Autowired
    public ForecastService(@Value("${trafficease.ai-service-url:http://127.0.0.1:8000}") String baseUrl) {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
        factory.setReadTimeout(Duration.ofSeconds(10));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
    ForecastService(RestClient client) { this.client = client; }
    public JsonNode catalog() { return call("/catalog", null); }
    public JsonNode metadata() { return call("/models/current", null); }
    public JsonNode predict(ForecastRequest request) {
        if (request == null || request.targetId() == null || request.targetId().isBlank() || request.targetId().length() > 128
                || request.weather() == null || !Set.of("CLEAR", "RAIN", "HEAVY_RAIN").contains(request.weather()))
            throw new Failure(400, "INVALID_REQUEST", "Choose a hypothetical road/region and supported weather scenario.");
        return call("/predict", new ForecastRequest(request.targetId(), request.forecastAt(), request.weather(), Boolean.TRUE.equals(request.isHoliday())));
    }
    private JsonNode call(String path, ForecastRequest request) {
        try {
            JsonNode body = request == null ? client.get().uri(path).retrieve().body(JsonNode.class)
                : client.post().uri(path).contentType(MediaType.APPLICATION_JSON).body(request).retrieve().body(JsonNode.class);
            if (body == null || !body.path("experimental").asBoolean() || !"SYNTHETIC".equals(body.path("dataSource").asText()))
                throw new Failure(502, "INVALID_AI_RESPONSE", "AI service returned invalid experimental-data provenance.");
            if ("/catalog".equals(path) && (!body.path("targets").isArray() || !body.path("weatherOptions").isArray()
                || body.path("now").asText().isBlank() || body.path("maxForecastAt").asText().isBlank()
                || !Set.of("ready", "not_trained", "unavailable").contains(body.path("modelStatus").asText())))
                throw new Failure(502, "INVALID_AI_RESPONSE", "AI scenario catalog is incomplete.");
            if (request != null && (!Set.of("LOW", "MODERATE", "HIGH").contains(body.path("congestion").asText())
                || !"EXPERIMENTAL_AI".equals(body.path("estimateKind").asText())
                || !body.has("supportsJourneyDuration") || body.path("supportsJourneyDuration").asBoolean()
                || !body.path("target").isObject() || !body.path("features").isObject()
                || body.path("forecastAt").asText().isBlank() || body.path("modelVersion").asText().isBlank()))
                throw new Failure(502, "INVALID_AI_RESPONSE", "AI service returned incomplete or unsupported forecast data.");
            return body;
        } catch (RestClientResponseException error) {
            int status = error.getStatusCode().value();
            try {
                JsonNode body = new ObjectMapper().readTree(error.getResponseBodyAsString());
                if (status == 422 && body.hasNonNull("code") && body.hasNonNull("message"))
                    throw new Failure(422, body.path("code").asText(), body.path("message").asText());
                if (status == 503) throw new Failure(503, "MODEL_UNAVAILABLE", "Experimental AI model unavailable. Train the model and restart the AI service.");
            } catch (Failure ex) { throw ex; }
            catch (Exception ignored) { /* Do not expose upstream traces or internals. */ }
            throw new Failure(503, "AI_UNAVAILABLE", "Experimental AI service unavailable. Please try again later.");
        } catch (RestClientException error) {
            throw new Failure(503, "AI_UNAVAILABLE", "Cannot reach the experimental AI service. Check that FastAPI is running.");
        }
    }
}
