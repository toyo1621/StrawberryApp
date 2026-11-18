import { HttpError } from './http';
import type { Env, RankingEntry } from './types';
import { maskInappropriateNames } from './nameModeration';

export const SUBJECT_SQL = "CASE WHEN rankings.owner_hash IS NULL THEN 'legacy:' || rankings.id ELSE 'owner:' || rankings.owner_hash END";
export const PUBLIC_VISIBILITY_SQL = `NOT EXISTS (SELECT 1 FROM moderated_subjects WHERE subject_key = ${SUBJECT_SQL})`;
export const BLOCK_VISIBILITY_SQL = `NOT EXISTS (SELECT 1 FROM player_blocks WHERE blocker_hash = ? AND subject_key = ${SUBJECT_SQL})`;

export const requirePublishablePlayer = async (env: Env, ownerHash: string): Promise<void> => {
  const hidden = await env.DB.prepare(
    'SELECT id FROM moderated_subjects WHERE subject_key = ?',
  ).bind(`owner:${ownerHash}`).first<{ id: string }>();
  if (hidden) {
    throw new HttpError(403, `公開ランキングへの投稿が制限されています。お問い合わせ番号: ${hidden.id}`, 'PLAYER_RESTRICTED');
  }
};

export const filterModeratedSnapshot = async (
  env: Env,
  entries: RankingEntry[],
): Promise<RankingEntry[]> => {
  if (entries.length === 0) {return entries;}
  // Cache deletion is local to a Cloudflare location; visibility must not rely on it.
  const result = await env.DB.prepare(
    `SELECT id FROM rankings WHERE id IN (${entries.map(() => '?').join(',')}) AND ${PUBLIC_VISIBILITY_SQL}`,
  ).bind(...entries.map((entry) => entry.id)).all<{ id: string }>();
  const visible = new Set(result.results.map((row) => row.id));
  return maskInappropriateNames(env, entries.filter((entry) => visible.has(entry.id)));
};

export const cleanupModerationData = async (env: Env, now = new Date()): Promise<void> => {
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM ranking_reports WHERE created_at < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM moderation_events WHERE created_at < ?').bind(cutoff),
  ]);
};
