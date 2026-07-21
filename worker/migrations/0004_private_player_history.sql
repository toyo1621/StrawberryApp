ALTER TABLE rankings
  ADD COLUMN owner_hash TEXT
  CHECK (owner_hash IS NULL OR length(owner_hash) = 64);

CREATE INDEX IF NOT EXISTS idx_rankings_owner_game_created
  ON rankings (owner_hash, game_type, created_at DESC);
