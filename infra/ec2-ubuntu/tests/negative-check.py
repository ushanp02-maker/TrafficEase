#!/usr/bin/env python3
"""Disposable container only: corrupt/restore a test artifact and open a temporary wildcard port."""
import subprocess,time
from pathlib import Path
if not Path('/run/trafficease-disposable-test').exists():
    raise SystemExit('Disposable test marker required')
root=Path('/opt/trafficease/current').resolve()
here=Path(__file__).resolve().parents[1]
script=str(here/'release-manifest.py')
p=root/'backend/app.jar';size=p.stat().st_size
try:
    with p.open('ab') as f:f.write(b'corruption-test')
    r=subprocess.run(['python3',script,'verify',str(root)],capture_output=True,text=True)
    assert r.returncode!=0 and 'integrity' in r.stderr
finally:
    with p.open('r+b') as f:f.truncate(size)
subprocess.run(['python3',script,'verify',str(root)],check=True)
listener=subprocess.Popen(['python3','-m','http.server','33060','--bind','0.0.0.0'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
    time.sleep(.5)
    assert listener.poll() is None
    r=subprocess.run(['python3',str(here/'health.py')],capture_output=True,text=True)
    assert r.returncode!=0 and 'not loopback-only' in r.stderr,r.stderr
finally:
    listener.terminate();listener.wait()
print('PASS: altered artifact rejected; wildcard internal listener rejected')
