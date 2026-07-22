import {
  type ApiGameType,
  GAME_MODE_CONFIG,
  GAME_MODE_ORDER,
  createEmptyRankings,
} from '../gameConfig';
import {
  filterRankingsByPeriod,
  getPlayerNameValidationError,
  getUniquePlayerRankings,
  normalizePlayerName,
  rankingIdentity,
} from '../domain/rankings';
import {
  GameMode,
  IslandRegion,
  type RankingEntry,
  RankingPeriod,
  type RankingsByMode,
} from '../types';
import {
  clearPlayerIdentity,
  getPlayerToken,
  getStoredPlayerToken,
} from './playerIdentityService';
import {
  clearLocalRankingData,
  loadLocalPlayerHistory,
  loadLocalRankingsForGame,
  mergeIntoLocalCache,
  mergeIntoLocalPlayerHistory,
  replaceLocalLeaderboardSnapshot,
} from './rankingLocalStore';
import {
  generateSubmissionId,
  normalizeIslandRegion,
  parseDeleteResult,
  parseGameSession,
  parseRankingEntries,
  parseRankingEntry,
  type AllRankingsFetchResult,
  type PendingScore,
  type RankingFetchResult,
  type RankingGameSession,
  type ScoreMetadata,
  type ScoreSaveResult,
  type SyncResult,
} from './rankingModels';
import {
  clearPendingScores,
  discardPendingScores,
  enqueuePendingScore,
  loadPendingScores,
  transactPendingScores,
} from './rankingPendingQueue';
import {
  RankingsApiError,
  apiRequest,
  buildQuery,
  hasRankingsApi,
  isTemporaryApiFailure,
} from './rankingsApiClient';

export { RankingPeriod } from '../types';
export { hasRankingsApi } from './rankingsApiClient';
export type {
  AllRankingsFetchResult,
  RankingFetchResult,
  RankingGameSession,
  ScoreMetadata,
  ScoreSaveResult,
  SyncResult,
} from './rankingModels';

const RANKING_LIMIT = 30;
const PENDING_SYNC_BATCH_SIZE = 3;

const persistRemoteEntryBestEffort = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  entry: RankingEntry,
): Promise<void> => {
  const results = await Promise.allSettled([
    mergeIntoLocalCache(gameType, islandRegion, [entry]),
    mergeIntoLocalPlayerHistory(gameType, [entry]),
  ]);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('A remote score was saved, but its local cache could not be updated.', result.reason);
    }
  });
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

