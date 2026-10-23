import { HttpError, readJsonBody } from './http';
import { sha256Hex } from './identity';
import { invalidateAllLeaderboards } from './leaderboards';
import type { Env } from './types';

export const requireModerator = async (request: Request, env: Env): Promise<void> => {
  // The operator CLI is not a browser endpoint, even for an allowed application origin.
  if (request.headers.has('origin')) {throw new HttpError(403, 'Browser administration is not allowed.');}
  const secret = env.MODERATION_ADMIN_TOKEN;
  if (!secret || secret.length < 32 || secret.length > 256) {throw new HttpError(503, 'Moderation administration is not configured.');}
  const provided = request.headers.get('authorization')?.match(/^Bearer (.{32,256})$/)?.[1] ?? '';
  const [expectedHash, providedHash] = await Promise.all([sha256Hex(secret), sha256Hex(provided)]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= expectedHash.charCodeAt(index) ^ providedHash.charCodeAt(index);
  }
  if (difference !== 0) {throw new HttpError(403, 'Moderator authentication failed.');}
};

export const listModerationReports = async (request: Request, env: Env) => {
  await requireModerator(request, env);
  const status = new URL(request.url).searchParams.get('status') || 'open';
  if (!['open', 'hidden', 'dismissed', 'restored'].includes(status)) {throw new HttpError(400, 'Invalid report status.');}
  const result = await env.DB.prepare(
    `SELECT id, ranking_id AS rankingId, name_snapshot AS playerName, reason, status,
     created_at AS createdAt, reviewed_at AS reviewedAt
     FROM ranking_reports WHERE status = ? ORDER BY created_at ASC LIMIT 100`,
  ).bind(status).all();
  return result.results;
};

export const reviewModerationReport = async (request: Request, env: Env) => {
  await requireModerator(request, env);
  const body = await readJsonBody(request);
  const enforcementId = body?.enforcementId;
  const referenceId = enforcementId ?? body?.reportId;
  const decision = String(body?.decision);
  if (typeof referenceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(referenceId)
    || (enforcementId !== undefined && (body?.reportId !== undefined || decision !== 'restore'))
    || !['hide', 'dismiss', 'restore'].includes(decision)) {
    throw new HttpError(400, 'A report ID and a supported decision are required.');
  }
  const report = await env.DB.prepare(enforcementId
    ? 'SELECT subject_key FROM moderated_subjects WHERE id = ?'
    : 'SELECT subject_key FROM ranking_reports WHERE id = ?')
    .bind(referenceId).first<{ subject_key: string }>();
  if (!report) {throw new HttpError(404, 'Report not found.');}
  const now = new Date().toISOString();
  const status = decision === 'hide' ? 'hidden' : decision === 'restore' ? 'restored' : 'dismissed';
  const statements = [
    env.DB.prepare(decision === 'dismiss'
      ? 'UPDATE ranking_reports SET status = ?, reviewed_at = ? WHERE id = ?'
      : 'UPDATE ranking_reports SET status = ?, reviewed_at = ? WHERE subject_key = ?')
      .bind(status, now, decision === 'dismiss' ? referenceId : report.subject_key),
    env.DB.prepare('INSERT INTO moderation_events (id, report_id, decision, created_at) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), referenceId, decision, now),
  ];
  if (decision === 'hide') {
    statements.push(env.DB.prepare('INSERT INTO moderated_subjects (subject_key, id, created_at) VALUES (?, ?, ?) ON CONFLICT(subject_key) DO NOTHING')
      .bind(report.subject_key, crypto.randomUUID(), now));
  } else if (decision === 'restore') {
    statements.push(env.DB.prepare('DELETE FROM moderated_subjects WHERE subject_key = ?').bind(report.subject_key));
  }
  await env.DB.batch(statements);
  await invalidateAllLeaderboards(request.url);
  return { reviewed: true, status };
};

export const listModerationRestrictions = async (request: Request, env: Env) => {
  await requireModerator(request, env);
  const result = await env.DB.prepare('SELECT id, created_at AS createdAt FROM moderated_subjects ORDER BY created_at ASC LIMIT 100').all();
  return result.results;
};
