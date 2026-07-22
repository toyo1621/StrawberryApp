import { cleanupRateLimitBuckets } from './identity';
import { RANKINGS_API_VERSION } from './generated/rankingContract';
import {
  getReleaseId,
  getRequestId,
  HttpError,
  isAllowedOrigin,
  json,
  requireAllowedBrowserOrigin,
  setCorsHeaders,
  setSecurityHeaders,
} from './http';
import {
  fetchLeaderboard,
  invalidateAllLeaderboards,
  invalidateLeaderboardScope,
} from './leaderboards';
import {
  deletePlayerScores,
  getPlayerBestScore,
  getPlayerHistory,
} from './playerRankings';
import {
  getProductionMonitorStatus,
  runProductionMonitor,
} from './productionMonitor';
import { ValidationError } from './rankingValidation';
import {
  cleanupExpiredGameSessions,
  createGameSession,
  saveScore,
} from './scoreSubmissions';
import type { Env } from './types';

const ALLOWED_METHODS_BY_PATH = new Map<string, string[]>([
  ['/health', ['GET']],
  ['/game-sessions', ['POST']],
  ['/rankings', ['GET']],
  ['/scores', ['POST']],
  ['/players/me/best', ['GET']],
  ['/players/me/history', ['GET']],
  ['/players/me/scores', ['DELETE']],
]);

export type { Env } from './types';

const noStoreHeaders = (requestId: string): HeadersInit => ({
  'cache-control': 'no-store',
  'x-request-id': requestId,
});

const runAfterResponse = async (
  context: ExecutionContext | undefined,
  operation: Promise<void>,
  failureMessage: string,
): Promise<void> => {
  const guarded = operation.catch((error) => {
    console.warn(failureMessage, error);
  });
  if (context) {
    context.waitUntil(guarded);
    return;
  }
  await guarded;
};

const handleOptions = (
  request: Request,
  origin: string | undefined,
  env: Env,
  requestId: string,
): Response => {
  const path = new URL(request.url).pathname;
  const allowedMethods = ALLOWED_METHODS_BY_PATH.get(path);
  if (!allowedMethods) {
    return json(
      { error: 'Not found' },
      { status: 404, headers: noStoreHeaders(requestId) },
      origin,
      env,
    );
  }
  if (origin && !isAllowedOrigin(origin, env)) {
    return json(
      { error: 'Origin is not allowed.' },
      { status: 403, headers: noStoreHeaders(requestId) },
      origin,
      env,
    );
  }
  const requestedMethod = request.headers.get('access-control-request-method')?.toUpperCase();
  if (requestedMethod && !allowedMethods.includes(requestedMethod)) {
    return json(
      { error: 'Method not allowed' },
      {
        status: 405,
        headers: { ...noStoreHeaders(requestId), allow: [...allowedMethods, 'OPTIONS'].join(', ') },
      },
      origin,
      env,
    );
  }
  const headers = new Headers();
  setCorsHeaders(headers, origin, env);
  setSecurityHeaders(headers);
  headers.set('allow', [...allowedMethods, 'OPTIONS'].join(', '));
  headers.set('x-api-version', String(RANKINGS_API_VERSION));
  headers.set('x-release-id', getReleaseId(env));
  headers.set('x-request-id', requestId);
  return new Response(null, { status: 204, headers });
};

