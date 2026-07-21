import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  API_GAME_TYPES,
  ApiGameType,
  GAME_MODE_CONFIG,
  GAME_MODE_ORDER,
  createEmptyRankings,
} from '../gameConfig';
import {
  filterRankingsByPeriod,
  getUniquePlayerRankings,
  normalizePlayerName,
  rankingIdentity,
} from '../domain/rankings';
import { GameMode, RankingEntry, RankingPeriod, RankingsByMode } from '../types';

export { RankingPeriod } from '../types';

export interface ScoreMetadata {
  durationMs: number;
}

export type ScoreSaveResult = {
  entry: RankingEntry;
  destination: 'remote' | 'local';
  queuedForSync: boolean;
};

export type SyncResult = {
  synced: number;
  pending: number;
  discarded: number;
};

type PendingScore = {
  submissionId: string;
  playerName: string;
  score: number;
  gameType: ApiGameType;
  durationMs: number;
  createdAt: string;
};

const RANKING_LIMIT = 30;
const LOCAL_CACHE_LIMIT = 200;
const PENDING_SCORE_LIMIT = 50;
const PENDING_SYNC_BATCH_SIZE = 3;
const API_TIMEOUT_MS = 6_000;
const API_ATTEMPTS = 2;
const PENDING_SCORES_KEY = 'strawberry_pending_scores_v1';

const STORAGE_KEYS: Record<ApiGameType, string> = {
  strawberry_rush: 'strawberry_game_rankings',
  island_rush: 'island_game_rankings',
  flag_rush: 'flag_game_rankings',
  color_rush: 'color_game_rankings',
};

const rankingsApiUrl = (process.env.EXPO_PUBLIC_RANKINGS_API_URL || '').replace(/\/+$/, '');

export const hasRankingsApi = (): boolean => rankingsApiUrl.length > 0;

class RankingsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const isTemporaryApiFailure = (error: unknown): boolean => {
  const status = error instanceof RankingsApiError ? error.status : undefined;
  return status === undefined || status === 408 || status === 429 || (status >= 500 && status <= 599);
};

const isApiGameType = (value: unknown): value is ApiGameType => {
  return typeof value === 'string' && API_GAME_TYPES.includes(value as ApiGameType);
};

const isRankingEntry = (value: unknown): value is RankingEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<RankingEntry>;
  return typeof entry.id === 'string'
    && typeof entry.playerName === 'string'
    && Number.isInteger(entry.score)
    && typeof entry.gameType === 'string'
    && typeof entry.createdAt === 'string'
    && Number.isFinite(Date.parse(entry.createdAt));
};

const parseRankingEntries = (value: unknown): RankingEntry[] => {
  if (!Array.isArray(value) || !value.every(isRankingEntry)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return value;
};

const parseRankingEntry = (value: unknown): RankingEntry => {
  if (!isRankingEntry(value)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return value;
};

const generateSubmissionId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  return `score_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
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

const wait = (durationMs: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
};

const apiRequest = async <T>(
  path: string,
  parse: (value: unknown) => T,
  init: RequestInit = {},
): Promise<T> => {
  if (!hasRankingsApi()) {
    throw new RankingsApiError('Rankings API URL is not configured.');
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < API_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const response = await fetch(`${rankingsApiUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          ...(init.body ? { 'content-type': 'application/json' } : {}),
          ...(init.headers || {}),
        },
      });

      const body = await response.json().catch(() => null) as unknown;
      if (!response.ok) {
        const message = body && typeof body === 'object' && 'error' in body
          ? String((body as { error: unknown }).error)
          : 'Rankings API request failed.';
        throw new RankingsApiError(message, response.status);
      }

      return parse(body);
    } catch (error) {
      lastError = error;
      const status = error instanceof RankingsApiError ? error.status : undefined;
      const retryable = status === undefined || status === 408 || (status >= 500 && status <= 599);
      if (!retryable || attempt === API_ATTEMPTS - 1) {
        throw error;
      }
      await wait(250 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new RankingsApiError('Rankings API request failed.');
};

const parseStoredRankings = (stored: string | null): RankingEntry[] => {
  if (!stored) {
    return [];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRankingEntry) : [];
  } catch {
    return [];
  }
};

