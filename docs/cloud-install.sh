#!/usr/bin/env bash
set -euo pipefail
cd /workspace/TrafficEase
export JAVA_HOME=/workspace/tools/jdk-21.0.9+10
export PATH="$JAVA_HOME/bin:/workspace/tools/apache-maven-3.9.11/bin:$PATH"
python - <<'PY'
import os
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from pathlib import Path
proxy = urlparse(os.environ['HTTPS_PROXY'])
Path('/workspace/tools/maven-settings.xml').write_text('<settings><proxies><proxy><id>cloud</id><active>true</active><protocol>http</protocol><host>'+escape(proxy.hostname)+'</host><port>'+str(proxy.port or 80)+'</port><nonProxyHosts>localhost|127.0.0.1</nonProxyHosts></proxy></proxies></settings>')
PY
npm ci --prefix frontend --cache /workspace/.cache/npm --no-audit --no-fund
npm run build --prefix frontend
python -m venv ai-service/.venv
ai-service/.venv/bin/pip install --cache-dir /workspace/.cache/pip -r ai-service/requirements.lock.txt
(cd ai-service && .venv/bin/python -m pytest -q)
(cd backend && mvn -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts -s /workspace/tools/maven-settings.xml -Dmaven.repo.local=/workspace/.cache/m2 verify)
