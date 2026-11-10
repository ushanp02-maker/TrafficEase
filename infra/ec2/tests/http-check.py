#!/usr/bin/env python3
"""Disposable container only: verify plaintext app blocking and ACME access."""
from pathlib import Path
import subprocess,http.client
if not Path('/run/trafficease-disposable-test').exists():
 raise SystemExit('Disposable test marker required')
site=Path('/etc/nginx/conf.d/trafficease.conf')
original=site.read_text()
token=Path('/var/lib/letsencrypt/.well-known/acme-challenge/local-check')
token.parent.mkdir(parents=True,exist_ok=True);token.write_text('local-only')
try:
 site.write_text((Path(__file__).resolve().parents[1]/'nginx/http.conf.template').read_text().replace('__DOMAIN__','deployment.test'))
 subprocess.run(['nginx','-t'],check=True);subprocess.run(['nginx'],check=True)
 for path,status in [('/',503),('/api/health',503),('/.well-known/acme-challenge/local-check',200)]:
  c=http.client.HTTPConnection('127.0.0.1',80);c.request('GET',path,headers={'Host':'deployment.test'});r=c.getresponse();assert r.status==status,(path,r.status);r.read();c.close()
 print('PASS: initial HTTP exposes only ACME and returns 503 for app/API')
finally:
 subprocess.run(['nginx','-s','quit'],check=True);site.write_text(original);token.unlink()
