#!/usr/bin/env bash
# OPTIONAL AL2023 profile: pinned official MySQL 8 container, not MariaDB.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
source /etc/os-release
[[ "$ID" == amzn && "$VERSION_ID" == 2023 && $(uname -m) == x86_64 ]] || te_die 'Use Amazon Linux 2023 x86-64.'
for name in mysql-root-password mysql-app-password; do
    file="/etc/trafficease/$name"
    [[ -f "$file" && ! -L "$file" && -s "$file" && $(stat -c %U "$file") == root && $(stat -c %a "$file") == 600 ]] || te_die 'Create nonempty root-owned 0600 database secret files locally, outside Git, as documented.'
done
dnf install -y docker
systemctl enable --now docker
if [[ ! -e /etc/trafficease/mysql-managed ]]; then
    if docker container inspect trafficease-mysql >/dev/null 2>&1 || docker volume inspect trafficease-mysql-data >/dev/null 2>&1; then
        te_die 'Existing unmanaged database container/volume found; never overwrite it.'
    fi
fi
# A digest fixes the tested MySQL 8 release. Review security updates before public launch.
docker pull mysql:8.4@sha256:a81d043930e51745522bd5c430961cf8286f0a23f0a9a2a6e0108f7ea71b0902
install -m 0644 "$here/systemd/trafficease-mysql.service" /etc/systemd/system/
install -d /usr/local/libexec /etc/systemd/system/trafficease-backend.service.d
install -m 0755 "$here/wait-mysql.sh" /usr/local/libexec/trafficease-wait-mysql
printf '[Unit]\nWants=trafficease-mysql.service\nAfter=trafficease-mysql.service\n' > /etc/systemd/system/trafficease-backend.service.d/mysql.conf
chmod 0644 /etc/systemd/system/trafficease-backend.service.d/mysql.conf
touch /etc/trafficease/mysql-managed
systemctl daemon-reload
systemctl enable --now trafficease-mysql
echo 'Optional local MySQL starting. Configure the protected backend mysql profile only after database startup succeeds. Never publish 3306/33060.'