const loadLocalRankingsForGame = async (gameType: ApiGameType): Promise<RankingEntry[]> => {
  try {
    return parseStoredRankings(await AsyncStorage.getItem(STORAGE_KEYS[gameType]));
  } catch (error) {
    console.warn('Failed to load cached rankings.', error);
    return [];
  }
};

const writeLocalRankingsForGame = async (
  gameType: ApiGameType,
  rankings: RankingEntry[],
): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS[gameType], JSON.stringify(rankings));
  } catch (error) {
    console.warn('Failed to cache rankings.', error);
  }
};

const mergeIntoLocalCache = async (
  gameType: ApiGameType,
  incoming: RankingEntry[],
): Promise<void> => {
  const current = await loadLocalRankingsForGame(gameType);
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  const merged = [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LOCAL_CACHE_LIMIT);
  await writeLocalRankingsForGame(gameType, merged);
};

const parsePendingScores = (stored: string | null): PendingScore[] => {
  if (!stored) {
    return [];
  }

  try {
    const value = JSON.parse(stored) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is PendingScore => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const score = item as Partial<PendingScore>;
      return typeof score.submissionId === 'string'
        && typeof score.playerName === 'string'
        && Number.isInteger(score.score)
        && isApiGameType(score.gameType)
        && Number.isInteger(score.durationMs)
        && typeof score.createdAt === 'string';
    });
  } catch {
    return [];
  }
};

const loadPendingScores = async (): Promise<PendingScore[]> => {
  try {
    return parsePendingScores(await AsyncStorage.getItem(PENDING_SCORES_KEY));
  } catch (error) {
    console.warn('Failed to load pending scores.', error);
    return [];
  }
};

const writePendingScores = async (scores: PendingScore[]): Promise<void> => {
  await AsyncStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(scores.slice(-PENDING_SCORE_LIMIT)));
};

const enqueuePendingScore = async (score: PendingScore): Promise<void> => {
  const current = await loadPendingScores();
  const withoutDuplicate = current.filter((item) => item.submissionId !== score.submissionId);
  await writePendingScores([...withoutDuplicate, score]);
};

const postScore = async (score: PendingScore): Promise<RankingEntry> => {
  return apiRequest('/scores', parseRankingEntry, {
    method: 'POST',
    body: JSON.stringify({
      submissionId: score.submissionId,
      playerName: score.playerName,
      score: score.score,
      gameType: score.gameType,
      durationMs: score.durationMs,
    }),
  });
};

export const syncPendingScores = async (): Promise<SyncResult> => {
  const pendingScores = await loadPendingScores();
  if (!hasRankingsApi() || pendingScores.length === 0) {
    return { synced: 0, pending: pendingScores.length, discarded: 0 };
  }

  const batch = pendingScores.slice(0, PENDING_SYNC_BATCH_SIZE);
  let remaining = pendingScores.slice(PENDING_SYNC_BATCH_SIZE);
  let synced = 0;
  let discarded = 0;

  for (let index = 0; index < batch.length; index += 1) {
    const score = batch[index];
    try {
      const entry = await postScore(score);
      await mergeIntoLocalCache(score.gameType, [entry]);
      synced += 1;
    } catch (error) {
      if (!isTemporaryApiFailure(error)) {
        discarded += 1;
      } else {
        remaining = [...batch.slice(index), ...remaining];
        break;
      }
    }
  }

  await writePendingScores(remaining);
  return { synced, pending: remaining.length, discarded };
};

export const fetchRankingsForMode = async (
  mode: GameMode,
  period: RankingPeriod = RankingPeriod.ALL,
): Promise<RankingEntry[]> => {
  const gameType = GAME_MODE_CONFIG[mode].apiType;
  if (hasRankingsApi()) {
    try {
      const rankings = await apiRequest(
        `/rankings${buildQuery({ gameType, period, limit: RANKING_LIMIT })}`,
        parseRankingEntries,
      );
      if (period === RankingPeriod.ALL) {
        await mergeIntoLocalCache(gameType, rankings);
      }
      return rankings;
    } catch (error) {
      console.warn('Using cached rankings after an API failure.', error);
    }
  }

  const localRankings = await loadLocalRankingsForGame(gameType);
  return getUniquePlayerRankings(filterRankingsByPeriod(localRankings, period), RANKING_LIMIT);
};

