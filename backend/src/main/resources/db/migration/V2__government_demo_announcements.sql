-- Additive demonstration-only announcements. No existing history/observations are modified.
CREATE TABLE government_demo_announcements (
 id VARCHAR(36) PRIMARY KEY,
 payload JSON NOT NULL,
 revision BIGINT NOT NULL,
 updated_at TIMESTAMP(6) NOT NULL,
 CONSTRAINT announcement_demo CHECK (JSON_EXTRACT(payload, '$.demonstration') IS NOT NULL AND JSON_EXTRACT(payload, '$.demonstration') = TRUE)
) ENGINE=InnoDB;
CREATE TABLE government_demo_audit (
 id VARCHAR(36) PRIMARY KEY,
 actor VARCHAR(64) NOT NULL,
 action VARCHAR(32) NOT NULL,
 announcement_id VARCHAR(36) NOT NULL,
 occurred_at TIMESTAMP(6) NOT NULL,
 INDEX audit_created (occurred_at)
) ENGINE=InnoDB;
