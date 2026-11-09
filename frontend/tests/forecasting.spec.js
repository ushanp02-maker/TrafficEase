import { test, expect } from '@playwright/test';
const now = '2026-11-09T12:00:00+05:30';
const target = { id: 'western-urban', name: 'Western · hypothetical urban corridor', kind: 'ROAD_SCENARIO' };
const catalog = { experimental: true, dataSource: 'SYNTHETIC', now, maxForecastAt: '2026-11-16T12:00:00+05:30', modelStatus: 'ready', timezone: 'Asia/Colombo', targets: [target], weatherOptions: ['CLEAR', 'RAIN', 'HEAVY_RAIN'], coverageNote: 'Fictional scenarios only, not actual regional coverage.' };
const forecast = { experimental: true, dataSource: 'SYNTHETIC', estimateKind: 'EXPERIMENTAL_AI', congestion: 'HIGH', forecastAt: now, target, features: { weather: 'RAIN', is_holiday: 0 }, modelVersion: 'test-synthetic-v1', datasetVersion: 'test-data-v1', limitations: ['Synthetic data only, no real Sri Lankan validation.'] };
async function open(page) { await page.goto('/'); await page.getByRole('navigation').getByRole('button', { name: 'AI Predictions', exact: true }).click(); }
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/forecasts/catalog', route => route.fulfill({ json: catalog }));
  await page.route('**/api/forecasts', route => route.fulfill({ json: forecast }));
});
test('scenario inputs produce experimental labels and clear old results on edits', async ({ page }) => {
  await open(page);
  await page.getByRole('combobox', { name: 'WEATHER SCENARIO', exact: false }).selectOption('RAIN');
  const sent = page.waitForRequest(r => r.url().endsWith('/api/forecasts') && r.method() === 'POST');
  await page.getByRole('button', { name: /Generate experimental forecast/ }).click();
  expect((await sent).postDataJSON()).toEqual({ targetId: 'western-urban', forecastAt: null, weather: 'RAIN', isHoliday: false });
  await expect(page.getByRole('heading', { name: 'HIGH congestion scenario' })).toBeVisible();
  await expect(page.getByText('No journey duration or road speed is estimated.', { exact: false })).toBeVisible();
  await expect(page.getByText('EXPERIMENTAL · SYNTHETIC', { exact: true })).toHaveCount(1);
  await page.getByRole('checkbox', { name: /Hypothetical holiday/ }).check();
  await expect(page.getByRole('heading', { name: 'HIGH congestion scenario' })).toHaveCount(0);
});
test('forecast datetime sends explicit Colombo offset and has seven-day bounds', async ({ page }) => {
  await open(page);
  await page.getByRole('checkbox', { name: 'Use current Sri Lankan time' }).uncheck();
  const date = page.getByLabel('FORECAST DATE AND TIME', { exact: false });
  await expect(date).toHaveAttribute('max', '2026-11-16T12:00');
  await date.fill('2026-11-10T19:00');
  const sent = page.waitForRequest(r => r.url().endsWith('/api/forecasts') && r.method() === 'POST');
  await page.getByRole('button', { name: /Generate experimental forecast/ }).click();
  expect((await sent).postDataJSON().forecastAt).toBe('2026-11-10T19:00:00+05:30');
});
test('unavailable model disables inference without inventing a prediction', async ({ page }) => {
  await page.route('**/api/forecasts/catalog', route => route.fulfill({ json: { ...catalog, modelStatus: 'not_trained' } }));
  await open(page);
  await expect(page.getByRole('alert')).toContainText('model unavailable');
  await expect(page.getByRole('button', { name: /Generate experimental forecast/ })).toBeDisabled();
  await expect(page.getByRole('article', { name: 'Experimental forecast result' })).toHaveCount(0);
});
test('unsupported location and backend failure remain visible errors', async ({ page }) => {
  await page.route('**/api/forecasts', route => route.fulfill({ status: 422, json: { code: 'UNSUPPORTED_LOCATION', message: 'Outside scenario catalog' } }));
  await open(page); await page.getByRole('button', { name: /Generate experimental forecast/ }).click();
  await expect(page.getByRole('alert')).toContainText('UNSUPPORTED_LOCATION');
  await page.route('**/api/forecasts/catalog', route => route.fulfill({ status: 503, json: { code: 'AI_UNAVAILABLE', message: 'Start FastAPI' } }));
  await page.getByRole('button', { name: 'Refresh model availability' }).click();
  await expect(page.getByRole('alert')).toContainText('AI_UNAVAILABLE');
});
test('loading inference and stale request cancellation are safe', async ({ page }) => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  await page.route('**/api/forecasts', async route => { await wait; await route.fulfill({ json: forecast }).catch(() => {}); });
  await open(page); await page.getByRole('button', { name: /Generate experimental forecast/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Running the synthetic-data' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Hypothetical holiday/ }).check(); release();
  await expect(page.getByRole('article', { name: 'Experimental forecast result' })).toHaveCount(0);
});
test('forecast form and result remain responsive', async ({ page }) => {
  await open(page); await page.getByRole('button', { name: /Generate experimental forecast/ }).click();
  await expect(page.getByRole('heading', { name: 'HIGH congestion scenario' })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
