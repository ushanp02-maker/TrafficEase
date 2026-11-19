export function validateForecastTarget(targetId, targets) {
  if (!targetId || typeof targetId !== 'string') {
    return 'Please select a road or region scenario.';
  }

  if (!Array.isArray(targets)) {
    return 'Forecast scenario catalog is unavailable.';
  }

  const supported = targets.some(
    target => target && target.id === targetId
  );

  if (!supported) {
    return 'Selected road or region scenario is not supported.';
  }

  return '';
}