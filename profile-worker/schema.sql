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
-- OK identities are stored separately because rpchess_profile_v1's existing
-- provider CHECK('web','vk') must not be rebuilt on a live D1 database.
-- The OK-owned profile row uses internal provider='web'; authenticated
-- reads resolve provider='ok' through this one-to-one mapping.
CREATE TABLE IF NOT EXISTS rpchess_profile_platform_v1 (
  provider TEXT NOT NULL CHECK(provider = 'ok'),
  platform_user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL UNIQUE REFERENCES rpchess_profile_v1(id),
  PRIMARY KEY (provider, platform_user_id)
);

CREATE TABLE IF NOT EXISTS rpchess_profile_token_v1 (
  token_hash TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES rpchess_profile_v1(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpchess_profile_token_player ON rpchess_profile_token_v1(profile_id);

-- Unified public Glory leaderboard; the existing leaderboard_v1 remains read-only.
-- Scores from PvE snapshots are NOT tournament verified and never pay prizes.
CREATE TABLE IF NOT EXISTS rpchess_leaderboard_v2 (
  profile_id TEXT PRIMARY KEY REFERENCES rpchess_profile_v1(id),
  player_name TEXT NOT NULL,
  glory INTEGER NOT NULL CHECK(glory>=0),
  week INTEGER NOT NULL CHECK(week>=0),
  power INTEGER NOT NULL CHECK(power>=0),
  run_id TEXT NOT NULL,
  commander_id TEXT NOT NULL,
  achieved_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpchess_leaderboard_v2_rank
ON rpchess_leaderboard_v2(glory DESC,week DESC,power DESC,achieved_at ASC,profile_id ASC);

-- Reset-on-upgrade leaderboard for the new achievement-based Glory v2.
-- An independent EMPTY table deliberately excludes every older ranking row.
-- Profiles, powers, Chronicle history, Arena, and Tournament data are retained.
CREATE TABLE IF NOT EXISTS rpchess_leaderboard_v3 (
  profile_id TEXT PRIMARY KEY REFERENCES rpchess_profile_v1(id),
  player_name TEXT NOT NULL,
  glory INTEGER NOT NULL CHECK(glory>=0),
  day INTEGER NOT NULL CHECK(day>=0),
  power INTEGER NOT NULL CHECK(power>=0),
  adventure INTEGER NOT NULL CHECK(adventure>=0),
  achievement_count INTEGER NOT NULL CHECK(achievement_count>=0),
  run_id TEXT NOT NULL,
  commander_id TEXT NOT NULL,
  achieved_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rpchess_leaderboard_v3_rank
ON rpchess_leaderboard_v3(glory DESC,adventure DESC,achievement_count DESC,day ASC,achieved_at ASC,profile_id ASC);
