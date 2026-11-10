#!/usr/bin/env bash
# Only inside a disposable Ubuntu container, after TWO separately built ready releases.
set -euo pipefail
[[ -e /run/trafficease-disposable-test ]] || { echo 'Disposable test marker required'; exit 1; }
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
old=${1:?old release id}
new=${2:?new release id}
install -d /tmp/trafficease-test-tools
install -m 0755 "$here/service-shim.py" /tmp/trafficease-test-tools/systemctl
cat > /tmp/trafficease-test-tools/python3 <<'PY'
#!/bin/sh
# Inject an immediate failed readiness result only for the selected test release.
case "$1" in
  */health.py)
    if [ -f /tmp/trafficease-fail-release ] && [ "$(basename "$(readlink -e /opt/trafficease/current)")" = "$(cat /tmp/trafficease-fail-release)" ]; then
      echo 'Injected failed readiness for rollback test' >&2
      exit 1
    fi
    ;;
esac
exec /usr/bin/python3 "$@"
PY
chmod 0755 /tmp/trafficease-test-tools/python3
export PATH="/tmp/trafficease-test-tools:$PATH"
# No current symlink exists at first activation: exercise the true first-install path.
bash "$here/../activate-release.sh" "$old"
[[ $(basename "$(readlink -e /opt/trafficease/current)") == "$old" ]]
runuser -u trafficease -- test ! -w "/opt/trafficease/releases/$old/backend/app.jar"
echo "$new" > /tmp/trafficease-fail-release
if bash "$here/../activate-release.sh" "$new"; then echo 'Expected failed activation'; exit 1; fi
[[ $(basename "$(readlink -e /opt/trafficease/current)") == "$old" ]]
rm /tmp/trafficease-fail-release
python3 "$here/../health.py"
bash "$here/../activate-release.sh" "$new"
[[ $(basename "$(readlink -e /opt/trafficease/previous)") == "$old" ]]
bash "$here/../rollback.sh"
[[ $(basename "$(readlink -e /opt/trafficease/current)") == "$old" ]]
python3 "$here/../health.py"
echo 'PASS: first activation, immutable runtime files, failed-release recovery, update and manual rollback (service simulator, actual apps)'
