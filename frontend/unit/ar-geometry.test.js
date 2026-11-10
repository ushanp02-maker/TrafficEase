import test from 'node:test';
import assert from 'node:assert/strict';
import { alignment, angleDelta, bearing, distance, extractHeading, nearestOnSegment, nearbyCandidates, recommendation } from '../src/ar/geometry.js';
const now = Date.parse('2026-11-10T10:00:00Z');
const gps = { latitude: 7, longitude: 80, accuracy: 5, timestamp: now, speed: 0 };
const north = { name: 'Mapped Road A', routeId: 'route-1', geometry: { type: 'LineString', coordinates: [[80, 7], [80, 7.001]] } };
const settings = { gps, heading: { degrees: 0, stable: true, timestamp: now }, rearCamera: true, routeAnchor: gps, generatedAt: new Date(now).toISOString(), candidates: [north], now };
const routeData = { estimateKind: 'BASELINE_ROUTING_ESTIMATE', comparisonScope: 'RETURNED_ROUTES_ONLY', routes: [{ id: 'route-1', durationSeconds: 600 }, { id: 'route-2', durationSeconds: 500 }] };
test('bearings and wraparound are geographic rather than image recognition', () => {
  assert.equal(bearing(gps, { latitude: 7.001, longitude: 80 }), 0);
  assert.ok(Math.abs(bearing(gps, { latitude: 7, longitude: 80.001 }) - 90) < .01);
  assert.equal(angleDelta(359, 1), -2); assert.equal(distance(gps, gps), 0);
});
test('nearest projection rejects degenerate edges', () => {
  assert.equal(nearestOnSegment(gps, gps, gps), null);
  assert.equal(nearbyCandidates([north], gps).length, 1);
});
test('absolute orientation and iOS compass require an upright portrait pose', () => {
  assert.equal(extractHeading({ alpha: 270, beta: 90, gamma: 0, absolute: true }).degrees, 90);
  assert.equal(extractHeading({ webkitCompassHeading: 30, webkitCompassAccuracy: 10, beta: 90, gamma: 0 }).degrees, 30);
  assert.equal(extractHeading({ alpha: 0, beta: 0, gamma: 0, absolute: true }), null);
  assert.equal(extractHeading({ alpha: 0, beta: 90, gamma: 0, absolute: false }), null);
  assert.equal(extractHeading({ alpha: 0, beta: 90, gamma: 0, absolute: true }, 90), null);
  assert.equal(extractHeading({ webkitCompassHeading: 10, webkitCompassAccuracy: 40, beta: 90, gamma: 0 }), null);
});
test('good fresh samples produce only an approximate candidate match', () => {
  const match = alignment(settings); assert.equal(match.reliable, true); assert.equal(match.candidate.name, 'Mapped Road A');
});
for (const [label, changes] of [
  ['missing rear camera', { rearCamera: false }], ['no gps', { gps: null }],
  ['poor accuracy', { gps: { ...gps, accuracy: 100 } }], ['stale gps', { gps: { ...gps, timestamp: now - 11000 } }],
  ['future gps', { gps: { ...gps, timestamp: now + 6000 } }], ['movement', { gps: { ...gps, speed: 2 } }],
  ['unstable heading', { heading: { ...settings.heading, stable: false } }], ['stale heading', { heading: { ...settings.heading, timestamp: now - 3000 } }],
  ['wrong direction', { heading: { ...settings.heading, degrees: 180 } }], ['missing route', { routeAnchor: null }],
  ['stale route', { generatedAt: new Date(now - 130000).toISOString() }], ['invalid timestamp', { generatedAt: 'invalid' }],
  ['off route origin', { routeAnchor: { latitude: 7.01, longitude: 80 } }], ['unreturned roads', { candidates: [] }],
]) test(`fallback: ${label}`, () => assert.equal(alignment({ ...settings, ...changes }).reliable, false));
test('parallel roads with even the same name remain ambiguous', () => {
  const parallel = { ...north, routeId: 'route-2', geometry: { type: 'LineString', coordinates: [[80.00003, 7], [80.00003, 7.001]] } };
  assert.equal(alignment({ ...settings, candidates: [north, parallel] }).reliable, false);
});
test('shared geometry is merged, not claimed to distinguish alternatives', () => {
  const match = alignment({ ...settings, candidates: [north, { ...north, routeId: 'route-2' }] });
  assert.equal(match.candidate.routeIds.length, 2); assert.equal(recommendation(match, routeData), null);
});
test('only genuine comparable slower route gets a baseline difference', () => {
  assert.equal(recommendation(alignment(settings), routeData).seconds, 100);
  assert.equal(recommendation({ ...alignment(settings), reliable: false }, routeData), null);
  assert.equal(recommendation(alignment(settings), { ...routeData, estimateKind: 'EXPERIMENTAL_AI' }), null);
  assert.equal(recommendation(alignment(settings), { ...routeData, routes: [routeData.routes[0]] }), null);
});
