#!/usr/bin/env bash
# Amazon Linux 2023 x86-64 only. Installs software, not AWS resources. Run only on the chosen EC2 host.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
source /etc/os-release
[[ "$ID" == amzn && "$VERSION_ID" == 2023 && $(uname -m) == x86_64 ]] || te_die 'Use Amazon Linux 2023 x86-64; Ubuntu is preserved under infra/ec2-ubuntu.'
deploy_user=${1:-${SUDO_USER:-ec2-user}}
[[ "$deploy_user" =~ ^[a-z_][a-z0-9_-]*$ && "$deploy_user" != root && "$deploy_user" != trafficease ]] || te_die 'Specify the normal SSH/build user.'
id "$deploy_user" >/dev/null
# Fresh-host installer only. Never replace an unrelated existing Nginx deployment.
if [[ -e /etc/nginx/nginx.conf && ! -f /etc/trafficease/platform-amazon-linux-2023 ]]; then
    te_die 'Existing Nginx configuration found. Review/migrate it manually; this installer will not overwrite it.'
fi
dnf install -y ca-certificates curl-minimal openssl xz tar gzip git sudo shadow-utils findutils diffutils which procps-ng iproute java-17-amazon-corretto-devel python3.12 python3.12-pip nginx httpd-tools systemd libselinux-utils policycoreutils
python3.12 -m venv /opt/trafficease-certbot
/opt/trafficease-certbot/bin/python -m pip install --require-virtualenv -r "$here/requirements-certbot.lock.txt"
ln -sfn /opt/trafficease-certbot/bin/certbot /usr/local/bin/certbot
id trafficease >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/trafficease --shell /usr/sbin/nologin trafficease
install -d -m 0755 "$TE_ROOT/releases" /var/lib/letsencrypt
install -d -o trafficease -g trafficease -m 0750 /var/lib/trafficease
install -d -o root -g trafficease -m 0750 /etc/trafficease
[[ ! -s /etc/trafficease/demo.htpasswd ]] || chmod 0751 /etc/trafficease
for name in backend ai; do
    [[ -e /etc/trafficease/$name.env ]] || install -o root -g trafficease -m 0640 "$here/env/$name.env.example" "/etc/trafficease/$name.env"
done
# Pinned official distributions; keep TLS and checksum verification enabled.
node_version=22.23.4
maven_version=3.9.11
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
if [[ ! -x /opt/trafficease-tools/node-v$node_version-linux-x64/bin/node ]]; then
    curl -fSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.xz" -o "$scratch/node.tar.xz"
    curl -fSL "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" -o "$scratch/node-shas.txt"
    expected=$(awk -v file="node-v$node_version-linux-x64.tar.xz" '$2 == file {print $1}' "$scratch/node-shas.txt")
    [[ "$expected" =~ ^[a-f0-9]{64}$ ]] || te_die 'Missing official Node checksum.'
    echo "$expected  $scratch/node.tar.xz" | sha256sum -c -
    install -d /opt/trafficease-tools
    tar -xJf "$scratch/node.tar.xz" -C /opt/trafficease-tools
fi
if [[ ! -x /opt/trafficease-tools/apache-maven-$maven_version/bin/mvn ]]; then
    url="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$maven_version/apache-maven-$maven_version-bin.tar.gz"
    curl -fSL "$url" -o "$scratch/maven.tar.gz"
    curl -fSL "$url.sha512" -o "$scratch/maven.sha512"
    expected=$(tr -d '[:space:]' < "$scratch/maven.sha512")
    [[ "$expected" =~ ^[a-f0-9]{128}$ ]] || te_die 'Invalid official Maven checksum.'
    echo "$expected  $scratch/maven.tar.gz" | sha512sum -c -
    tar -xzf "$scratch/maven.tar.gz" -C /opt/trafficease-tools
fi
for executable in node npm npx; do ln -sfn "/opt/trafficease-tools/node-v$node_version-linux-x64/bin/$executable" "/usr/local/bin/$executable"; done
ln -sfn "/opt/trafficease-tools/apache-maven-$maven_version/bin/mvn" /usr/local/bin/mvn
install -m 0644 "$here/systemd/trafficease-ai.service" "$here/systemd/trafficease-backend.service" /etc/systemd/system/
# Bound local journal growth; no CloudWatch agent or paid log service.
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=100M\nRuntimeMaxUse=50M\nMaxRetentionSec=7day\n' > /etc/systemd/journald.conf.d/trafficease.conf
# AL2023 uses conf.d, user nginx, and may ship an inline default server.
# Preserve the original package file, then install only our minimal fresh-host layout.
[[ -e /etc/nginx/nginx.conf.before-trafficease ]] || cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.before-trafficease
install -m 0644 "$here/nginx/nginx.conf" /etc/nginx/nginx.conf
install -m 0644 "$here/systemd/trafficease-certbot.service" "$here/systemd/trafficease-certbot.timer" /etc/systemd/system/
touch /etc/trafficease/platform-amazon-linux-2023
chmod 0644 /etc/trafficease/platform-amazon-linux-2023
# Keep SELinux enforcing where enabled: allow Nginx static files and loopback proxying.
# Minimal containers do not have active SELinux; this host gate is checked at deployment.
if command -v getenforce >/dev/null && [[ $(getenforce) != Disabled ]]; then
    dnf install -y policycoreutils-python-utils
    semanage fcontext -a -t httpd_sys_content_t '/opt/trafficease(/.*)?' 2>/dev/null || semanage fcontext -m -t httpd_sys_content_t '/opt/trafficease(/.*)?'
    semanage fcontext -a -t httpd_sys_content_t '/var/lib/letsencrypt(/.*)?' 2>/dev/null || semanage fcontext -m -t httpd_sys_content_t '/var/lib/letsencrypt(/.*)?'
    restorecon -R /var/lib/letsencrypt /opt/trafficease
    setsebool -P httpd_can_network_connect on
fi
if [[ $(cat /proc/1/comm) == systemd ]]; then systemctl daemon-reload; systemctl restart systemd-journald; fi
printf 'Amazon Linux host prepared. Build as %s, not root. No application services or AWS resources were started.\n' "$deploy_user"
