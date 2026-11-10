#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
[[ $(id -u) != 0 ]] || te_die 'Run as the normal SSH/build user.'
repo=$(git -C "$here" rev-parse --show-toplevel)
[[ $(git -C "$repo" branch --show-current) == vidura && -z $(git -C "$repo" status --porcelain) ]] || te_die 'Use a clean vidura checkout.'
git -C "$repo" pull --ff-only origin vidura
# Refresh helper path after pull, never switch to main.
here="$repo/infra/ec2"
id="$(date -u +%Y%m%dT%H%M%SZ)-$(git -C "$repo" rev-parse --short=12 HEAD)"
sudo bash "$here/reserve-release.sh" "$id" "$(id -un)"
bash "$here/build-release.sh" "$id"
sudo bash "$here/activate-release.sh" "$id"
