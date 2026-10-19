-- Add a cosmetic commander portrait to existing leaderboard rows.
-- The DEFAULT keeps all prior results and ranks intact.
ALTER TABLE leaderboard_v1 ADD COLUMN commander_id TEXT NOT NULL DEFAULT 'oathkeeper';
