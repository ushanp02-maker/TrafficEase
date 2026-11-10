#!/usr/bin/env bash
# Ubuntu 24.04 amd64 only. Installs software, not AWS resources. Run only on the chosen EC2 host.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
source "$here/common.sh"
te_root
source /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 && $(dpkg --print-architecture) == amd64 ]] || te_die 'Use Ubuntu 24.04 x86-64.'
deploy_user=${1:-${SUDO_USER:-ubuntu}}
[[ "$deploy_user" =~ ^[a-z_][a-z0-9_-]*$ && "$deploy_user" != root && "$deploy_user" != trafficease ]] || te_die 'Specify the normal SSH/build user.'
id "$deploy_user" >/dev/null
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl xz-utils git sudo python3 python3-venv openjdk-17-jdk-headless nginx certbot apache2-utils iproute2 systemd
id trafficease >/dev/null 2>&1 || useradd --system --user-group --home-dir /var/lib/trafficease --shell /usr/sbin/nologin trafficease
install -d -m 0755 "$TE_ROOT/releases" /var/lib/letsencrypt
install -d -o trafficease -g trafficease -m 0750 /var/lib/trafficease
install -d -o root -g trafficease -m 0750 /etc/trafficease
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
# Stock Nginx site must not be exposed. Configure the domain before opening SG port 80.
rm -f /etc/nginx/sites-enabled/default
if [[ $(cat /proc/1/comm) == systemd ]]; then systemctl daemon-reload; systemctl restart systemd-journald; fi
printf 'Host prepared. Build as %s, not root. No application units were started by this script; package installation may start Nginx. No AWS resources were created.\n' "$deploy_user"
