#!/usr/bin/env bash
# Explicit future operator action: contacts Let's Encrypt, not AWS. Never run during readiness-only work.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
te_domain "${1:-}"
[[ ${2:-} == *@* && "$2" != -* ]] || te_die 'Provide a certificate contact email.'
[[ -f /etc/nginx/sites-available/trafficease && -s /etc/trafficease/demo.htpasswd ]] || te_die 'Configure ACME HTTP site and an interactive demo password first.'
chown root:www-data /etc/trafficease/demo.htpasswd
chmod 0640 /etc/trafficease/demo.htpasswd
# Nginx worker needs traversal to this one protected password file, not backend environments.
chmod 0751 /etc/trafficease
certbot certonly --webroot -w /var/lib/letsencrypt -d "$1" --email "$2" --agree-tos --non-interactive --keep-until-expiring
backup=$(mktemp)
cp /etc/nginx/sites-available/trafficease "$backup"
restore() { cp "$backup" /etc/nginx/sites-available/trafficease; rm -f "$backup"; }
trap restore ERR
sed "s/__DOMAIN__/$1/g" "$here/nginx/https.conf.template" > /etc/nginx/sites-available/trafficease
nginx -t
systemctl reload nginx
trap - ERR
rm -f "$backup"
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nset -e\n/usr/sbin/nginx -t\n/bin/systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/trafficease-reload
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/trafficease-reload
systemctl enable --now certbot.timer
echo 'HTTPS configured. Verify in a real browser and run certbot renew --dry-run once.'
