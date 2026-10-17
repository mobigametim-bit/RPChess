CREATE TABLE IF NOT EXISTS leaderboard_v1 (
  vk_id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  glory INTEGER NOT NULL CHECK(glory>=0),
  week INTEGER NOT NULL CHECK(week>=0),
  power INTEGER NOT NULL CHECK(power>=0),
  run_id TEXT NOT NULL,
  commander_id TEXT NOT NULL DEFAULT 'oathkeeper',
  achieved_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_v1_rank
ON leaderboard_v1(glory DESC,week DESC,power DESC,achieved_at ASC,vk_id ASC);
