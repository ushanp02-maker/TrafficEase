#!/usr/bin/env bash
# Optional: current application has no JDBC/MySQL integration. Off by default.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || te_die 'Use Ubuntu 24.04 for MySQL 8.0 packages.'
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y mysql-server
[[ $(mysqld --version) == *'8.0.'* ]] || te_die 'Expected MySQL 8.0; review installed package before proceeding.'
printf '[mysqld]\nbind-address=127.0.0.1\nmysqlx-bind-address=127.0.0.1\n' > /etc/mysql/mysql.conf.d/99-trafficease-local.cnf
systemctl restart mysql
systemctl enable mysql
mysql < "$here/../../database/schema.sql"
echo 'Local-only MySQL schema initialized. No application connection or password was configured.'
