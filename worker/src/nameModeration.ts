import { HttpError } from './http';
import { isClearlyInappropriateName, normalizeNamePolicyValue } from './namePolicy';
import type { Env } from './types';

type NameRule = { term: string; match_type: 'exact' | 'contains' };
const loadRules = async (env: Env): Promise<NameRule[]> => (
  await env.DB.prepare('SELECT term, match_type FROM moderation_name_rules LIMIT 100').all<NameRule>()
).results;
const isDisallowed = (name: string, rules: NameRule[]): boolean => {
  const normalized = normalizeNamePolicyValue(name);
  return isClearlyInappropriateName(name) || rules.some((rule) => rule.match_type === 'exact'
    ? normalized === rule.term : normalized.includes(rule.term));
};
export const requireAllowedRankingName = async (env: Env, name: string): Promise<void> => {
  if (isDisallowed(name, await loadRules(env))) {
    throw new HttpError(400, '公開ランキングに使用できない名前です。別の名前に変更してください。', 'NAME_NOT_ALLOWED');
  }
};
export const maskInappropriateNames = async <T extends { playerName: string }>(env: Env, entries: T[]): Promise<T[]> => {
  if (entries.length === 0) {return entries;}
  const rules = await loadRules(env);
  return entries.map((entry) => isDisallowed(entry.playerName, rules) ? { ...entry, playerName: '非公開の名前' } : entry);
};
