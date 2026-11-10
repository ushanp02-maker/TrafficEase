# Disposable Amazon Linux deployment checks

These helpers are **test-only**, not EC2 installation commands or a production systemd replacement. Use an isolated disposable Amazon Linux 2023 x86-64 container with no published ports, a process-reaping init (`docker run --init`), and no credentials. Run the real installer there, build two different committed `vidura` releases as a normal build user at their final paths, and configure `/etc/nginx/conf.d/trafficease.conf` from the HTTP template using `deployment.test`. Use the provided minimal `nginx.conf`, not a stock inline default server.

Only in that disposable container, as root:

```sh
touch /run/trafficease-disposable-test
bash infra/ec2/tests/activation-check.sh OLD_RELEASE_ID NEW_RELEASE_ID
python3 infra/ec2/tests/negative-check.py
python3 infra/ec2/tests/local-nginx-check.py
python3 infra/ec2/tests/http-check.py
systemd-analyze verify /etc/systemd/system/trafficease-{ai,backend}.service
```

The first check expects no initial `current` symlink. It uses the service simulator through a temporary PATH, but launches the actual built apps, unit commands, environment files and runtime user. The negative check temporarily alters and restores the test JAR and binds wildcard port 33060; run it **before** optional MySQL installation. HTTPS tests create ephemeral credentials and a trusted local CA, edit container-only hosts/Nginx files and require no DNS/public certificate order. No public geocoder/router calls are made by these tests. Never reuse their certificates/passwords outside the container.

Discard the container after collecting results. These checks do not validate systemd boot/sandbox enforcement, EC2 networking/billing, public certificate renewal or physical smartphone alignment. See [recorded results](../../../docs/ec2-validation.md).

The current environment denied `cdn.amazonlinux.com` (HTTP 403), so a complete dnf installer/final-path release lifecycle has not yet been revalidated on AL2023. The report distinguishes actual AL application/runtime checks from the previous Ubuntu lifecycle evidence. Do not describe the service simulator as a real systemd boot.
