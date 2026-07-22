import {
  enforceScoreSubmissionRateLimit,
  getBearerPlayerToken,
  getPlayerOwnerHash,
  sha256Hex,
} from './identity';
import {
  HttpError,
  readJsonBody,
  requireAllowedBrowserOrigin,
} from './http';
import {
  validateGameSessionRequest,
  validateScoreSubmission,
} from './rankingValidation';
import type {
  Env,
  GameSessionRow,
  RankingEntry,
  RankingRow,
} from './types';
import { mapRanking } from './types';

const GAME_SESSION_TTL_MS = 15 * 60 * 1000;
const GAME_SESSION_CLOCK_TOLERANCE_MS = 5_000;

export type SaveScoreResult = {
  entry: RankingEntry;
  created: boolean;
};

const findScoreById = async (
  env: Env,
  submissionId: string,
): Promise<RankingRow | null> => {
  return env.DB.prepare(
    `
      SELECT id, player_name, score, game_type, island_region, created_at, owner_hash
      FROM rankings
      WHERE id = ?
      LIMIT 1
    `,
  ).bind(submissionId).first<RankingRow>();
};

const toIdempotentResult = (
  existing: RankingRow,
  expected: {
    playerName: string;
    score: number;
    gameType: string;
    islandRegion: string;
    ownerHash: string;
  },
): SaveScoreResult => {
  if (existing.player_name !== expected.playerName
    || existing.score !== expected.score
    || existing.game_type !== expected.gameType
    || existing.island_region !== expected.islandRegion
    || (existing.owner_hash !== null && existing.owner_hash !== expected.ownerHash)) {
    throw new HttpError(409, 'Submission ID is already in use.');
  }
  return { entry: mapRanking(existing), created: false };
};

export const createGameSession = async (
  request: Request,
  env: Env,
  origin?: string,
): Promise<{
  id: string;
  gameType: string;
  islandRegion: string;
  startedAt: string;
  expiresAt: string;
}> => {
  requireAllowedBrowserOrigin(origin, env);
  const body = await readJsonBody(request);
  const { gameType, islandRegion } = validateGameSessionRequest(body);
  const ownerHash = await getPlayerOwnerHash(request);
  await enforceScoreSubmissionRateLimit(request, env);

  const id = crypto.randomUUID();
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + GAME_SESSION_TTL_MS);
  await env.DB.prepare(
    `
      INSERT INTO game_sessions (id, owner_hash, game_type, island_region, started_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).bind(
    id,
    ownerHash,
    gameType,
    islandRegion,
    startedAt.toISOString(),
    expiresAt.toISOString(),
  ).run();

  return {
    id,
    gameType,
    islandRegion,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
};

export const saveScore = async (
  request: Request,
  env: Env,
  origin?: string,
): Promise<SaveScoreResult> => {
  requireAllowedBrowserOrigin(origin, env);
  const body = await readJsonBody(request);
  const {
    submissionId,
    gameSessionId,
    playerName,
    score,
    gameType,
    islandRegion,
    durationMs,
    playerToken,
  } = validateScoreSubmission(body);
  const bearerToken = getBearerPlayerToken(request);
  if (bearerToken && playerToken && bearerToken !== playerToken) {
    throw new HttpError(400, 'Player token credentials do not match.');
  }
  const ownerHash = await sha256Hex(`player:${bearerToken}`);
  const expected = { playerName, score, gameType, islandRegion, ownerHash };

  const existing = await findScoreById(env, submissionId);
  if (existing) {
    return toIdempotentResult(existing, expected);
  }

  const session = await env.DB.prepare(
    `
      SELECT id, owner_hash, game_type, island_region, started_at, expires_at, consumed_at, submission_id
      FROM game_sessions
      WHERE id = ?
      LIMIT 1
    `,
  ).bind(gameSessionId).first<GameSessionRow>();

  if (!session) {
    throw new HttpError(400, 'Game session was not found.');
  }
  if (session.owner_hash !== ownerHash
    || session.game_type !== gameType
    || session.island_region !== islandRegion) {
    throw new HttpError(403, 'Game session does not match this score.');
  }
  if (session.consumed_at || session.submission_id) {
    if (session.submission_id === submissionId) {
      const concurrentScore = await findScoreById(env, submissionId);
      if (concurrentScore) {
        return toIdempotentResult(concurrentScore, expected);
      }
    }
    throw new HttpError(409, 'Game session has already been used.');
  }

  const now = new Date();
  const startedAtMs = Date.parse(session.started_at);
  const expiresAtMs = Date.parse(session.expires_at);
  if (!Number.isFinite(startedAtMs)
    || !Number.isFinite(expiresAtMs)
    || now.getTime() > expiresAtMs) {
    throw new HttpError(409, 'Game session has expired.');
  }
  if (durationMs > now.getTime() - startedAtMs + GAME_SESSION_CLOCK_TOLERANCE_MS) {
    throw new HttpError(400, 'Game duration exceeds the server-observed session time.');
  }

  const entry: RankingEntry = {
    id: submissionId,
    playerName,
    score,
    gameType,
    islandRegion,
    createdAt: now.toISOString(),
  };

  let results: { meta: { changes?: number } }[];
  try {
    results = await env.DB.batch([
      env.DB.prepare(
        `
          UPDATE game_sessions
          SET consumed_at = ?, submission_id = ?
          WHERE id = ? AND consumed_at IS NULL AND submission_id IS NULL
        `,
      ).bind(entry.createdAt, entry.id, gameSessionId),
      env.DB.prepare(
        `
          INSERT INTO rankings (id, player_name, score, game_type, island_region, created_at, owner_hash)
          SELECT ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (
            SELECT 1 FROM game_sessions WHERE id = ? AND submission_id = ?
          )
        `,
      ).bind(
        entry.id,
        entry.playerName,
        entry.score,
        entry.gameType,
        entry.islandRegion,
        entry.createdAt,
        ownerHash,
        gameSessionId,
        entry.id,
      ),
    ]);
  } catch (error) {
    const concurrentScore = await findScoreById(env, submissionId);
    if (concurrentScore) {
      return toIdempotentResult(concurrentScore, expected);
    }
    throw error;
  }

  const [consumeResult, insertResult] = results;
  if ((consumeResult.meta.changes ?? 0) !== 1 || (insertResult.meta.changes ?? 0) !== 1) {
    const concurrentScore = await findScoreById(env, submissionId);
    if (concurrentScore) {
      return toIdempotentResult(concurrentScore, expected);
    }
    throw new HttpError(409, 'Game session has already been used.');
  }

  return { entry, created: true };
};

export const cleanupExpiredGameSessions = async (
  env: Env,
  now: Date = new Date(),
): Promise<void> => {
  await env.DB.prepare(
    `
      DELETE FROM game_sessions
      WHERE expires_at < ?
    `,
  ).bind(now.toISOString()).run();
};
