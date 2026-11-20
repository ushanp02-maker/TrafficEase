import { test, expect } from '@playwright/test';

test('empty route API response displays a useful error', async ({ page }) => {
  const locations = {
    Kandy: { id: '1', name: 'Kandy, Sri Lanka', latitude: 7.29, longitude: 80.63, countryCode: 'LK' },
    Matale: { id: '2', name: 'Matale, Sri Lanka', latitude: 7.47, longitude: 80.62, countryCode: 'LK' },
  };

  await page.route('https://tile.openstreetmap.org/**', route => route.abort());

  await page.route('**/api/locations?*', route => {
    const query = new URL(route.request().url()).searchParams.get('query');
    return route.fulfill({
      json: { locations: locations[query] ? [locations[query]] : [] }
    });
  });

  await page.route('**/api/routes', route =>
    route.fulfill({ json: { routes: [] } })
  );

  await page.goto('/navigation');

  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Kandy');
  await page.getByRole('button', { name: 'Search starting point' }).click();
  await page.getByRole('button', { name: 'Kandy, Sri Lanka', exact: true }).click();

  await page.getByRole('textbox', { name: 'DESTINATION' }).fill('Matale');
  await page.getByRole('button', { name: 'Search destination' }).click();
  await page.getByRole('button', { name: 'Matale, Sri Lanka', exact: true }).click();

  await page.getByRole('button', { name: /Find routes/ }).click();

  await expect(page.getByRole('alert')).toContainText(
    'No valid road routes were returned'
  );

  await expect(page.locator('.route-card')).toHaveCount(0);
});

const validRoute = { id: 'route-1', distanceMeters: 25000, durationSeconds: 1800,
  geometry: { type: 'LineString', coordinates: [[80.63, 7.29], [80.62, 7.47]] } };
for (const [name, result] of [
  ['null body', null], ['missing routes', {}], ['null route', { routes: [null] }],
  ['negative distance', { routes: [{ ...validRoute, distanceMeters: -1 }] }],
  ['missing duration', { routes: [{ ...validRoute, durationSeconds: null }] }],
  ['invalid geometry', { routes: [{ ...validRoute, geometry: { type: 'LineString', coordinates: [[181, 7], [80, 7]] } }] }],
]) {
  test(`rejects ${name} without rendering fabricated results`, async ({ page }) => {
    await page.route('https://tile.openstreetmap.org/**', r => r.abort());
    await page.route('**/api/locations?*', r => {
      const kandy = new URL(r.request().url()).searchParams.get('query') === 'Kandy';
      return r.fulfill({ json: { locations: [{ id: kandy ? '1' : '2', name: kandy ? 'Kandy' : 'Matale' }] } });
    });
    await page.route('**/api/routes', r => r.fulfill({ body: JSON.stringify(result), contentType: 'application/json' }));
    await page.goto('/navigation');
    for (const [title, town] of [['STARTING POINT', 'Kandy'], ['DESTINATION', 'Matale']]) {
      await page.getByRole('textbox', { name: title }).fill(town);
      await page.getByRole('button', { name: `Search ${title.toLowerCase()}` }).click();
      await page.getByRole('button', { name: town, exact: true }).click();
    }
    await page.getByRole('button', { name: /Find routes/ }).click();
    await expect(page.getByRole('alert')).toContainText('No valid road routes were returned');
    await expect(page.locator('.route-card')).toHaveCount(0);
  });
}

test('null HTTP error body keeps friendly retry and never exposes a TypeError', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', r => r.abort());
  await page.route('**/api/locations?*', r => r.fulfill({ status: 503, body: 'null', contentType: 'application/json' }));
  await page.goto('/navigation');
  await page.getByRole('textbox', { name: 'STARTING POINT' }).fill('Kandy');
  await page.getByRole('button', { name: 'Search starting point' }).click();
  await expect(page.getByRole('alert')).toContainText('This service is temporarily unavailable');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Unicode search stays supported and identical selected locations cannot be routed', async ({ page }) => {
  let routingCalls = 0;
  await page.route('https://tile.openstreetmap.org/**', r => r.abort());
  await page.route('**/api/locations?*', r => r.fulfill({ json: { locations: [{ id: '1', name: 'මහනුවර' }] } }));
  await page.route('**/api/routes', r => { routingCalls++; return r.abort(); });
  await page.goto('/navigation');
  for (const title of ['STARTING POINT', 'DESTINATION']) {
    const input = page.getByRole('textbox', { name: title });
    const search = page.getByRole('button', { name: `Search ${title.toLowerCase()}` });
    await input.fill('123'); await expect(search).toBeDisabled();
    await input.fill('மாத்தளை'); await expect(search).toBeEnabled();
    await input.fill('මහනුවර'); await search.click();
    await page.getByRole('button', { name: 'මහනුවර', exact: true }).click();
  }
  await expect(page.getByRole('alert')).toContainText('cannot be the same location');
  await expect(page.getByRole('button', { name: /Find routes/ })).toBeDisabled();
  expect(routingCalls).toBe(0);
});
