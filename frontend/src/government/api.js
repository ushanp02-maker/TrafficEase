import {friendlyError} from '../components/Feedback.jsx';
const base=(import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
export async function governmentRequest(path,{method='GET',body,csrf,signal}={}){
 const headers={};if(csrf)headers['X-CSRF-TOKEN']=csrf;
 if(body instanceof URLSearchParams)headers['Content-Type']='application/x-www-form-urlencoded';
 else if(body)headers['Content-Type']='application/json';
 let response;
 try{response=await fetch(`${base}/api${path}`,{method,credentials:'same-origin',headers,signal,body:body instanceof URLSearchParams?body:body?JSON.stringify(body):undefined});}catch(e){if(e.name==='AbortError')throw e;throw new Error('Connection lost. Please try again.');}
 let data;try{data=await response.json();}catch{throw new Error('This service is temporarily unavailable. Please try again.');}
 if(!response.ok){const e=new Error(response.status===401?'Check your sign-in details and try again.':response.status===403?'Your session needs refreshing. Please sign in again.':response.status===400?'Check your details and try again.':friendlyError(data.code,response.status));e.status=response.status;throw e;}
 return data;
}
export const categories=['ROAD_CLOSURE','ACCIDENT','WEATHER','GENERAL'];
export const regions=['NATIONWIDE','WESTERN','CENTRAL','SOUTHERN','NORTHERN','EASTERN','NORTH_WESTERN','NORTH_CENTRAL','UVA','SABARAGAMUWA'];
export const words=value=>value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
export const localTime=value=>new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Colombo'}).format(new Date(value));