export const fetchAllRankings = async (): Promise<RankingsByMode> => {
  const entries = await Promise.all(
    GAME_MODE_ORDER.map(async (mode) => [mode, await fetchRankingsForMode(mode)] as const),
  );
  return entries.reduce<RankingsByMode>((result, [mode, rankings]) => {
    result[mode] = rankings;
    return result;
  }, createEmptyRankings());
};

const saveLocalScore = async (pending: PendingScore): Promise<RankingEntry> => {
  const entry: RankingEntry = {
    id: pending.submissionId,
    playerName: pending.playerName,
    score: pending.score,
    gameType: pending.gameType,
    createdAt: pending.createdAt,
  };
  await mergeIntoLocalCache(pending.gameType, [entry]);
  return entry;
};

export const saveScoreForMode = async (
  mode: GameMode,
  playerName: string,
  score: number,
  metadata: ScoreMetadata,
): Promise<ScoreSaveResult> => {
  const durationMs = metadata.durationMs;
  if (!Number.isInteger(durationMs) || durationMs < 1_000) {
    throw new Error('A valid game duration is required to save a score.');
  }

  const pending: PendingScore = {
    submissionId: generateSubmissionId(),
    playerName: normalizePlayerName(playerName),
    score,
    gameType: GAME_MODE_CONFIG[mode].apiType,
    durationMs,
    createdAt: new Date().toISOString(),
  };

  if (hasRankingsApi()) {
    try {
      const entry = await postScore(pending);
      await mergeIntoLocalCache(pending.gameType, [entry]);
      return { entry, destination: 'remote', queuedForSync: false };
    } catch (error) {
      if (!isTemporaryApiFailure(error)) {
        throw error;
      }
      console.warn('Queued a score after an API failure.', error);
      await enqueuePendingScore(pending);
      const entry = await saveLocalScore(pending);
      return { entry, destination: 'local', queuedForSync: true };
    }
  }

  return {
    entry: await saveLocalScore(pending),
    destination: 'local',
    queuedForSync: false,
  };
};

export const fetchPlayerScoreHistory = async (
  playerName: string,
  gameType: ApiGameType = 'strawberry_rush',
): Promise<RankingEntry[]> => {
  const normalizedName = normalizePlayerName(playerName);
  if (hasRankingsApi()) {
    try {
      const history = await apiRequest(
        `/players/${encodeURIComponent(normalizedName)}/history${buildQuery({ gameType, limit: 100 })}`,
        parseRankingEntries,
      );
      await mergeIntoLocalCache(gameType, history);
      return history;
    } catch (error) {
      console.warn('Using cached score history after an API failure.', error);
    }
  }

  const identity = rankingIdentity(normalizedName);
  const rankings = await loadLocalRankingsForGame(gameType);
  return rankings
    .filter((entry) => rankingIdentity(entry.playerName) === identity)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getPlayerBestScore = async (playerName: string): Promise<number> => {
  const history = await fetchPlayerScoreHistory(playerName, 'strawberry_rush');
  return history.reduce((best, entry) => Math.max(best, entry.score), 0);
};

export const fetchRankings = () => fetchRankingsForMode(GameMode.STRAWBERRY);
export const fetchIslandRankings = () => fetchRankingsForMode(GameMode.ISLAND);
export const fetchFlagRankings = () => fetchRankingsForMode(GameMode.FLAG);
export const fetchColorRankings = () => fetchRankingsForMode(GameMode.COLOR);
export const fetchRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.STRAWBERRY, period);
export const fetchIslandRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.ISLAND, period);
export const fetchFlagRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.FLAG, period);
export const fetchColorRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.COLOR, period);
export const saveScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.STRAWBERRY, playerName, score, metadata);
export const saveIslandScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.ISLAND, playerName, score, metadata);
export const saveFlagScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.FLAG, playerName, score, metadata);
export const saveColorScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.COLOR, playerName, score, metadata);
