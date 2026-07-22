import { GameMode, RankingsByMode } from './types';
import { API_GAME_TYPES } from './generated/rankingContract';

export { API_GAME_TYPES } from './generated/rankingContract';

export type ApiGameType = typeof API_GAME_TYPES[number];

export type GameModeConfig = {
  apiType: ApiGameType;
  emoji: string;
  title: string;
  shortLabel: string;
  description: string;
  rankingTitle: string;
  unit: '個' | '問';
  accent: string;
  accentDark: string;
  tint: string;
  tintDark: string;
};

export const GAME_MODE_ORDER = [
  GameMode.STRAWBERRY,
  GameMode.ISLAND,
  GameMode.FLAG,
  GameMode.COLOR,
] as const;

export const GAME_MODE_CONFIG: Record<GameMode, GameModeConfig> = {
  [GameMode.STRAWBERRY]: {
    apiType: 'strawberry_rush',
    emoji: '🍓',
    title: 'いちごつめ！',
    shortLabel: 'いちご',
    description: '時間内にいちごをたくさんつめよう！',
    rankingTitle: 'いちご王',
    unit: '個',
    accent: '#be185d',
    accentDark: '#f472b6',
    tint: '#fdf2f8',
    tintDark: '#4a2038',
  },
  [GameMode.ISLAND]: {
    apiType: 'island_rush',
    emoji: '🏝️',
    title: '島つめ！',
    shortLabel: '島',
    description: '時間内に有人離島をたくさん当てよう！',
    rankingTitle: '島王',
    unit: '問',
    accent: '#1d4ed8',
    accentDark: '#60a5fa',
    tint: '#eff6ff',
    tintDark: '#172f55',
  },
  [GameMode.FLAG]: {
    apiType: 'flag_rush',
    emoji: '🏁',
    title: '国旗つめ！',
    shortLabel: '国旗',
    description: '時間内に国旗をたくさん当てよう！',
    rankingTitle: '国旗王',
    unit: '問',
    accent: '#047857',
    accentDark: '#34d399',
    tint: '#ecfdf5',
    tintDark: '#173f34',
  },
  [GameMode.COLOR]: {
    apiType: 'color_rush',
    emoji: '🎨',
    title: '色つめ！',
    shortLabel: '色',
    description: '時間内に色名をたくさん当てよう！',
    rankingTitle: '色王',
    unit: '問',
    accent: '#7e22ce',
    accentDark: '#c084fc',
    tint: '#faf5ff',
    tintDark: '#3a2151',
  },
};

export const gameModeFromApiType = (gameType: string): GameMode => {
  return GAME_MODE_ORDER.find((mode) => GAME_MODE_CONFIG[mode].apiType === gameType)
    ?? GameMode.STRAWBERRY;
};

export const createEmptyRankings = (): RankingsByMode => ({
  [GameMode.STRAWBERRY]: [],
  [GameMode.ISLAND]: [],
  [GameMode.FLAG]: [],
  [GameMode.COLOR]: [],
});
