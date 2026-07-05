import AsyncStorage from '@react-native-async-storage/async-storage';

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
}

export enum RankingPeriod {
  ALL = 'all',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export interface ScoreMetadata {
  durationMs?: number;
}

const GAME_TYPE = 'strawberry_rush';
const ISLAND_GAME_TYPE = 'island_rush';
const FLAG_GAME_TYPE = 'flag_rush';
const COLOR_GAME_TYPE = 'color_rush';
const RANKING_LIMIT = 30;

const STORAGE_KEYS: Record<string, string> = {
  [GAME_TYPE]: 'strawberry_game_rankings',
  [ISLAND_GAME_TYPE]: 'island_game_rankings',
  [FLAG_GAME_TYPE]: 'flag_game_rankings',
  [COLOR_GAME_TYPE]: 'color_game_rankings',
};

const rankingsApiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

const hasRankingsApi = (): boolean => rankingsApiUrl.length > 0;

const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

const storageKeyForGame = (gameType: string): string => {
  return STORAGE_KEYS[gameType] || STORAGE_KEYS[GAME_TYPE];
};

const loadLocalRankingsForGame = async (gameType: string): Promise<RankingEntry[]> => {
  try {
    const stored = await AsyncStorage.getItem(storageKeyForGame(gameType));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local rankings:', error);
    return [];
  }
};

const saveLocalRankingsForGame = async (gameType: string, rankings: RankingEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(storageKeyForGame(gameType), JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local rankings:', error);
  }
};

const getUniquePlayerRankings = (rankings: RankingEntry[]): RankingEntry[] => {
  const playerBestScores = new Map<string, RankingEntry>();

  rankings.forEach((entry) => {
    const existing = playerBestScores.get(entry.playerName);
    if (
      !existing ||
      entry.score > existing.score ||
      (entry.score === existing.score && entry.createdAt < existing.createdAt)
    ) {
      playerBestScores.set(entry.playerName, entry);
    }
  });

  return Array.from(playerBestScores.values())
    .sort((a, b) => b.score - a.score || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, RANKING_LIMIT);
};

const getPeriodStartDate = (period: RankingPeriod): Date => {
  const now = new Date();
  const start = new Date(now);

  switch (period) {
    case RankingPeriod.DAILY:
      start.setHours(0, 0, 0, 0);
      break;
    case RankingPeriod.WEEKLY: {
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    }
    case RankingPeriod.MONTHLY:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      return new Date(0);
  }

  return start;
};

const filterByPeriod = (rankings: RankingEntry[], period: RankingPeriod): RankingEntry[] => {
  if (period === RankingPeriod.ALL) {
    return rankings;
  }

  const startDate = getPeriodStartDate(period);
  return rankings.filter((entry) => new Date(entry.createdAt) >= startDate);
};

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!hasRankingsApi()) {
    throw new Error('Rankings API URL is not configured.');
  }

  const response = await fetch(`${rankingsApiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Rankings API error: ${response.status} ${body}`);
  }

  return response.json();
};

const fetchRankingsForGame = async (
  gameType: string,
  period: RankingPeriod = RankingPeriod.ALL,
): Promise<RankingEntry[]> => {
  if (hasRankingsApi()) {
    try {
      return await apiRequest<RankingEntry[]>(
        `/rankings${buildQuery({ gameType, period, limit: RANKING_LIMIT })}`,
      );
    } catch (error) {
      console.error('Failed to fetch rankings from API:', error);
    }
  }

  const localRankings = await loadLocalRankingsForGame(gameType);
  return getUniquePlayerRankings(filterByPeriod(localRankings, period));
};

