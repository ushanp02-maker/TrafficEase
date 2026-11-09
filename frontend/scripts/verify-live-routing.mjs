// Explicit one-off live checks only: do not run against donated providers in ordinary CI.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
if (process.env.RUN_LIVE_ROUTING !== '1') throw new Error('Set RUN_LIVE_ROUTING=1 to deliberately call real geocoding, routing and map services.');
const output = process.env.LIVE_OUTPUT || '/tmp/trafficease-live';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
let lastSearch = 0;
async function select(label, query) {
  // Global to this serial script. Backend independently enforces upstream limits.
  const wait = 1200 - (Date.now() - lastSearch);
  if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
  await page.getByRole('textbox', { name: label, exact: true }).fill(query);
  const received = page.waitForResponse(r => r.url().includes('/api/locations?') && r.request().method() === 'GET');
  await page.getByRole('button', { name: `Search ${label.toLowerCase()}`, exact: true }).click();
  const response = await received; lastSearch = Date.now();
  const body = await response.json();
  assert.equal(response.status(), 200, JSON.stringify(body));
  assert.ok(body.locations.length > 0, `No result for ${query}`);
  assert.ok(body.locations.every(location => location.countryCode === 'LK'));
  const place = body.locations[0];
  await page.getByRole('list', { name: `${label} results` }).getByRole('button').first().click();
  return place;
}
try {
  await page.goto(process.env.LIVE_BASE_URL || 'http://127.0.0.1:5173');
  for (const [province, originQuery, destinationQuery] of [
    ['Central', 'Kandy railway station', 'Matale railway station'],
    ['Northern', 'Jaffna railway station', 'Chunnakam railway station'],
    ['Southern', 'Galle railway station', 'Matara railway station'],
    ['Western', 'Colombo Fort railway station', 'Negombo railway station'],
    ['Eastern', 'Trincomalee railway station', 'Batticaloa railway station'],
    ['North Western', 'Kurunegala railway station', 'Puttalam railway station'],
    ['North Central', 'Anuradhapura railway station', 'Polonnaruwa railway station'],
    ['Uva', 'Badulla railway station', 'Bandarawela railway station'],
    ['Sabaragamuwa', 'Ratnapura bus station', 'Kegalle bus station'],
  ]) {
    if (process.env.LIVE_PROVINCES && !process.env.LIVE_PROVINCES.split(',').includes(province)) continue;
    const row = { province, originQuery, destinationQuery };
    try {
      row.origin = await select('STARTING POINT', originQuery);
      row.destination = await select('DESTINATION', destinationQuery);
      const received = page.waitForResponse(r => r.url().endsWith('/api/routes') && r.request().method() === 'POST');
      await page.getByRole('button', { name: /Calculate road routes/ }).click();
      const response = await received; const body = await response.json();
      row.httpStatus = response.status();
      assert.equal(response.status(), 200, JSON.stringify(body));
      assert.equal(body.estimateKind, 'BASELINE_ROUTING_ESTIMATE');
      assert.equal(body.trueShortestSupported, false);
      assert.ok(body.routes.length > 0);
      assert.ok(body.snapping.every(point => point.distanceMeters <= 300));
      assert.ok(body.routes.every(route => route.geometry.type === 'LineString' && route.geometry.coordinates.length > 2));
      await page.locator('.route-card').first().waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-overlay-pane path').length > 2);
      // fitBounds schedules its zoom on an animation frame. Observe it starting before
      // waiting for completion, otherwise a scaled low-resolution old tile can pass.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(() => !document.querySelector('.leaflet-zoom-anim'));
      await page.waitForFunction(() => {
        const images = [...document.querySelectorAll('img.leaflet-tile')];
        return images.length > 0 && images.every(img => img.complete && img.naturalWidth === 256 && img.classList.contains('leaflet-tile-loaded'));
      }, null, { timeout: 30000 });
      row.routes = body.routes.map(route => ({ distanceMeters: route.distanceMeters, durationSeconds: route.durationSeconds, vertices: route.geometry.coordinates.length }));
      row.snapping = body.snapping;
      row.loadedTiles = await page.locator('img.leaflet-tile-loaded').count();
      row.tileWarning = await page.locator('.map-warning').count();
      assert.equal(row.tileWarning, 0, 'Tile failures occurred during the journey');
      await page.screenshot({ path: `${output}/${province.toLowerCase()}-desktop.png`, fullPage: true });
      if (province === 'Central') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('.geographic-map').scrollIntoViewIfNeeded();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.waitForFunction(() => !document.querySelector('.leaflet-zoom-anim'));
        await page.waitForFunction(() => {
          const images = [...document.querySelectorAll('img.leaflet-tile')];
          return images.length > 0 && images.every(img => img.complete && img.naturalWidth === 256 && img.classList.contains('leaflet-tile-loaded'));
        }, null, { timeout: 30000 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: `${output}/central-mobile.png`, fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1100 });
      }
      if (body.routes.length > 1) {
        await page.locator('.route-card').last().click();
        assert.equal(await page.locator('.route-card').last().getAttribute('aria-pressed'), 'true');
      }
      row.result = 'passed';
    } catch (error) { row.result = 'failed'; row.error = error.message; row.stack = error.stack; await page.screenshot({ path: `${output}/${province.toLowerCase()}-failure.png`, fullPage: true }).catch(() => {}); }
    results.push(row);
    console.log(province, row.result, row.error || `${row.routes.length} routes, ${row.loadedTiles} loaded tiles`);
  }
  assert.ok(results.length > 0, 'No provinces selected; check LIVE_PROVINCES');
  assert.equal(errors.length, 0, errors.join('\n'));
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ checkedAt: new Date().toISOString(), mode: 'live providers, no API or tile mocks', results, errors }, null, 2) + '\n');
  await browser.close();
}
if (results.some(row => row.result !== 'passed')) process.exitCode = 1;
