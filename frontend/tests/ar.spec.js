import { test, expect } from '@playwright/test';
const destination = { id: 'dest', name: 'Mapped destination, Sri Lanka', latitude: 7.001, longitude: 80, countryCode: 'LK' };
const geometry = { type: 'LineString', coordinates: [[80,7],[80,7.0005],[80,7.001]] };
const routing = () => ({ source: 'OSRM / OpenStreetMap', estimateKind: 'BASELINE_ROUTING_ESTIMATE', generatedAt: new Date().toISOString(), comparisonScope: 'RETURNED_ROUTES_ONLY', trueShortestSupported: false,
  snapping: [{ endpoint: 'origin', latitude: 7, longitude: 80, distanceMeters: 2 }, { endpoint: 'destination', latitude: 7.001, longitude: 80, distanceMeters: 3 }],
  limitations: ['No live traffic'], routes: [{ id: 'route-1', distanceMeters: 120, durationSeconds: 60, fastestAvailable: true, shortestAvailable: true, geometry }] });
async function devices(page, mode = 'granted') {
  await page.addInitScript(({ mode }) => {
    window.arTest = { stopped: 0, cleared: 0, compassRemoved: 0, compassAdded: 0, currentWatch: null };
    const originalAdd = window.addEventListener.bind(window);
    window.addEventListener = (type, listener, options) => { if (type.startsWith('deviceorientation')) window.arTest.compassAdded++; return originalAdd(type, listener, options); };
    const originalRemove = window.removeEventListener.bind(window);
    window.removeEventListener = (type, listener, options) => { if (type.startsWith('deviceorientation')) window.arTest.compassRemoved++; return originalRemove(type, listener, options); };
    if (mode === 'missing') {
      Object.defineProperty(navigator,'mediaDevices',{ configurable: true, value: undefined });
      Object.defineProperty(navigator,'geolocation',{ configurable: true, value: undefined });
      Object.defineProperty(window,'DeviceOrientationEvent',{ configurable: true, value: undefined });
      return;
    }
    const geo = {
      watchPosition(success, failure) {
        if (mode === 'denied') { setTimeout(() => failure({ code: 1 }), 0); return 1; }
        window.arTest.currentWatch = () => success({ timestamp: Date.now(), coords: { latitude: 7, longitude: 80, accuracy: mode === 'poor' ? 100 : 5, speed: 0 } });
        window.arTest.currentWatch(); return 1;
      },
      clearWatch() { window.arTest.cleared++; window.arTest.currentWatch = null; },
    };
    Object.defineProperty(navigator,'geolocation',{ configurable: true, value: geo });
    const orientation = window.DeviceOrientationEvent || function() {};
    orientation.requestPermission = async () => mode === 'lateCompass' ? await new Promise(resolve => { window.arTest.releaseCompass = resolve; }) : mode === 'denied' ? 'denied' : 'granted';
    Object.defineProperty(window,'DeviceOrientationEvent',{ configurable: true, value: orientation });
    Object.defineProperty(navigator,'mediaDevices',{ configurable: true, value: { getUserMedia: async () => {
      if (mode === 'denied') throw new DOMException('Denied','NotAllowedError');
      const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
      canvas.getContext('2d').fillRect(0,0,100,100);
      const stream = canvas.captureStream(5), track = stream.getVideoTracks()[0];
      const stop = track.stop.bind(track); track.stop = () => { window.arTest.stopped++; stop(); };
      track.getSettings = () => ({ facingMode: 'environment' });
      if (mode === 'late') await new Promise(resolve => { window.arTest.releaseCamera = resolve; });
      return stream;
    } } });
  }, { mode });
}
async function open(page) {
  await page.route('https://tile.openstreetmap.org/**', r => r.abort());
  await page.route('**/api/locations?*', r => r.fulfill({ json: { locations: [new URL(r.request().url()).searchParams.get('query') === 'Origin' ? { ...destination, id: 'origin', name: 'Mapped origin, Sri Lanka' } : destination], source: 'Nominatim / OpenStreetMap' } }));
  await page.route('**/api/ar/routes', r => r.fulfill({ json: { routing: routing(), destination, originSource: 'GPS', candidates: [{ name: 'Mapped Road', routeId: 'route-1', geometry }] } }));
  await page.route('**/api/routes', r => r.fulfill({ json: routing() }));
  await page.goto('/'); await page.getByRole('navigation').getByRole('button',{ name: 'AR Navigation', exact: true }).click();
}
async function consent(page) { await page.getByRole('checkbox',{name:/I am stationary/}).check(); }
async function destinationSelection(page) {
  await page.getByRole('textbox',{name:'DESTINATION',exact:true}).fill('A station');
  await page.getByRole('button',{name:'Search destination',exact:true}).click();
  await page.getByRole('button',{name:destination.name,exact:true}).click();
}
async function compassSamples(page) {
  for (let i=0;i<5;i++) {
    await page.evaluate(() => {
      window.arTest.currentWatch?.();
      const event = new Event('deviceorientation');
      Object.assign(event,{ webkitCompassHeading: 0, webkitCompassAccuracy: 5, beta: 90, gamma: 0, absolute: true });
      window.dispatchEvent(event);
    });
    await page.waitForTimeout(110); // Establish a minimum physical-time sample window.
  }
}
test('simulated camera/GPS/compass match with cleanup on page navigation',async({page})=>{
  await devices(page); await open(page);
  await expect(page.getByRole('button',{name:'Start rear camera'})).toBeDisabled();
  await consent(page); await page.getByRole('button',{name:'Start rear camera'}).click();
  await page.getByRole('button',{name:'Enable GPS'}).click(); await page.getByRole('button',{name:'Enable compass'}).click();
  await compassSamples(page); await destinationSelection(page);
  await page.getByRole('button',{name:'Calculate AR/map routes'}).click(); await compassSamples(page);
  await expect(page.getByRole('heading',{name:'Candidate road: Mapped Road'})).toBeVisible();
  await expect(page.getByText('No better directional alternative is established', {exact:false})).toBeVisible();
  if (process.env.M4_SCREENSHOT_DIR) {
    await page.evaluate(() => {
      const banner = document.createElement('p'); banner.textContent = 'SIMULATION TEST — no real smartphone camera, GPS or compass';
      Object.assign(banner.style, { background: '#ffe28a', color: '#102333', padding: '14px', fontWeight: 'bold' });
      document.querySelector('.ar-page').prepend(banner);
    });
    await compassSamples(page);
    await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/m4-simulated-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await compassSamples(page);
    await page.screenshot({ path: `${process.env.M4_SCREENSHOT_DIR}/m4-simulated-mobile.png`, fullPage: true });
  }
  await page.getByRole('navigation').getByRole('button',{name:'Dashboard',exact:true}).click();
  const cleanup = await page.evaluate(()=>window.arTest);
  expect(cleanup.stopped).toBeGreaterThan(0); expect(cleanup.cleared).toBeGreaterThan(0); expect(cleanup.compassRemoved).toBeGreaterThanOrEqual(2);
});
test('permission denial preserves a functioning manual map route',async({page})=>{
  await devices(page,'denied'); await open(page); await consent(page);
  for (const name of ['Start rear camera','Enable GPS','Enable compass']) await page.getByRole('button',{name}).click();
  await expect(page.getByText('Camera permission denied',{exact:false})).toBeVisible();
  await expect(page.getByText('GPS permission denied',{exact:false})).toBeVisible();
  await expect(page.getByText('Compass permission denied',{exact:false})).toBeVisible();
  await page.getByRole('combobox',{name:'STARTING POINT SOURCE'}).selectOption('manual');
  await page.getByRole('textbox',{name:'MANUAL STARTING POINT',exact:true}).fill('Origin');
  await page.getByRole('button',{name:'Search manual starting point',exact:true}).click();
  await page.getByRole('button',{name:'Mapped origin, Sri Lanka',exact:true}).click();
  await destinationSelection(page); await page.getByRole('button',{name:'Calculate AR/map routes'}).click();
  await expect(page.getByRole('button',{name:/Road route 1/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Map fallback · alignment uncertain'})).toBeVisible();
});
test('missing sensors and camera are explicit unsupported states',async({page})=>{
  await devices(page,'missing'); await open(page); await consent(page);
  for (const name of ['Start rear camera','Enable GPS','Enable compass']) await page.getByRole('button',{name}).click();
  await expect(page.getByText('Camera API unavailable',{exact:false})).toBeVisible();
  await expect(page.getByText('GPS API unavailable',{exact:false})).toBeVisible();
  await expect(page.getByText('Orientation API unavailable',{exact:false})).toBeVisible();
});
test('poor GPS blocks camera-aligned routing and shows map fallback',async({page})=>{
  await devices(page,'poor'); await open(page); await consent(page); await page.getByRole('button',{name:'Enable GPS'}).click();
  await destinationSelection(page); await expect(page.getByRole('button',{name:'Calculate AR/map routes'})).toBeDisabled();
  await expect(page.getByRole('heading',{name:'Map fallback · alignment uncertain'})).toBeVisible();
});
test('late camera resolution after stop still stops the returned tracks',async({page})=>{
  await devices(page,'late'); await open(page); await consent(page);
  await page.getByRole('button',{name:'Start rear camera'}).click();
  await page.waitForFunction(()=>!!window.arTest.releaseCamera);
  await page.getByRole('button',{name:'Stop camera and sensors'}).click();
  await page.evaluate(()=>window.arTest.releaseCamera());
  await page.waitForFunction(()=>window.arTest.stopped>0);
  await expect(page.locator('video')).toHaveJSProperty('srcObject',null);
});
test('background pagehide stops streams and sensor listeners',async({page})=>{
  await devices(page); await open(page); await consent(page);
  await page.getByRole('button',{name:'Start rear camera'}).click();
  await page.getByRole('button',{name:'Enable GPS'}).click(); await page.getByRole('button',{name:'Enable compass'}).click();
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  await page.waitForFunction(()=>window.arTest.stopped>0&&window.arTest.cleared>0&&window.arTest.compassRemoved>=2);
});
test('sensor UI is responsive at mobile and tablet widths',async({page})=>{
  await devices(page,'missing'); await open(page);
  for(const width of [320,390,768,1440]) { await page.setViewportSize({width,height:844}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
});

test('insecure HTTP context offers manual fallback without opening devices', async ({ page }) => {
  await devices(page);
  await page.addInitScript(() => Object.defineProperty(window, 'isSecureContext', { value: false }));
  await open(page); await consent(page);
  await page.getByRole('button', { name: 'Start rear camera' }).click();
  await expect(page.getByText('HTTPS or localhost is required', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Enable GPS' }).click();
  await expect(page.getByText('GPS API unavailable', { exact: false })).toBeVisible();
  await page.getByRole('combobox', { name: 'STARTING POINT SOURCE' }).selectOption('manual');
  await expect(page.getByRole('textbox', { name: 'MANUAL STARTING POINT', exact: true })).toBeVisible();
});

test('starting the camera does not invalidate GPS or compass already enabled', async ({ page }) => {
  await devices(page); await open(page); await consent(page);
  await page.getByRole('button', { name: 'Enable GPS' }).click();
  await page.getByRole('button', { name: 'Enable compass' }).click();
  await compassSamples(page);
  await page.getByRole('button', { name: 'Start rear camera' }).click();
  await destinationSelection(page);
  await page.getByRole('button', { name: 'Calculate AR/map routes' }).click();
  await compassSamples(page);
  await expect(page.getByRole('heading', { name: 'Candidate road: Mapped Road' })).toBeVisible();
  await page.waitForTimeout(2200);
  await expect(page.getByRole('heading', { name: 'Map fallback · alignment uncertain' })).toBeVisible();
});

test('Android-style absolute events without a permission method remain approximate', async ({ page }) => {
  await devices(page); await open(page); await consent(page);
  await page.evaluate(() => { delete window.DeviceOrientationEvent.requestPermission; });
  await page.getByRole('button', { name: 'Start rear camera' }).click();
  await page.getByRole('button', { name: 'Enable GPS' }).click();
  await page.getByRole('button', { name: 'Enable compass' }).click();
  await destinationSelection(page); await page.getByRole('button', { name: 'Calculate AR/map routes' }).click();
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      window.arTest.currentWatch?.();
      const event = new Event('deviceorientationabsolute');
      Object.assign(event, { alpha: 0, beta: 90, gamma: 0, absolute: true }); window.dispatchEvent(event);
    });
    await page.waitForTimeout(110);
  }
  await expect(page.getByRole('heading', { name: 'Candidate road: Mapped Road' })).toBeVisible();
  await expect(page.getByText('error not reported', { exact: false })).toBeVisible();
});

test('late compass permission after stopping never attaches sensor listeners', async ({ page }) => {
  await devices(page, 'lateCompass'); await open(page); await consent(page);
  await page.getByRole('button', { name: 'Enable compass' }).click();
  await page.waitForFunction(() => !!window.arTest.releaseCompass);
  await page.getByRole('button', { name: 'Stop camera and sensors' }).click();
  await page.evaluate(() => window.arTest.releaseCompass('granted'));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  expect(await page.evaluate(() => window.arTest.compassAdded)).toBe(0);
});
