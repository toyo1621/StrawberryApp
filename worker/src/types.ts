export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_SALT?: string;
  WEB_APP_URL?: string;
  MONITOR_ALERT_WEBHOOK_URL?: string;
  CF_VERSION_METADATA?: {
    id: string;
    tag?: string;
    timestamp: string;
  };
}

export type RankingRow = {
  id: string;
  player_name: string;
  score: number;
  game_type: string;
  island_region: string;
  created_at: string;
  owner_hash: string | null;
};

export type RankingEntry = {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  islandRegion: string;
  createdAt: string;
  isCurrentPlayer?: boolean;
};

export type GameSessionRow = {
  id: string;
  owner_hash: string;
  game_type: string;
  island_region: string;
  started_at: string;
  expires_at: string;
  consumed_at: string | null;
  submission_id: string | null;
};

export const mapRanking = (row: RankingRow): RankingEntry => ({
  id: row.id,
  playerName: row.player_name,
  score: row.score,
  gameType: row.game_type,
  islandRegion: row.island_region,
  createdAt: row.created_at,
});
