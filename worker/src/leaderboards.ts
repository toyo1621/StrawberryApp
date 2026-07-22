import {
  ISLAND_REGIONS,
  PERIODS,
  parseGameType,
  parseIslandRegion,
  parseRankingPeriod,
} from './rankingValidation';
import { getBearerPlayerToken, sha256Hex } from './identity';
import type { Env, RankingEntry, RankingRow } from './types';
import { mapRanking } from './types';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const CACHE_FRESH_MS = 30 * 1000;
const CACHE_RETENTION_SECONDS = 5 * 60;
const CACHE_VERSION = 'v1';
const RANKING_PERIODS = PERIODS;
type CacheStatus = 'bypass' | 'hit' | 'miss' | 'stale';

type LeaderboardSnapshot = {
  cachedAt: number;
  entries: RankingEntry[];
  databaseRegion?: string;
  servedByPrimary?: boolean;
};

export type LeaderboardResult = LeaderboardSnapshot & {
  cacheStatus: CacheStatus;
};

type LeaderboardQuery = {
  gameType: string;
  islandRegion: string;
  period: string;
  limit: number;
  start: string | null;
};

const inFlightRefreshes = new Map<string, Promise<LeaderboardSnapshot>>();
const cacheGenerations = new Map<string, number>();

export const getPeriodStart = (period: string, now: Date = new Date()): string | null => {
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

const clampLimit = (value: string | null): number => {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const parseLeaderboardQuery = (request: Request): LeaderboardQuery => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const islandRegion = parseIslandRegion(url.searchParams.get('islandRegion'), gameType);
  const period = parseRankingPeriod(url.searchParams.get('period'));
  return {
    gameType,
    islandRegion,
    period,
    limit: clampLimit(url.searchParams.get('limit')),
    start: getPeriodStart(period),
  };
};

const getPublicReadSession = (database: D1Database): Pick<D1Database, 'prepare'> => {
  const withSession = (database as D1Database & {
    withSession?: D1Database['withSession'];
  }).withSession;
  return typeof withSession === 'function'
    ? withSession.call(database, 'first-unconstrained')
    : database;
};

const getPrimaryReadSession = (database: D1Database): Pick<D1Database, 'prepare'> => {
  const withSession = (database as D1Database & {
    withSession?: D1Database['withSession'];
  }).withSession;
  return typeof withSession === 'function'
    ? withSession.call(database, 'first-primary')
    : database;
};

const queryLeaderboard = async (
  query: LeaderboardQuery,
  env: Env,
  readFromPrimary = false,
): Promise<LeaderboardSnapshot> => {
  const params: (string | number)[] = [query.gameType, query.islandRegion];
  let where = 'game_type = ? AND island_region = ?';
  if (query.start) {
    where += ' AND created_at >= ?';
    params.push(query.start);
  }

  const database = readFromPrimary
    ? getPrimaryReadSession(env.DB)
    : getPublicReadSession(env.DB);
  const result = await database.prepare(
    `
      WITH owner_ranked AS (
        SELECT
          id,
          player_name,
          score,
          game_type,
          island_region,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY owner_hash
            ORDER BY score DESC, created_at ASC
          ) AS rn
        FROM rankings
        WHERE ${where} AND owner_hash IS NOT NULL
      ),
      legacy_ranked AS (
        SELECT
          id,
          player_name,
          score,
          game_type,
          island_region,
          created_at,
          ROW_NUMBER() OVER (
            PARTITION BY lower(trim(player_name))
            ORDER BY score DESC, created_at ASC
          ) AS rn
        FROM rankings
        WHERE ${where} AND owner_hash IS NULL
      ),
      best_scores AS (
        SELECT id, player_name, score, game_type, island_region, created_at
        FROM owner_ranked
        WHERE rn = 1
        UNION ALL
        SELECT id, player_name, score, game_type, island_region, created_at
        FROM legacy_ranked
        WHERE rn = 1
      )
      SELECT id, player_name, score, game_type, island_region, created_at
      FROM best_scores
      ORDER BY score DESC, created_at ASC
      LIMIT ?
    `,
  ).bind(...params, ...params, query.limit).all<RankingRow>();

  return {
    cachedAt: Date.now(),
    entries: result.results.map(mapRanking),
    databaseRegion: typeof result.meta?.served_by_region === 'string'
      ? result.meta.served_by_region
      : undefined,
    servedByPrimary: typeof result.meta?.served_by_primary === 'boolean'
      ? result.meta.served_by_primary
      : undefined,
  };
};

const getCurrentPlayerBestEntryId = async (
  query: LeaderboardQuery,
  env: Env,
  ownerHash: string,
): Promise<string | null> => {
  const params: string[] = [query.gameType, query.islandRegion, ownerHash];
  let periodClause = '';
  if (query.start) {
    periodClause = 'AND created_at >= ?';
    params.push(query.start);
  }
  const row = await getPrimaryReadSession(env.DB).prepare(
    `
      SELECT id
      FROM rankings
      WHERE game_type = ? AND island_region = ? AND owner_hash = ? ${periodClause}
      ORDER BY score DESC, created_at ASC
      LIMIT 1
    `,
  ).bind(...params).first<{ id: string }>();
  return row?.id ?? null;
};

const personalizeSnapshot = async <T extends LeaderboardSnapshot>(
  snapshot: T,
  query: LeaderboardQuery,
  env: Env,
  ownerHash: string | null,
  required = false,
): Promise<T> => {
  if (!ownerHash) {
    return snapshot;
  }
  let currentEntryId: string | null;
  try {
    currentEntryId = await getCurrentPlayerBestEntryId(query, env, ownerHash);
  } catch (error) {
    if (required) {
      throw error;
    }
    console.warn('Serving a public leaderboard without the current-player marker.', error);
    return snapshot;
  }
  return {
    ...snapshot,
    entries: snapshot.entries.map((entry) => (
      entry.id === currentEntryId ? { ...entry, isCurrentPlayer: true } : entry
    )),
  } as T;
};

const getEdgeCache = (): Cache | null => {
  try {
    return typeof caches === 'undefined' ? null : caches.default;
  } catch {
    return null;
  }
};

const buildCacheKey = (
  requestUrl: string,
  gameType: string,
  islandRegion: string,
  period: string,
): Request => {
  const url = new URL('/__rankings-cache', requestUrl);
  url.search = '';
  url.searchParams.set('version', CACHE_VERSION);
  url.searchParams.set('gameType', gameType);
  url.searchParams.set('islandRegion', islandRegion);
  url.searchParams.set('period', period);
  return new Request(url.toString());
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
    && typeof entry.islandRegion === 'string'
    && typeof entry.createdAt === 'string'
    && entry.isCurrentPlayer === undefined;
};

const parseCachedSnapshot = async (response: Response): Promise<LeaderboardSnapshot | null> => {
  try {
    const value = await response.json() as Partial<LeaderboardSnapshot>;
    if (!Number.isFinite(value.cachedAt)
      || !Array.isArray(value.entries)
      || !value.entries.every(isRankingEntry)) {
      return null;
    }
    return {
      cachedAt: value.cachedAt as number,
      entries: value.entries,
      databaseRegion: typeof value.databaseRegion === 'string' ? value.databaseRegion : undefined,
      servedByPrimary: typeof value.servedByPrimary === 'boolean'
        ? value.servedByPrimary
        : undefined,
    };
  } catch {
    return null;
  }
};

const writeSnapshot = async (
  cache: Cache,
  key: Request,
  snapshot: LeaderboardSnapshot,
): Promise<void> => {
  try {
    await cache.put(key, new Response(JSON.stringify(snapshot), {
      headers: {
        'cache-control': `public, max-age=${CACHE_RETENTION_SECONDS}`,
        'content-type': 'application/json; charset=utf-8',
      },
    }));
  } catch (error) {
    console.warn('Failed to cache a leaderboard snapshot.', error);
  }
};

const refreshSnapshot = (
  cache: Cache,
  key: Request,
  query: LeaderboardQuery,
  env: Env,
): Promise<LeaderboardSnapshot> => {
  const cacheId = key.url;
  const current = inFlightRefreshes.get(cacheId);
  if (current) {
    return current;
  }

  const generation = cacheGenerations.get(cacheId) ?? 0;
  const refresh = queryLeaderboard(query, env).then(async (snapshot) => {
    if ((cacheGenerations.get(cacheId) ?? 0) === generation) {
      await writeSnapshot(cache, key, snapshot);
    }
    return snapshot;
  });
  inFlightRefreshes.set(cacheId, refresh);
  void refresh.finally(() => {
    if (inFlightRefreshes.get(cacheId) === refresh) {
      inFlightRefreshes.delete(cacheId);
    }
  }).catch(() => undefined);
  return refresh;
};

const canUseCache = (request: Request, query: LeaderboardQuery): boolean => {
  const cacheControl = request.headers.get('cache-control')?.toLowerCase() ?? '';
  return query.limit === DEFAULT_LIMIT
    && !cacheControl.includes('no-cache')
    && !cacheControl.includes('no-store');
};

export const fetchLeaderboard = async (
  request: Request,
  env: Env,
  context?: ExecutionContext,
): Promise<LeaderboardResult> => {
  const query = parseLeaderboardQuery(request);
  const playerToken = getBearerPlayerToken(request, false);
  const ownerHash = playerToken ? await sha256Hex(`player:${playerToken}`) : null;
  const readFromPrimary = ownerHash !== null && !canUseCache(request, query);
  const cache = getEdgeCache();
  if (!cache || !canUseCache(request, query)) {
    return personalizeSnapshot({
      ...await queryLeaderboard(query, env, readFromPrimary),
      cacheStatus: 'bypass',
    }, query, env, ownerHash, readFromPrimary);
  }

  const key = buildCacheKey(request.url, query.gameType, query.islandRegion, query.period);
  let cached: LeaderboardSnapshot | null = null;
  try {
    const response = await cache.match(key);
    cached = response ? await parseCachedSnapshot(response) : null;
    if (response && !cached) {
      await cache.delete(key);
    }
  } catch (error) {
    console.warn('Failed to read a leaderboard snapshot.', error);
  }

  if (cached && Date.now() - cached.cachedAt <= CACHE_FRESH_MS) {
    return personalizeSnapshot(
      { ...cached, cacheStatus: 'hit' },
      query,
      env,
      ownerHash,
    );
  }

  const refresh = refreshSnapshot(cache, key, query, env);
  if (cached && context) {
    context.waitUntil(refresh.catch((error) => {
      console.warn('Failed to refresh a stale leaderboard snapshot.', error);
    }));
    return personalizeSnapshot(
      { ...cached, cacheStatus: 'stale' },
      query,
      env,
      ownerHash,
    );
  }

  try {
    return personalizeSnapshot(
      { ...await refresh, cacheStatus: 'miss' },
      query,
      env,
      ownerHash,
    );
  } catch (error) {
    if (cached) {
      console.warn('Serving a stale leaderboard snapshot after a database failure.', error);
      return personalizeSnapshot(
        { ...cached, cacheStatus: 'stale' },
        query,
        env,
        ownerHash,
      );
    }
    throw error;
  }
};

const invalidateKeys = async (cache: Cache, keys: Request[]): Promise<void> => {
  await Promise.all(keys.map(async (key) => {
    const cacheId = key.url;
    cacheGenerations.set(cacheId, (cacheGenerations.get(cacheId) ?? 0) + 1);
    inFlightRefreshes.delete(cacheId);
    try {
      await cache.delete(key);
    } catch (error) {
      console.warn('Failed to invalidate a leaderboard snapshot.', error);
    }
  }));
};

export const invalidateLeaderboardScope = async (
  requestUrl: string,
  gameType: string,
  islandRegion: string,
): Promise<void> => {
  const cache = getEdgeCache();
  if (!cache) {
    return;
  }
  await invalidateKeys(
    cache,
    RANKING_PERIODS.map((period) => buildCacheKey(requestUrl, gameType, islandRegion, period)),
  );
};

export const invalidateAllLeaderboards = async (requestUrl: string): Promise<void> => {
  const cache = getEdgeCache();
  if (!cache) {
    return;
  }
  const scopes = [
    ...['strawberry_rush', 'flag_rush', 'color_rush'].map((gameType) => ({
      gameType,
      islandRegion: 'all',
    })),
    ...ISLAND_REGIONS.map((islandRegion) => ({ gameType: 'island_rush', islandRegion })),
  ];
  await invalidateKeys(cache, scopes.flatMap(({ gameType, islandRegion }) => (
    RANKING_PERIODS.map((period) => buildCacheKey(requestUrl, gameType, islandRegion, period))
  )));
};
