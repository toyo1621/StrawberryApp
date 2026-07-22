export enum GameState {
  START,
  PLAYING,
  ISLAND_PLAYING,
  FLAG_PLAYING,
  COLOR_PLAYING,
  MEMORY_GAME,
  MEMORY_GAME_2,
  GAME_OVER,
  RULES,
  MY_PAGE,
  SETTINGS,
  PRIVACY_POLICY,
  TERMS_OF_SERVICE,
}

export enum GameMode {
  STRAWBERRY = 'strawberry',
  ISLAND = 'island',
  FLAG = 'flag',
  COLOR = 'color',
}

export enum IslandRegion {
  ALL = 'all',
  HOKKAIDO_TOHOKU = 'hokkaido_tohoku',
  KANTO = 'kanto',
  CHUBU_KINKI = 'chubu_kinki',
  CHUGOKU = 'chugoku',
  SHIKOKU = 'shikoku',
  KYUSHU_NORTH = 'kyushu_north',
  KYUSHU_SOUTH = 'kyushu_south',
  // Retained for pre-split score history and cached clients.
  KYUSHU = 'kyushu',
  OKINAWA = 'okinawa',
}

export type IslandRegionGroup = Exclude<
  IslandRegion,
  IslandRegion.ALL | IslandRegion.KYUSHU
>;

export enum RankingPeriod {
  ALL = 'all',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  islandRegion: IslandRegion;
  createdAt: string;
}

export type RankingsByMode = Record<GameMode, RankingEntry[]>;

export interface MemoryGameData {
  lastNonStrawberryFruit: string;
  allFruits: string[];
}

export interface Island {
  id: string;
  name: string;
  file: string;
  prefecture: string;
  municipality: string;
  region: IslandRegionGroup;
}

export interface Country {
  id: string;
  name: string;
  code: string;
}

export interface Color {
  id: string;
  name: string;
  nameEn: string;
  munsell: string;
  hex: string;
  description: string;
}
