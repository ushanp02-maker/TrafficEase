import React,{createContext,useContext,useEffect,useState} from 'react';
import {Navigate,Outlet,useLocation} from 'react-router-dom';
import {InlineError} from '../components/Feedback.jsx';
import {governmentRequest} from './api.js';
const Auth=createContext();
export const useGovernment=()=>useContext(Auth);
export function GovernmentProvider(){const [session,setSession]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState('');
 async function refresh(signal){setBusy(true);setError('');try{const data=await governmentRequest('/government/session',{signal});if(!signal?.aborted)setSession(data);return data;}catch(e){if(!signal?.aborted)setError(e.message);throw e;}finally{if(!signal?.aborted)setBusy(false);}}
 useEffect(()=>{const c=new AbortController();refresh(c.signal).catch(()=>{});return()=>c.abort();},[]);
 return <Auth.Provider value={{session,busy,error,refresh,setSession}}><Outlet/></Auth.Provider>;
}
export function ProtectedGovernment(){const {session,busy,error,refresh}=useGovernment();const location=useLocation();if(busy)return <div className="tool-page"><p role="status" className="empty-state">Signing you in…</p></div>;if(error)return <div className="tool-page"><InlineError onRetry={()=>refresh().catch(()=>{})}>{error}</InlineError></div>;return session?.authenticated?<Outlet/>:<Navigate to={`/government/login?next=${encodeURIComponent(location.pathname)}`} replace/>;}
