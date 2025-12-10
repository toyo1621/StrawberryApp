/*
  # Create function to get top rankings with unique players

  1. Function
    - `get_top_rankings` - Returns the highest score for each unique player
    - Takes game_type and limit as parameters
    - Uses window functions to get the best score per player

  2. Security
    - Function is accessible to public (same as table policies)
*/

CREATE OR REPLACE FUNCTION get_top_rankings(
  game_type_param text DEFAULT 'strawberry_rush',
  limit_param integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  player_name text,
  score integer,
  game_type text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH ranked_scores AS (
    SELECT 
      r.*,
      ROW_NUMBER() OVER (
        PARTITION BY r.player_name 
        ORDER BY r.score DESC, r.created_at ASC
      ) as rn
    FROM rankings r
    WHERE r.game_type = game_type_param
  )
  SELECT 
    rs.id,
    rs.player_name,
    rs.score,
    rs.game_type,
    rs.created_at
  FROM ranked_scores rs
  WHERE rs.rn = 1
  ORDER BY rs.score DESC, rs.created_at ASC
  LIMIT limit_param;
$$;