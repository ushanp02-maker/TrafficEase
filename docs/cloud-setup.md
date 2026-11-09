# Current cloud machine

Use the existing `/workspace/TrafficEase` checkout; cloud tasks are already isolated. Do not create another worktree by default.

The base image has Node 24 and Python 3.12, but only a Java 21 runtime. A local Temurin JDK 17.0.17+10 and Maven 3.9.11 were downloaded from their official release distributions into `/workspace/tools`, with SHA-256 (JDK) and SHA-512 (Maven) verification. The JDK digest was verified using the official GitHub release asset metadata to check the archive against its published digest. TLS verification remained enabled.

For Maven in this machine:

```sh
export JAVA_HOME=/workspace/tools/jdk-17.0.17+10
export PATH="$JAVA_HOME/bin:/workspace/tools/apache-maven-3.9.11/bin:$PATH"
cd /workspace/TrafficEase/backend
mvn -Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts \
  -s /workspace/tools/maven-settings.xml \
  -Dmaven.repo.local=/workspace/.cache/m2 verify
```

The settings file contains the current cloud HTTP proxy host/port, without credentials. Regenerate it from the inherited `HTTPS_PROXY` if the proxy changes in a future task. The system Java truststore preserves trust in the cloud CA; the downloaded JDK's default store lacks it.

To regenerate the settings without exposing environment values:

```sh
python - <<'PY'
import os
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from pathlib import Path
proxy = urlparse(os.environ['HTTPS_PROXY'])
Path('/workspace/tools/maven-settings.xml').write_text(
    '<settings><proxies><proxy><id>cloud</id><active>true</active>'
    '<protocol>http</protocol><host>' + escape(proxy.hostname) + '</host>'
    '<port>' + str(proxy.port or 80) + '</port>'
    '<nonProxyHosts>localhost|127.0.0.1</nonProxyHosts>'
    '</proxy></proxies></settings>')
PY
```

Run the backend with the same Maven options and `spring-boot:run` in place of `verify`, or run `java -jar target/trafficease-backend-0.1.0-SNAPSHOT.jar` after packaging. Node and Python startup commands are in the root README. Processes must be restarted after environment restoration.

## Live browser map verification

The M1 live verification helper requires the environment-provided CA to be trusted and Chromium to have access to its NSS certificate database. Sandboxed Chromium may fail with `ERR_CERT_AUTHORITY_INVALID` if it cannot initialize that database, even when curl and Java succeed. In this task an approved browser command outside the execution sandbox resolved certificate-store access while preserving full TLS validation. Do not disable certificate checks. See [live verification](m1-live-verification.md) for the evidence and deliberate, rate-limited command.
