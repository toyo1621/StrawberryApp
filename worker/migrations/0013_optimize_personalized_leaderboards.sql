CREATE INDEX IF NOT EXISTS idx_rankings_owner_game_region_score_created
  ON rankings (owner_hash, game_type, island_region, score DESC, created_at ASC)
  WHERE owner_hash IS NOT NULL;
