#!/usr/bin/env bash
set -euo pipefail
TE_ROOT=/opt/trafficease
te_die() { echo "TrafficEase: $*" >&2; exit 1; }
te_root() { [[ $(id -u) == 0 ]] || te_die 'Run this administrative script with sudo.'; }
te_id() { [[ ${1:-} =~ ^[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || te_die 'Invalid release ID; expected UTC timestamp-shortcommit.'; }
te_release() {
  te_id "$1"
  [[ -d "$TE_ROOT/releases/$1" && ! -L "$TE_ROOT/releases/$1" ]] || te_die 'Release is missing or is a symlink.'
  [[ $(realpath "$TE_ROOT/releases/$1") == "$TE_ROOT/releases/$1" ]] || te_die 'Release escapes its expected path.'
}
te_domain() {
  python3 - "$1" <<'PY'
import re,sys
s=sys.argv[1]
valid=len(s)<=253 and '.' in s and all(re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?',p) for p in s.split('.'))
if not valid: raise SystemExit('Use a lowercase DNS hostname, not an IP, wildcard or URL')
PY
}