const routeRequest = async (
  request: Request,
  env: Env,
  context: ExecutionContext | undefined,
  origin: string | undefined,
  requestId: string,
): Promise<Response> => {
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;

  switch (route) {
    case 'GET /health': {
      const [health, monitor] = await Promise.all([
        env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>(),
        getProductionMonitorStatus(env),
      ]);
      if (health?.ok !== 1) {
        throw new Error('Database health check failed.');
      }
      return json({
        ok: true,
        service: 'strawberry-rankings-api',
        version: RANKINGS_API_VERSION,
        release: getReleaseId(env),
        monitor: monitor ? {
          status: monitor.status,
          checkedAt: monitor.checkedAt,
          latencyMs: monitor.latencyMs,
        } : null,
      }, { headers: noStoreHeaders(requestId) }, origin, env);
    }

    case 'POST /game-sessions':
      return json(
        await createGameSession(request, env, origin),
        { status: 201, headers: noStoreHeaders(requestId) },
        origin,
        env,
      );

    case 'GET /rankings': {
      const result = await fetchLeaderboard(request, env, context);
      const cacheControl = request.headers.has('authorization')
        ? 'private, no-store'
        : result.cacheStatus === 'stale'
          ? 'public, max-age=5, stale-if-error=300'
          : 'public, max-age=30, stale-while-revalidate=120, stale-if-error=300';
      return json(result.entries, {
        headers: {
          'cache-control': cacheControl,
          'vary': 'Authorization',
          'x-d1-primary': result.servedByPrimary === undefined
            ? 'unknown'
            : String(result.servedByPrimary),
          'x-d1-region': result.databaseRegion ?? 'unknown',
          'x-rankings-cache': result.cacheStatus,
          'x-request-id': requestId,
        },
      }, origin, env);
    }

    case 'POST /scores': {
      const result = await saveScore(request, env, origin);
      if (result.created) {
        await runAfterResponse(
          context,
          invalidateLeaderboardScope(request.url, result.entry.gameType, result.entry.islandRegion),
          'Failed to schedule leaderboard cache invalidation.',
        );
      }
      return json(result.entry, {
        status: result.created ? 201 : 200,
        headers: noStoreHeaders(requestId),
      }, origin, env);
    }

    case 'GET /players/me/best':
      return json(
        await getPlayerBestScore(request, env),
        { headers: noStoreHeaders(requestId) },
        origin,
        env,
      );

    case 'GET /players/me/history':
      return json(
        await getPlayerHistory(request, env),
        { headers: noStoreHeaders(requestId) },
        origin,
        env,
      );

    case 'DELETE /players/me/scores': {
      requireAllowedBrowserOrigin(origin, env);
      const result = await deletePlayerScores(request, env);
      if (result.deleted > 0) {
        await runAfterResponse(
          context,
          invalidateAllLeaderboards(request.url),
          'Failed to schedule complete leaderboard cache invalidation.',
        );
      }
      return json(result, { headers: noStoreHeaders(requestId) }, origin, env);
    }

    default:
      if (ALLOWED_METHODS_BY_PATH.has(url.pathname)) {
        const allowedMethods = ALLOWED_METHODS_BY_PATH.get(url.pathname) ?? [];
        return json(
          { error: 'Method not allowed' },
          {
            status: 405,
            headers: {
              ...noStoreHeaders(requestId),
              allow: [...allowedMethods, 'OPTIONS'].join(', '),
            },
          },
          origin,
          env,
        );
      }
      return json(
        { error: 'Not found' },
        { status: 404, headers: noStoreHeaders(requestId) },
        origin,
        env,
      );
  }
};

export default {
  async fetch(
    request: Request,
    env: Env,
    context?: ExecutionContext,
  ): Promise<Response> {
    const origin = request.headers.get('origin') ?? undefined;
    const requestId = getRequestId(request);

    if (request.method === 'OPTIONS') {
      return handleOptions(request, origin, env, requestId);
    }

    const url = new URL(request.url);
    try {
      return await routeRequest(request, env, context, origin, requestId);
    } catch (error) {
      const status = error instanceof HttpError || error instanceof ValidationError
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
      const headers = new Headers(noStoreHeaders(requestId));
      if (status === 429) {
        headers.set('retry-after', '60');
      } else if (status === 503) {
        headers.set('retry-after', '5');
      }
      return json(
        { error: message, requestId },
        { status, headers },
        origin,
        env,
      );
    }
  },

  async scheduled(_controller: unknown, env: Env): Promise<void> {
    await Promise.all([
      cleanupRateLimitBuckets(env),
      cleanupExpiredGameSessions(env),
      runProductionMonitor(env),
    ]);
  },
};
