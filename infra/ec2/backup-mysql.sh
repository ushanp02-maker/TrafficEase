#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
install -d -m 0700 /var/backups/trafficease
umask 077
output="/var/backups/trafficease/mysql-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
trap 'rm -f "$output"' ERR
docker exec --user root trafficease-mysql sh -c 'export MYSQL_PWD="$(cat /run/secrets/mysql-root-password)"; exec mysqldump -uroot --single-transaction --no-tablespaces --databases trafficease' | gzip > "$output"
echo "Local backup created: $output. Securely copy it off-host; local backups do not protect against instance/volume loss."
