import { test, expect } from '@playwright/test';

const locations = {
  Kandy: { id: '1', name: 'Kandy, Sri Lanka', latitude: 7.29, longitude: 80.63, countryCode: 'LK' },
  Matale: { id: '2', name: 'Matale, Sri Lanka', latitude: 7.47, longitude: 80.62, countryCode: 'LK' },
};
const geometry = { type: 'LineString', coordinates: [[80.63, 7.29], [80.62, 7.47]] };
// These responses are test fixtures, never application fallback data.
const fixture = {
  source: 'OSRM / OpenStreetMap', estimateKind: 'BASELINE_ROUTING_ESTIMATE', generatedAt: '2026-11-09T10:00:00Z',
  comparisonScope: 'RETURNED_ROUTES_ONLY', trueShortestSupported: false,
  snapping: [{ endpoint: 'origin', latitude: 7.29, longitude: 80.63, distanceMeters: 2 }, { endpoint: 'destination', latitude: 7.47, longitude: 80.62, distanceMeters: 3 }],
  limitations: ['Baseline driving durations are not live traffic or future forecasts.'],
  routes: [{ id: 'route-1', distanceMeters: 25000, durationSeconds: 1800, fastestAvailable: true, shortestAvailable: true, geometry }],
};
async function selectLocations(page) {
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Kandy');
  await page.getByRole('button', { name: 'Search starting point' }).click();
  await page.getByRole('button', { name: 'Kandy, Sri Lanka', exact: true }).click();
  await page.getByRole('textbox', { name: 'DESTINATION' }).fill('Matale');
  await page.getByRole('button', { name: 'Search destination' }).click();
  await page.getByRole('button', { name: 'Matale, Sri Lanka', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.abort());
  await page.route('**/api/locations?*', route => {
    const query = new URL(route.request().url()).searchParams.get('query');
    return route.fulfill({ json: { locations: locations[query] ? [locations[query]] : [], attribution: '© OpenStreetMap contributors' } });
  });
  await page.route('**/api/routes', route => route.fulfill({ json: fixture }));
  await page.goto('/');
});
test('no automatic geocoding, explicit selection, genuine response geometry and comparison labels', async ({ page }) => {
  let searches = 0; page.on('request', request => { if (request.url().includes('/api/locations')) searches++; });
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Ka');
  await expect(page.getByRole('button', { name: /Calculate road routes/ })).toBeDisabled();
  expect(searches).toBe(0);
  await selectLocations(page);
  await page.getByRole('button', { name: /Calculate road routes/ }).click();
  await expect(page.getByRole('button', { name: /Fastest available.*Shortest available/ })).toBeVisible();
  await expect(page.getByText('The same route is fastest and shortest', { exact: false })).toBeVisible();
  await expect(page.getByText('OSRM baseline estimate · not live traffic')).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'DESTINATION' }).fill('Different');
  await expect(page.getByRole('button', { name: /Calculate road routes/ })).toBeDisabled();
  await expect(page.getByText('OSRM baseline estimate · not live traffic')).toHaveCount(0);
});
test('unavailable geocoder and tiles show honest errors without sample routes', async ({ page }) => {
  await page.route('**/api/locations?*', route => route.fulfill({ status: 503, json: { message: 'Location provider unavailable' } }));
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Jaffna');
  await page.getByRole('button', { name: 'Search starting point' }).click();
  await expect(page.getByRole('alert')).toContainText('Location provider unavailable');
  await expect(page.getByText('Map tiles are unavailable.', { exact: false })).toBeVisible();
  await expect(page.locator('.route-card')).toHaveCount(0);
});
test('empty search results are distinct from failure', async ({ page }) => {
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Missing');
  await page.getByRole('button', { name: 'Search starting point' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'No matching Sri Lankan locations' })).toBeVisible();
});
test('snapping rejection is shown without a fabricated route', async ({ page }) => {
  await selectLocations(page);
  await page.route('**/api/routes', route => route.fulfill({ status: 422, json: { code: 'EXCESSIVE_SNAPPING', message: 'Destination is approximately 2776 m from the routed road.' } }));
  await page.getByRole('button', { name: /Calculate road routes/ }).click();
  await expect(page.getByRole('alert')).toContainText('2776 m');
  await expect(page.locator('.route-card')).toHaveCount(0);
});
test('loading and stale responses cannot overwrite edited locations', async ({ page }) => {
  let release; const wait = new Promise(resolve => { release = resolve; });
  await page.route('**/api/locations?*', async route => { await wait; await route.fulfill({ json: { locations: [locations.Kandy] } }).catch(() => {}); });
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Kandy');
  await page.getByRole('button', { name: 'Search starting point' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Searching Sri Lankan' })).toBeVisible();
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Galle'); release();
  await expect(page.getByRole('button', { name: 'Kandy, Sri Lanka', exact: true })).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'STARTING POINT' })).toHaveValue('Galle');
});
test('navigation and map stay within mobile and tablet viewports', async ({ page }) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  for (const name of ['AI Predictions', 'AR Navigation', 'Route Planner']) {
    await page.getByRole('navigation').getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('navigation').getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await expect(page.getByRole('textbox', { name: 'STARTING POINT' })).toBeVisible();
});

test('alternative routes are selectable and comparisons stay scoped to returned candidates', async ({ page }) => {
  await selectLocations(page);
  const response = structuredClone(fixture);
  response.routes[0].shortestAvailable = false;
  response.routes.push({ ...response.routes[0], id: 'route-2', distanceMeters: 23000, durationSeconds: 2100, fastestAvailable: false, shortestAvailable: true });
  await page.route('**/api/routes', route => route.fulfill({ json: response }));
  await page.getByRole('button', { name: /Calculate road routes/ }).click();
  await expect(page.getByText('Fastest and shortest available routes differ.', { exact: false })).toBeVisible();
  const alternative = page.getByRole('button', { name: /Shortest available Road route 2/ });
  await alternative.click();
  await expect(alternative).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('OSRM does not calculate a true shortest-distance route.', { exact: false })).toBeVisible();
});

test('pending route cannot repopulate results after a location is edited', async ({ page }) => {
  await selectLocations(page);
  let release; const wait = new Promise(resolve => { release = resolve; });
  await page.route('**/api/routes', async route => { await wait; await route.fulfill({ json: fixture }).catch(() => {}); });
  await page.getByRole('button', { name: /Calculate road routes/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Calculating genuine' })).toBeVisible();
  await page.getByRole('textbox', { name: 'DESTINATION' }).fill('Jaffna'); release();
  await expect(page.locator('.route-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Calculate road routes/ })).toBeDisabled();
});
