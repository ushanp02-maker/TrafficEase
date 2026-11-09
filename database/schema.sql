-- MySQL 8. Source labels prevent synthetic data being mistaken for observations.
CREATE DATABASE IF NOT EXISTS trafficease CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE trafficease;
CREATE TABLE IF NOT EXISTS roads (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(200) NOT NULL,
 district VARCHAR(100) NOT NULL DEFAULT 'Colombo',
 country_code CHAR(2) NOT NULL DEFAULT 'LK',
 start_latitude DECIMAL(9,6) NOT NULL, start_longitude DECIMAL(9,6) NOT NULL,
 end_latitude DECIMAL(9,6) NOT NULL, end_longitude DECIMAL(9,6) NOT NULL,
 lanes TINYINT UNSIGNED NOT NULL,
 source_label VARCHAR(200) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (country_code = 'LK'), CHECK (lanes > 0),
 CHECK (start_latitude BETWEEN -90 AND 90 AND end_latitude BETWEEN -90 AND 90),
 CHECK (start_longitude BETWEEN -180 AND 180 AND end_longitude BETWEEN -180 AND 180)
);
CREATE TABLE IF NOT EXISTS traffic_observations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 road_id BIGINT UNSIGNED NOT NULL,
 observed_at DATETIME NOT NULL COMMENT 'UTC',
 congestion_category ENUM('low','moderate','high') NOT NULL,
 weather_condition VARCHAR(60) NOT NULL,
 source_type ENUM('synthetic','manual','provider') NOT NULL,
 source_label VARCHAR(200) NOT NULL,
 FOREIGN KEY (road_id) REFERENCES roads(id),
 INDEX (road_id, observed_at)
);
CREATE TABLE IF NOT EXISTS predictions (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 road_id BIGINT UNSIGNED NOT NULL,
 predicted_for DATETIME NOT NULL COMMENT 'UTC',
 congestion_category ENUM('low','moderate','high') NOT NULL,
 model_version VARCHAR(100) NOT NULL,
 training_data_source ENUM('synthetic','real','mixed') NOT NULL,
 source_label VARCHAR(200) NOT NULL,
 experimental BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (road_id) REFERENCES roads(id),
 CHECK (training_data_source <> 'synthetic' OR experimental = TRUE),
 INDEX (road_id, predicted_for)
);
