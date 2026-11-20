import test from 'node:test';
import assert from 'node:assert/strict';
import { validateForecastTime } from '../src/utils/forecastValidation.js';

const min = '2026-11-19T10:00:00+05:30';
const max = '2026-11-26T10:00:00+05:30';

test('rejects empty forecast time', () => {
  assert.match(validateForecastTime('', min, max), /select/);
});

test('rejects past forecast time', () => {
  assert.match(
    validateForecastTime('2026-11-18T10:00', min, max),
    /future/
  );
});

test('rejects dates beyond seven days', () => {
  assert.match(
    validateForecastTime('2026-11-27T10:00', min, max),
    /seven-day/
  );
});

test('accepts valid forecast time', () => {
  assert.equal(
    validateForecastTime('2026-11-20T10:00', min, max),
    ''
  );
});

test('rejects invalid calendar dates', () => {
  assert.match(
    validateForecastTime('2026-02-30T10:00', min, max),
    /valid calendar/
  );
});
