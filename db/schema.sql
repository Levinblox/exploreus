-- Exploreus schema. Safe to re-run.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT UNIQUE,
  name        TEXT,
  map_style   TEXT NOT NULL DEFAULT 'outdoors',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Auth + profile (added in iteration 2). device_id stays for backfilling
-- pre-auth rows; new accounts will have it NULL.
ALTER TABLE users ALTER COLUMN device_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username       TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS age            INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS activities     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS hikes (
  id                TEXT PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  started_at        BIGINT NOT NULL,
  ended_at          BIGINT NOT NULL,
  duration_ms       BIGINT NOT NULL,
  distance_m        DOUBLE PRECISION NOT NULL,
  elevation_gain_m  DOUBLE PRECISION NOT NULL,
  moving_ms         BIGINT,
  rest_ms           BIGINT,
  points            JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hikes_user_started_idx ON hikes(user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS user_trails (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  ref         TEXT,
  network     TEXT,
  from_label  TEXT,
  to_label    TEXT,
  distance_m  DOUBLE PRECISION NOT NULL,
  start_lat   DOUBLE PRECISION NOT NULL,
  start_lng   DOUBLE PRECISION NOT NULL,
  preview     JSONB NOT NULL,
  segments    JSONB NOT NULL,
  featured    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_trails_user_idx ON user_trails(user_id, created_at DESC);
-- Trail metadata for save-after-hike + discovery.
ALTER TABLE user_trails ADD COLUMN IF NOT EXISTS difficulty  TEXT;
ALTER TABLE user_trails ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE user_trails ADD COLUMN IF NOT EXISTS is_public   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_trails ADD COLUMN IF NOT EXISTS source_hike_id TEXT;
CREATE INDEX IF NOT EXISTS user_trails_public_idx ON user_trails(is_public, created_at DESC) WHERE is_public = TRUE;

-- Saved trails — many-to-many bookmarks of other users' public trails.
CREATE TABLE IF NOT EXISTS saved_trails (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id  TEXT NOT NULL REFERENCES user_trails(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trail_id)
);
CREATE INDEX IF NOT EXISTS saved_trails_user_idx ON saved_trails(user_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_kind   TEXT NOT NULL CHECK (parent_kind IN ('user_trail', 'hike')),
  parent_id     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  storage_key   TEXT NOT NULL,
  thumb_key     TEXT,
  content_type  TEXT,
  caption       TEXT,
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Poster frame for videos, generated server-side during transcode.
ALTER TABLE media ADD COLUMN IF NOT EXISTS thumb_key TEXT;
CREATE INDEX IF NOT EXISTS media_parent_idx ON media(parent_kind, parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_user_idx ON media(user_id, created_at DESC);
