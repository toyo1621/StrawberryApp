import {
  ValidationError,
  parseGameType,
  parseRankingPeriod,
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
const SCORE_SUBMISSION_RETENTION_MS = 24 * 60 * 60 * 1000;
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

const getPeriodStart = (period: string) => {
  if (period === 'all') {
    return null;
  }

  const now = new Date();
  const start = new Date(now);

  if (period === 'daily') {
    start.setHours(0, 0, 0, 0);
  }

  if (period === 'weekly') {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
  }

  if (period === 'monthly') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return start.toISOString();
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
  const salt = env.RATE_LIMIT_SALT ?? 'strawberry-rankings';

  return sha256Hex(`${salt}:${ip}:${userAgent}`);
};

const enforceScoreSubmissionRateLimit = async (
  request: Request,
  env: Env,
  playerName: string,
  gameType: string,
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
      INSERT INTO score_submission_events (id, identity_hash, player_name, game_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
  ).bind(crypto.randomUUID(), identityHash, playerName, gameType, new Date(now).toISOString()).run();

  await env.DB.prepare(
    `
      DELETE FROM score_submission_events
      WHERE created_at < ?
    `,
  ).bind(new Date(now - SCORE_SUBMISSION_RETENTION_MS).toISOString()).run();
};

const fetchRankings = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const period = parseRankingPeriod(url.searchParams.get('period'));
  const limit = clampLimit(url.searchParams.get('limit'));
  const start = getPeriodStart(period);

  const params: Array<string | number> = [gameType];
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

const saveScore = async (request: Request, env: Env, origin?: string) => {
  requireAllowedOrigin(origin, env);

  const body = await request.json().catch(() => null) as {
    playerName?: unknown;
    score?: unknown;
    gameType?: unknown;
    durationMs?: unknown;
  } | null;

  const { playerName, score, gameType } = validateScoreSubmission(body);
  await enforceScoreSubmissionRateLimit(request, env, playerName, gameType);

  const entry: RankingEntry = {
    id: crypto.randomUUID(),
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

  return entry;
};

const getPlayerBestScore = async (request: Request, env: Env, playerName: string) => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));

  const row = await env.DB.prepare(
    `
      SELECT score
      FROM rankings
      WHERE game_type = ? AND player_name = ?
      ORDER BY score DESC, created_at ASC
      LIMIT 1
    `,
  ).bind(gameType, playerName).first<{ score: number }>();

  return { score: row?.score ?? 0 };
};

const getPlayerHistory = async (request: Request, env: Env, playerName: string) => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const limit = clampLimit(url.searchParams.get('limit'));

  const { results } = await env.DB.prepare(
    `
      SELECT id, player_name, score, game_type, created_at
      FROM rankings
      WHERE game_type = ? AND player_name = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
  ).bind(gameType, playerName, limit).all<RankingRow>();

  return results.map(mapRanking);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('origin') ?? undefined;

    if (request.method === 'OPTIONS') {
      const headers = new Headers();
      setCorsHeaders(headers, origin, env);
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true }, {}, origin, env);
      }

      if (request.method === 'GET' && url.pathname === '/rankings') {
        return json(await fetchRankings(request, env), {}, origin, env);
      }

      if (request.method === 'POST' && url.pathname === '/scores') {
        return json(await saveScore(request, env, origin), { status: 201 }, origin, env);
      }

      const bestMatch = url.pathname.match(/^\/players\/([^/]+)\/best$/);
      if (request.method === 'GET' && bestMatch) {
        return json(await getPlayerBestScore(request, env, decodeURIComponent(bestMatch[1])), {}, origin, env);
      }

      const historyMatch = url.pathname.match(/^\/players\/([^/]+)\/history$/);
      if (request.method === 'GET' && historyMatch) {
        return json(await getPlayerHistory(request, env, decodeURIComponent(historyMatch[1])), {}, origin, env);
      }

      return json({ error: 'Not found' }, { status: 404 }, origin, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      const status =
        error instanceof HttpError || error instanceof ValidationError
          ? error.status
          : 500;
      return json({ error: message }, { status }, origin, env);
    }
  },
};
