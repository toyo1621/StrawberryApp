export enum GameState {
  START,
  PLAYING,
  MEMORY_GAME,
  GAME_OVER,
}

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;