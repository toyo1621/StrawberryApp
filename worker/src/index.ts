import {
  ValidationError,
  parseGameType,
  parseRankingPeriod,
  validatePlayerName,
  validateScoreSubmission,
} from './rankingValidation';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_SALT?: string;
}

type RankingRow = {
  id: string;
  player_name: string;
  score: number;
  game_type: string;
  created_at: string;
};

type RankingEntry = {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
};

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const SCORE_SUBMISSION_LIMIT = 8;
const SCORE_SUBMISSION_WINDOW_MS = 60 * 1000;
const SCORE_SUBMISSION_RETENTION_MS = 15 * 60 * 1000;
const MAX_REQUEST_BODY_BYTES = 2_048;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://toyo1621.github.io',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19006',
];

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const json = (data: unknown, init: ResponseInit = {}, origin?: string, env?: Env) => {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('referrer-policy', 'no-referrer');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  setCorsHeaders(headers, origin, env);

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
};

const setCorsHeaders = (headers: Headers, origin?: string, env?: Env) => {
  const allowedOrigin = getAllowedOrigin(origin, env);
  headers.set('access-control-allow-origin', allowedOrigin);
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('access-control-max-age', '86400');
  headers.append('vary', 'Origin');
};

const getAllowedOrigin = (origin?: string, env?: Env) => {
  if (!origin) {
    return '*';
  }

  const configured = env?.ALLOWED_ORIGINS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;

  return allowed.includes(origin) ? origin : allowed[0];
};

const isAllowedOrigin = (origin?: string, env?: Env) => {
  if (!origin) {
    return false;
  }

  const configured = env?.ALLOWED_ORIGINS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = configured?.length ? configured : DEFAULT_ALLOWED_ORIGINS;

  return allowed.includes(origin);
};

const requireAllowedOrigin = (origin: string | undefined, env: Env) => {
  if (!isAllowedOrigin(origin, env)) {
    throw new HttpError(403, 'Score submissions require an allowed origin.');
  }
};

export const getPeriodStart = (period: string, now: Date = new Date()) => {
  if (period === 'all') {
    return null;
  }

  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth();
  const date = jstNow.getUTCDate();
  let startDay = date;

  if (period === 'weekly') {
    const day = jstNow.getUTCDay();
    startDay -= day === 0 ? 6 : day - 1;
  }

  if (period === 'monthly') {
    startDay = 1;
  }

  return new Date(Date.UTC(year, month, startDay) - JST_OFFSET_MS).toISOString();
};

const mapRanking = (row: RankingRow): RankingEntry => ({
  id: row.id,
  playerName: row.player_name,
  score: row.score,
  gameType: row.game_type,
  createdAt: row.created_at,
});

const clampLimit = (value: string | null) => {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
};

const sha256Hex = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const getClientIdentityHash = async (request: Request, env: Env) => {
  const ip =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown-ip';
  const userAgent = request.headers.get('user-agent') ?? 'unknown-agent';
  const salt = env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 16) {
    throw new HttpError(503, 'Score submissions are temporarily unavailable.');
  }

  return sha256Hex(`${salt}:${ip}:${userAgent}`);
};

const enforceScoreSubmissionRateLimit = async (
  request: Request,
  env: Env,
) => {
  const identityHash = await getClientIdentityHash(request, env);
  const now = Date.now();
  const windowStart = new Date(now - SCORE_SUBMISSION_WINDOW_MS).toISOString();

  const row = await env.DB.prepare(
    `
      SELECT COUNT(*) AS count
      FROM score_submission_events
      WHERE identity_hash = ? AND created_at >= ?
    `,
  ).bind(identityHash, windowStart).first<{ count: number }>();

  if ((row?.count ?? 0) >= SCORE_SUBMISSION_LIMIT) {
    throw new HttpError(429, 'Too many score submissions. Please wait a moment and try again.');
  }

  await env.DB.prepare(
    `
      INSERT INTO score_submission_events (id, identity_hash, created_at)
      VALUES (?, ?, ?)
    `,
  ).bind(crypto.randomUUID(), identityHash, new Date(now).toISOString()).run();

  await cleanupRateLimitEvents(env, new Date(now));
};

export const cleanupRateLimitEvents = async (
  env: Env,
  now: Date = new Date(),
) => {
  await env.DB.prepare(
    `
      DELETE FROM score_submission_events
      WHERE created_at < ?
    `,
  ).bind(new Date(now.getTime() - SCORE_SUBMISSION_RETENTION_MS).toISOString()).run();
};

const fetchRankings = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const period = parseRankingPeriod(url.searchParams.get('period'));
  const limit = clampLimit(url.searchParams.get('limit'));
  const start = getPeriodStart(period);

  const params: (string | number)[] = [gameType];
  let where = 'game_type = ?';

  if (start) {
    where += ' AND created_at >= ?';
    params.push(start);
  }

  params.push(limit);

  const { results } = await env.DB.prepare(
    `
      WITH ranked_scores AS (
        SELECT
          id,
          player_name,
          score,
          game_type,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY lower(trim(player_name))
            ORDER BY score DESC, created_at ASC
          ) AS rn
        FROM rankings
        WHERE ${where}
      )
      SELECT id, player_name, score, game_type, created_at
      FROM ranked_scores
      WHERE rn = 1
      ORDER BY score DESC, created_at ASC
      LIMIT ?
    `,
  ).bind(...params).all<RankingRow>();

  return results.map(mapRanking);
};

const readJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new HttpError(415, 'Content-Type must be application/json.');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large.');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large.');
  }

  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
};

const saveScore = async (request: Request, env: Env, origin?: string) => {
  requireAllowedOrigin(origin, env);

  const body = await readJsonBody(request);
  const { submissionId, playerName, score, gameType } = validateScoreSubmission(body);

  const existing = await env.DB.prepare(
    `
      SELECT id, player_name, score, game_type, created_at
      FROM rankings
      WHERE id = ?
      LIMIT 1
    `,
  ).bind(submissionId).first<RankingRow>();

  if (existing) {
    if (
      existing.player_name !== playerName
      || existing.score !== score
      || existing.game_type !== gameType
    ) {
      throw new HttpError(409, 'Submission ID is already in use.');
    }
    return { entry: mapRanking(existing), created: false };
  }

  await enforceScoreSubmissionRateLimit(request, env);

  const entry: RankingEntry = {
    id: submissionId,
    playerName,
    score,
    gameType,
    createdAt: new Date().toISOString(),
  };

  await env.DB.prepare(
    `
      INSERT INTO rankings (id, player_name, score, game_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
  ).bind(entry.id, entry.playerName, entry.score, entry.gameType, entry.createdAt).run();

  return { entry, created: true };
};

const getPlayerBestScore = async (request: Request, env: Env, playerName: string) => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const normalizedPlayerName = validatePlayerName(playerName);

  const row = await env.DB.prepare(
    `
      SELECT score
      FROM rankings
      WHERE game_type = ? AND lower(trim(player_name)) = lower(trim(?))
      ORDER BY score DESC, created_at ASC
      LIMIT 1
    `,
  ).bind(gameType, normalizedPlayerName).first<{ score: number }>();

  return { score: row?.score ?? 0 };
};

const getPlayerHistory = async (request: Request, env: Env, playerName: string) => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const limit = clampLimit(url.searchParams.get('limit'));
  const normalizedPlayerName = validatePlayerName(playerName);

  const { results } = await env.DB.prepare(
    `
      SELECT id, player_name, score, game_type, created_at
      FROM rankings
      WHERE game_type = ? AND lower(trim(player_name)) = lower(trim(?))
      ORDER BY created_at DESC
      LIMIT ?
    `,
  ).bind(gameType, normalizedPlayerName, limit).all<RankingRow>();

  return results.map(mapRanking);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') ?? undefined;
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

    if (request.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin, env)) {
        return new Response(null, {
          status: 403,
          headers: { 'x-content-type-options': 'nosniff', 'x-request-id': requestId },
        });
      }
      const headers = new Headers();
      setCorsHeaders(headers, origin, env);
      headers.set('x-content-type-options', 'nosniff');
      headers.set('x-request-id', requestId);
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        const health = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
        if (health?.ok !== 1) {
          throw new Error('Database health check failed.');
        }
        return json(
          { ok: true, service: 'strawberry-rankings-api' },
          { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
          origin,
          env,
        );
      }

      if (request.method === 'GET' && url.pathname === '/rankings') {
        return json(
          await fetchRankings(request, env),
          { headers: { 'cache-control': 'public, max-age=30, stale-while-revalidate=120', 'x-request-id': requestId } },
          origin,
          env,
        );
      }

      if (request.method === 'POST' && url.pathname === '/scores') {
        const result = await saveScore(request, env, origin);
        return json(
          result.entry,
          {
            status: result.created ? 201 : 200,
            headers: { 'cache-control': 'no-store', 'x-request-id': requestId },
          },
          origin,
          env,
        );
      }

      const bestMatch = url.pathname.match(/^\/players\/([^/]+)\/best$/);
      if (request.method === 'GET' && bestMatch) {
        return json(
          await getPlayerBestScore(request, env, decodeURIComponent(bestMatch[1])),
          { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
          origin,
          env,
        );
      }

      const historyMatch = url.pathname.match(/^\/players\/([^/]+)\/history$/);
      if (request.method === 'GET' && historyMatch) {
        return json(
          await getPlayerHistory(request, env, decodeURIComponent(historyMatch[1])),
          { headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
          origin,
          env,
        );
      }

      return json(
        { error: 'Not found' },
        { status: 404, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
        origin,
        env,
      );
    } catch (error) {
      const status =
        error instanceof HttpError || error instanceof ValidationError
          ? error.status
          : 500;
      if (status >= 500) {
        console.error(JSON.stringify({
          event: 'request_failed',
          requestId,
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
      const message = status >= 500
        ? 'The service is temporarily unavailable.'
        : error instanceof Error ? error.message : 'Request failed.';
      return json(
        { error: message, requestId },
        { status, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
        origin,
        env,
      );
    }
  },
  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await cleanupRateLimitEvents(env);
  },
};
