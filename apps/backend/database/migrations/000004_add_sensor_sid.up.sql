-- Physical sensor identity vs. profile position.
--
-- The legacy MAG-soft software (see sniffdbDataSetTableAdapters.Sensors)
-- identifies a physical sensor by its SID (e.g. "SID0001"), etched into the
-- device/coating itself. Position (channel 1..8) is NOT a sensor attribute —
-- it is an attribute of a measurement *profile*: the same physical sensor
-- can sit at different positions across different profiles/measurements.
--
-- UNIQUE (device_id, position) on `sensors` wrongly treats position as a
-- stable sensor identity, which made the upload path (GetByDeviceAndPosition)
-- silently merge data from different physical sensors that happened to share
-- a channel number across uploads. `measurement_parameters.position` already
-- captures the correct, per-measurement notion of position — `sensors` only
-- needs a way to be looked up by its real identity, the SID.
ALTER TABLE sensors DROP CONSTRAINT sensors_device_id_position_key;

-- Nullable: not every device/format reports a SID (e.g. hand-entered CSV
-- without one) — those sensors keep falling back to position-based lookup.
ALTER TABLE sensors ADD COLUMN sid VARCHAR(64);

CREATE UNIQUE INDEX idx_sensors_device_sid ON sensors (device_id, sid) WHERE sid IS NOT NULL;

COMMENT ON COLUMN sensors.position IS 'Position last seen at creation time; informational only — see measurement_parameters.position for the authoritative per-measurement channel.';
