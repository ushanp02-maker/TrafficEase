-- Separate from the legacy observations bootstrap: no coordinates or observed traffic.
CREATE TABLE synthetic_prediction_history (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    target_id VARCHAR(128) NOT NULL,
    forecast_at TIMESTAMP(6) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    congestion VARCHAR(8) NOT NULL,
    weather VARCHAR(16) NOT NULL,
    is_holiday BOOLEAN NOT NULL,
    model_version VARCHAR(128) NOT NULL,
    dataset_version VARCHAR(128) NOT NULL,
    data_source VARCHAR(16) NOT NULL DEFAULT 'SYNTHETIC',
    experimental BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT history_source CHECK (data_source = 'SYNTHETIC' AND experimental = TRUE),
    CONSTRAINT history_category CHECK (congestion IN ('LOW', 'MODERATE', 'HIGH')),
    INDEX history_retention (created_at)
) ENGINE=InnoDB;
