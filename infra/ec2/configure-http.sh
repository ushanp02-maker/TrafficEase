#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
te_domain "${1:-}"
[[ ! -e /etc/nginx/conf.d/trafficease.conf ]] || te_die 'Site exists; preserve/review it rather than overwriting HTTPS configuration.'
sed "s/__DOMAIN__/$1/g" "$here/nginx/http.conf.template" > /etc/nginx/conf.d/trafficease.conf
chown root:root /etc/nginx/conf.d/trafficease.conf
chmod 0644 /etc/nginx/conf.d/trafficease.conf
nginx -t
systemctl enable --now nginx
systemctl reload nginx
echo 'ACME-only HTTP site configured. Create the demo password, verify DNS/SG, then enable HTTPS.'
