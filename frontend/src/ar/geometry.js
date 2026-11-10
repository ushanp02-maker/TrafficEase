// Geometry-only estimates, not visual road recognition or a world-registered AR engine.
const rad = value => value * Math.PI / 180;
export const normalize = angle => ((angle % 360) + 360) % 360;
export const angleDelta = (a, b) => ((a - b + 540) % 360) - 180;
export function distance(a, b) {
  const x = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(x)));
}
export function bearing(a, b) {
  const d = rad(b.longitude - a.longitude), p = rad(a.latitude), q = rad(b.latitude);
  return normalize(Math.atan2(Math.sin(d) * Math.cos(q), Math.cos(p) * Math.sin(q) - Math.sin(p) * Math.cos(q) * Math.cos(d)) * 180 / Math.PI);
}
export function nearestOnSegment(position, a, b) {
  const scale = Math.cos(rad(position.latitude));
  const x1 = rad(a.longitude - position.longitude) * 6371000 * scale, y1 = rad(a.latitude - position.latitude) * 6371000;
  const x2 = rad(b.longitude - position.longitude) * 6371000 * scale, y2 = rad(b.latitude - position.latitude) * 6371000;
  const dx = x2 - x1, dy = y2 - y1;
  if (dx * dx + dy * dy < 1) return null;
  const t = Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / (dx * dx + dy * dy)));
  return { distance: Math.hypot(x1 + t * dx, y1 + t * dy), latitude: a.latitude + t * (b.latitude - a.latitude), longitude: a.longitude + t * (b.longitude - a.longitude), bearing: bearing(a, b) };
}
export function nearbyCandidates(candidates, position) {
  if (!position) return [];
  const hits = [];
  for (const candidate of candidates || []) {
    const points = candidate.geometry?.coordinates || [];
    // Keep one closest segment per named route step, avoiding curvature self-ambiguity.
    let best = null;
    for (let i = 1; i < points.length; i++) {
      const p = nearestOnSegment(position, { longitude: points[i-1][0], latitude: points[i-1][1] }, { longitude: points[i][0], latitude: points[i][1] });
      if (p && p.distance <= 50 && (!best || p.distance < best.distance)) best = p;
    }
    if (!best) continue;
    const duplicate = hits.find(hit => hit.name === candidate.name && distance(hit, best) < 0.1 && Math.abs(angleDelta(hit.bearing, best.bearing)) < 1);
    if (duplicate) { if (!duplicate.routeIds.includes(candidate.routeId)) duplicate.routeIds.push(candidate.routeId); }
    else hits.push({ ...best, name: candidate.name, routeIds: [candidate.routeId] });
  }
  return hits;
}
export function extractHeading(event, screenAngle = 0) {
  // Rear camera estimate only for upright portrait use; other poses require map fallback.
  if (screenAngle !== 0 || !Number.isFinite(event.beta) || event.beta < 45 || event.beta > 135 || !Number.isFinite(event.gamma) || Math.abs(event.gamma) > 35) return null;
  if (Number.isFinite(event.webkitCompassHeading)) {
    if (!Number.isFinite(event.webkitCompassAccuracy) || event.webkitCompassAccuracy < 0 || event.webkitCompassAccuracy > 20) return null;
    return { degrees: normalize(event.webkitCompassHeading), accuracy: event.webkitCompassAccuracy, source: 'webkit compass (approximate)' };
  }
  if (!(event.absolute || event.type === 'deviceorientationabsolute') || !Number.isFinite(event.alpha)) return null;
  const a = rad(event.alpha), b = rad(event.beta), g = rad(event.gamma);
  const x = -Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g);
  const y = -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g);
  return { degrees: normalize(Math.atan2(x, y) * 180 / Math.PI), accuracy: null, source: 'absolute orientation (error not reported)' };
}
export function alignment({ gps, heading, rearCamera, routeAnchor, generatedAt, candidates, now }) {
  const fallback = reason => ({ reliable: false, reason });
  if (!rearCamera) return fallback('Rear camera unavailable or not verified. Use the map.');
  if (!gps || !Number.isFinite(gps.accuracy) || gps.accuracy <= 0 || gps.accuracy > 30 || now - gps.timestamp > 10000 || gps.timestamp > now + 5000) return fallback('GPS is missing, stale or uncertain. Use the map or a manual origin.');
  if (Number.isFinite(gps.speed) && gps.speed > 1.5) return fallback('Movement detected. Pause directional guidance and use the map as a passenger.');
  if (!heading || !Number.isFinite(heading.degrees) || !heading.stable || now - heading.timestamp > 2000 || heading.timestamp > now + 5000 || (heading.accuracy != null && (!Number.isFinite(heading.accuracy) || heading.accuracy < 0 || heading.accuracy > 20))) return fallback('Compass is missing, unstable, stale or phone is not upright in portrait. Use the map.');
  if (!routeAnchor || !Number.isFinite(Date.parse(generatedAt)) || Date.parse(generatedAt) > now + 5000 || now - Date.parse(generatedAt) > 120000 || distance(gps, routeAnchor) > 25) return fallback('GPS route missing, stale or no longer near its starting point. Recalculate or use the map.');
  const hits = nearbyCandidates(candidates, gps).filter(hit => hit.distance <= Math.min(40, gps.accuracy + 15))
    .map(hit => ({ ...hit, headingError: Math.abs(angleDelta(hit.bearing, heading.degrees)) })).sort((a, b) => a.headingError - b.headingError);
  if (!hits.length || hits[0].headingError > 20) return fallback('No returned road segment aligns with this heading. Use the map.');
  if (hits[1] && hits[1].headingError - hits[0].headingError < 15) return fallback('Several road directions fit this uncertain position/heading. Use the map.');
  return { reliable: true, candidate: hits[0], reason: 'Approximate route-segment match, not camera recognition. Compass bias and magnetic interference may remain.' };
}
export function recommendation(match, routing) {
  if (!match?.reliable || match.candidate.routeIds.length !== 1 || !routing?.routes?.length || routing.estimateKind !== 'BASELINE_ROUTING_ESTIMATE' || routing.comparisonScope !== 'RETURNED_ROUTES_ONLY' || routing.routes.some(r => !Number.isFinite(r.durationSeconds) || r.durationSeconds <= 0)) return null;
  const current = routing.routes.find(r => r.id === match.candidate.routeIds[0]);
  const fastest = [...routing.routes].sort((a,b) => a.durationSeconds - b.durationSeconds)[0];
  if (!current || fastest.id === current.id || current.durationSeconds - fastest.durationSeconds < 1) return null;
  return { routeId: fastest.id, seconds: Math.round(current.durationSeconds - fastest.durationSeconds) };
}
