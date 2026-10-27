-- Time masks, as in the legacy MAG-soft (tables Mask / MaskData).
--
-- A mask is a named, shared list of sample moments (seconds) at which a
-- measurement is evaluated: extrema, radar diagrams, exports and comparisons
-- are all computed only at the mask points. A measurement can remember a
-- default mask (legacy Measures.DefaultMask).
CREATE TABLE masks (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(128) NOT NULL UNIQUE,
    created_by INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE mask_points (
    id      SERIAL PRIMARY KEY,
    mask_id INTEGER       NOT NULL REFERENCES masks(id) ON DELETE CASCADE,
    time_s  NUMERIC(12,3) NOT NULL,
    UNIQUE (mask_id, time_s)
);

ALTER TABLE measurements
    ADD COLUMN default_mask_id INTEGER REFERENCES masks(id) ON DELETE SET NULL;
