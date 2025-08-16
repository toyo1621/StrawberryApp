export enum GameState {
  START,
  PLAYING,
  ISLAND_PLAYING,
  MEMORY_GAME,
  MEMORY_GAME_2,
  GAME_OVER,
  RULES,
}

export enum GameMode {
  STRAWBERRY = 'strawberry',
  ISLAND = 'island'
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

export interface Island {
  id: string;
  name: string;
  file: string;
}