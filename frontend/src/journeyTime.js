// Modern Sri Lankan civil time is UTC+05:30, independent of the browser timezone.
export const colomboLocal = value => new Date(new Date(value).getTime() + 330 * 60_000).toISOString().slice(0, 16);
export const departureTimestamp = local => `${local}:00+05:30`;
export function validateDeparture(mode, local, now) {
  if (mode === 'LEAVE_NOW') return '';
  if (!['LATER_TODAY', 'FUTURE_DATE'].includes(mode)) return 'Choose a supported journey mode.';
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return 'Choose a departure date and time in Asia/Colombo.';
  const instant = Date.parse(departureTimestamp(local));
  if (!Number.isFinite(instant) || colomboLocal(instant) !== local) return 'Choose a valid calendar date and time.';
  if (instant < now || instant > now + 7 * 86400_000) return 'Departure must be from now through seven days ahead.';
  const today = colomboLocal(now).slice(0, 10), selected = local.slice(0, 10);
  if (mode === 'LATER_TODAY' && selected !== today) return 'Later Today must use today’s Sri Lankan date.';
  if (mode === 'FUTURE_DATE' && selected <= today) return 'Use Later Today for this evening; Future Date begins tomorrow.';
  return '';
}
export const journeyPayload = journey => ({ mode: journey.mode, departureAt: journey.mode === 'LEAVE_NOW' ? null : departureTimestamp(journey.local) });
