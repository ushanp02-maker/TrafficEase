package lk.trafficease.forecast;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/forecasts")
public class ForecastController {
    private final ForecastService service;
    public ForecastController(ForecastService service) { this.service = service; }
    @GetMapping("/catalog") public JsonNode catalog() { return service.catalog(); }
    @GetMapping("/model") public JsonNode model() { return service.metadata(); }
    @PostMapping public JsonNode forecast(@RequestBody ForecastService.ForecastRequest request) { return service.predict(request); }
    @ExceptionHandler(ForecastService.Failure.class)
    public ResponseEntity<Map<String, String>> failure(ForecastService.Failure error) {
        return ResponseEntity.status(error.status).body(Map.of("code", error.code, "message", error.getMessage()));
    }
}
