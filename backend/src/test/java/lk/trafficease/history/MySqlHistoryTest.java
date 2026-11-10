package lk.trafficease.history;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import java.nio.file.*;
import java.sql.Timestamp;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real MySQL 8 integration test; explicitly enabled using an ephemeral local database. */
@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_PASSWORD_FILE", matches = ".+")
class MySqlHistoryTest {
    @Test void migrationsOptInProvenanceRetentionAndBoundedHistory() throws Exception {
        var config = new MySqlConfiguration();
        String password = Files.readString(Path.of(System.getenv("MYSQL_TEST_PASSWORD_FILE"))).trim();
        try (var pool = config.historyDataSource("jdbc:mysql://127.0.0.1:3306/trafficease?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true&sslMode=DISABLED&allowPublicKeyRetrieval=true", "te_history", password)) {
            var migrations = config.historyMigrations(pool);
            migrations.migrate(); assertEquals(0, migrations.migrate().migrationsExecuted);
            var jdbc = new JdbcTemplate(pool);
            jdbc.update("DELETE FROM synthetic_prediction_history");
            Clock clock = Clock.fixed(Instant.parse("2026-11-11T04:30:00Z"), ZoneOffset.UTC);
            var history = new PredictionHistory(jdbc, clock);
            var data = new ObjectMapper().readTree("""
                {"experimental":true,"dataSource":"SYNTHETIC","target":{"id":"region-uva"},"forecastAt":"2026-11-11T19:00:00+05:30", "congestion":"HIGH","features":{"weather":"RAIN","is_holiday":false},"modelVersion":"test-model", "datasetVersion":"test-synthetic"}
                """);
            assertEquals("SAVED", history.save(data));
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM synthetic_prediction_history", Integer.class));
            assertEquals("AVAILABLE", history.recent().get("status"));
            assertEquals(Timestamp.from(Instant.parse("2026-11-11T13:30:00Z")), jdbc.queryForObject("SELECT forecast_at FROM synthetic_prediction_history", Timestamp.class));
            ((com.fasterxml.jackson.databind.node.ObjectNode) data).put("dataSource", "OBSERVED");
            assertEquals("REJECTED", history.save(data));
            assertThrows(org.springframework.dao.DataAccessException.class, () -> jdbc.update("UPDATE synthetic_prediction_history SET data_source='OBSERVED'"));
            jdbc.update("UPDATE synthetic_prediction_history SET created_at=?", Timestamp.from(clock.instant().minus(Duration.ofDays(8))));
            history.recent();
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM synthetic_prediction_history", Integer.class));
            ((com.fasterxml.jackson.databind.node.ObjectNode) data).put("dataSource", "SYNTHETIC");
            assertEquals("SAVED", history.save(data));
            for (int i = 0; i < 10; i++) jdbc.update("INSERT INTO synthetic_prediction_history (target_id,forecast_at,created_at,congestion,weather,is_holiday,model_version,dataset_version,data_source,experimental) SELECT target_id,forecast_at,created_at,congestion,weather,is_holiday,model_version,dataset_version,data_source,experimental FROM synthetic_prediction_history LIMIT 1000");
            assertEquals("CAPACITY_REACHED", history.save(data));
            jdbc.update("DELETE FROM synthetic_prediction_history");
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success=TRUE AND version='1'", Integer.class));
            assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='trafficease' AND table_name='synthetic_prediction_history' AND column_name IN ('latitude','longitude','origin','destination','gps')", Integer.class));
        }
    }
    @Test void disabledProfileDoesNotNeedDatabaseOrPersistAnything() throws Exception {
        var history = new PredictionHistory(null, Clock.systemUTC());
        assertEquals(false, history.status().get("enabled"));
        assertEquals("DISABLED", history.save(new ObjectMapper().createObjectNode()));
        assertEquals("DISABLED", history.recent().get("status"));
    }
}
