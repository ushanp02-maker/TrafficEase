const base=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
export async function governmentRequest(path,{method='GET',body,csrf,signal}={}){
 const headers={};if(csrf)headers['X-CSRF-TOKEN']=csrf;
 if(body instanceof URLSearchParams)headers['Content-Type']='application/x-www-form-urlencoded';
 else if(body)headers['Content-Type']='application/json';
 let response;
 try{response=await fetch(`${base}/api${path}`,{method,credentials:'same-origin',headers,signal,body:body instanceof URLSearchParams?body:body?JSON.stringify(body):undefined});}catch(e){if(e.name==='AbortError')throw e;throw new Error('Cannot reach announcement services. Check the backend connection.');}
 let data;try{data=await response.json();}catch{throw new Error('The server returned an unreadable response.');}
 if(!response.ok){const e=new Error(data.message||'Request failed. Refresh your session and try again.');e.status=response.status;throw e;}
 return data;
}
export const categories=['ROAD_CLOSURE','ACCIDENT','WEATHER','GENERAL'];
export const regions=['NATIONWIDE','WESTERN','CENTRAL','SOUTHERN','NORTHERN','EASTERN','NORTH_WESTERN','NORTH_CENTRAL','UVA','SABARAGAMUWA'];
export const words=value=>value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export const localTime=value=>new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Colombo'}).format(new Date(value));
