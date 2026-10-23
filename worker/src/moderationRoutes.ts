import { json } from './http';
import { listModerationReports, listModerationRestrictions, reviewModerationReport } from './moderationAdmin';
import { blockPlayer, listPlayerBlocks, reportRanking, unblockPlayer } from './rankingModeration';
import type { Env } from './types';
import { manageNameRules } from './moderationNameRules';

export const MODERATION_METHODS: [string, string[]][] = [
  ['/ranking-reports', ['POST']],
  ['/players/me/blocks', ['GET', 'POST', 'DELETE']],
  ['/moderation/reports', ['GET', 'POST']],
  ['/moderation/restrictions', ['GET']],
  ['/moderation/name-rules', ['GET', 'POST', 'DELETE']],
];

export const routeModeration = async (request: Request, env: Env, origin: string | undefined, requestId: string): Promise<Response | null> => {
  const route = `${request.method} ${new URL(request.url).pathname}`;
  const operation = route === 'POST /ranking-reports' ? () => reportRanking(request, env, origin)
    : route === 'GET /players/me/blocks' ? () => listPlayerBlocks(request, env)
      : route === 'POST /players/me/blocks' ? () => blockPlayer(request, env, origin)
        : route === 'DELETE /players/me/blocks' ? () => unblockPlayer(request, env, origin)
          : route === 'GET /moderation/reports' ? () => listModerationReports(request, env)
            : route === 'POST /moderation/reports' ? () => reviewModerationReport(request, env)
              : route === 'GET /moderation/restrictions' ? () => listModerationRestrictions(request, env)
                : ['GET /moderation/name-rules', 'POST /moderation/name-rules', 'DELETE /moderation/name-rules'].includes(route)
                  ? () => manageNameRules(request, env) : null;
  return operation ? json(await operation(), {
    headers: { 'cache-control': 'private, no-store', 'x-request-id': requestId, vary: 'Authorization' },
  }, origin, env) : null;
};
