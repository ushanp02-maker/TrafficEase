package lk.trafficease.forecast;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import lk.trafficease.history.PredictionHistory;
import com.fasterxml.jackson.databind.ObjectMapper;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.ArgumentMatchers.any;
class ForecastHistoryApiTest {
    @Test void savingRequiresExplicitOptInAndReportsDatabaseState() throws Exception {
        var model = mock(ForecastService.class); var history = mock(PredictionHistory.class);
        var result = new ObjectMapper().readTree("{\"experimental\":true,\"dataSource\":\"SYNTHETIC\",\"congestion\":\"LOW\"}");
        when(model.predict(any())).thenReturn(result); when(history.save(any())).thenReturn("UNAVAILABLE");
        var mvc = MockMvcBuilders.standaloneSetup(new ForecastController(model, history)).build();
        mvc.perform(post("/api/forecasts").contentType("application/json").content("{\"targetId\":\"fictional\",\"weather\":\"CLEAR\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.historyStatus").value("NOT_REQUESTED"));
        verifyNoInteractions(history);
        mvc.perform(post("/api/forecasts").contentType("application/json").content("{\"targetId\":\"fictional\",\"weather\":\"CLEAR\",\"saveHistory\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.historyStatus").value("UNAVAILABLE"))
            .andExpect(jsonPath("$.congestion").value("LOW"));
        verify(history).save(any());
    }
}
