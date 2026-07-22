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
import {
  GameMode,
  IslandRegion,
  RankingEntry,
  RankingPeriod,
  RankingsByMode,
} from '../types';
import {
  clearPlayerIdentity,
  getPlayerToken,
  getStoredPlayerToken,
} from './playerIdentityService';
import {
  RankingsApiError,
  apiRequest,
  buildQuery,
  hasRankingsApi,
  isTemporaryApiFailure,
} from './rankingsApiClient';

export { RankingPeriod } from '../types';
export { hasRankingsApi } from './rankingsApiClient';

export interface ScoreMetadata {
  durationMs: number;
  islandRegion?: IslandRegion;
  gameSession?: RankingGameSession | null;
}

export type RankingGameSession = {
  id: string;
  gameType: ApiGameType;
  islandRegion: IslandRegion;
  startedAt: string;
  expiresAt: string;
};

export type ScoreSaveResult = {
  entry: RankingEntry;
  destination: 'remote' | 'local';
  queuedForSync: boolean;
  droppedPendingScores: number;
  verifiedForRanking: boolean;
};

export type RankingFetchResult = {
  entries: RankingEntry[];
  source: 'remote' | 'cache' | 'local';
  stale: boolean;
};

export type AllRankingsFetchResult = {
  rankings: RankingsByMode;
  staleModes: GameMode[];
  failedModes: GameMode[];
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
  islandRegion: IslandRegion;
  durationMs: number;
  createdAt: string;
  gameSessionId?: string;
  gameSessionExpiresAt?: string;
};

const RANKING_LIMIT = 30;
const LOCAL_CACHE_LIMIT = 200;
const PENDING_SCORE_LIMIT = 50;
const PENDING_SYNC_BATCH_SIZE = 3;
const PENDING_SCORES_KEY = 'strawberry_pending_scores_v1';
const PLAYER_HISTORY_KEY_PREFIX = 'strawberry_player_history_v2';

const BASE_STORAGE_KEYS: Record<ApiGameType, string> = {
  strawberry_rush: 'strawberry_game_rankings',
  island_rush: 'island_game_rankings',
  flag_rush: 'flag_game_rankings',
  color_rush: 'color_game_rankings',
};

const ISLAND_REGION_SET = new Set<string>(Object.values(IslandRegion));

const normalizeIslandRegion = (
  gameType: ApiGameType,
  value: unknown,
): IslandRegion => {
  if (
    gameType === 'island_rush'
    && typeof value === 'string'
    && ISLAND_REGION_SET.has(value)
  ) {
    return value as IslandRegion;
  }
  return IslandRegion.ALL;
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

const ALL_STORAGE_KEYS = [
  ...Object.values(BASE_STORAGE_KEYS),
  ...Object.values(IslandRegion)
    .filter((region) => region !== IslandRegion.ALL)
    .map((region) => getStorageKey('island_rush', region)),
  ...API_GAME_TYPES.map((gameType) => `${PLAYER_HISTORY_KEY_PREFIX}_${gameType}`),
];

const isApiGameType = (value: unknown): value is ApiGameType => {
  return typeof value === 'string' && API_GAME_TYPES.includes(value as ApiGameType);
};

const toRankingEntry = (value: unknown): RankingEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<RankingEntry>;
  if (!(typeof entry.id === 'string'
    && typeof entry.playerName === 'string'
    && Number.isInteger(entry.score)
    && isApiGameType(entry.gameType)
    && typeof entry.createdAt === 'string'
    && Number.isFinite(Date.parse(entry.createdAt)))) {
    return null;
  }

  return {
    id: entry.id,
    playerName: entry.playerName,
    score: entry.score as number,
    gameType: entry.gameType,
    islandRegion: normalizeIslandRegion(entry.gameType, entry.islandRegion),
    createdAt: entry.createdAt,
  };
};

