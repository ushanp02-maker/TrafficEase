package lk.trafficease.history;
import org.junit.jupiter.api.Test;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Clock;
import static org.junit.jupiter.api.Assertions.*;
class HistoryDisabledTest {
    @Test void noDatabaseIsRequiredByDefault() {
        var history = new PredictionHistory(null, Clock.systemUTC());
        assertEquals(false, history.status().get("enabled"));
        assertEquals("DISABLED", history.save(new ObjectMapper().createObjectNode()));
        assertEquals("DISABLED", history.recent().get("status"));
    }
}
