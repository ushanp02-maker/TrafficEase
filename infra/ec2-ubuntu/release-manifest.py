#!/usr/bin/env python3
"""Local integrity/ready marker, not a signature or an untrusted-code sandbox."""
import hashlib
import json
import sys
from pathlib import Path

def require(value, message):
    if not value: raise SystemExit(message)

mode, root = sys.argv[1], Path(sys.argv[2]).resolve()
manifest = root / 'READY.json'
base_files = ['backend/app.jar', 'ai-service/main.py', 'ai-service/scenarios.py', 'ai-service/artifacts/model.joblib', 'ai-service/artifacts/metadata.json', 'frontend/dist/index.html']
route_files = ['ai-service/route_api.py', 'ai-service/route_features.py', 'ai-service/artifacts/routes/model.joblib', 'ai-service/artifacts/routes/metadata.json', 'backend/src/main/resources/experimental/journeys.json']
files = base_files + route_files
if mode == 'create':
    data = {'commit': sys.argv[3], 'files': {name: hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}}
    manifest.write_text(json.dumps(data, indent=2) + '\n')
elif mode == 'verify':
    data = json.loads(manifest.read_text())
    require(set(data['files']) in [set(base_files), set(files)], 'Unexpected manifest contents')
    require(all(hashlib.sha256((root/name).read_bytes()).hexdigest() == checksum for name,checksum in data['files'].items()), 'Release integrity check failed')
    require((root/'ai-service/.venv/bin/python').exists(), 'Final-path virtualenv missing')
    meta = json.loads((root/'ai-service/artifacts/metadata.json').read_text())
    require(meta['experimental'] and meta['dataSource'] == 'SYNTHETIC', 'Invalid model provenance')
    require(meta['artifactSha256'] == data['files']['ai-service/artifacts/model.joblib'], 'Model metadata checksum mismatch')
    if 'ai-service/artifacts/routes/model.joblib' in data['files']:
        route = json.loads((root/'ai-service/artifacts/routes/metadata.json').read_text())
        require(route['experimental'] and route['dataSource'] == 'SYNTHETIC' and not route['supportsJourneyDuration'], 'Invalid route model provenance')
        require(route['artifactSha256'] == data['files']['ai-service/artifacts/routes/model.joblib'], 'Route model metadata checksum mismatch')
else:
    raise SystemExit('Use create or verify')
print('Release manifest:', mode, 'passed')