export const syncPendingScores = async (
  options: { onlineRankingsEnabled?: boolean } = {},
): Promise<SyncResult> => {
  if (options.onlineRankingsEnabled === false) {
    const pendingScores = await loadPendingScores();
    return { synced: 0, pending: pendingScores.length, discarded: 0 };
  }
  if (!hasRankingsApi()) {
    const pendingScores = await loadPendingScores();
    return { synced: 0, pending: pendingScores.length, discarded: 0 };
  }

  return transactPendingScores(async (pendingScores) => {
    if (pendingScores.length === 0) {
      return {
        scores: pendingScores,
        result: { synced: 0, pending: 0, discarded: 0 },
      };
    }

    const batch = pendingScores.slice(0, PENDING_SYNC_BATCH_SIZE);
    let remaining = pendingScores.slice(PENDING_SYNC_BATCH_SIZE);
    let synced = 0;
    let discarded = 0;

    for (let index = 0; index < batch.length; index += 1) {
      const score = batch[index];
      if (!score.gameSessionId
        || !score.gameSessionExpiresAt
        || Date.parse(score.gameSessionExpiresAt) <= Date.now()) {
        discarded += 1;
        continue;
      }
      try {
        const entry = await postScore(score);
        await persistRemoteEntryBestEffort(score.gameType, score.islandRegion, entry);
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

    return {
      scores: remaining,
      result: { synced, pending: remaining.length, discarded },
    };
  });
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
        const pendingIds = new Set(
          (await loadPendingScores())
            .filter((score) => (
              score.gameType === gameType && score.islandRegion === rankingRegion
            ))
            .map((score) => score.submissionId),
        );
        try {
          await replaceLocalLeaderboardSnapshot(
            gameType,
            rankingRegion,
            rankings,
            pendingIds,
          );
        } catch (cacheError) {
          console.warn('Remote rankings loaded, but the local cache could not be updated.', cacheError);
        }
      }
      return { entries: rankings, source: 'remote', stale: false };
    } catch (error) {
      console.warn('Using cached rankings after an API failure.', error);
    }
  }

  const localRankings = await loadLocalRankingsForGame(gameType, rankingRegion);
  return {
    entries: getUniquePlayerRankings(
      filterRankingsByPeriod(localRankings, period),
      RANKING_LIMIT,
    ),
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
    GAME_MODE_ORDER.map(async (mode) => (
      [mode, await fetchRankingsForModeWithStatus(mode)] as const
    )),
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

  return { rankings, staleModes, failedModes };
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
  if (!Number.isInteger(metadata.durationMs) || metadata.durationMs < 1_000) {
    throw new Error('A valid game duration is required to save a score.');
  }

  const playerNameError = getPlayerNameValidationError(playerName);
  if (playerNameError) {
    throw new Error(playerNameError);
  }

  const gameType = GAME_MODE_CONFIG[mode].apiType;
  const pending: PendingScore = {
    submissionId: generateSubmissionId(),
    playerName: normalizePlayerName(playerName),
    score,
    gameType,
    islandRegion: normalizeIslandRegion(gameType, metadata.islandRegion),
    durationMs: metadata.durationMs,
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
      await persistRemoteEntryBestEffort(pending.gameType, pending.islandRegion, entry);
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
      let entry: RankingEntry;
      try {
        entry = await saveLocalScore(pending);
      } catch (cacheError) {
        console.warn('The queued score could not be added to the local ranking cache.', cacheError);
        entry = {
          id: pending.submissionId,
          playerName: pending.playerName,
          score: pending.score,
          gameType: pending.gameType,
          islandRegion: pending.islandRegion,
          createdAt: pending.createdAt,
        };
      }
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
      try {
        await mergeIntoLocalPlayerHistory(gameType, history);
      } catch (cacheError) {
        console.warn('Remote score history loaded, but the local cache could not be updated.', cacheError);
      }
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
        Object.values(IslandRegion).map((region) => (
          loadLocalRankingsForGame(gameType, region)
        )),
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
  await Promise.all([clearLocalRankingData(), clearPendingScores()]);
};

export const discardPendingRankingScores = (): Promise<number> => discardPendingScores();

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
export const fetchRankingsByPeriod = (period: RankingPeriod) => (
  fetchRankingsForMode(GameMode.STRAWBERRY, period)
);
export const fetchIslandRankingsByPeriod = (
  period: RankingPeriod,
  islandRegion: IslandRegion = IslandRegion.ALL,
) => fetchRankingsForMode(GameMode.ISLAND, period, islandRegion);
export const fetchFlagRankingsByPeriod = (period: RankingPeriod) => (
  fetchRankingsForMode(GameMode.FLAG, period)
);
export const fetchColorRankingsByPeriod = (period: RankingPeriod) => (
  fetchRankingsForMode(GameMode.COLOR, period)
);
export const saveScore = (playerName: string, score: number, metadata: ScoreMetadata) => (
  saveScoreForMode(GameMode.STRAWBERRY, playerName, score, metadata)
);
export const saveIslandScore = (playerName: string, score: number, metadata: ScoreMetadata) => (
  saveScoreForMode(GameMode.ISLAND, playerName, score, metadata)
);
export const saveFlagScore = (playerName: string, score: number, metadata: ScoreMetadata) => (
  saveScoreForMode(GameMode.FLAG, playerName, score, metadata)
);
export const saveColorScore = (playerName: string, score: number, metadata: ScoreMetadata) => (
  saveScoreForMode(GameMode.COLOR, playerName, score, metadata)
);
