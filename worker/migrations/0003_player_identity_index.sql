CREATE INDEX IF NOT EXISTS idx_rankings_game_player_identity_created
  ON rankings (game_type, lower(trim(player_name)), created_at DESC);
