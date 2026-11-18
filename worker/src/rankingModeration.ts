import { enforceScoreSubmissionRateLimit, getPlayerOwnerHash } from './identity';
import { HttpError, readJsonBody, requireAllowedBrowserOrigin } from './http';
import { SUBJECT_SQL } from './moderationStore';
import { maskInappropriateNames } from './nameModeration';
import type { Env } from './types';

const REASONS = new Set(['offensive', 'personal_information', 'impersonation', 'other']);
const MAX_BLOCKS = 200;

const findSubject = async (env: Env, rankingId: unknown, ownerHash: string) => {
  if (typeof rankingId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(rankingId)) {
    throw new HttpError(400, 'A valid ranking ID is required.');
  }
  const row = await env.DB.prepare(
    `SELECT id, player_name, owner_hash, ${SUBJECT_SQL} AS subject_key FROM rankings WHERE id = ?`,
  ).bind(rankingId).first<{ id: string; player_name: string; owner_hash: string | null; subject_key: string }>();
  if (!row) {throw new HttpError(404, 'Ranking not found.');}
  if (row.owner_hash === ownerHash) {throw new HttpError(400, 'Your own ranking cannot be reported or blocked.');}
  return row;
};

export const reportRanking = async (request: Request, env: Env, origin?: string) => {
  requireAllowedBrowserOrigin(origin, env);
  const ownerHash = await getPlayerOwnerHash(request);
  const body = await readJsonBody(request);
  if (typeof body?.reason !== 'string' || !REASONS.has(body.reason)) {
    throw new HttpError(400, 'A supported report reason is required.');
  }
  const subject = await findSubject(env, body.rankingId, ownerHash);
  const existing = await env.DB.prepare(
    'SELECT id FROM ranking_reports WHERE reporter_hash = ? AND ranking_id = ?',
  ).bind(ownerHash, subject.id).first<{ id: string }>();
  if (existing) {return { id: existing.id, status: 'received' };}
  await enforceScoreSubmissionRateLimit(request, env, 'moderation');
  const id = crypto.randomUUID();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO ranking_reports (id, reporter_hash, ranking_id, subject_key, name_snapshot, reason, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ? WHERE
       (SELECT COUNT(*) FROM ranking_reports WHERE reporter_hash = ? AND created_at >= ?) < 20
     ON CONFLICT(reporter_hash, ranking_id) DO NOTHING`,
  ).bind(id, ownerHash, subject.id, subject.subject_key, subject.player_name, body.reason, new Date().toISOString(), ownerHash, since).run();
  const saved = await env.DB.prepare(
    'SELECT id FROM ranking_reports WHERE reporter_hash = ? AND ranking_id = ?',
  ).bind(ownerHash, subject.id).first<{ id: string }>();
  if (!saved) {throw new HttpError(429, '通報は1日20件までです。時間をおいてお試しください。');}
  return { id: saved.id, status: 'received' };
};

export const listPlayerBlocks = async (request: Request, env: Env) => {
  const ownerHash = await getPlayerOwnerHash(request);
  const result = await env.DB.prepare(
    `SELECT id, ranking_id AS rankingId, name_snapshot AS playerName, created_at AS createdAt
     FROM player_blocks WHERE blocker_hash = ? ORDER BY created_at DESC LIMIT ?`,
  ).bind(ownerHash, MAX_BLOCKS).all<{ id: string; rankingId: string; playerName: string; createdAt: string }>();
  return maskInappropriateNames(env, result.results);
};

export const blockPlayer = async (request: Request, env: Env, origin?: string) => {
  requireAllowedBrowserOrigin(origin, env);
  const ownerHash = await getPlayerOwnerHash(request);
  const body = await readJsonBody(request);
  const subject = await findSubject(env, body?.rankingId, ownerHash);
  await enforceScoreSubmissionRateLimit(request, env, 'moderation');
  const result = await env.DB.prepare(
    `INSERT INTO player_blocks (id, blocker_hash, subject_key, ranking_id, name_snapshot, created_at)
     SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM player_blocks WHERE blocker_hash = ?) < ?
     ON CONFLICT(blocker_hash, subject_key) DO NOTHING`,
  ).bind(crypto.randomUUID(), ownerHash, subject.subject_key, subject.id, subject.player_name, new Date().toISOString(), ownerHash, MAX_BLOCKS).run();
  if (!result.meta.changes) {
    const existing = await env.DB.prepare(
      'SELECT id FROM player_blocks WHERE blocker_hash = ? AND subject_key = ?',
    ).bind(ownerHash, subject.subject_key).first();
    if (!existing) {throw new HttpError(409, 'ブロックは200件までです。設定から解除してください。');}
  }
  return listPlayerBlocks(request, env);
};

export const unblockPlayer = async (request: Request, env: Env, origin?: string) => {
  requireAllowedBrowserOrigin(origin, env);
  const ownerHash = await getPlayerOwnerHash(request);
  const body = await readJsonBody(request);
  if (typeof body?.blockId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.blockId)) {
    throw new HttpError(400, 'A valid block ID is required.');
  }
  await env.DB.prepare('DELETE FROM player_blocks WHERE id = ? AND blocker_hash = ?').bind(body.blockId, ownerHash).run();
  return listPlayerBlocks(request, env);
};
