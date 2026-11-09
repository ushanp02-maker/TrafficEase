package lk.trafficease.routing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.net.*;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

@Component
public class ProviderClient {
    private final HttpClient client;
    private final ObjectMapper mapper;
    private final String userAgent;
    private final Map<String, Long> nextAllowed = new HashMap<>();
    @Autowired
    public ProviderClient(ObjectMapper mapper,
        @Value("${trafficease.user-agent}") String userAgent) {
        this.mapper = mapper; this.userAgent = userAgent;
        HttpClient.Builder builder = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5));
        String proxy = System.getenv("HTTPS_PROXY");
        if (proxy != null && !proxy.isBlank()) {
            URI uri = URI.create(proxy);
            Proxy proxyAddress = new Proxy(Proxy.Type.HTTP, new InetSocketAddress(uri.getHost(), uri.getPort() == -1 ? 80 : uri.getPort()));
            builder.proxy(new ProxySelector() {
                @Override public List<Proxy> select(URI target) {
                    return List.of(Set.of("localhost", "127.0.0.1", "::1").contains(target.getHost()) ? Proxy.NO_PROXY : proxyAddress);
                }
                @Override public void connectFailed(URI target, SocketAddress address, java.io.IOException error) { }
            });
        }
        this.client = builder.build();
    }
    ProviderClient(ObjectMapper mapper, String userAgent, HttpClient client) {
        this.mapper = mapper; this.userAgent = userAgent; this.client = client;
    }
    // Single application instance only. Fail fast rather than queue work on donated services.
    public synchronized JsonNode get(String provider, String url) {
        long now = System.nanoTime();
        if (now < nextAllowed.getOrDefault(provider, 0L))
            throw new ApiFailure(429, "RATE_LIMITED", "Please wait before trying again; the request limit or provider cooldown is active.");
        nextAllowed.put(provider, now + 1_100_000_000L);
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(15))
                .header("User-Agent", userAgent).header("Accept", "application/json").GET().build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429) {
                long seconds = 60;
                try { seconds = Math.max(1, Long.parseLong(response.headers().firstValue("Retry-After").orElse("60"))); }
                catch (NumberFormatException ignored) { /* Conservative cooldown for HTTP-date values. */ }
                nextAllowed.put(provider, System.nanoTime() + Math.min(seconds, 86400) * 1_000_000_000L);
                throw new ApiFailure(503, "PROVIDER_RATE_LIMITED", "Provider quota reached. Try again later.");
            }
            if (response.statusCode() != 200)
                throw new ApiFailure(503, "PROVIDER_UNAVAILABLE", "The location or routing provider is unavailable. Try again later.");
            JsonNode data = mapper.readTree(response.body());
            if (data == null || data.isNull()) throw new ApiFailure(502, "INVALID_PROVIDER_RESPONSE", "Provider returned an empty response.");
            return data;
        } catch (ApiFailure ex) { throw ex; }
        catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new ApiFailure(503, "PROVIDER_UNAVAILABLE", "The provider request was interrupted.");
        } catch (Exception ex) {
            throw new ApiFailure(503, "PROVIDER_UNAVAILABLE", "Cannot reach the provider. Check connectivity or try again later.");
        }
    }
}
