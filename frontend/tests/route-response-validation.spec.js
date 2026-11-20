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

  await page.getByRole('button', { name: /Calculate road routes/ }).click();

  await expect(page.getByRole('alert')).toContainText(
    'No valid road routes were returned'
  );

  await expect(page.locator('.route-card')).toHaveCount(0);
});
