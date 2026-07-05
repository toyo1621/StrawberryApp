CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  game_type TEXT NOT NULL DEFAULT 'strawberry_rush',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(trim(player_name)) > 0),
  CHECK (score >= 0),
  CHECK (game_type IN ('strawberry_rush', 'island_rush', 'flag_rush', 'color_rush'))
);

CREATE INDEX IF NOT EXISTS idx_rankings_game_score_created
  ON rankings (game_type, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rankings_player_game_created
  ON rankings (player_name, game_type, created_at DESC);

CREATE TABLE IF NOT EXISTS score_submission_events (
  id TEXT PRIMARY KEY,
  identity_hash TEXT NOT NULL,
  player_name TEXT NOT NULL,
  game_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (length(identity_hash) = 64),
  CHECK (length(trim(player_name)) > 0),
  CHECK (game_type IN ('strawberry_rush', 'island_rush', 'flag_rush', 'color_rush'))
);

CREATE INDEX IF NOT EXISTS idx_score_submission_events_identity_created
  ON score_submission_events (identity_hash, created_at DESC);
