import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isApiGameType,
  normalizeIslandRegion,
  type PendingScore,
} from './rankingModels';

const PENDING_SCORE_LIMIT = 50;
const PENDING_SCORES_KEY = 'strawberry_pending_scores_v1';

let pendingQueueTail: Promise<void> = Promise.resolve();

const withPendingQueueLock = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = pendingQueueTail.then(operation, operation);
  pendingQueueTail = result.then(() => undefined, () => undefined);
  return result;
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
        ...(score.gameSessionExpiresAt
          ? { gameSessionExpiresAt: score.gameSessionExpiresAt }
          : {}),
      }];
    });
  } catch {
    return [];
  }
};

const readPendingScores = async (): Promise<PendingScore[]> => {
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

export const loadPendingScores = (): Promise<PendingScore[]> => (
  withPendingQueueLock(readPendingScores)
);

export const enqueuePendingScore = (score: PendingScore): Promise<number> => (
  withPendingQueueLock(async () => {
    const current = await readPendingScores();
    const withoutDuplicate = current.filter((item) => item.submissionId !== score.submissionId);
    const queued = [...withoutDuplicate, score];
    const retained = queued.slice(-PENDING_SCORE_LIMIT);
    await writePendingScores(retained);
    return queued.length - retained.length;
  })
);

export const transactPendingScores = <T>(
  operation: (scores: PendingScore[]) => Promise<{
    scores: PendingScore[];
    result: T;
  }>,
): Promise<T> => (
  withPendingQueueLock(async () => {
    const current = await readPendingScores();
    const transaction = await operation(current);
    await writePendingScores(transaction.scores);
    return transaction.result;
  })
);

export const clearPendingScores = (): Promise<void> => (
  withPendingQueueLock(async () => {
    await AsyncStorage.removeItem(PENDING_SCORES_KEY);
  })
);

export const discardPendingScores = (): Promise<number> => (
  withPendingQueueLock(async () => {
    const current = await readPendingScores();
    await AsyncStorage.removeItem(PENDING_SCORES_KEY);
    return current.length;
  })
);
