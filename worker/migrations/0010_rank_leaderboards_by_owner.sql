DROP INDEX IF EXISTS idx_rankings_game_region_player_identity_created;

CREATE INDEX IF NOT EXISTS idx_rankings_game_region_owner_score_created
  ON rankings (game_type, island_region, owner_hash, score DESC, created_at ASC)
  WHERE owner_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rankings_game_region_legacy_name_score_created
  ON rankings (game_type, island_region, lower(trim(player_name)), score DESC, created_at ASC)
  WHERE owner_hash IS NULL;
