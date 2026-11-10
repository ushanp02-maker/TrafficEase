#!/usr/bin/env bash
# Dry run by default. Always retain current, previous and newest three release directories.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
[[ ${1:-} == '' || ${1:-} == --apply ]] || te_die 'Use no argument for dry run or --apply after reviewing it.'
current=$(readlink -e "$TE_ROOT/current" || true)
previous=$(readlink -e "$TE_ROOT/previous" || true)
mapfile -t releases < <(find "$TE_ROOT/releases" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort -r)
for ((i=3; i<${#releases[@]}; i++)); do
    name=${releases[i]}; te_release "$name"
    path="$TE_ROOT/releases/$name"
    [[ "$path" != "$current" && "$path" != "$previous" ]] || continue
    echo "Old release: $path"
    if [[ ${1:-} == --apply ]]; then rm -rf --one-file-system -- "$path"; fi
done
