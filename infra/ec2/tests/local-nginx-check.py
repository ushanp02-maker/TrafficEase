#!/usr/bin/env python3
"""Run INSIDE a disposable Amazon Linux test container after a release is built.
Tests actual TLS with a temporary trusted local CA, never --insecure or a real CA order.
"""
import base64
import json
import ssl
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path('/opt/trafficease')
DOMAIN = 'deployment.test'


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def main():
    if not Path('/run/trafficease-disposable-test').exists():
        raise SystemExit('Disposable test marker required; never run on a deployed host')
    site = Path('/etc/nginx/conf.d/trafficease.conf')
    certdir = Path('/etc/letsencrypt/live') / DOMAIN
    certdir.mkdir(parents=True, exist_ok=True)
    # Ephemeral test credentials/certificates stay outside Git. Nothing is ordered remotely.
    with tempfile.TemporaryDirectory() as temp:
        temp = Path(temp)
        run('openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=TrafficEase local test CA', '-keyout', str(temp/'ca.key'), '-out', str(temp/'ca.crt'))
        run('openssl', 'req', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=deployment.test', '-keyout', str(certdir/'privkey.pem'), '-out', str(temp/'server.csr'))
        (temp/'extensions').write_text('subjectAltName=DNS:deployment.test,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n')
        run('openssl', 'x509', '-req', '-in', str(temp/'server.csr'), '-CA', str(temp/'ca.crt'), '-CAkey', str(temp/'ca.key'), '-CAcreateserial', '-days', '1', '-extfile', str(temp/'extensions'), '-out', str(certdir/'fullchain.pem'))
        password = base64.urlsafe_b64encode(__import__('os').urandom(24)).decode()
        # Input via stdin, not a password command argument or log output.
        hashed = subprocess.check_output(['htpasswd','-niB','demo'], input=(password+'\n').encode())
        Path('/etc/trafficease/demo.htpasswd').write_bytes(hashed)
        run('chown','root:nginx','/etc/trafficease/demo.htpasswd')
        run('chmod','0640','/etc/trafficease/demo.htpasswd')
        run('chmod','0751','/etc/trafficease')
        template = Path(__file__).resolve().parents[1]/'nginx/https.conf.template'
        site.write_text(template.read_text().replace('__DOMAIN__',DOMAIN))
        run('nginx','-t')
        run('nginx')
        with Path('/etc/hosts').open('a') as hosts: hosts.write('\n127.0.0.1 deployment.test\n')
        context = ssl.create_default_context(cafile=str(temp/'ca.crt'))
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=context))
        authorization='Basic '+base64.b64encode(('demo:'+password).encode()).decode()
        def get(path, auth=True):
            headers={'Host':DOMAIN}
            if auth: headers['Authorization']=authorization
            with opener.open(urllib.request.Request('https://'+DOMAIN+path,headers=headers),timeout=20) as response:
                return response.status,response.read(),response.headers
        for path in ['/', '/api/health']:
            try: get(path,False);raise AssertionError('Endpoint was not protected: '+path)
            except urllib.error.HTTPError as error: assert error.code==401
        status,html,headers=get('/')
        assert status==200 and b'TrafficEase' in html
        assert 'camera=(self)' in headers['Permissions-Policy']
        assert "connect-src 'self'" in headers['Content-Security-Policy']
        assert headers['Referrer-Policy']=='strict-origin-when-cross-origin'
        assert headers['X-Content-Type-Options']=='nosniff'
        _,body,_=get('/api/health');assert json.loads(body)['service']=='trafficease-backend'
        _,body,_=get('/api/forecasts/catalog');assert json.loads(body)['modelStatus']=='ready'
        _,body,_=get('/a/client/side/route');assert b'TrafficEase' in body
        for path in ['/assets/missing.js','/.env','/api/missing-endpoint']:
            try: get(path);raise AssertionError('Unexpected success: '+path)
            except urllib.error.HTTPError as error: assert error.code in (403,404)
        print('PASS: actual Nginx TLS, password auth, security headers, same-origin Java/AI proxy, SPA fallback and protected paths')
        run('nginx','-s','quit')


if __name__=='__main__':
    main()
