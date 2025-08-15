export enum GameState {
  START,
  PLAYING,
  MEMORY_GAME,
  MEMORY_GAME_2,
  GAME_OVER,
}

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
}

export interface MemoryGameData {
  lastNonStrawberryFruit: string;
  allFruits: string[];
}