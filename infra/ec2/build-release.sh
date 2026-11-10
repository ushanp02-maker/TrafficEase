#!/usr/bin/env bash
# Build at the FINAL release path so the virtualenv never needs relocation.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
[[ $(id -u) != 0 ]] || te_die 'Build as the normal SSH user, never root.'
te_release "${1:-}"
release="$TE_ROOT/releases/$1"
[[ -O "$release" && -z $(ls -A "$release") ]] || te_die 'Release must be empty and owned by this build user.'
repo=$(git -C "$here" rev-parse --show-toplevel)
[[ $(git -C "$repo" branch --show-current) == vidura ]] || te_die 'Build only the vidura branch.'
[[ -z $(git -C "$repo" status --porcelain) ]] || te_die 'Commit or preserve checkout changes before building a reviewed release.'
commit=$(git -C "$repo" rev-parse HEAD)
[[ "$1" == *-"${commit:0:12}" ]] || te_die 'Release ID does not match HEAD.'
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH="$JAVA_HOME/bin:/usr/local/bin:$PATH"
[[ -x "$JAVA_HOME/bin/javac" ]] || te_die 'Java 17 JDK missing.'
python3 -c 'import sys; sys.exit(0 if sys.version_info[:2] == (3,12) else "Python 3.12 required")'
node -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22||(a===22&&b<12))process.exit(1)'
git -C "$repo" archive "$commit" | tar -xf - -C "$release"
cd "$release"
# Never inject laptop Vite endpoint/TLS settings or external API credentials into builds.
unset VITE_API_BASE VITE_TILE_URL DEV_HTTPS_CERT DEV_HTTPS_KEY
export NODE_OPTIONS=--max-old-space-size=768
export MAVEN_OPTS="${MAVEN_OPTS:-} -Xmx512m"
npm ci --prefix frontend --no-audit --no-fund
npm run test:unit --prefix frontend
npm run build --prefix frontend
mvn -f backend/pom.xml -B verify
cp backend/target/trafficease-backend-0.1.0-SNAPSHOT.jar backend/app.jar
python3 -m venv ai-service/.venv
ai-service/.venv/bin/python -m pip install -r ai-service/requirements.lock.txt
(cd ai-service && .venv/bin/python train.py && .venv/bin/python -m pytest -q)
# Smoke-load the newly generated trusted model; no public provider requests.
(cd ai-service && .venv/bin/python - <<'PY'
from main import app
if app.state.model_status != 'ready': raise SystemExit('Trained model is unavailable')
PY
)
rm -rf frontend/node_modules backend/target ai-service/artifacts/data ai-service/.pytest_cache
python3 "$here/release-manifest.py" create "$release" "$commit"
echo "Built $release; activation is a separate root command."
