import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  API_GAME_TYPES,
  type ApiGameType,
} from '../gameConfig';
import { getLeaderboardEntries } from '../domain/rankings';
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

const storageWriteTails = new Map<string, Promise<void>>();

const withStorageWriteLock = <T>(key: string, operation: () => Promise<T>): Promise<T> => {
  const previous = storageWriteTails.get(key) ?? Promise.resolve();
  const result = previous.then(operation, operation);
  const tail = result.then(() => undefined, () => undefined);
  storageWriteTails.set(key, tail);
  void tail.finally(() => {
    if (storageWriteTails.get(key) === tail) {
      storageWriteTails.delete(key);
    }
  });
  return result;
};

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
  await AsyncStorage.setItem(key, JSON.stringify(rankings));
};

const mergeHistoryById = (
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
  const key = getPlayerHistoryStorageKey(gameType);
  await withStorageWriteLock(key, async () => {
    const current = parseStoredRankings(await AsyncStorage.getItem(key));
    await writeRankings(key, mergeHistoryById(current, incoming));
  });
};

export const mergeIntoLocalCache = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  incoming: RankingEntry[],
): Promise<void> => {
  const key = getStorageKey(gameType, islandRegion);
  await withStorageWriteLock(key, async () => {
    const current = parseStoredRankings(await AsyncStorage.getItem(key));
    await writeRankings(
      key,
      getLeaderboardEntries([...current, ...incoming], LOCAL_CACHE_LIMIT),
    );
  });
};

export const replaceLocalLeaderboardSnapshot = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  incoming: RankingEntry[],
  pendingIds: ReadonlySet<string>,
): Promise<void> => {
  const key = getStorageKey(gameType, islandRegion);
  await withStorageWriteLock(key, async () => {
    const current = parseStoredRankings(await AsyncStorage.getItem(key));
    const pendingEntries = current.filter((entry) => pendingIds.has(entry.id));
    const snapshot = getLeaderboardEntries(
      [...incoming, ...pendingEntries],
      LOCAL_CACHE_LIMIT,
    );
    await writeRankings(key, snapshot);
  });
};

export const clearLocalRankingData = async (): Promise<void> => {
  await AsyncStorage.multiRemove(ALL_STORAGE_KEYS);
};
