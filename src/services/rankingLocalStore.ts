import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  API_GAME_TYPES,
  type ApiGameType,
} from '../gameConfig';
import type { RankingEntry } from '../types';
import { IslandRegion } from '../types';
import { toRankingEntry } from './rankingModels';

const LOCAL_CACHE_LIMIT = 200;
const PLAYER_HISTORY_KEY_PREFIX = 'strawberry_player_history_v2';

const BASE_STORAGE_KEYS: Record<ApiGameType, string> = {
  strawberry_rush: 'strawberry_game_rankings',
  island_rush: 'island_game_rankings',
  flag_rush: 'flag_game_rankings',
  color_rush: 'color_game_rankings',
};

const getStorageKey = (
  gameType: ApiGameType,
  islandRegion: IslandRegion = IslandRegion.ALL,
): string => {
  if (gameType === 'island_rush' && islandRegion !== IslandRegion.ALL) {
    return `${BASE_STORAGE_KEYS.island_rush}_${islandRegion}`;
  }
  return BASE_STORAGE_KEYS[gameType];
};

const getPlayerHistoryStorageKey = (gameType: ApiGameType): string => (
  `${PLAYER_HISTORY_KEY_PREFIX}_${gameType}`
);

const ALL_STORAGE_KEYS = [
  ...Object.values(BASE_STORAGE_KEYS),
  ...Object.values(IslandRegion)
    .filter((region) => region !== IslandRegion.ALL)
    .map((region) => getStorageKey('island_rush', region)),
  ...API_GAME_TYPES.map(getPlayerHistoryStorageKey),
];

const parseStoredRankings = (stored: string | null): RankingEntry[] => {
  if (!stored) {
    return [];
  }
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed)
      ? parsed.map(toRankingEntry).filter((entry): entry is RankingEntry => entry !== null)
      : [];
  } catch {
    return [];
  }
};

const writeRankings = async (key: string, rankings: RankingEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(rankings));
  } catch (error) {
    console.warn('Failed to cache rankings.', error);
  }
};

const mergeById = (
  current: RankingEntry[],
  incoming: RankingEntry[],
): RankingEntry[] => {
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LOCAL_CACHE_LIMIT);
};

export const loadLocalRankingsForGame = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion = IslandRegion.ALL,
): Promise<RankingEntry[]> => {
  return parseStoredRankings(await AsyncStorage.getItem(getStorageKey(gameType, islandRegion)));
};

export const loadLocalPlayerHistory = async (
  gameType: ApiGameType,
): Promise<RankingEntry[]> => {
  return parseStoredRankings(await AsyncStorage.getItem(getPlayerHistoryStorageKey(gameType)));
};

export const mergeIntoLocalPlayerHistory = async (
  gameType: ApiGameType,
  incoming: RankingEntry[],
): Promise<void> => {
  const current = await loadLocalPlayerHistory(gameType);
  await writeRankings(getPlayerHistoryStorageKey(gameType), mergeById(current, incoming));
};

export const mergeIntoLocalCache = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  incoming: RankingEntry[],
): Promise<void> => {
  const current = await loadLocalRankingsForGame(gameType, islandRegion);
  await writeRankings(
    getStorageKey(gameType, islandRegion),
    mergeById(current, incoming),
  );
};

export const replaceLocalLeaderboardSnapshot = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  incoming: RankingEntry[],
  pendingIds: ReadonlySet<string>,
): Promise<void> => {
  const current = await loadLocalRankingsForGame(gameType, islandRegion);
  const pendingEntries = current.filter((entry) => pendingIds.has(entry.id));
  const snapshot = mergeById(incoming, pendingEntries);
  await writeRankings(getStorageKey(gameType, islandRegion), snapshot);
};

export const clearLocalRankingData = async (): Promise<void> => {
  await AsyncStorage.multiRemove(ALL_STORAGE_KEYS);
};
