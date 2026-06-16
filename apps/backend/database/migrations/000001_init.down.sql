-- Reverses 000001_init.up.sql.
-- Drops tables in reverse dependency order (children before parents)
-- and finally removes the pg_trgm extension. This is DESTRUCTIVE: it
-- wipes all data. The trigram GIN indexes go away with their tables,
-- so dropping the extension afterwards is safe.

DROP TABLE IF EXISTS measurement_data;
DROP TABLE IF EXISTS measurement_parameters;
DROP TABLE IF EXISTS measurements;
DROP TABLE IF EXISTS measurement_groups;
DROP TABLE IF EXISTS measurement_objects;
DROP TABLE IF EXISTS sensors;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS coatings;
DROP TABLE IF EXISTS device_types;

DROP EXTENSION IF EXISTS pg_trgm;
