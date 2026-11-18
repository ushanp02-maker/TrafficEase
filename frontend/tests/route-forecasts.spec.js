import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync('../backend/src/main/resources/experimental/journeys.json','utf8'));
const observations=JSON.parse(readFileSync('../data/journeys/routing-observations.json','utf8'));
const jid='pettah--piliyandala';
function result(status='AVAILABLE'){
 const routes=observations[jid].routes.map((r,i)=>({id:`route-${i+1}`,distanceMeters:r.distance,durationSeconds:r.duration,geometry:r.geometry,fastestAvailable:i===0,shortestAvailable:i===0}));
 const predictions=routes.map((r,i)=>({routeId:r.id,status:'SUPPORTED',congestion:i?'HIGH':'LOW',syntheticBurden:i?1.5:.2,features:{directness:i?1.5:1.1,turns_per_km:.3,weather:'RAIN'},geometryFeatures:{featureVersion:'fixture-schema'}}));
 return {dataMode:'LIVE',journey:catalog.journeys.find(j=>j.id===jid),routing:{routes,snapping:[],generatedAt:new Date().toISOString()},weather:{status,source:status==='MANUAL_SIMULATION'?'USER_SIMULATION':'Open-Meteo',validFor:'2026-11-19T19:00:00+05:30',retrievedAt:new Date().toISOString(),routes:status==='UNAVAILABLE'?[]:routes.map(r=>({routeId:r.id,category:'RAIN',samples:[]}))},forecast:status==='UNAVAILABLE'?{status:'WEATHER_UNAVAILABLE'}:{status:'AVAILABLE',result:{modelVersion:'fixture-synthetic',forecastAt:new Date().toISOString(),limitations:['Synthetic fixture'],routePredictions:predictions,recommendation:{status:'EXPERIMENTAL_PREFERENCE',routeId:'route-1'}}},trafficAwareDuration:{status:'UNAVAILABLE'}};
}
async function choose(page,id=jid){const journey=catalog.journeys.find(j=>j.id===id);await page.getByRole('combobox',{name:'FROM',exact:true}).selectOption(journey.origin);await page.getByRole('combobox',{name:'TO',exact:true}).selectOption(id);}
async function setup(page,reply=result()){
 await page.route('https://tile.openstreetmap.org/**',r=>r.abort());
 await page.route('**/api/route-forecasts/catalog',r=>r.fulfill({json:{...catalog,model:{modelStatus:'ready'}}}));
 await page.route('**/api/journeys/capabilities',r=>r.fulfill({json:{timeZone:'Asia/Colombo',now:new Date().toISOString()}}));
 await page.route('**/api/route-forecasts',r=>r.fulfill({json:reply}));
 await page.goto('/ai-predictions');await page.getByRole('button',{name:'Online',exact:true}).click();await choose(page);
}
test('consumer journey → automatic weather → model → mapped alternatives with accessible provenance',async({page})=>{
 await setup(page);const sent=page.waitForRequest(r=>r.url().endsWith('/api/route-forecasts')&&r.method()==='POST');await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();
 expect((await sent).postDataJSON()).toMatchObject({journeyId:jid,mode:'LEAVE_NOW',dataMode:'LIVE',weatherMode:'AUTO',manualWeather:null});
 await expect(page.getByRole('heading',{name:'Low traffic',exact:true})).toBeVisible();await expect(page.locator('.weather-indicator')).toContainText('Forecast weather');
 await expect(page.locator('.route-recommendation')).toContainText('lower-congestion option');await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
 await page.getByRole('button',{name:'Select route 2',exact:true}).click();await expect(page.getByRole('button',{name:'Select route 2',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.getByRole('heading',{name:'High traffic',exact:true})).toBeVisible();
 await page.getByText('About these results',{exact:true}).click();await expect(page.getByText('Experimental model trained on synthetic targets',{exact:false})).toBeVisible();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`forecast @${width}`).toBe(true);}
});
test('weather unavailable preserves baseline, offers retry and explicit simulation without automatic success',async({page})=>{
 await setup(page,result('UNAVAILABLE'));await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Weather is temporarily unavailable');await expect(page.locator('.consumer-route-card')).toHaveCount(2);await expect(page.getByRole('heading',{name:'Low traffic',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Try simulation instead'}).click();await expect(page.getByRole('button',{name:'Simulation',exact:true})).toHaveAttribute('aria-pressed','true');await expect(page.locator('.consumer-route-card')).toHaveCount(0);
 await page.route('**/api/route-forecasts',r=>{expect(r.request().postDataJSON().dataMode).toBe('SIMULATION');return r.fulfill({json:result('SIMULATED')});});await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();await expect(page.getByText('SIMULATION · SYNTHETIC',{exact:true})).toBeVisible();await expect(page.locator('.weather-indicator')).toContainText('Weather scenario');
});
test('ties and unavailable model do not invent a preference; editing clears stale results',async({page})=>{
 const data=result();data.forecast.result.recommendation={status:'TIE_OR_INSUFFICIENT_DIFFERENTIATION',routeId:null};await setup(page,data);await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();await expect(page.getByText('No clear congestion advantage',{exact:true})).toBeVisible();await choose(page,'badulla--ella');await expect(page.locator('.consumer-route-card')).toHaveCount(0);
 data.forecast={status:'MODEL_UNAVAILABLE',message:'java: DEBUG trace secret exception FastAPI not_trained'};await page.route('**/api/route-forecasts',r=>r.fulfill({json:data}));await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Traffic predictions are temporarily unavailable');await expect(page.getByText('DEBUG trace',{exact:false})).toHaveCount(0);await expect(page.locator('.traffic-indicator')).toContainText(['Traffic insight unavailable','Traffic insight unavailable']);
});
test('provider errors are short and retryable with no fabricated routes',async({page})=>{
 await setup(page);await page.route('**/api/route-forecasts',r=>r.fulfill({status:503,json:{message:'Stacktrace java.lang.RuntimeException API debug details'}}));await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();await expect(page.getByRole('alert')).toContainText('temporarily unavailable');await expect(page.getByRole('alert').getByRole('button',{name:'Try again'})).toBeVisible();await expect(page.locator('.consumer-route-card')).toHaveCount(0);await expect(page.getByText('java.lang',{exact:false})).toHaveCount(0);
});
test('future departure uses Colombo offset, and single route does not suggest alternatives',async({page})=>{
 const data=result();data.routing.routes=data.routing.routes.slice(0,1);data.forecast.result.routePredictions=data.forecast.result.routePredictions.slice(0,1);data.forecast.result.recommendation={status:'SINGLE_ROUTE',routeId:null};await setup(page,data);
 await page.getByRole('combobox',{name:'JOURNEY MODE',exact:true}).selectOption('FUTURE_DATE');const future=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Date.now()+86400000)).replace(' ','T');await page.getByLabel('DEPARTURE DATE AND TIME · SRI LANKA').fill(future);
 const sent=page.waitForRequest(r=>r.url().endsWith('/api/route-forecasts')&&r.method()==='POST');await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();expect((await sent).postDataJSON()).toMatchObject({mode:'FUTURE_DATE',departureAt:future+':00+05:30'});await expect(page.getByText('One available route. No verified alternative was returned.',{exact:true})).toBeVisible();
});
test('manual weather is collapsed until advanced options are deliberately opened',async({page})=>{
 await setup(page);await expect(page.getByRole('combobox',{name:'WEATHER INPUT',exact:true})).not.toBeVisible();await page.getByText('Advanced options',{exact:true}).click();await page.getByRole('combobox',{name:'WEATHER INPUT',exact:true}).selectOption('MANUAL_SIMULATION');await page.getByRole('combobox',{name:'SIMULATED WEATHER',exact:true}).selectOption('HEAVY_RAIN');const sent=page.waitForRequest(r=>r.url().endsWith('/api/route-forecasts')&&r.method()==='POST');await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();expect((await sent).postDataJSON()).toMatchObject({weatherMode:'MANUAL_SIMULATION',manualWeather:'HEAVY_RAIN'});
});
test('late prediction cannot repopulate results after inputs change',async({page})=>{
 await setup(page);let release;const wait=new Promise(resolve=>{release=resolve;});await page.route('**/api/route-forecasts',async r=>{await wait;await r.fulfill({json:result()}).catch(()=>{});});await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();await expect(page.getByRole('status',{name:'Finding your journey'})).toBeVisible();await choose(page,'badulla--ella');release();await expect(page.locator('.consumer-route-card')).toHaveCount(0);
});
test('actual Spring/FastAPI inference for all thirty simulation journeys without public network',async({page})=>{
 test.skip(!process.env.CONSUMER_INTEGRATION,'Requires local Java/FastAPI models.');test.setTimeout(120000);let external=0;await page.route('https://**',r=>{external++;return r.abort();});await page.goto('/ai-predictions');await page.getByRole('button',{name:'Simulation',exact:true}).click();
 for(const journey of catalog.journeys){await choose(page,journey.id);const response=page.waitForResponse(r=>r.url().endsWith('/api/route-forecasts')&&r.request().method()==='POST');await page.getByRole('button',{name:'Predict Traffic',exact:true}).click();const body=await (await response).json();expect(body.dataMode).toBe('SIMULATION');expect(body.forecast.status).toBe('AVAILABLE');expect(body.routing.source).toBe('RECORDED_OSRM_DEMONSTRATION');expect(body.forecast.result.adjustedDurationSeconds).toBeNull();await expect(page.locator('.consumer-route-card')).toHaveCount(body.routing.routes.length);await expect(page.locator('.journey-summary h2')).toContainText(/(Low|Moderate|High) traffic/);}
 expect(external).toBe(0);
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});await page.locator('.geographic-map').scrollIntoViewIfNeeded();
  await expect.poll(async()=>{
   return await page.locator('.geographic-map').evaluate(el=>{
    const box=el.getBoundingClientRect();const roads=[...el.querySelectorAll('path.leaflet-interactive')];
    return roads.length>0&&roads.every(p=>{
     const r=p.getBoundingClientRect();
     return r.width>0&&r.height>0&&r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom;
    });
   });
  }).toBe(true);
 }
 await page.getByText('About these results',{exact:true}).click();await expect(page.getByText('Genuine recorded OSRM geometry',{exact:false})).toBeVisible();
});
