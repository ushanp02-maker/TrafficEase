#!/usr/bin/env bash
# Explicit future operator action: contacts Let's Encrypt, not AWS. Never run during readiness-only work.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
te_domain "${1:-}"
[[ ${2:-} == *@* && "$2" != -* ]] || te_die 'Provide a certificate contact email.'
[[ -f /etc/nginx/conf.d/trafficease.conf && -s /etc/trafficease/demo.htpasswd ]] || te_die 'Configure ACME HTTP site and an interactive demo password first.'
chown root:nginx /etc/trafficease/demo.htpasswd
chmod 0640 /etc/trafficease/demo.htpasswd
# Nginx worker needs traversal to this one protected password file, not backend environments.
chmod 0751 /etc/trafficease
if command -v getenforce >/dev/null && [[ $(getenforce) != Disabled ]]; then
    semanage fcontext -a -t httpd_config_t '/etc/trafficease/demo.htpasswd' 2>/dev/null || semanage fcontext -m -t httpd_config_t '/etc/trafficease/demo.htpasswd'
    restorecon /etc/trafficease/demo.htpasswd
fi
/opt/trafficease-certbot/bin/certbot certonly --webroot -w /var/lib/letsencrypt -d "$1" --email "$2" --agree-tos --non-interactive --keep-until-expiring
if command -v getenforce >/dev/null && [[ $(getenforce) != Disabled ]]; then
    semanage fcontext -a -t cert_t '/etc/letsencrypt(/.*)?' 2>/dev/null || semanage fcontext -m -t cert_t '/etc/letsencrypt(/.*)?'
    restorecon -R /etc/letsencrypt
fi
backup=$(mktemp)
cp /etc/nginx/conf.d/trafficease.conf "$backup"
restore() { cp "$backup" /etc/nginx/conf.d/trafficease.conf; rm -f "$backup"; }
trap restore ERR
sed "s/__DOMAIN__/$1/g" "$here/nginx/https.conf.template" > /etc/nginx/conf.d/trafficease.conf
chown root:root /etc/nginx/conf.d/trafficease.conf
chmod 0644 /etc/nginx/conf.d/trafficease.conf
nginx -t
systemctl reload nginx
trap - ERR
rm -f "$backup"
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nset -e\n/usr/sbin/nginx -t\n/bin/systemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/trafficease-reload
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/trafficease-reload
systemctl enable --now trafficease-certbot.timer
echo 'HTTPS configured. Verify in a real browser and run certbot renew --dry-run once.'
