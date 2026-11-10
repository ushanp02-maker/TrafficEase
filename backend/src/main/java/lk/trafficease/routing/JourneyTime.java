package lk.trafficease.routing;

import java.time.*;
import java.util.List;
import java.util.Map;

/** Departure context only: OSRM does not use this value to predict traffic or an ETA. */
public final class JourneyTime {
    public static final ZoneId ZONE = ZoneId.of("Asia/Colombo");
    public record Departure(String mode, String departureAt, String timeZone,
                            boolean trafficAware, boolean futureEstimatesSupported, String status, String message) {}
    private JourneyTime() {}
    public static Departure resolve(String mode, String departureAt, Clock clock) {
        String selected = mode == null ? "LEAVE_NOW" : mode;
        Instant now = clock.instant();
        ZonedDateTime localNow = now.atZone(ZONE);
        Instant requested;
        if ("LEAVE_NOW".equals(selected)) {
            if (departureAt != null) throw invalid("Leave Now does not accept a scheduled timestamp.");
            requested = now;
        } else {
            if (!List.of("LATER_TODAY", "FUTURE_DATE").contains(selected)) throw invalid("Choose Leave Now, Later Today or Future Date.");
            try { requested = OffsetDateTime.parse(departureAt).toInstant(); }
            catch (Exception error) { throw invalid("Provide a departure timestamp with an explicit UTC offset."); }
            if (requested.isBefore(now) || requested.isAfter(now.plus(Duration.ofDays(7))))
                throw invalid("Departure must be from now through exactly seven days ahead in Asia/Colombo.");
            LocalDate date = requested.atZone(ZONE).toLocalDate();
            if ("LATER_TODAY".equals(selected) && !date.equals(localNow.toLocalDate()))
                throw invalid("Later Today must be on today's Sri Lankan calendar date.");
            if ("FUTURE_DATE".equals(selected) && !date.isAfter(localNow.toLocalDate()))
                throw invalid("Future Date must be after today; choose Later Today for this evening.");
        }
        return new Departure(selected, requested.atZone(ZONE).toOffsetDateTime().toString(), ZONE.getId(), false, false,
            "BASELINE_ONLY", "Departure recorded as planning context only. OSRM durations are baseline estimates, not traffic-aware or departure-specific forecasts. No arrival time is predicted.");
    }
    public static Map<String, Object> capabilities(Clock clock) {
        Instant now = clock.instant();
        return Map.of("now", now.atZone(ZONE).toOffsetDateTime().toString(), "maxDepartureAt", now.plus(Duration.ofDays(7)).atZone(ZONE).toOffsetDateTime().toString(),
            "timeZone", ZONE.getId(), "modes", List.of("LEAVE_NOW", "LATER_TODAY", "FUTURE_DATE"),
            "trafficAware", false, "futureEstimatesSupported", false, "provider", "OSRM baseline routing", "status", "BASELINE_ONLY");
    }
    private static ApiFailure invalid(String message) { return new ApiFailure(400, "INVALID_DEPARTURE", message); }
}
