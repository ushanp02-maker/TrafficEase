# Deployment readiness

`ec2/` prepares a single Ubuntu 24.04 x86-64 host with Nginx, Java 17, FastAPI and an optional local MySQL 8.0 service. No AWS resources have been created. Installation/activation/certificate commands are future operator actions, not an already deployed site.

Read [the EC2 beginner guide](../docs/ec2-deployment.md) before running scripts. It covers credits/costs, security groups, domain/HTTPS, protected demo access, building trained AI artifacts, atomic activation/rollback, backups and stopping costs.
