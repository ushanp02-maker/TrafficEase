import React from 'react';
export function InlineError({children='We couldn’t complete that request.',onRetry}){return <div className="inline-feedback" role="alert"><span aria-hidden="true">↻</span><div>{children}</div>{onRetry&&<button type="button" className="text-button" onClick={onRetry}>Try again</button>}</div>;}
export function LoadingCards(){return <div className="loading-cards" role="status" aria-label="Finding your journey"><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/><p>Finding your best available options…</p></div>;}
export function SourceInfo({children}){return <details className="source-popover"><summary>About these results</summary><div>{children}</div></details>;}
export function friendlyError(code,status){
 if(code==='EXCESSIVE_SNAPPING')return 'Choose a starting point or destination closer to a road.';
 if(code==='NO_ROUTE')return 'No road route found. Try a nearby location.';
 if(code==='INVALID_DEPARTURE'||code==='OUTSIDE_FORECAST_HORIZON')return 'Choose a departure within the next seven days.';
 if(status===429||code==='PROVIDER_RATE_LIMITED')return 'Please wait a moment before trying again.';
 if(status===422)return 'This journey is unavailable. Try a nearby location.';
 return 'This service is temporarily unavailable. Please try again.';
}
