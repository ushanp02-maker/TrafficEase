# Deployment readiness

`ec2/` is the **Amazon Linux 2023 x86-64** primary target, using Corretto JDK 17, Python 3.12, Node 22, Nginx/systemd and optional loopback-only MySQL 8. The earlier Ubuntu scripts are retained under `ec2-ubuntu/`; never mix platform installers.

Read [the AL2023 beginner guide](../docs/ec2-deployment.md), [current validation](../docs/ec2-validation.md) and [Ubuntu alternative](../docs/ec2-ubuntu-deployment.md). No AWS resource, paid service, credential or public certificate order was created. Full AL dnf installation is still a manual verification gate where the cloud repository is network-blocked.
