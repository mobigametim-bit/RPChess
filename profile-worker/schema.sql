-- Isolated RPChess profile tables in the EXISTING rpchess-leaderboard D1.
-- Additive only: never touch leaderboard_v1, tournament Durable Objects, or legacy VK saves.
CREATE TABLE IF NOT EXISTS rpchess_profile_v1 (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider IN ('web','vk')),
  vk_user_id TEXT UNIQUE,
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
  migrated_vk_v1 INTEGER NOT NULL DEFAULT 0 CHECK(migrated_vk_v1 IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpchess_profile_updated ON rpchess_profile_v1(updated_at DESC);
CREATE TABLE IF NOT EXISTS rpchess_profile_token_v1 (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES rpchess_profile_v1(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpchess_profile_token_player ON rpchess_profile_token_v1(profile_id);
