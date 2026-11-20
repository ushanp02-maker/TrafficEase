export function validateForecastTime(time, min, max) {
  if (typeof time !== 'string' || !time.trim()) {
    return 'Please select a forecast date and time.';
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(time)) {
    return 'Please enter a valid date and time.';
  }

  const selected = Date.parse(`${time}:00+05:30`);
  const minimum = Date.parse(min);
  const maximum = Date.parse(max);

  if (!Number.isFinite(selected) ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum)) {
    return 'Invalid forecast date and time.';
  }

  const normalized = new Date(selected + 330 * 60000)
    .toISOString().slice(0, 16);

  if (normalized !== time) {
    return 'Please enter a valid calendar date and time.';
  }

  if (selected < minimum) {
    return 'Please select a future forecast time.';
  }

  if (selected > maximum) {
    return 'Forecast date must be within the supported seven-day period.';
  }

  return '';
}
