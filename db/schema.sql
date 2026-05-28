-- Exploreus schema. Safe to re-run.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT UNIQUE NOT NULL,
  name        TEXT,
  map_style   TEXT NOT NULL DEFAULT 'outdoors',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_kind   TEXT NOT NULL CHECK (parent_kind IN ('user_trail', 'hike')),
  parent_id     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  storage_key   TEXT NOT NULL,
  content_type  TEXT,
  caption       TEXT,
  size_bytes    BIGINT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS media_parent_idx ON media(parent_kind, parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_user_idx ON media(user_id, created_at DESC);
