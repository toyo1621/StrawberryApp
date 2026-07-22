CREATE TABLE game_sessions (
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

CREATE INDEX idx_game_sessions_expires
  ON game_sessions (expires_at);

CREATE INDEX idx_game_sessions_owner_started
  ON game_sessions (owner_hash, started_at DESC);
