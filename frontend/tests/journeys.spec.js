import { test, expect } from '@playwright/test';
const now = '2026-11-11T10:00:00+05:30';
const target = { id: 'fictional', name: 'Explicitly hypothetical scenario', kind: 'ROAD_SCENARIO' };
const places = { Kandy: { id: '1', name: 'Kandy', latitude: 7.29, longitude: 80.63 }, Matale: { id: '2', name: 'Matale', latitude: 7.47, longitude: 80.62 } };
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(now) });
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/journeys/capabilities', route => route.fulfill({ json: { now, maxDepartureAt: '2026-11-18T10:00:00+05:30', timeZone: 'Asia/Colombo', futureEstimatesSupported: false } }));
  await page.route('**/api/locations?*', route => route.fulfill({ json: { locations: [places[new URL(route.request().url()).searchParams.get('query')]] } }));
  await page.route('**/api/forecasts/catalog', route => route.fulfill({ json: { experimental: true, dataSource: 'SYNTHETIC', now, maxForecastAt: '2026-11-18T10:00:00+05:30', modelStatus: 'ready', targets: [target], weatherOptions: ['CLEAR'], coverageNote: 'Fictional only' } }));
  await page.route('**/api/forecasts/history/status', route => route.fulfill({ json: { enabled: true } }));
  await page.goto('/');
});
test('evening departure reaches routing and carries to AI and map-only AR', async ({ page }) => {
  await expect(page.getByRole('option', { name: 'Later Today' })).toBeEnabled();
  await page.getByLabel('JOURNEY MODE').selectOption('LATER_TODAY');
  await page.getByLabel('DEPARTURE DATE AND TIME').fill('2026-11-11T19:00');
  for (const [label, name] of [['STARTING POINT', 'Kandy'], ['DESTINATION', 'Matale']]) {
    await page.getByRole('textbox', { name: label, exact: true }).fill(name);
    await page.getByRole('button', { name: `Search ${label.toLowerCase()}` }).click();
    await page.getByRole('button', { name, exact: true }).click();
  }
  await page.route('**/api/routes', route => {
    expect(route.request().postDataJSON()).toEqual({ originId: '1', destinationId: '2', mode: 'LATER_TODAY', departureAt: '2026-11-11T19:00:00+05:30' });
    return route.fulfill({ status: 503, json: { message: 'Test provider unavailable; no invented route.' } });
  });
  await page.getByRole('button', { name: /Calculate road routes/ }).click();
  await expect(page.getByRole('alert')).toContainText('no invented route');
  await page.getByRole('button', { name: /Explore AI scenarios for this departure/ }).click();
  await expect(page.getByLabel('FORECAST DATE AND TIME', { exact: false })).toHaveValue('2026-11-11T19:00');
  await expect(page.getByText('No geographic route-to-scenario mapping', { exact: false })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'AR Navigation', exact: true }).click();
  await expect(page.getByLabel('JOURNEY MODE')).toHaveValue('LATER_TODAY');
  await expect(page.getByText('Scheduled departure · map planning only.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Map fallback · alignment uncertain' })).toBeVisible();
});
test('scheduled timestamp input requires future date and exposes a seven-day maximum', async ({ page }) => {
  await expect(page.getByRole('option', { name: 'Future Date' })).toBeEnabled();
  await page.getByLabel('JOURNEY MODE').selectOption('FUTURE_DATE');
  const input = page.getByLabel('DEPARTURE DATE AND TIME');
  await expect(input).toHaveAttribute('max', '2026-11-18T10:00');
  await input.fill('2026-11-11T19:00');
  await expect(page.getByText('Use Later Today for this evening;', { exact: false })).toBeVisible();
});
test('history is explicit opt-in and shows storage outcome without changing model result', async ({ page }) => {
  await page.getByRole('navigation').getByRole('button', { name: 'AI Predictions', exact: true }).click();
  const save = page.getByRole('checkbox', { name: /Save my next synthetic scenario/ });
  await expect(save).not.toBeChecked(); await save.check();
  await page.route('**/api/forecasts', route => {
    expect(route.request().postDataJSON().saveHistory).toBe(true);
    return route.fulfill({ json: { experimental: true, dataSource: 'SYNTHETIC', target, forecastAt: now, congestion: 'LOW', features: { weather: 'CLEAR', is_holiday: false }, modelVersion: 'fixture', datasetVersion: 'fixture', limitations: [], historyStatus: 'SAVED' } });
  });
  await page.getByRole('button', { name: /Generate experimental forecast/ }).click();
  await expect(page.getByRole('heading', { name: 'LOW congestion scenario' })).toBeVisible();
  await expect(page.getByText('Synthetic scenario saved to shared history.', { exact: false })).toBeVisible();
  await page.route('**/api/forecasts/history', route => route.fulfill({ json: { status: 'AVAILABLE', records: [] } }));
  await page.getByRole('button', { name: 'View latest shared synthetic scenarios' }).click();
  await expect(page.getByText('History: AVAILABLE. 0 recent scenarios.')).toBeVisible();
});
test('model evaluation is accessible and explicitly synthetic', async ({ page }) => {
  await page.route('**/api/forecasts/model', route => route.fulfill({ json: { experimental: true, dataSource: 'SYNTHETIC', modelStatus: 'ready', metadata: { modelVersion: 'evaluated-fixture', datasetVersion: 'fictional-fixture', features: ['hour','weekday'], evaluation: { majority_baseline: { test: { macro_f1: 0.22 } }, random_forest: { test: { macro_f1: 0.71 } } } } } }));
  await page.getByRole('navigation').getByRole('button', { name: 'AI Predictions', exact: true }).click();
  await page.getByRole('button', { name: 'View synthetic model evaluation' }).click();
  await expect(page.getByText('Version: evaluated-fixture', { exact: false })).toBeVisible();
  await page.getByText('Training, validation and held-out test metrics', { exact: true }).click();
  await expect(page.locator('.model-metrics')).toContainText('majority_baseline');
  await expect(page.locator('.model-metrics')).toContainText('random_forest');
  await expect(page.getByText('Synthetic-only evaluation cannot establish real Sri Lankan traffic accuracy.', { exact: false })).toBeVisible();
});
