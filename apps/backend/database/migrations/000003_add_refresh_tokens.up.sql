-- Refresh tokens for "remember me" sessions.
-- Only the SHA-256 hash of the raw token is stored — the raw token exists
-- only in the httpOnly cookie on the client and in the response once at
-- issuance time.

CREATE TABLE refresh_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64)  NOT NULL UNIQUE,   -- hex-encoded SHA-256
    expires_at TIMESTAMPTZ  NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ                     -- NULL = active; set on rotation/logout/reuse detection
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
