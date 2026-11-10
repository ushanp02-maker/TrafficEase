#!/usr/bin/env python3
"""Local integrity/ready marker, not a signature or an untrusted-code sandbox."""
import hashlib
import json
import sys
from pathlib import Path

mode, root = sys.argv[1], Path(sys.argv[2]).resolve()
manifest = root / 'READY.json'
files = ['backend/app.jar', 'ai-service/main.py', 'ai-service/scenarios.py', 'ai-service/artifacts/model.joblib', 'ai-service/artifacts/metadata.json', 'frontend/dist/index.html']
if mode == 'create':
    data = {'commit': sys.argv[3], 'files': {name: hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files}}
    manifest.write_text(json.dumps(data, indent=2) + '\n')
elif mode == 'verify':
    data = json.loads(manifest.read_text())
    assert set(data['files']) == set(files), 'Unexpected manifest contents'
    assert all(hashlib.sha256((root/name).read_bytes()).hexdigest() == checksum for name,checksum in data['files'].items()), 'Release integrity check failed'
    assert (root/'ai-service/.venv/bin/python').exists(), 'Final-path virtualenv missing'
    meta = json.loads((root/'ai-service/artifacts/metadata.json').read_text())
    assert meta['experimental'] and meta['dataSource'] == 'SYNTHETIC'
    assert meta['artifactSha256'] == data['files']['ai-service/artifacts/model.joblib']
else:
    raise SystemExit('Use create or verify')
print('Release manifest:', mode, 'passed')