const parseRankingEntries = (value: unknown): RankingEntry[] => {
  if (!Array.isArray(value)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  const entries = value.map(toRankingEntry);
  if (entries.some((entry) => entry === null)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return entries as RankingEntry[];
};

const parseRankingEntry = (value: unknown): RankingEntry => {
  const entry = toRankingEntry(value);
  if (!entry) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return entry;
};

const parseGameSession = (value: unknown): RankingGameSession => {
  if (!value || typeof value !== 'object') {
    throw new RankingsApiError('The rankings API returned an invalid game session.');
  }
  const session = value as Partial<RankingGameSession>;
  if (!(typeof session.id === 'string'
    && isApiGameType(session.gameType)
    && typeof session.startedAt === 'string'
    && Number.isFinite(Date.parse(session.startedAt))
    && typeof session.expiresAt === 'string'
    && Number.isFinite(Date.parse(session.expiresAt)))) {
    throw new RankingsApiError('The rankings API returned an invalid game session.');
  }
  return {
    id: session.id,
    gameType: session.gameType,
    islandRegion: normalizeIslandRegion(session.gameType, session.islandRegion),
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
  };
};

const parseDeleteResult = (value: unknown): { deleted: number } => {
  if (!value || typeof value !== 'object' || !Number.isInteger((value as { deleted?: unknown }).deleted)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }

  return { deleted: (value as { deleted: number }).deleted };
};

const generateSubmissionId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }

  return `score_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
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

const loadLocalRankingsForGame = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion = IslandRegion.ALL,
): Promise<RankingEntry[]> => {
  return parseStoredRankings(await AsyncStorage.getItem(getStorageKey(gameType, islandRegion)));
};

const writeLocalRankingsForGame = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  rankings: RankingEntry[],
): Promise<void> => {
  try {
    await AsyncStorage.setItem(getStorageKey(gameType, islandRegion), JSON.stringify(rankings));
  } catch (error) {
    console.warn('Failed to cache rankings.', error);
  }
};

const getPlayerHistoryStorageKey = (gameType: ApiGameType): string => (
  `${PLAYER_HISTORY_KEY_PREFIX}_${gameType}`
);

const loadLocalPlayerHistory = async (gameType: ApiGameType): Promise<RankingEntry[]> => {
  return parseStoredRankings(await AsyncStorage.getItem(getPlayerHistoryStorageKey(gameType)));
};

const mergeIntoLocalPlayerHistory = async (
  gameType: ApiGameType,
  incoming: RankingEntry[],
): Promise<void> => {
  const current = await loadLocalPlayerHistory(gameType);
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  const merged = [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LOCAL_CACHE_LIMIT);
  try {
    await AsyncStorage.setItem(getPlayerHistoryStorageKey(gameType), JSON.stringify(merged));
  } catch (error) {
    console.warn('Failed to cache player history.', error);
  }
};

const mergeIntoLocalCache = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  incoming: RankingEntry[],
): Promise<void> => {
  const current = await loadLocalRankingsForGame(gameType, islandRegion);
  const byId = new Map(current.map((entry) => [entry.id, entry]));
  incoming.forEach((entry) => byId.set(entry.id, entry));
  const merged = [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LOCAL_CACHE_LIMIT);
  await writeLocalRankingsForGame(gameType, islandRegion, merged);
};

const replaceLocalLeaderboardSnapshot = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  incoming: RankingEntry[],
): Promise<void> => {
  const pendingIds = new Set(
    (await loadPendingScores())
      .filter((score) => score.gameType === gameType && score.islandRegion === islandRegion)
      .map((score) => score.submissionId),
  );
  const current = await loadLocalRankingsForGame(gameType, islandRegion);
  const pendingEntries = current.filter((entry) => pendingIds.has(entry.id));
  const byId = new Map(incoming.map((entry) => [entry.id, entry]));
  pendingEntries.forEach((entry) => byId.set(entry.id, entry));
  const snapshot = [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, LOCAL_CACHE_LIMIT);
  await writeLocalRankingsForGame(gameType, islandRegion, snapshot);
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

    return value.flatMap((item): PendingScore[] => {
      if (!item || typeof item !== 'object') {
        return [];
      }
      const score = item as Partial<PendingScore>;
      if (!(typeof score.submissionId === 'string'
        && typeof score.playerName === 'string'
        && Number.isInteger(score.score)
        && isApiGameType(score.gameType)
        && Number.isInteger(score.durationMs)
        && typeof score.createdAt === 'string'
        && (score.gameSessionId === undefined || typeof score.gameSessionId === 'string')
        && (score.gameSessionExpiresAt === undefined || (
          typeof score.gameSessionExpiresAt === 'string'
          && Number.isFinite(Date.parse(score.gameSessionExpiresAt))
        )))) {
        return [];
      }

      return [{
        submissionId: score.submissionId,
        playerName: score.playerName,
        score: score.score as number,
        gameType: score.gameType,
        islandRegion: normalizeIslandRegion(score.gameType, score.islandRegion),
        durationMs: score.durationMs as number,
        createdAt: score.createdAt,
        ...(score.gameSessionId ? { gameSessionId: score.gameSessionId } : {}),
        ...(score.gameSessionExpiresAt ? { gameSessionExpiresAt: score.gameSessionExpiresAt } : {}),
      }];
    });
  } catch {
    return [];
  }
};

const loadPendingScores = async (): Promise<PendingScore[]> => {
  const stored = await AsyncStorage.getItem(PENDING_SCORES_KEY);
  const scores = parsePendingScores(stored);
  const sanitized = JSON.stringify(scores);
  if (stored !== null && stored !== sanitized) {
    await AsyncStorage.setItem(PENDING_SCORES_KEY, sanitized);
  }
  return scores;
};

const writePendingScores = async (scores: PendingScore[]): Promise<void> => {
  await AsyncStorage.setItem(PENDING_SCORES_KEY, JSON.stringify(scores));
};

const enqueuePendingScore = async (score: PendingScore): Promise<number> => {
  const current = await loadPendingScores();
  const withoutDuplicate = current.filter((item) => item.submissionId !== score.submissionId);
  const queued = [...withoutDuplicate, score];
  const retained = queued.slice(-PENDING_SCORE_LIMIT);
  await writePendingScores(retained);
  return queued.length - retained.length;
};

const postScore = async (score: PendingScore): Promise<RankingEntry> => {
  if (!score.gameSessionId) {
    throw new RankingsApiError('A verified game session is required.', 400);
  }
  const playerToken = await getPlayerToken();
  return apiRequest('/scores', parseRankingEntry, {
    method: 'POST',
    headers: { authorization: `Bearer ${playerToken}` },
    body: JSON.stringify({
      submissionId: score.submissionId,
      gameSessionId: score.gameSessionId,
      playerName: score.playerName,
      score: score.score,
      gameType: score.gameType,
      islandRegion: score.islandRegion,
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
    if (
      !score.gameSessionId
      || !score.gameSessionExpiresAt
      || Date.parse(score.gameSessionExpiresAt) <= Date.now()
    ) {
      discarded += 1;
      continue;
    }
    try {
      const entry = await postScore(score);
      await mergeIntoLocalCache(score.gameType, score.islandRegion, [entry]);
      await mergeIntoLocalPlayerHistory(score.gameType, [entry]);
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

export const fetchRankingsForModeWithStatus = async (
  mode: GameMode,
  period: RankingPeriod = RankingPeriod.ALL,
  islandRegion: IslandRegion = IslandRegion.ALL,
): Promise<RankingFetchResult> => {
  const gameType = GAME_MODE_CONFIG[mode].apiType;
  const rankingRegion = normalizeIslandRegion(gameType, islandRegion);
  if (hasRankingsApi()) {
    try {
      const rankings = await apiRequest(
        `/rankings${buildQuery({
          gameType,
          period,
          islandRegion: rankingRegion,
          limit: RANKING_LIMIT,
        })}`,
        parseRankingEntries,
      );
      if (period === RankingPeriod.ALL) {
        await replaceLocalLeaderboardSnapshot(gameType, rankingRegion, rankings);
      }
      return { entries: rankings, source: 'remote', stale: false };
    } catch (error) {
      console.warn('Using cached rankings after an API failure.', error);
    }
  }

  const localRankings = await loadLocalRankingsForGame(gameType, rankingRegion);
  return {
    entries: getUniquePlayerRankings(filterRankingsByPeriod(localRankings, period), RANKING_LIMIT),
    source: hasRankingsApi() ? 'cache' : 'local',
    stale: hasRankingsApi(),
  };
};

export const fetchRankingsForMode = async (
  mode: GameMode,
  period: RankingPeriod = RankingPeriod.ALL,
  islandRegion: IslandRegion = IslandRegion.ALL,
): Promise<RankingEntry[]> => {
  return (await fetchRankingsForModeWithStatus(mode, period, islandRegion)).entries;
};

export const fetchAllRankingsWithStatus = async (): Promise<AllRankingsFetchResult> => {
  const settled = await Promise.allSettled(
    GAME_MODE_ORDER.map(async (mode) => [mode, await fetchRankingsForModeWithStatus(mode)] as const),
  );
  const rankings = createEmptyRankings();
  const staleModes: GameMode[] = [];
  const failedModes: GameMode[] = [];

  settled.forEach((result, index) => {
    const mode = GAME_MODE_ORDER[index];
    if (result.status === 'rejected') {
      console.warn(`Failed to load ${mode} rankings.`, result.reason);
      failedModes.push(mode);
      return;
    }

    rankings[mode] = result.value[1].entries;
    if (result.value[1].stale) {
      staleModes.push(mode);
    }
  });

  return {
    rankings,
    staleModes,
    failedModes,
  };
};

export const fetchAllRankings = async (): Promise<RankingsByMode> => {
  return (await fetchAllRankingsWithStatus()).rankings;
};

const saveLocalScore = async (pending: PendingScore): Promise<RankingEntry> => {
  const entry: RankingEntry = {
    id: pending.submissionId,
    playerName: pending.playerName,
    score: pending.score,
    gameType: pending.gameType,
    islandRegion: pending.islandRegion,
    createdAt: pending.createdAt,
  };
  await mergeIntoLocalCache(pending.gameType, pending.islandRegion, [entry]);
  await mergeIntoLocalPlayerHistory(pending.gameType, [entry]);
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

  const gameType = GAME_MODE_CONFIG[mode].apiType;
  const pending: PendingScore = {
    submissionId: generateSubmissionId(),
    playerName: normalizePlayerName(playerName),
    score,
    gameType,
    islandRegion: normalizeIslandRegion(gameType, metadata.islandRegion),
    durationMs,
    createdAt: new Date().toISOString(),
    ...(metadata.gameSession ? {
      gameSessionId: metadata.gameSession.id,
      gameSessionExpiresAt: metadata.gameSession.expiresAt,
    } : {}),
  };

  const hasUsableSession = Boolean(
    pending.gameSessionId
    && pending.gameSessionExpiresAt
    && Date.parse(pending.gameSessionExpiresAt) > Date.now(),
  );
  if (hasRankingsApi() && hasUsableSession) {
    try {
      const entry = await postScore(pending);
      await mergeIntoLocalCache(pending.gameType, pending.islandRegion, [entry]);
      await mergeIntoLocalPlayerHistory(pending.gameType, [entry]);
      return {
        entry,
        destination: 'remote',
        queuedForSync: false,
        droppedPendingScores: 0,
        verifiedForRanking: true,
      };
    } catch (error) {
      if (!isTemporaryApiFailure(error)) {
        throw error;
      }
      console.warn('Queued a score after an API failure.', error);
      const droppedPendingScores = await enqueuePendingScore(pending);
      const entry = await saveLocalScore(pending);
      return {
        entry,
        destination: 'local',
        queuedForSync: true,
        droppedPendingScores,
        verifiedForRanking: true,
      };
    }
  }

  return {
    entry: await saveLocalScore(pending),
    destination: 'local',
    queuedForSync: false,
    droppedPendingScores: 0,
    verifiedForRanking: false,
  };
};

export const createRankingGameSession = async (
  mode: GameMode,
  islandRegion: IslandRegion = IslandRegion.ALL,
): Promise<RankingGameSession | null> => {
  if (!hasRankingsApi()) {
    return null;
  }
  const gameType = GAME_MODE_CONFIG[mode].apiType;
  const rankingRegion = normalizeIslandRegion(gameType, islandRegion);
  const playerToken = await getPlayerToken();
  return apiRequest('/game-sessions', parseGameSession, {
    method: 'POST',
    headers: { authorization: `Bearer ${playerToken}` },
    body: JSON.stringify({ gameType, islandRegion: rankingRegion }),
  }, { attempts: 1, timeoutMs: 3_000 });
};

export const fetchPlayerScoreHistory = async (
  playerName: string,
  gameType: ApiGameType = 'strawberry_rush',
): Promise<RankingEntry[]> => {
  const normalizedName = normalizePlayerName(playerName);
  if (hasRankingsApi()) {
    try {
      const playerToken = await getPlayerToken();
      const history = await apiRequest(
        `/players/me/history${buildQuery({ gameType, limit: 100 })}`,
        parseRankingEntries,
        { headers: { authorization: `Bearer ${playerToken}` } },
      );
      await mergeIntoLocalPlayerHistory(gameType, history);
      return history;
    } catch (error) {
      console.warn('Using cached score history after an API failure.', error);
    }
  }

  const cachedHistory = await loadLocalPlayerHistory(gameType);
  if (cachedHistory.length > 0) {
    return cachedHistory.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  const identity = rankingIdentity(normalizedName);
  const legacyRankings = gameType === 'island_rush'
    ? (await Promise.all(
        Object.values(IslandRegion).map((region) => loadLocalRankingsForGame(gameType, region)),
      )).flat()
    : await loadLocalRankingsForGame(gameType);
  return legacyRankings
    .filter((entry) => rankingIdentity(entry.playerName) === identity)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getPlayerBestScore = async (playerName: string): Promise<number> => {
  const history = await fetchPlayerScoreHistory(playerName, 'strawberry_rush');
  return history.reduce((best, entry) => Math.max(best, entry.score), 0);
};

export const clearRankingData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([...ALL_STORAGE_KEYS, PENDING_SCORES_KEY]);
};

export const deletePlayerRankingData = async (): Promise<number> => {
  const playerToken = await getStoredPlayerToken();
  let deleted = 0;

  if (hasRankingsApi() && playerToken) {
    const result = await apiRequest('/players/me/scores', parseDeleteResult, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${playerToken}` },
    });
    deleted = result.deleted;
  }

  await clearRankingData();
  await clearPlayerIdentity();
  return deleted;
};

