package lk.trafficease.routing;

import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class JourneyTimeTest {
    final Clock ten = Clock.fixed(Instant.parse("2026-11-11T04:30:00Z"), ZoneOffset.UTC); // 10 AM Colombo
    @Test void tenAmCanPlanSevenPmWithoutChangingBaselineCapabilities() {
        var result = JourneyTime.resolve("LATER_TODAY", "2026-11-11T19:00:00+05:30", ten);
        assertEquals("2026-11-11T19:00+05:30", result.departureAt());
        assertFalse(result.trafficAware()); assertFalse(result.futureEstimatesSupported());
    }
    @Test void utcOffsetIsConvertedBeforeCheckingSriLankanDate() {
        assertEquals("2026-11-11T19:00+05:30", JourneyTime.resolve("LATER_TODAY", "2026-11-11T13:30:00Z", ten).departureAt());
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("LATER_TODAY", "2026-11-11T23:00:00-04:00", ten));
    }
    @Test void sevenDayHorizonIsInclusiveButOneNanosecondBeyondFails() {
        assertDoesNotThrow(() -> JourneyTime.resolve("FUTURE_DATE", "2026-11-18T10:00:00+05:30", ten));
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("FUTURE_DATE", "2026-11-18T10:00:00.000000001+05:30", ten));
    }
    @Test void exactNowAcceptedForLaterTodayButPastRejected() {
        assertDoesNotThrow(() -> JourneyTime.resolve("LATER_TODAY", "2026-11-11T10:00:00+05:30", ten));
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("LATER_TODAY", "2026-11-11T09:59:59+05:30", ten));
    }
    @Test void midnightUsesSriLankanCalendarNotUtc() {
        Clock midnight = Clock.fixed(Instant.parse("2026-11-11T18:30:00Z"), ZoneOffset.UTC);
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("LATER_TODAY", "2026-11-11T23:59:00+05:30", midnight));
        assertDoesNotThrow(() -> JourneyTime.resolve("LATER_TODAY", "2026-11-12T00:01:00+05:30", midnight));
    }
    @Test void modeAndTimestampMustBeConsistent() {
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("FUTURE_DATE", "2026-11-11T19:00:00+05:30", ten));
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("LATER_TODAY", "2026-11-12T19:00:00+05:30", ten));
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("LEAVE_NOW", "2026-11-11T19:00:00+05:30", ten));
        assertThrows(ApiFailure.class, () -> JourneyTime.resolve("UNKNOWN", null, ten));
    }
    @Test void malformedOffsetlessAndImpossibleDatesFail() {
        for (String date : new String[]{null, "", "2026-11-11T19:00", "2026-02-30T19:00:00+05:30", "tomorrow"})
            assertThrows(ApiFailure.class, () -> JourneyTime.resolve("LATER_TODAY", date, ten));
    }
    @Test void legacyRequestDefaultsToNowAndCapabilitiesUseSameClock() {
        assertEquals("LEAVE_NOW", JourneyTime.resolve(null, null, ten).mode());
        assertEquals("2026-11-18T10:00+05:30", JourneyTime.capabilities(ten).get("maxDepartureAt"));
    }
    @Test void invalidDepartureNeverUsesPublicProviders() {
        var client = mock(ProviderClient.class); var locations = mock(LocationService.class);
        var service = new RouteService(client, locations, "https://router.project-osrm.org", 300);
        assertThrows(ApiFailure.class, () -> service.calculate(new RoutingModels.RouteRequest("a", "b", "FUTURE_DATE", "2000-01-01T00:00:00Z")));
        verifyNoInteractions(client, locations);
    }
}
