package lk.trafficease.routing;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.net.URI;
import java.net.http.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProviderClientTest {
    @SuppressWarnings("unchecked")
    HttpResponse<String> response(int status, String body) {
        HttpResponse<String> r = mock(HttpResponse.class);
        when(r.statusCode()).thenReturn(status); when(r.body()).thenReturn(body);
        when(r.headers()).thenReturn(HttpHeaders.of(java.util.Map.of("Retry-After", java.util.List.of("60")), (a,b) -> true));
        return r;
    }
    @Test void identifiesApplicationAndLimitsRequests() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> upstream = response(200,"[]");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(upstream);
        ProviderClient client = new ProviderClient(new ObjectMapper(),"TrafficEase-Test",http);
        assertTrue(client.get("search","https://example.org/search").isArray());
        assertEquals(429,assertThrows(ApiFailure.class, () -> client.get("search","https://example.org/search")).status);
        var capture = org.mockito.ArgumentCaptor.forClass(HttpRequest.class);
        verify(http, times(1)).send(capture.capture(),any(HttpResponse.BodyHandler.class));
        assertEquals("TrafficEase-Test",capture.getValue().headers().firstValue("User-Agent").orElseThrow());
        assertTrue(capture.getValue().timeout().isPresent());
    }
    @Test void providerQuotaDoesNotRetryImmediately() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> upstream = response(429,"{}");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(upstream);
        ProviderClient client = new ProviderClient(new ObjectMapper(),"TrafficEase-Test",http);
        assertEquals("PROVIDER_RATE_LIMITED",assertThrows(ApiFailure.class, () -> client.get("search","https://example.org/search")).code);
        assertEquals("RATE_LIMITED",assertThrows(ApiFailure.class, () -> client.get("search","https://example.org/search")).code);
        verify(http,times(1)).send(any(HttpRequest.class),any(HttpResponse.BodyHandler.class));
    }
    @Test void unavailableUpstreamReturnsActionableFailure() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> upstream = response(403,"denied");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(upstream);
        ProviderClient client = new ProviderClient(new ObjectMapper(),"TrafficEase-Test",http);
        assertEquals("PROVIDER_UNAVAILABLE",assertThrows(ApiFailure.class, () -> client.get("route","https://example.org/route")).code);
    }
    @Test void malformedUpstreamJsonFailsClosed() throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> upstream = response(200,"not-json");
        when(http.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(upstream);
        ProviderClient client = new ProviderClient(new ObjectMapper(),"TrafficEase-Test",http);
        assertEquals(503,assertThrows(ApiFailure.class, () -> client.get("route","https://example.org/route")).status);
    }
}