const saveLocalScore = async (playerName: string, score: number, gameType: string): Promise<RankingEntry> => {
  const newEntry: RankingEntry = {
    id: generateId(),
    playerName: playerName.trim(),
    score,
    gameType,
    createdAt: new Date().toISOString(),
  };

  const currentRankings = await loadLocalRankingsForGame(gameType);
  const updatedRankings = [...currentRankings, newEntry]
    .sort((a, b) => b.score - a.score)
    .slice(0, RANKING_LIMIT);

  await saveLocalRankingsForGame(gameType, updatedRankings);
  return newEntry;
};

const saveScoreForGame = async (
  playerName: string,
  score: number,
  gameType: string,
  metadata: ScoreMetadata = {},
): Promise<RankingEntry | null> => {
  if (hasRankingsApi()) {
    try {
      return await apiRequest<RankingEntry>('/scores', {
        method: 'POST',
        body: JSON.stringify({
          playerName: playerName.trim(),
          score,
          gameType,
          durationMs: metadata.durationMs,
        }),
      });
    } catch (error) {
      console.error('Failed to save score to API:', error);
    }
  }

  return saveLocalScore(playerName, score, gameType);
};

export const fetchRankings = async (): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(GAME_TYPE);
};

export const fetchIslandRankings = async (): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(ISLAND_GAME_TYPE);
};

export const fetchFlagRankings = async (): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(FLAG_GAME_TYPE);
};

export const fetchColorRankings = async (): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(COLOR_GAME_TYPE);
};

export const saveScore = async (
  playerName: string,
  score: number,
  metadata?: ScoreMetadata,
): Promise<RankingEntry | null> => {
  return saveScoreForGame(playerName, score, GAME_TYPE, metadata);
};

export const saveIslandScore = async (
  playerName: string,
  score: number,
  metadata?: ScoreMetadata,
): Promise<RankingEntry | null> => {
  return saveScoreForGame(playerName, score, ISLAND_GAME_TYPE, metadata);
};

export const saveFlagScore = async (
  playerName: string,
  score: number,
  metadata?: ScoreMetadata,
): Promise<RankingEntry | null> => {
  return saveScoreForGame(playerName, score, FLAG_GAME_TYPE, metadata);
};

export const saveColorScore = async (
  playerName: string,
  score: number,
  metadata?: ScoreMetadata,
): Promise<RankingEntry | null> => {
  return saveScoreForGame(playerName, score, COLOR_GAME_TYPE, metadata);
};

export const getPlayerBestScore = async (playerName: string): Promise<number> => {
  const trimmedName = playerName.trim();

  if (hasRankingsApi()) {
    try {
      const response = await apiRequest<{ score: number }>(
        `/players/${encodeURIComponent(trimmedName)}/best${buildQuery({ gameType: GAME_TYPE })}`,
      );
      return response.score || 0;
    } catch (error) {
      console.error('Failed to fetch player best score from API:', error);
    }
  }

  const rankings = await loadLocalRankingsForGame(GAME_TYPE);
  const playerScores = rankings
    .filter((entry) => entry.playerName === trimmedName)
    .map((entry) => entry.score);

  return playerScores.length > 0 ? Math.max(...playerScores) : 0;
};

export const fetchRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(GAME_TYPE, period);
};

export const fetchIslandRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(ISLAND_GAME_TYPE, period);
};

export const fetchFlagRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(FLAG_GAME_TYPE, period);
};

export const fetchColorRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  return fetchRankingsForGame(COLOR_GAME_TYPE, period);
};

export const fetchPlayerScoreHistory = async (
  playerName: string,
  gameType: string = GAME_TYPE,
): Promise<RankingEntry[]> => {
  const trimmedName = playerName.trim();

  if (hasRankingsApi()) {
    try {
      return await apiRequest<RankingEntry[]>(
        `/players/${encodeURIComponent(trimmedName)}/history${buildQuery({ gameType, limit: 100 })}`,
      );
    } catch (error) {
      console.error('Failed to fetch player score history from API:', error);
    }
  }

  const rankings = await loadLocalRankingsForGame(gameType);
  return rankings
    .filter((entry) => entry.playerName === trimmedName)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};
