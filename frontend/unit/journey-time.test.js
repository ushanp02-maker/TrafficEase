import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colomboLocal, validateDeparture, journeyPayload } from '../src/journeyTime.js';
const now = Date.parse('2026-11-11T04:30:00Z');
test('10 AM Colombo plans 7 PM regardless of machine timezone', () => {
  assert.equal(colomboLocal(now), '2026-11-11T10:00');
  assert.equal(validateDeparture('LATER_TODAY', '2026-11-11T19:00', now), '');
  assert.deepEqual(journeyPayload({ mode: 'LATER_TODAY', local: '2026-11-11T19:00' }), { mode: 'LATER_TODAY', departureAt: '2026-11-11T19:00:00+05:30' });
});
test('past and seven-day boundary, including calendar mode constraints', () => {
  assert.equal(validateDeparture('FUTURE_DATE', '2026-11-18T10:00', now), '');
  assert.notEqual(validateDeparture('FUTURE_DATE', '2026-11-18T10:01', now), '');
  assert.notEqual(validateDeparture('LATER_TODAY', '2026-11-11T09:59', now), '');
  assert.notEqual(validateDeparture('FUTURE_DATE', '2026-11-11T19:00', now), '');
  assert.notEqual(validateDeparture('LATER_TODAY', '2026-11-12T19:00', now), '');
});
test('Sri Lankan midnight and invalid dates are explicit', () => {
  const midnight = Date.parse('2026-11-11T18:30:00Z');
  assert.equal(colomboLocal(midnight), '2026-11-12T00:00');
  assert.equal(validateDeparture('LATER_TODAY', '2026-11-12T00:01', midnight), '');
  assert.notEqual(validateDeparture('LATER_TODAY', '2026-02-30T12:00', now), '');
  assert.notEqual(validateDeparture('LATER_TODAY', '', now), '');
  assert.deepEqual(journeyPayload({ mode: 'LEAVE_NOW', local: 'stale' }), { mode: 'LEAVE_NOW', departureAt: null });
});
