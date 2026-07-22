import type { ApiGameType } from '../gameConfig';
import type { IslandRegion, RankingEntry } from '../types';
import { getPlayerToken } from './playerIdentityService';
import {
  mergeIntoLocalCache,
  mergeIntoLocalPlayerHistory,
} from './rankingLocalStore';
import {
  parseRankingEntry,
  type PendingScore,
  type SyncResult,
} from './rankingModels';
import {
  loadPendingScores,
  transactPendingScores,
} from './rankingPendingQueue';
import {
  RankingsApiError,
  apiRequest,
  hasRankingsApi,
  isTemporaryApiFailure,
} from './rankingsApiClient';
const PENDING_SYNC_BATCH_SIZE = 3;

export const persistRemoteEntryBestEffort = async (
  gameType: ApiGameType,
  islandRegion: IslandRegion,
  entry: RankingEntry,
): Promise<void> => {
  const ownedEntry = { ...entry, isCurrentPlayer: true };
  const results = await Promise.allSettled([
    mergeIntoLocalCache(gameType, islandRegion, [ownedEntry]),
    mergeIntoLocalPlayerHistory(gameType, [ownedEntry]),
  ]);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('A remote score was saved, but its local cache could not be updated.', result.reason);
    }
  });
};

export const postPendingScore = async (score: PendingScore): Promise<RankingEntry> => {
  if (!score.gameSessionId) {
    throw new RankingsApiError('A verified game session is required.', 400);
  }
  const playerToken = await getPlayerToken();
  const entry = await apiRequest('/scores', parseRankingEntry, {
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
  return { ...entry, isCurrentPlayer: true };
};

export const syncPendingScores = async (
  options: { onlineRankingsEnabled?: boolean } = {},
): Promise<SyncResult> => {
  if (options.onlineRankingsEnabled === false || !hasRankingsApi()) {
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
        const entry = await postPendingScore(score);
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
