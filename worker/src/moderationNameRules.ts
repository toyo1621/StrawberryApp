import { HttpError, readJsonBody } from './http';
import { requireModerator } from './moderationAdmin';
import { normalizeNamePolicyValue } from './namePolicy';
import type { Env } from './types';

export const manageNameRules = async (request: Request, env: Env) => {
  await requireModerator(request, env);
  if (request.method === 'POST') {
    const body = await readJsonBody(request);
    if (typeof body?.term !== 'string' || [...body.term].length > 48
      || !['exact', 'contains'].includes(String(body.matchType))) {throw new HttpError(400, 'A term and exact/contains match type are required.');}
    const term = normalizeNamePolicyValue(body.term);
    if ([...term].length < (body.matchType === 'contains' ? 2 : 1) || [...term].length > 12
      || /[<>\p{C}]/u.test(term)) {throw new HttpError(400, 'The normalized NG term is invalid.');}
    const result = await env.DB.prepare(
      `INSERT INTO moderation_name_rules (id, term, match_type, created_at)
       SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM moderation_name_rules) < 100
       ON CONFLICT(term, match_type) DO NOTHING`,
    ).bind(crypto.randomUUID(), term, body.matchType, new Date().toISOString()).run();
    if (!result.meta.changes && !await env.DB.prepare('SELECT id FROM moderation_name_rules WHERE term = ? AND match_type = ?').bind(term, body.matchType).first()) {
      throw new HttpError(409, 'NG rules are limited to 100 entries.');
    }
  } else if (request.method === 'DELETE') {
    const body = await readJsonBody(request);
    if (typeof body?.ruleId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.ruleId)) {throw new HttpError(400, 'A rule ID is required.');}
    await env.DB.prepare('DELETE FROM moderation_name_rules WHERE id = ?').bind(body.ruleId).run();
  }
  return (await env.DB.prepare('SELECT id, term, match_type AS matchType, created_at AS createdAt FROM moderation_name_rules ORDER BY created_at ASC LIMIT 100').all()).results;
};
