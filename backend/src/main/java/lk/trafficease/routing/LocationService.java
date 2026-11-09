package lk.trafficease.routing;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static lk.trafficease.routing.RoutingModels.*;

@Service
public class LocationService {
    private final ProviderClient client;
    private final String baseUrl;
    private final boolean publicEnabled;
    private record Cached(List<Location> locations, Instant expires) {}
    private final Map<String, Cached> cache = new LinkedHashMap<>();
    public LocationService(ProviderClient client, @Value("${trafficease.geocoding-url}") String baseUrl,
                           @Value("${trafficease.public-geocoding-enabled:false}") boolean publicEnabled) {
        this.client = client; this.baseUrl = baseUrl; this.publicEnabled = publicEnabled;
    }
    public synchronized List<Location> search(String query) {
        if (query == null || query.strip().length() < 2 || query.length() > 160)
            throw new ApiFailure(400, "INVALID_QUERY", "Enter a location name between 2 and 160 characters.");
        String key = query.strip().toLowerCase(Locale.ROOT);
        cache.values().removeIf(c -> c.expires().isBefore(Instant.now()));
        Cached cached = cache.get(key);
        if (cached != null) return cached.locations();
        if (baseUrl.contains("nominatim.openstreetmap.org") && !publicEnabled)
            throw new ApiFailure(503, "GEOCODING_NOT_CONFIGURED", "Location search needs developer opt-in to the Nominatim usage policy or a configured hosted service.");
        JsonNode data = client.get("geocoding", baseUrl + "/search?format=jsonv2&addressdetails=1&countrycodes=lk&limit=6&q="
            + URLEncoder.encode(query.strip(), StandardCharsets.UTF_8));
        if (!data.isArray()) throw new ApiFailure(502, "INVALID_PROVIDER_RESPONSE", "Location provider returned invalid data.");
        List<Location> result = new ArrayList<>();
        for (JsonNode item : data) {
            if (!"lk".equalsIgnoreCase(item.path("address").path("country_code").asText())) continue;
            double lat, lon;
            try { lat = Double.parseDouble(item.path("lat").asText()); lon = Double.parseDouble(item.path("lon").asText()); }
            catch (NumberFormatException ex) { continue; }
            if (!validCoordinates(lat, lon) || item.path("display_name").asText().isBlank()) continue;
            String id = item.path("place_id").asText();
            if (id.isBlank()) continue;
            result.add(new Location(id, item.path("display_name").asText(), lat, lon, "LK"));
        }
        if (cache.size() >= 256) cache.remove(cache.keySet().iterator().next());
        List<Location> locations = List.copyOf(result);
        cache.put(key, new Cached(locations, Instant.now().plusSeconds(86400)));
        return locations;
    }
    public synchronized Location selected(String id) {
        if (id != null) for (Cached c : cache.values()) {
            if (c.expires().isAfter(Instant.now())) for (Location l : c.locations()) if (l.id().equals(id)) return l;
        }
        throw new ApiFailure(400, "LOCATION_SELECTION_REQUIRED", "Search and select both locations again; selections expire after 24 hours or a server restart.");
    }
    // Bounding range is only a sanity check. Country membership comes from geocoder metadata.
    static boolean validCoordinates(double lat, double lon) {
        return Double.isFinite(lat) && Double.isFinite(lon) && lat >= 5.8 && lat <= 10.1 && lon >= 79.3 && lon <= 82.1;
    }
}
