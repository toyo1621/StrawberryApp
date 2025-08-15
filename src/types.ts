export enum GameState {
  START,
  PLAYING,
  GAME_OVER,
}

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
}