export const fetchRankings = () => fetchRankingsForMode(GameMode.STRAWBERRY);
export const fetchIslandRankings = (islandRegion: IslandRegion = IslandRegion.ALL) => (
  fetchRankingsForMode(GameMode.ISLAND, RankingPeriod.ALL, islandRegion)
);
export const fetchFlagRankings = () => fetchRankingsForMode(GameMode.FLAG);
export const fetchColorRankings = () => fetchRankingsForMode(GameMode.COLOR);
export const fetchRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.STRAWBERRY, period);
export const fetchIslandRankingsByPeriod = (
  period: RankingPeriod,
  islandRegion: IslandRegion = IslandRegion.ALL,
) => fetchRankingsForMode(GameMode.ISLAND, period, islandRegion);
export const fetchFlagRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.FLAG, period);
export const fetchColorRankingsByPeriod = (period: RankingPeriod) => fetchRankingsForMode(GameMode.COLOR, period);
export const saveScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.STRAWBERRY, playerName, score, metadata);
export const saveIslandScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.ISLAND, playerName, score, metadata);
export const saveFlagScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.FLAG, playerName, score, metadata);
export const saveColorScore = (playerName: string, score: number, metadata: ScoreMetadata) => saveScoreForMode(GameMode.COLOR, playerName, score, metadata);
