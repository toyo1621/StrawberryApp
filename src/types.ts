export enum GameState {
  START,
  PLAYING,
  ISLAND_PLAYING,
  FLAG_PLAYING,
  SQUARE_PLAYING,
  CUBE_PLAYING,
  MEMORY_GAME,
  MEMORY_GAME_2,
  GAME_OVER,
  RULES,
}

export enum GameMode {
  STRAWBERRY = 'strawberry',
  ISLAND = 'island',
  FLAG = 'flag',
  SQUARE = 'square',
  CUBE = 'cube'
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

export interface Country {
  id: string;
  name: string;
  code: string;
}