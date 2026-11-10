import { useEffect, useRef, useState } from 'react';
import { angleDelta, extractHeading } from './geometry.js';

export default function useArSensors(video) {
  const [camera, setCamera] = useState('off'), [rear, setRear] = useState(false);
  const [gps, setGps] = useState(null), [heading, setHeading] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('off'), [compassStatus, setCompassStatus] = useState('off');
  const stream = useRef(), watch = useRef(null), listener = useRef(), mounted = useRef(true), cameraGeneration = useRef(0), gpsGeneration = useRef(0), compassGeneration = useRef(0);
  function stop() {
    cameraGeneration.current++; gpsGeneration.current++; compassGeneration.current++;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (watch.current !== null) navigator.geolocation?.clearWatch?.(watch.current); watch.current = null;
    if (listener.current) {
      window.removeEventListener('deviceorientation', listener.current);
      window.removeEventListener('deviceorientationabsolute', listener.current); listener.current = null;
    }
    if (mounted.current) { setCamera('off'); setRear(false); setGps(null); setHeading(null); setGpsStatus('off'); setCompassStatus('off'); }
  }
  useEffect(() => {
    mounted.current = true;
    const hide = () => { if (document.hidden) stop(); };
    window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', hide);
    return () => { mounted.current = false; stop(); window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hide); };
  }, []);
  async function startCamera() {
    if (!window.isSecureContext) { setCamera('HTTPS or localhost is required'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setCamera('Camera API unavailable; use the map'); return; }
    stream.current?.getTracks().forEach(track => track.stop()); const token = ++cameraGeneration.current; setCamera('requesting');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { exact: 'environment' } } });
      if (!mounted.current || token !== cameraGeneration.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media; setRear(media.getVideoTracks()[0]?.getSettings?.().facingMode === 'environment');
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      if (mounted.current && token === cameraGeneration.current) setCamera('on');
      media.getVideoTracks()[0]?.addEventListener('ended', () => { if (mounted.current && token === cameraGeneration.current) { setRear(false); setCamera('Camera stream ended; use the map'); } }, { once: true });
    } catch (error) {
      if (mounted.current && token === cameraGeneration.current) {
        stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setRear(false);
        setCamera(error.name === 'NotAllowedError' ? 'Camera permission denied; use the map' : 'Rear camera unavailable; use the map');
      }
    }
  }
  function startGps() {
    setGps(null);
    if (!window.isSecureContext || !navigator.geolocation) { setGpsStatus('GPS API unavailable; select a manual origin'); return; }
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    const token = ++gpsGeneration.current; setGpsStatus('requesting');
    try { watch.current = navigator.geolocation.watchPosition(position => {
      if (!mounted.current || token !== gpsGeneration.current) return;
      const c = position.coords;
      if (![c.latitude, c.longitude, c.accuracy, position.timestamp].every(Number.isFinite)) { setGps(null); setGpsStatus('Invalid GPS fix; use manual origin'); return; }
      setGps({ latitude: c.latitude, longitude: c.longitude, accuracy: c.accuracy, speed: c.speed, timestamp: position.timestamp }); setGpsStatus('on');
    }, error => { if (mounted.current && token === gpsGeneration.current) { setGps(null); setGpsStatus(error.code === 1 ? 'GPS permission denied; select a manual origin' : 'GPS unavailable or timed out; select a manual origin'); } }, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }); } catch { setGps(null); setGpsStatus('GPS API blocked; select a manual origin'); }
  }
  async function startCompass() {
    if (!window.isSecureContext || !window.DeviceOrientationEvent) { setCompassStatus('Orientation API unavailable; use the map'); return; }
    const token = ++compassGeneration.current;
    setHeading(null); setCompassStatus('requesting');
    if (listener.current) { window.removeEventListener('deviceorientation', listener.current); window.removeEventListener('deviceorientationabsolute', listener.current); listener.current = null; }
    try {
      // On iOS this must be called directly from the user gesture, before other awaits.
      const decision = typeof window.DeviceOrientationEvent.requestPermission === 'function' ? await window.DeviceOrientationEvent.requestPermission() : 'granted';
      if (!mounted.current || token !== compassGeneration.current) return;
      if (decision !== 'granted') { setCompassStatus('Compass permission denied; use the map'); return; }
      if (listener.current) { window.removeEventListener('deviceorientation', listener.current); window.removeEventListener('deviceorientationabsolute', listener.current); }
      let samples = [], last = 0;
      listener.current = event => {
        if (!mounted.current || token !== compassGeneration.current) return;
        const time = Date.now(); if (time - last < 100) return; last = time;
        const value = extractHeading(event, window.screen.orientation?.angle ?? window.orientation ?? Number.NaN);
        if (!value) { samples = []; setHeading(null); setCompassStatus('Unreliable heading/pose; hold upright in portrait or use map'); return; }
        samples = [...samples, { ...value, timestamp: time }].slice(-6);
        const stable = samples.length >= 4 && samples[samples.length - 1].timestamp - samples[0].timestamp >= 300 && samples.every(s => Math.abs(angleDelta(s.degrees, value.degrees)) < 8);
        setHeading({ ...value, timestamp: time, stable }); setCompassStatus(stable ? 'on' : 'Stabilizing compass…');
      };
      window.addEventListener('deviceorientation', listener.current); window.addEventListener('deviceorientationabsolute', listener.current);
      setCompassStatus('Waiting for absolute compass events; use map if none arrive');
    } catch { if (mounted.current && token === compassGeneration.current) setCompassStatus('Compass permission failed; use the map'); }
  }
  return { camera, rear, gps, heading, gpsStatus, compassStatus, startCamera, startGps, startCompass, stop };
}
