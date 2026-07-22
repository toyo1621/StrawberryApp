import { getPlayerOwnerHash } from './identity';
import { parseGameType } from './rankingValidation';
import type { Env, RankingEntry, RankingRow } from './types';
import { mapRanking } from './types';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const clampLimit = (value: string | null): number => {
  const parsed = Number(value ?? DEFAULT_LIMIT);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const getPrimaryReadSession = (database: D1Database): Pick<D1Database, 'prepare'> => {
  const withSession = (database as D1Database & {
    withSession?: D1Database['withSession'];
  }).withSession;
  return typeof withSession === 'function'
    ? withSession.call(database, 'first-primary')
    : database;
};

export const getPlayerBestScore = async (
  request: Request,
  env: Env,
): Promise<{ score: number }> => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const ownerHash = await getPlayerOwnerHash(request);
  const database = getPrimaryReadSession(env.DB);

  const row = await database.prepare(
    `
      SELECT score
      FROM rankings
      WHERE game_type = ? AND owner_hash = ?
      ORDER BY score DESC, created_at ASC
      LIMIT 1
    `,
  ).bind(gameType, ownerHash).first<{ score: number }>();

  return { score: row?.score ?? 0 };
};

export const getPlayerHistory = async (
  request: Request,
  env: Env,
): Promise<RankingEntry[]> => {
  const url = new URL(request.url);
  const gameType = parseGameType(url.searchParams.get('gameType'));
  const limit = clampLimit(url.searchParams.get('limit'));
  const ownerHash = await getPlayerOwnerHash(request);
  const database = getPrimaryReadSession(env.DB);

  const { results } = await database.prepare(
    `
      SELECT id, player_name, score, game_type, island_region, created_at
      FROM rankings
      WHERE game_type = ? AND owner_hash = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
  ).bind(gameType, ownerHash, limit).all<RankingRow>();

  return results.map(mapRanking);
};

export const deletePlayerScores = async (
  request: Request,
  env: Env,
): Promise<{ deleted: number }> => {
  const ownerHash = await getPlayerOwnerHash(request);
  const result = await env.DB.prepare(
    'DELETE FROM rankings WHERE owner_hash = ?',
  ).bind(ownerHash).run();
  return { deleted: result.meta.changes ?? 0 };
};
