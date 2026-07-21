CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  game_type TEXT NOT NULL DEFAULT 'strawberry_rush',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  owner_hash TEXT,
  CHECK (length(trim(player_name)) BETWEEN 1 AND 12),
  CHECK (score BETWEEN 0 AND 5000),
  CHECK (game_type IN ('strawberry_rush', 'island_rush', 'flag_rush', 'color_rush')),
  CHECK (owner_hash IS NULL OR length(owner_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_rankings_game_score_created
  ON rankings (game_type, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rankings_player_game_created
  ON rankings (player_name, game_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rankings_game_player_identity_created
  ON rankings (game_type, lower(trim(player_name)), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rankings_owner_game_created
  ON rankings (owner_hash, game_type, created_at DESC);

CREATE TABLE IF NOT EXISTS score_submission_buckets (
  identity_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  submission_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (identity_hash, window_start),
  CHECK (length(identity_hash) = 64),
  CHECK (submission_count BETWEEN 1 AND 8)
);

CREATE INDEX IF NOT EXISTS idx_score_submission_buckets_expires
  ON score_submission_buckets (expires_at);
