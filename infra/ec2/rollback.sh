#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
previous=$(readlink -e "$TE_ROOT/previous" || true)
[[ -n "$previous" && "$previous" == "$TE_ROOT/releases/"* ]] || te_die 'No previous ready release recorded.'
exec bash "$here/activate-release.sh" "$(basename "$previous")"
