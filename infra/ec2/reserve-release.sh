#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
te_id "${1:-}"
owner=${2:-${SUDO_USER:-}}
[[ "$owner" =~ ^[a-z_][a-z0-9_-]*$ && "$owner" != root && "$owner" != trafficease ]] || te_die 'Specify the normal build user.'
id "$owner" >/dev/null
[[ ! -e "$TE_ROOT/releases/$1" ]] || te_die 'Release already exists; choose a new ID.'
mkdir "$TE_ROOT/releases/$1"
chown "$owner:$(id -gn "$owner")" "$TE_ROOT/releases/$1"
chmod 0755 "$TE_ROOT/releases/$1"
