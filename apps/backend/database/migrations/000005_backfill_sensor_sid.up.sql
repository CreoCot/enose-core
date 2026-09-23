-- Sensors created before 000004 carry their SID inside the name ("SID0001"
-- from XML, "Name [SID0001]" from CSV/XLSX). Without a backfill, upload would
-- create a second row per physical sensor and split its history.
--
-- One row per (device_id, sid) is backfilled (the oldest); rows whose SID is
-- already taken are left NULL so the unique index is never violated.
UPDATE sensors s
SET sid = c.extracted
FROM (
    SELECT DISTINCT ON (device_id, extracted) id, extracted
    FROM (
        SELECT id, device_id, substring(name from 'SID[A-Za-z0-9_-]+') AS extracted
        FROM sensors
        WHERE sid IS NULL
    ) t
    WHERE extracted IS NOT NULL
    ORDER BY device_id, extracted, id
) c
WHERE s.id = c.id
  AND NOT EXISTS (
      SELECT 1 FROM sensors o
      WHERE o.device_id = s.device_id AND o.sid = c.extracted
  );
