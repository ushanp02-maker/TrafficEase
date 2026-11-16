import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
const titles={'/':'A better way','/navigation':'Find your way forward.','/ai-predictions':'Explore the road ahead.','/ar-navigation':'Look ahead. Stay aware.','/traffic-information':'A clearer view of what’s ahead.','/about':'Built for learning. Designed for journeys.'};
test.beforeEach(async({page})=>{
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
});
test('each citizen URL refreshes into its own page and home hero is exclusive',async({page})=>{
 for(const [path,title] of Object.entries(titles)){
  await page.goto(path);await expect(page.getByRole('heading',{level:1})).toContainText(title);
  await expect(page.getByTestId('home-hero')).toHaveCount(path==='/'?1:0);
  await page.reload();await expect(page.getByRole('heading',{level:1})).toContainText(title);
  expect(await page.title()).toContain('TrafficEase');
 }
 await page.goto('/does-not-exist');await expect(page.getByRole('heading',{level:1})).toHaveText('This road ends here.');
});
test('navigation supports links, active state, browser history and mobile menu',async({page})=>{
 await page.goto('/');await page.getByRole('link',{name:'Plan Your Journey',exact:false}).click();await expect(page).toHaveURL(/\/navigation$/);
 await expect(page.getByTestId('home-hero')).toHaveCount(0);
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'AI Predictions',exact:true}).click();
 await expect(page).toHaveURL(/\/ai-predictions$/);await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'AI Predictions',exact:true})).toHaveAttribute('aria-current','page');
 await page.goBack();await expect(page).toHaveURL(/\/navigation$/);await page.goForward();await expect(page).toHaveURL(/\/ai-predictions$/);
 await page.setViewportSize({width:390,height:844});const menu=page.getByRole('button',{name:'Open navigation'});await menu.click();await expect(page.getByRole('button',{name:'Close navigation'})).toHaveAttribute('aria-expanded','true');
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Traffic Information',exact:true}).click();await expect(page).toHaveURL(/\/traffic-information$/);await expect(page.getByRole('button',{name:'Open navigation'})).toHaveAttribute('aria-expanded','false');
});
test('citizen announcements filter with explicit demo, dates and empty/error states',async({page})=>{
 const notice={id:'fixture',title:'Coursework closure illustration',body:'This is a test announcement, not an official road closure.',category:'ROAD_CLOSURE',region:'CENTRAL',affectedArea:'Fictional coursework road',validFrom:'2026-12-01T00:00:00Z',validUntil:'2026-12-02T00:00:00Z',publishedAt:'2026-11-16T00:00:00Z',demonstration:true};
 await page.route('**/api/announcements?*',r=>r.fulfill({json:{demonstration:true,storage:'VOLATILE_DEMO_MEMORY',announcements:new URL(r.request().url()).searchParams.get('category')==='WEATHER'?[]:[notice]}}));
 await page.goto('/traffic-information');await expect(page.getByRole('heading',{name:notice.title})).toBeVisible();await expect(page.getByText('DEMO · NOT OFFICIAL',{exact:true})).toBeVisible();
 await page.getByText('Notice details & relevant times').click();await expect(page.getByText('All times: Asia/Colombo.',{exact:false})).toBeVisible();
 await page.getByRole('combobox',{name:'CATEGORY',exact:true}).selectOption('WEATHER');await expect(page.getByRole('heading',{name:'No demonstration notices here yet.'})).toBeVisible();
 await page.route('**/api/announcements?*',r=>r.fulfill({status:503,json:{message:'Test storage unavailable'}}));await page.getByRole('button',{name:'Reset & refresh'}).click();await expect(page.getByRole('alert')).toContainText('Test storage unavailable');
});
test('all citizen pages and government login fit mobile, tablet and desktop',async({page})=>{
 for(const path of [...Object.keys(titles),'/government/login']){
  await page.goto(path);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${path} @ ${width}`).toBe(true);}
 }
 if(process.env.UI_SCREENSHOT_DIR){mkdirSync(process.env.UI_SCREENSHOT_DIR,{recursive:true});for(const [path,name]of[['/','home'],['/navigation','route-planner'],['/ai-predictions','ai-predictions'],['/ar-navigation','ar-navigation'],['/traffic-information','announcements'],['/government/login','government-login']]){
  await page.setViewportSize({width:1440,height:1050});await page.goto(path);if(path==='/ai-predictions')await expect(page.locator('.forecast-form')).toBeVisible();
  if(path==='/traffic-information')await expect(page.getByText('Loading demonstration announcements…',{exact:true})).toHaveCount(0);
  await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/${name}-desktop.png`,fullPage:true});
  if(path==='/'){await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/${name}-mobile.png`,fullPage:true});}
 }}
});
test('unauthenticated government URLs redirect to login without exposing tools',async({page})=>{
 for(const path of ['/government/dashboard','/government/analytics','/government/alerts']){await page.goto(path);await expect(page).toHaveURL(/\/government\/login\?next=/);await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();await expect(page.getByRole('button',{name:'Create draft'})).toHaveCount(0);}
});
test('real server session creates, edits, publishes and withdraws a notice seen by citizens',async({page})=>{
 test.skip(!process.env.GOV_E2E_CREDENTIAL_FILE,'Requires the ephemeral local test-account file; no live credentials are embedded.');
 const credentials=JSON.parse(readFileSync(process.env.GOV_E2E_CREDENTIAL_FILE,'utf8'));
 await page.goto('/government/login');await expect(page.getByRole('button',{name:'Sign in to government demo'})).toBeEnabled();
 await page.getByLabel('DEMO USERNAME').fill(credentials.username);await page.getByLabel('PASSWORD',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in to government demo'}).click();
 await expect(page).toHaveURL(/\/government\/dashboard$/);await expect(page.getByRole('heading',{name:'Example transportation demand'})).toBeVisible();
 await page.getByRole('navigation',{name:'Government navigation'}).getByRole('link',{name:'Alert Management'}).click();
 const title=`Browser test notice ${Date.now()}`;
 await page.getByLabel('TITLE',{exact:true}).fill(title);await page.getByLabel('AFFECTED AREA / ROAD NAME').fill('Fictional demo corridor');await page.getByLabel('ANNOUNCEMENT TEXT',{exact:false}).fill('This is an administrator-created browser test, never an official government notice.');
 await page.getByRole('button',{name:'Create draft',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Draft created.'})).toBeVisible();
 await page.getByRole('button',{name:`Publish ${title}`,exact:true}).click();await expect(page.getByRole('status').filter({hasText:'published to the citizen feed'})).toBeVisible();
 await page.goto('/traffic-information');await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 if(process.env.UI_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/announcements-published-desktop.png`,fullPage:true});
 await page.goto('/government/alerts');await page.getByRole('button',{name:`Edit ${title}`,exact:true}).click();await page.getByLabel('TITLE',{exact:true}).fill(`${title} edited`);await page.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('status').filter({hasText:'updated'})).toBeVisible();
 if(process.env.UI_SCREENSHOT_DIR){await page.goto('/government/dashboard');await expect(page.getByRole('heading',{name:'Example transportation demand'})).toBeVisible();await expect(page.locator('.audit-item').first()).toBeVisible();await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/government-dashboard-desktop.png`,fullPage:true});await page.goto('/government/analytics');await expect(page.getByRole('heading',{name:'Synthetic time-of-day demand illustration'})).toBeVisible();await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/government-analytics-desktop.png`,fullPage:true});await page.goto('/government/alerts');}
 for(const width of[320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 if(process.env.UI_SCREENSHOT_DIR){await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/government-alerts-desktop.png`,fullPage:true});await page.setViewportSize({width:390,height:900});await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/government-alerts-mobile.png`,fullPage:true});await page.setViewportSize({width:1440,height:900});}
 await page.getByRole('button',{name:`Withdraw ${title} edited`,exact:true}).click();await expect(page.getByRole('status').filter({hasText:'withdrawn'})).toBeVisible();
 await page.goto('/traffic-information');await expect(page.getByRole('heading',{name:`${title} edited`,exact:true})).toHaveCount(0);
 await page.goto('/government/dashboard');await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/government\/login$/);
 await page.goto('/government/alerts');await expect(page).toHaveURL(/\/government\/login\?next=/);
});
test('real FastAPI model renders a clearly synthetic prediction card',async({page})=>{
 test.skip(!process.env.GOV_E2E_CREDENTIAL_FILE,'Requires the local Java/FastAPI integration services.');
 await page.goto('/ai-predictions');await expect(page.getByRole('button',{name:/Generate experimental forecast/})).toBeEnabled();
 await page.getByRole('button',{name:/Generate experimental forecast/}).click();
 await expect(page.getByRole('heading',{name:/^(LOW|MODERATE|HIGH) congestion scenario$/})).toBeVisible();
 await expect(page.getByRole('article',{name:'Experimental forecast result'})).toContainText('SYNTHETIC');
 await expect(page.getByRole('article',{name:'Experimental forecast result'})).toContainText('No journey duration or road speed is estimated.');
 if(process.env.UI_SCREENSHOT_DIR)await page.screenshot({path:`${process.env.UI_SCREENSHOT_DIR}/ai-actual-synthetic-result-desktop.png`,fullPage:true});
});
