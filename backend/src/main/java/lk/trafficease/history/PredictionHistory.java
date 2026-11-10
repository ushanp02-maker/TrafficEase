package lk.trafficease.history;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

/** Optional shared demonstration history. Explicit opt-in only; never stores GPS or real route data. */
@Service
public class PredictionHistory {
    private final JdbcTemplate jdbc;
    private final Clock clock;
    @org.springframework.beans.factory.annotation.Autowired
    public PredictionHistory(ObjectProvider<JdbcTemplate> provider) { this(provider.getIfAvailable(), Clock.systemUTC()); }
    PredictionHistory(JdbcTemplate jdbc, Clock clock) { this.jdbc = jdbc; this.clock = clock; }
    public Map<String, Object> status() {
        return Map.of("enabled", jdbc != null, "retentionDays", 7, "maxRecords", 1000,
            "shared", true, "dataSource", "SYNTHETIC", "experimental", true,
            "notice", "Opt-in fictional scenarios only, visible to everyone with demo access. No GPS, origin/destination or camera data is stored. Expired records are hidden and purged on the next history read/save.");
    }
    private Timestamp cutoff() { return Timestamp.from(clock.instant().minus(Duration.ofDays(7))); }
    private void purge() { jdbc.update("DELETE FROM synthetic_prediction_history WHERE created_at < ?", cutoff()); }
    public synchronized String save(JsonNode forecast) {
        if (jdbc == null) return "DISABLED";
        if (!forecast.path("experimental").asBoolean() || !"SYNTHETIC".equals(forecast.path("dataSource").asText())
            || forecast.path("target").path("id").asText().isBlank() || forecast.path("modelVersion").asText().isBlank()
            || forecast.path("datasetVersion").asText().isBlank()) return "REJECTED";
        try {
            purge();
            Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM synthetic_prediction_history", Integer.class);
            if (count != null && count >= 1000) return "CAPACITY_REACHED";
            jdbc.update("INSERT INTO synthetic_prediction_history (target_id,forecast_at,created_at,congestion,weather,is_holiday,model_version,dataset_version,data_source,experimental) VALUES (?,?,?,?,?,?,?,?, 'SYNTHETIC',TRUE)",
                forecast.path("target").path("id").asText(), Timestamp.from(OffsetDateTime.parse(forecast.path("forecastAt").asText()).toInstant()),
                Timestamp.from(clock.instant()), forecast.path("congestion").asText(), forecast.path("features").path("weather").asText(),
                forecast.path("features").path("is_holiday").asBoolean(), forecast.path("modelVersion").asText(), forecast.path("datasetVersion").asText());
            return "SAVED";
        } catch (DataAccessException | DateTimeException error) { return "UNAVAILABLE"; }
    }
    public synchronized Map<String, Object> recent() {
        if (jdbc == null) return Map.of("status", "DISABLED", "records", List.of());
        try {
            purge();
            var rows = jdbc.query("SELECT id,target_id,forecast_at,created_at,congestion,weather,model_version,dataset_version FROM synthetic_prediction_history WHERE created_at >= ? ORDER BY id DESC LIMIT 20", (rs, row) -> Map.of(
                "id", rs.getLong("id"), "targetId", rs.getString("target_id"), "forecastAt", rs.getTimestamp("forecast_at").toInstant().toString(),
                "createdAt", rs.getTimestamp("created_at").toInstant().toString(), "congestion", rs.getString("congestion"), "weather", rs.getString("weather"),
                "modelVersion", rs.getString("model_version"), "datasetVersion", rs.getString("dataset_version"), "dataSource", "SYNTHETIC", "experimental", true), cutoff());
            return Map.of("status", "AVAILABLE", "records", rows);
        } catch (DataAccessException error) { return Map.of("status", "UNAVAILABLE", "records", List.of()); }
    }
}
