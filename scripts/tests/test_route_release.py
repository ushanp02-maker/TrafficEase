"""Portable deployment integrity checks; no root, AWS or provider requests."""
import hashlib,json,subprocess,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
BASE=['backend/app.jar','ai-service/main.py','ai-service/scenarios.py','ai-service/artifacts/model.joblib','ai-service/artifacts/metadata.json','frontend/dist/index.html']
ROUTES=['ai-service/route_api.py','ai-service/route_features.py','ai-service/artifacts/routes/model.joblib','ai-service/artifacts/routes/metadata.json','backend/src/main/resources/experimental/journeys.json']
class ReleaseTest(unittest.TestCase):
 def test_both_platforms_integrity_and_legacy_rollback(self):
  for platform in ['ec2','ec2-ubuntu']:
   script=ROOT/'infra'/platform/'release-manifest.py'
   with tempfile.TemporaryDirectory() as directory:
    root=Path(directory)
    for name in BASE+ROUTES+['ai-service/.venv/bin/python']:
     p=root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b'test-only-placeholder')
    for folder in ['ai-service/artifacts','ai-service/artifacts/routes']:
     meta=dict(experimental=True,dataSource='SYNTHETIC',supportsJourneyDuration=False,artifactSha256=hashlib.sha256((root/folder/'model.joblib').read_bytes()).hexdigest());(root/folder/'metadata.json').write_text(json.dumps(meta))
    def call(mode):return subprocess.run(['python3',str(script),mode,str(root),'test-commit'],capture_output=True,text=True)
    self.assertEqual(call('create').returncode,0);self.assertEqual(call('verify').returncode,0)
    model=root/'ai-service/artifacts/routes/model.joblib';original=model.read_bytes();model.write_bytes(b'corrupted');self.assertNotEqual(call('verify').returncode,0);model.write_bytes(original)
    manifest=root/'READY.json';data=json.loads(manifest.read_text());data['files']={k:v for k,v in data['files'].items() if k in BASE};manifest.write_text(json.dumps(data));self.assertEqual(call('verify').returncode,0)
    data['files'][ROUTES[0]]=hashlib.sha256((root/ROUTES[0]).read_bytes()).hexdigest();manifest.write_text(json.dumps(data));self.assertNotEqual(call('verify').returncode,0)
if __name__=='__main__':unittest.main()
