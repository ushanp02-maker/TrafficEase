#!/usr/bin/env bash
# systemd ExecStartPost: backend ordering waits for actual authenticated DB readiness.
set -euo pipefail
for ((attempt=0; attempt<60; attempt++)); do
    if docker exec --user root trafficease-mysql sh -c 'export MYSQL_PWD="$(cat /run/secrets/mysql-root-password)"; exec mysql -uroot --batch --skip-column-names -e "SELECT 1"' >/dev/null 2>&1; then
        exit 0
    fi
    sleep 2
done
echo 'MySQL did not become ready; inspect the local database unit logs.' >&2
exit 1
