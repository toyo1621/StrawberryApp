import { cleanupRateLimitBuckets } from './identity';
import {
  getReleaseId,
  HttpError,
  isAllowedOrigin,
  json,
  requireAllowedBrowserOrigin,
  setCorsHeaders,
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
import { ValidationError } from './rankingValidation';
import {
  cleanupExpiredGameSessions,
  createGameSession,
  saveScore,
} from './scoreSubmissions';
import type { Env } from './types';

export type { Env } from './types';
export { cleanupRateLimitBuckets } from './identity';
export { getPeriodStart } from './leaderboards';
export { cleanupExpiredGameSessions } from './scoreSubmissions';

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
  origin: string | undefined,
  env: Env,
  requestId: string,
): Response => {
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
      const health = await env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
      if (health?.ok !== 1) {
        throw new Error('Database health check failed.');
      }
      return json({
        ok: true,
        service: 'strawberry-rankings-api',
        version: 4,
        release: getReleaseId(env),
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
      const cacheControl = result.cacheStatus === 'stale'
        ? 'public, max-age=5, stale-if-error=300'
        : 'public, max-age=30, stale-while-revalidate=120, stale-if-error=300';
      return json(result.entries, {
        headers: {
          'cache-control': cacheControl,
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
    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

    if (request.method === 'OPTIONS') {
      return handleOptions(origin, env, requestId);
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
    ]);
  },
};
