export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
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

const GAME_TYPES = new Set([
  'strawberry_rush',
  'island_rush',
  'flag_rush',
  'color_rush',
]);

const PERIODS = new Set(['all', 'daily', 'weekly', 'monthly']);
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MAX_SCORE = 1000000;
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

const getGameType = (value: string | null) => {
  const gameType = value || 'strawberry_rush';
  if (!GAME_TYPES.has(gameType)) {
    throw new Error('Unsupported game type');
  }

  return gameType;
};

const getPeriod = (value: string | null) => {
  const period = value || 'all';
  if (!PERIODS.has(period)) {
    throw new Error('Unsupported ranking period');
  }

  return period;
};

const fetchRankings = async (request: Request, env: Env) => {
  const url = new URL(request.url);
  const gameType = getGameType(url.searchParams.get('gameType'));
  const period = getPeriod(url.searchParams.get('period'));
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

const saveScore = async (request: Request, env: Env) => {
  const body = await request.json().catch(() => null) as {
    playerName?: unknown;
    score?: unknown;
    gameType?: unknown;
  } | null;

  const playerName = typeof body?.playerName === 'string' ? body.playerName.trim() : '';
  const score = typeof body?.score === 'number' ? body.score : Number(body?.score);
  const gameType = typeof body?.gameType === 'string' ? getGameType(body.gameType) : 'strawberry_rush';

  if (!playerName || playerName.length > 30) {
    throw new HttpError(400, 'Player name must be 1-30 characters.');
  }

  if (!Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    throw new HttpError(400, 'Score is out of range.');
  }

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
  const gameType = getGameType(url.searchParams.get('gameType'));

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
  const gameType = getGameType(url.searchParams.get('gameType'));
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
        return json(await saveScore(request, env), { status: 201 }, origin, env);
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
      const status = error instanceof HttpError ? error.status : message.startsWith('Unsupported') ? 400 : 500;
      return json({ error: message }, { status }, origin, env);
    }
  },
};
