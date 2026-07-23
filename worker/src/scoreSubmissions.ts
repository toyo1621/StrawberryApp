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
import { GAME_SESSION_TTL_MS } from './generated/rankingContract';
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

const GAME_SESSION_CLOCK_TOLERANCE_MS = 5_000;

export type SaveScoreResult = {
  entry: RankingEntry;
  created: boolean;
};

type ExpectedScoreIdentity = {
  playerName: string;
  score: number;
  gameType: string;
  islandRegion: string;
  ownerHash: string;
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
  expected: ExpectedScoreIdentity,
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

const findIdempotentResult = async (
  env: Env,
  submissionId: string,
  expected: ExpectedScoreIdentity,
): Promise<SaveScoreResult | null> => {
  const existing = await findScoreById(env, submissionId);
  return existing ? toIdempotentResult(existing, expected) : null;
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

const validateGameSession = async (
  env: Env,
  session: GameSessionRow | null,
  expected: ExpectedScoreIdentity,
  submissionId: string,
  durationMs: number,
): Promise<SaveScoreResult | null> => {
  if (!session) {
    throw new HttpError(400, 'Game session was not found.');
  }
  if (session.owner_hash !== expected.ownerHash
    || session.game_type !== expected.gameType
    || session.island_region !== expected.islandRegion) {
    throw new HttpError(403, 'Game session does not match this score.');
  }
  if (session.consumed_at || session.submission_id) {
    const idempotent = session.submission_id === submissionId
      ? await findIdempotentResult(env, submissionId, expected)
      : null;
    if (idempotent) {
      return idempotent;
    }
    throw new HttpError(409, 'Game session has already been used.');
  }

  const nowMs = Date.now();
  const startedAtMs = Date.parse(session.started_at);
  const expiresAtMs = Date.parse(session.expires_at);
  if (!Number.isFinite(startedAtMs)
    || !Number.isFinite(expiresAtMs)
    || nowMs > expiresAtMs) {
    throw new HttpError(409, 'Game session has expired.');
  }
  if (durationMs > nowMs - startedAtMs + GAME_SESSION_CLOCK_TOLERANCE_MS) {
    throw new HttpError(400, 'Game duration exceeds the server-observed session time.');
  }
  return null;
};

const commitScore = async (
  env: Env,
  entry: RankingEntry,
  ownerHash: string,
  gameSessionId: string,
  expected: ExpectedScoreIdentity,
): Promise<SaveScoreResult> => {
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
    const idempotent = await findIdempotentResult(env, entry.id, expected);
    if (idempotent) {
      return idempotent;
    }
    throw error;
  }

  const [consumeResult, insertResult] = results;
  if ((consumeResult.meta.changes ?? 0) === 1 && (insertResult.meta.changes ?? 0) === 1) {
    return { entry, created: true };
  }
  const idempotent = await findIdempotentResult(env, entry.id, expected);
  if (idempotent) {
    return idempotent;
  }
  throw new HttpError(409, 'Game session has already been used.');
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

  const existing = await findIdempotentResult(env, submissionId, expected);
  if (existing) {
    return existing;
  }

  const session = await env.DB.prepare(
    `
      SELECT id, owner_hash, game_type, island_region, started_at, expires_at, consumed_at, submission_id
      FROM game_sessions
      WHERE id = ?
      LIMIT 1
    `,
  ).bind(gameSessionId).first<GameSessionRow>();

  const idempotentSession = await validateGameSession(
    env,
    session,
    expected,
    submissionId,
    durationMs,
  );
  if (idempotentSession) {
    return idempotentSession;
  }

  const now = new Date();
  const entry: RankingEntry = {
    id: submissionId,
    playerName,
    score,
    gameType,
    islandRegion,
    createdAt: now.toISOString(),
  };

  return commitScore(env, entry, ownerHash, gameSessionId, expected);
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
