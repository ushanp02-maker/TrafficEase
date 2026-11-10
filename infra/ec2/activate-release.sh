#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
te_release "${1:-}"
release="$TE_ROOT/releases/$1"
python3 "$here/release-manifest.py" verify "$release"
nginx -t
old=""
if [[ -L "$TE_ROOT/current" ]]; then
    old=$(readlink -e "$TE_ROOT/current") || te_die 'Current release link is dangling.'
    te_release "$(basename "$old")"
    [[ "$old" == "$TE_ROOT/releases/$(basename "$old")" && -f "$old/READY.json" ]] || te_die 'Current link does not name a ready local release.'
elif [[ -e "$TE_ROOT/current" ]]; then
    te_die 'Current must be a release symlink, not an existing file/directory.'
fi
[[ "$old" != "$release" ]] || te_die 'Release is already current.'
# Runtime cannot rewrite its own code or artifacts. The SSH admin remains trusted.
chown -hR root:root "$release"
chmod -R go-w "$release"
chmod -R a+rX "$release"
switch_to() {
    ln -sfn "$1" "$TE_ROOT/.current-next"
    mv -Tf "$TE_ROOT/.current-next" "$TE_ROOT/current"
}
recover() {
    trap - ERR
    echo 'Activation failed; attempting to restore the previous current release.' >&2
    systemctl stop trafficease-backend trafficease-ai || true
    if [[ -n "$old" ]]; then
        switch_to "$old"
        if systemctl restart trafficease-ai trafficease-backend && python3 "$here/health.py" --attempts 30; then
            echo 'Previous release restored.' >&2
        else
            echo 'Rollback health failed; inspect local systemd status and logs.' >&2
        fi
    else
        rm -f "$TE_ROOT/current"
        echo 'First activation failed; services stopped and no current release selected.' >&2
    fi
    exit 1
}
trap recover ERR
systemctl stop trafficease-backend trafficease-ai
switch_to "$release"
systemctl restart trafficease-ai trafficease-backend
python3 "$here/health.py" --attempts 30
systemctl is-active --quiet trafficease-ai trafficease-backend
if [[ -n "$old" ]]; then ln -sfn "$old" "$TE_ROOT/previous"; fi
systemctl enable trafficease-ai trafficease-backend
trap - ERR
echo "Activated $1; previous release retained."
