DROP INDEX IF EXISTS idx_sensors_device_sid;
ALTER TABLE sensors DROP COLUMN IF EXISTS sid;
ALTER TABLE sensors ADD CONSTRAINT sensors_device_id_position_key UNIQUE (device_id, position);
