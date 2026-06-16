-- Initial schema for enose-core.
-- Source of truth for the database structure. Authored from the GORM
-- models in internal/models/models.go and cross-validated against
-- database/sql/schema.sql (reference document). PostgreSQL-specific
-- features (pg_trgm extension, GIN trigram indexes, JSONB columns,
-- ON DELETE CASCADE rules) are intentionally preserved here because
-- they cannot be expressed through GORM AutoMigrate.

-- pg_trgm is required by the trigram GIN indexes below. Creating an
-- extension needs CREATE privilege (the local dev role has it).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- Lookups (справочники)
-- ---------------------------------------------------------------------

CREATE TABLE device_types (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(32)  NOT NULL UNIQUE,   -- 'MAG8', 'BIOSCAN', 'NANOVESICLE', ...
    name        VARCHAR(128) NOT NULL,
    description TEXT
);

CREATE TABLE coatings (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(128) NOT NULL UNIQUE,   -- e.g. 'Carbowax 20M', 'PEG-2000'
    description TEXT
);

-- ---------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------

CREATE TABLE users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(64)  NOT NULL UNIQUE,
    full_name  VARCHAR(255),
    email      VARCHAR(255) UNIQUE,
    role       VARCHAR(32)  NOT NULL DEFAULT 'operator',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Devices and sensors
-- ---------------------------------------------------------------------

CREATE TABLE devices (
    id             SERIAL PRIMARY KEY,
    device_type_id INTEGER      NOT NULL REFERENCES device_types(id),
    serial_number  VARCHAR(64)  NOT NULL UNIQUE,
    name           VARCHAR(255) NOT NULL,
    description    TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Analog of the legacy Sensors table (SID, Name, Description, Settings),
-- but tied to a concrete device and extended for different "cell" types
-- via JSONB (polymorphic cell_config without a zoo of tables).

CREATE TABLE sensors (
    id          SERIAL PRIMARY KEY,
    device_id   INTEGER      NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    position    INTEGER      NOT NULL,             -- channel number on the device (1..N)
    name        VARCHAR(128) NOT NULL,
    coating_id  INTEGER      REFERENCES coatings(id),
    cell_config JSONB        NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    UNIQUE (device_id, position)
);

-- ---------------------------------------------------------------------
-- Measurement objects (samples/substances)
-- ---------------------------------------------------------------------

CREATE TABLE measurement_objects (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(128),
    description TEXT,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Measurement grouping (analog of the legacy GroupTree: folder tree)
-- + group_key is used to automatically group "compatible" measurements
-- (see measurements.group_key)
-- ---------------------------------------------------------------------

CREATE TABLE measurement_groups (
    id          SERIAL PRIMARY KEY,
    parent_id   INTEGER REFERENCES measurement_groups(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    group_key   VARCHAR(64),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_measurement_groups_key ON measurement_groups (group_key);

-- ---------------------------------------------------------------------
-- Measurements (analog of the legacy Measures)
-- ---------------------------------------------------------------------

CREATE TABLE measurements (
    id                    SERIAL PRIMARY KEY,
    name                  VARCHAR(255) NOT NULL,
    device_id             INTEGER      NOT NULL REFERENCES devices(id),
    measurement_object_id INTEGER      REFERENCES measurement_objects(id),
    user_id               INTEGER      REFERENCES users(id),
    group_id              INTEGER      REFERENCES measurement_groups(id),
    start_time            TIMESTAMPTZ  NOT NULL,
    duration_s            NUMERIC(12,3),
    interval_ms           INTEGER      NOT NULL,
    description           TEXT,
    status                VARCHAR(32)  NOT NULL DEFAULT 'completed',
    -- sha256 of the measurement "signature" (device + object + set of
    -- sensors + interval + ...) WITHOUT start_time/id. Measurements
    -- with the same group_key are considered "repeats of the same
    -- experiment" and can be compared/averaged together.
    group_key             VARCHAR(64)  NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_measurements_group_key ON measurements (group_key);
CREATE INDEX idx_measurements_device    ON measurements (device_id);
CREATE INDEX idx_measurements_object    ON measurements (measurement_object_id);

-- ---------------------------------------------------------------------
-- Measurement parameters: which sensors participate and in which order
-- (analog of legacy Mask/MeasureProfile/MeasureProfileData)
-- ---------------------------------------------------------------------

CREATE TABLE measurement_parameters (
    id             SERIAL PRIMARY KEY,
    measurement_id INTEGER      NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
    sensor_id      INTEGER      NOT NULL REFERENCES sensors(id),
    position       INTEGER      NOT NULL,
    label          VARCHAR(128),
    unit           VARCHAR(32)  NOT NULL DEFAULT 'Hz',
    UNIQUE (measurement_id, sensor_id)
);

-- ---------------------------------------------------------------------
-- Time series (analog of legacy Data: MeasureID, TimeValue, FreqValue,
-- SensorID)
-- ---------------------------------------------------------------------

CREATE TABLE measurement_data (
    id              BIGSERIAL PRIMARY KEY,
    measurement_id  INTEGER         NOT NULL REFERENCES measurements(id) ON DELETE CASCADE,
    sensor_id       INTEGER         NOT NULL REFERENCES sensors(id),
    time_offset_s   NUMERIC(12,4)   NOT NULL,
    value           DOUBLE PRECISION NOT NULL
);

CREATE INDEX idx_measurement_data_meas
    ON measurement_data (measurement_id, sensor_id, time_offset_s);

-- ---------------------------------------------------------------------
-- Trigram indexes for autocomplete (ILIKE '%...%')
-- ---------------------------------------------------------------------

CREATE INDEX idx_measurement_objects_name_trgm
    ON measurement_objects USING gin (name gin_trgm_ops);
CREATE INDEX idx_sensors_name_trgm
    ON sensors USING gin (name gin_trgm_ops);
CREATE INDEX idx_measurements_name_trgm
    ON measurements USING gin (name gin_trgm_ops);
CREATE INDEX idx_devices_name_trgm
    ON devices USING gin (name gin_trgm_ops);
