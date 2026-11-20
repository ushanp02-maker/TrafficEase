import test from 'node:test';
import assert from 'node:assert/strict';
import { validateForecastTarget } from '../src/utils/forecastTargetValidation.js';

const targets = [
  { id: 'ROAD_01', name: 'Sample Road' },
  { id: 'REGION_01', name: 'Sample Region' }
];

test('rejects missing target', () => {
  assert.match(validateForecastTarget('', targets), /select/);
});

test('rejects unknown target', () => {
  assert.match(validateForecastTarget('UNKNOWN', targets), /not supported/);
});

test('rejects unavailable catalog', () => {
  assert.match(validateForecastTarget('ROAD_01', null), /unavailable/);
});

test('accepts valid road target', () => {
  assert.equal(validateForecastTarget('ROAD_01', targets), '');
});

test('accepts valid region target', () => {
  assert.equal(validateForecastTarget('REGION_01', targets), '');
});