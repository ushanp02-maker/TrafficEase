package lk.trafficease.government;
import java.time.Instant;
import java.util.*;
public final class GovernmentModels {
    private GovernmentModels() {}
    public static final Set<String> CATEGORIES = Set.of("ROAD_CLOSURE","ACCIDENT","WEATHER","GENERAL");
    public static final List<String> REGIONS = List.of("NATIONWIDE","WESTERN","CENTRAL","SOUTHERN","NORTHERN","EASTERN","NORTH_WESTERN","NORTH_CENTRAL","UVA","SABARAGAMUWA");
    public record Edit(String title, String body, String category, String region, String affectedArea, String validFrom, String validUntil, Long revision) {}
    public record Announcement(String id, String title, String body, String category, String region, String affectedArea,
                               String validFrom, String validUntil, String status, String createdAt, String updatedAt,
                               String publishedAt, long revision, boolean demonstration) {}
    public record Audit(String id, String actor, String action, String announcementId, String at) {}
    public static class Problem extends RuntimeException {
        final int status;
        public Problem(int status, String message) { super(message);this.status=status; }
    }
}
