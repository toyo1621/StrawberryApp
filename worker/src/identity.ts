import { validatePlayerToken } from './rankingValidation';
import { HttpError } from './http';
import type { Env } from './types';

const SCORE_SUBMISSION_LIMIT = 8;
const SCORE_SUBMISSION_WINDOW_MS = 60 * 1000;
const SCORE_SUBMISSION_RETENTION_MS = 15 * 60 * 1000;

export const sha256Hex = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const getBearerPlayerToken = (
  request: Request,
  required = true,
): string | null => {
  const authorization = request.headers.get('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!authorization && !required) {
    return null;
  }
  return validatePlayerToken(match?.[1]);
};

export const getPlayerOwnerHash = async (request: Request): Promise<string> => {
  const playerToken = getBearerPlayerToken(request);
  return sha256Hex(`player:${playerToken}`);
};

const getClientIdentityHash = async (request: Request, env: Env): Promise<string> => {
  const ip = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown-ip';
  const userAgent = request.headers.get('user-agent') ?? 'unknown-agent';
  const salt = env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 16) {
    throw new HttpError(503, 'Score submissions are temporarily unavailable.');
  }

  return sha256Hex(`${salt}:${ip}:${userAgent}`);
};

export const enforceScoreSubmissionRateLimit = async (
  request: Request,
  env: Env,
): Promise<void> => {
  const identityHash = await getClientIdentityHash(request, env);
  const now = Date.now();
  const windowStart = Math.floor(now / SCORE_SUBMISSION_WINDOW_MS) * SCORE_SUBMISSION_WINDOW_MS;
  const expiresAt = new Date(now + SCORE_SUBMISSION_RETENTION_MS).toISOString();
  const result = await env.DB.prepare(
    `
      INSERT INTO score_submission_buckets (identity_hash, window_start, submission_count, expires_at)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(identity_hash, window_start) DO UPDATE SET
        submission_count = submission_count + 1,
        expires_at = excluded.expires_at
      WHERE submission_count < ?
    `,
  ).bind(identityHash, windowStart, expiresAt, SCORE_SUBMISSION_LIMIT).run();

  if ((result.meta.changes ?? 0) === 0) {
    throw new HttpError(429, 'Too many score submissions. Please wait a moment and try again.');
  }
};

export const cleanupRateLimitBuckets = async (
  env: Env,
  now: Date = new Date(),
): Promise<void> => {
  await env.DB.prepare(
    `
      DELETE FROM score_submission_buckets
      WHERE expires_at < ?
    `,
  ).bind(now.toISOString()).run();
};
