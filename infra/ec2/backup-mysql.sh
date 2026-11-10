#!/usr/bin/env bash
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
install -d -m 0700 /var/backups/trafficease
umask 077
output="/var/backups/trafficease/mysql-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
trap 'rm -f "$output"' ERR
mysqldump --single-transaction --no-tablespaces --databases trafficease | gzip > "$output"
echo "Local backup created: $output. Copy it securely off this instance; local copies are not disaster recovery."
