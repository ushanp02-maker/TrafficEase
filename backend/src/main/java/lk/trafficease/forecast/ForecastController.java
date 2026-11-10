package lk.trafficease.forecast;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/forecasts")
public class ForecastController {
    private final ForecastService service;
    private final lk.trafficease.history.PredictionHistory history;
    public ForecastController(ForecastService service, lk.trafficease.history.PredictionHistory history) { this.service = service; this.history = history; }
    @GetMapping("/history/status") public Map<String, Object> historyStatus() { return history.status(); }
    @GetMapping("/history") public Map<String, Object> history() { return history.recent(); }
    @GetMapping("/catalog") public JsonNode catalog() { return service.catalog(); }
    @GetMapping("/model") public JsonNode model() { return service.metadata(); }
    @PostMapping
    public JsonNode forecast(@RequestBody ForecastService.ForecastRequest request) {
        var result = service.predict(request);
        var response = ((com.fasterxml.jackson.databind.node.ObjectNode) result).deepCopy();
        response.put("historyStatus", Boolean.TRUE.equals(request.saveHistory()) ? history.save(result) : "NOT_REQUESTED");
        return response;
    }
    @ExceptionHandler(ForecastService.Failure.class)
    public ResponseEntity<Map<String, String>> failure(ForecastService.Failure error) {
        return ResponseEntity.status(error.status).body(Map.of("code", error.code, "message", error.getMessage()));
    }
}
