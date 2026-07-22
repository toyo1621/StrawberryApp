CREATE TABLE IF NOT EXISTS rankings (
  id TEXT PRIMARY KEY,
  player_name TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  game_type TEXT NOT NULL DEFAULT 'strawberry_rush',
  island_region TEXT NOT NULL DEFAULT 'all',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  owner_hash TEXT,
  CHECK (length(trim(player_name)) BETWEEN 1 AND 12),
  CHECK (score BETWEEN 0 AND 5000),
  CHECK (game_type IN ('strawberry_rush', 'island_rush', 'flag_rush', 'color_rush')),
  CHECK (island_region IN ('all', 'hokkaido_tohoku', 'kanto', 'chubu_kinki', 'chugoku', 'shikoku', 'kyushu', 'okinawa')),
  CHECK (game_type = 'island_rush' OR island_region = 'all'),
  CHECK (owner_hash IS NULL OR length(owner_hash) = 64)
);

CREATE INDEX IF NOT EXISTS idx_rankings_game_region_score_created
  ON rankings (game_type, island_region, score DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_rankings_player_game_region_created
  ON rankings (player_name, game_type, island_region, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rankings_game_region_owner_score_created
  ON rankings (game_type, island_region, owner_hash, score DESC, created_at ASC)
  WHERE owner_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rankings_game_region_legacy_name_score_created
  ON rankings (game_type, island_region, lower(trim(player_name)), score DESC, created_at ASC)
  WHERE owner_hash IS NULL;

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

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  owner_hash TEXT NOT NULL,
  game_type TEXT NOT NULL,
  island_region TEXT NOT NULL DEFAULT 'all',
  started_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  submission_id TEXT UNIQUE,
  CHECK (length(id) = 36),
  CHECK (length(owner_hash) = 64),
  CHECK (game_type IN ('strawberry_rush', 'island_rush', 'flag_rush', 'color_rush')),
  CHECK (island_region IN ('all', 'hokkaido_tohoku', 'kanto', 'chubu_kinki', 'chugoku', 'shikoku', 'kyushu', 'okinawa')),
  CHECK (game_type = 'island_rush' OR island_region = 'all'),
  CHECK (consumed_at IS NULL OR submission_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_expires
  ON game_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_game_sessions_owner_started
  ON game_sessions (owner_hash, started_at DESC);
