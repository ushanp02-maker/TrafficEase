import {useCallback,useEffect,useRef,useState} from 'react';
import {angleDelta,extractHeading} from './geometry.js';

export default function useArSensors(video){
 const [camera,setCamera]=useState('off'),[rear,setRear]=useState(false),[gps,setGps]=useState(null),[heading,setHeading]=useState(null);
 const [gpsStatus,setGpsStatus]=useState('off'),[compassStatus,setCompassStatus]=useState('off');
 const stream=useRef(),watch=useRef(null),listener=useRef(),mounted=useRef(true);
 const cameraGeneration=useRef(0),gpsGeneration=useRef(0),compassGeneration=useRef(0),timers=useRef(new Set());
 const clearGps=useCallback(()=>{if(watch.current!==null)navigator.geolocation?.clearWatch?.(watch.current);watch.current=null;for(const timer of timers.current)clearTimeout(timer);timers.current.clear();},[]);
 const stop=useCallback(()=>{
  cameraGeneration.current++;gpsGeneration.current++;compassGeneration.current++;
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;clearGps();
  if(listener.current){window.removeEventListener('deviceorientation',listener.current);window.removeEventListener('deviceorientationabsolute',listener.current);listener.current=null;}
  if(mounted.current){setCamera('off');setRear(false);setGps(null);setHeading(null);setGpsStatus('off');setCompassStatus('off');}
 },[video,clearGps]);
 useEffect(()=>{
  mounted.current=true;const hide=()=>{if(document.hidden)stop();};window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',hide);
  return()=>{mounted.current=false;stop();window.removeEventListener('pagehide',stop);document.removeEventListener('visibilitychange',hide);};
 },[stop]);
 const startCamera=useCallback(async()=>{
  if(!window.isSecureContext){setCamera('HTTPS or localhost is required');return;}
  if(!navigator.mediaDevices?.getUserMedia){setCamera('Camera unavailable; guided preview remains available');return;}
  stream.current?.getTracks().forEach(t=>t.stop());const token=++cameraGeneration.current;setCamera('requesting');
  try{
   let media;
   try{media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{exact:'environment'}}});}
   catch(error){
    if(token!==cameraGeneration.current||!mounted.current)return;
    if(!['OverconstrainedError','NotFoundError'].includes(error.name))throw error;
    // One bounded fallback can show a front webcam for preview; it never qualifies as rear-camera alignment.
    media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
   }
   if(!mounted.current||token!==cameraGeneration.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;setRear(media.getVideoTracks()[0]?.getSettings?.().facingMode==='environment');
   if(video.current){video.current.srcObject=media;await video.current.play();}
   if(!mounted.current||token!==cameraGeneration.current){media.getTracks().forEach(t=>t.stop());return;}
   setCamera('on');media.getVideoTracks()[0]?.addEventListener('ended',()=>{if(mounted.current&&token===cameraGeneration.current){setRear(false);setCamera('Camera ended; guided preview remains available');}},{once:true});
  }catch(error){if(mounted.current&&token===cameraGeneration.current){stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setRear(false);setCamera(error.name==='NotAllowedError'?'Camera permission denied; guided preview remains available':'Camera unavailable; guided preview remains available');}}
 },[video]);
 const startGps=useCallback(()=>{
  clearGps();setGps(null);const token=++gpsGeneration.current;
  if(!window.isSecureContext||!navigator.geolocation){setGpsStatus('Location unavailable; guided preview remains available');return;}
  let attempts=0,lastUpdate=0;
  const later=(callback,ms)=>{const id=setTimeout(()=>{timers.current.delete(id);callback();},ms);timers.current.add(id);return id;};
  function begin(){
   if(!mounted.current||token!==gpsGeneration.current)return;
   attempts++;setGpsStatus('Connecting GPS');let usable=false,finished=false,acquisition;
   function retry(denied=false){
    if(finished||token!==gpsGeneration.current)return;finished=true;
    if(acquisition){clearTimeout(acquisition);timers.current.delete(acquisition);}
    if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;
    setGps(null);
    if(denied){setGpsStatus('Location permission denied; guided preview remains available');return;}
    if(attempts>=3){setGpsStatus('Location not found. Retry when ready.');return;}
    setGpsStatus('Waiting for a better location');later(begin,attempts===1?15000:30000);
   }
   try{
    watch.current=navigator.geolocation.watchPosition(position=>{
     if(!mounted.current||token!==gpsGeneration.current||finished)return;
     const c=position.coords;
     if(![c.latitude,c.longitude,c.accuracy,position.timestamp].every(Number.isFinite)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||c.accuracy<=0){setGps(null);setGpsStatus('Location uncertain');return;}
     const now=Date.now();if(now-lastUpdate<1000)return;lastUpdate=now;
     setGps({latitude:c.latitude,longitude:c.longitude,accuracy:c.accuracy,speed:c.speed,timestamp:position.timestamp});
     if(c.accuracy<=30&&position.timestamp<=now+1000&&now-position.timestamp<=10000){usable=true;setGpsStatus('on');if(acquisition){clearTimeout(acquisition);timers.current.delete(acquisition);}}
     else setGpsStatus('Location uncertain');
    },error=>{if(mounted.current&&token===gpsGeneration.current)retry(error.code===1);},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
    acquisition=later(()=>{if(!usable)retry();},20000);
   }catch{retry();}
  }
  begin();
 },[clearGps]);
 const startCompass=useCallback(async()=>{
  const token=++compassGeneration.current;setHeading(null);
  if(listener.current){window.removeEventListener('deviceorientation',listener.current);window.removeEventListener('deviceorientationabsolute',listener.current);listener.current=null;}
  if(!window.isSecureContext||!window.DeviceOrientationEvent){setCompassStatus('Compass unavailable; guided preview remains available');return;}
  setCompassStatus('Connecting compass');
  try{
   // Must be called from the same Start click as camera permission on iOS; never auto-reprompt.
   const decision=typeof window.DeviceOrientationEvent.requestPermission==='function'?await window.DeviceOrientationEvent.requestPermission():'granted';
   if(!mounted.current||token!==compassGeneration.current)return;
   if(decision!=='granted'){setCompassStatus('Compass permission denied; guided preview remains available');return;}
   let samples=[],last=0;
   listener.current=event=>{
    if(!mounted.current||token!==compassGeneration.current)return;
    const time=Date.now();if(time-last<100)return;last=time;
    const value=extractHeading(event,window.screen.orientation?.angle??window.orientation??Number.NaN);
    if(!value){samples=[];setHeading(null);setCompassStatus('Hold upright in portrait for a reliable compass');return;}
    samples=[...samples,{...value,timestamp:time}].slice(-6);
    const stable=samples.length>=4&&samples.at(-1).timestamp-samples[0].timestamp>=300&&samples.every(s=>Math.abs(angleDelta(s.degrees,value.degrees))<8);
    setHeading({...value,timestamp:time,stable});setCompassStatus(stable?'on':'Steadying compass');
   };
   window.addEventListener('deviceorientation',listener.current);window.addEventListener('deviceorientationabsolute',listener.current);setCompassStatus('Waiting for compass');
  }catch{if(mounted.current&&token===compassGeneration.current)setCompassStatus('Compass permission unavailable. Retry when ready.');}
 },[]);
 return {camera,rear,gps,heading,gpsStatus,compassStatus,startCamera,startGps,startCompass,stop};
}
