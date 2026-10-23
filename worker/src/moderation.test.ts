import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import test from 'node:test';
import worker, { type Env } from './index.js';
import { sha256Hex } from './identity.js';
import { cleanupModerationData } from './moderationStore.js';
import { isClearlyInappropriateName } from './namePolicy.js';
import { validateScoreSubmission } from './rankingValidation.js';

const VIEWER = '11111111-1111-4111-8111-111111111111';
const AUTHOR = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const ADMIN = 'moderator-test-secret-with-more-than-32-characters';

const harness = async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('worker/schema.sql', 'utf8'));
  const prepare = (sql: string) => {
    let values: SQLInputValue[] = [];
    const statement = {
      bind(...params: SQLInputValue[]) {values = params; return statement;},
      async first() {return sqlite.prepare(sql).get(...values) ?? null;},
      async all() {return { results: sqlite.prepare(sql).all(...values), meta: {} };},
      async run() {return { meta: { changes: Number(sqlite.prepare(sql).run(...values).changes) } };},
    };
    return statement;
  };
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec('BEGIN');
    try {const results = []; for (const statement of statements) {results.push(await statement.run());} sqlite.exec('COMMIT'); return results;}
    catch (error) {sqlite.exec('ROLLBACK'); throw error;}
  } };
  const env: Env = { DB: db as unknown as D1Database, RATE_LIMIT_SALT: 'moderation-network-test-salt', MODERATION_ADMIN_TOKEN: ADMIN };
  const hashes = await Promise.all([VIEWER, AUTHOR, OTHER].map((token) => sha256Hex(`player:${token}`)));
  const seed = (id: string, ownerHash: string | null, name = '同名の選手', gameType = 'strawberry_rush', score = 10) => {
    sqlite.prepare('INSERT INTO rankings (id, player_name, score, game_type, island_region, created_at, owner_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, score, gameType, 'all', new Date().toISOString(), ownerHash);
  };
  seed('author-score', hashes[1]); seed('other-score', hashes[2]); seed('my-score', hashes[0], '本人');
  const request = async (path: string, method = 'GET', body?: unknown, token: string | null = VIEWER, origin?: string) => {
    const headers = new Headers();
    if (token) {headers.set('authorization', `Bearer ${token}`);}
    if (origin) {headers.set('origin', origin);}
    if (body !== undefined) {headers.set('content-type', 'application/json');}
    return worker.fetch(new Request(`https://api.test${path}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), env);
  };
  const ids = async (token: string | null = VIEWER, query = '') => {
    const response = await request(`/rankings?gameType=strawberry_rush${query}`, 'GET', undefined, token);
    assert.equal(response.status, 200);
    return (await response.json() as { id: string }[]).map((entry) => entry.id);
  };
  return { sqlite, env, hashes, seed, request, ids };
};

test('reports are private, idempotent, bounded, and never automatically hide a player', async () => {
  const { request, ids, sqlite } = await harness();
  const body = { rankingId: 'author-score', reason: 'offensive' };
  const first = await request('/ranking-reports', 'POST', body);
  assert.equal(first.status, 200);
  const receipt = await first.json() as { id: string; status: string };
  assert.equal(receipt.status, 'received');
  const repeated = await request('/ranking-reports', 'POST', body);
  assert.deepEqual(await repeated.json(), receipt);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM ranking_reports').get()?.count, 1);
  assert.equal((await ids()).includes('author-score'), true);
  assert.equal((await request('/moderation/reports')).status, 403);
  const queue = await request('/moderation/reports', 'GET', undefined, ADMIN);
  const reports = await queue.json() as Record<string, unknown>[];
  assert.equal(reports[0].playerName, '同名の選手');
  assert.equal('reporter_hash' in reports[0], false);
  assert.equal('subject_key' in reports[0], false);
  assert.equal(queue.headers.get('cache-control'), 'private, no-store');
  for (const [body, status] of [
    [{ rankingId: 'my-score', reason: 'other' }, 400],
    [{ rankingId: 'missing', reason: 'other' }, 404],
    [{ rankingId: '<script>', reason: 'other' }, 400],
    [{ rankingId: 'author-score', reason: 'unsupported' }, 400],
    [null, 400],
  ] as const) {assert.equal((await request('/ranking-reports', 'POST', body)).status, status);}
  assert.equal((await request('/ranking-reports', 'POST', body, null)).status, 401);
  assert.equal((await request('/ranking-reports', 'POST', body, VIEWER, 'https://evil.test')).status, 403);
});

test('blocking is owner-based across names, modes, and periods, but never affects namesakes or other viewers', async () => {
  const { request, ids, seed, hashes } = await harness();
  seed('author-renamed', hashes[1], '改名後', 'color_rush');
  const before = await (await request('/rankings')).json() as { id: string; publicRank: number }[];
  const response = await request('/players/me/blocks', 'POST', { rankingId: 'author-score' });
  assert.equal(response.status, 200);
  const blocks = await response.json() as { id: string; rankingId: string }[];
  assert.equal(blocks.length, 1);
  assert.equal(JSON.stringify(blocks).includes(hashes[1]), false);
  assert.equal((await request('/players/me/blocks', 'POST', { rankingId: 'author-score' })).status, 200);
  assert.equal((await ids()).includes('author-score'), false);
  assert.equal((await ids()).includes('other-score'), true);
  const after = await (await request('/rankings')).json() as { id: string; publicRank: number }[];
  assert.equal(after.find((entry) => entry.id === 'other-score')?.publicRank, before.find((entry) => entry.id === 'other-score')?.publicRank);
  assert.equal((await ids(null)).includes('author-score'), true);
  assert.equal((await ids(OTHER)).includes('author-score'), true);
  for (const period of ['all', 'daily', 'weekly', 'monthly']) {
    assert.equal((await ids(VIEWER, `&period=${period}&limit=1`)).includes('author-score'), false);
  }
  const color = await request('/rankings?gameType=color_rush');
  assert.deepEqual(await color.json(), []);
  assert.equal((await request('/players/me/blocks', 'DELETE', { blockId: blocks[0].id }, OTHER)).status, 200);
  assert.equal((await ids()).includes('author-score'), false);
  assert.equal((await request('/players/me/blocks', 'DELETE', { blockId: blocks[0].id })).status, 200);
  assert.equal((await ids()).includes('author-score'), true);
  assert.equal((await request('/players/me/blocks', 'DELETE', { blockId: 'invalid' })).status, 400);
  assert.equal((await request('/players/me/blocks', 'POST', { rankingId: 'my-score' })).status, 400);
  assert.equal((await request('/players/me/blocks', 'GET', undefined, 'invalid-token')).status, 401);
});

test('legacy blocks affect a record only, and deleted target records remain unblockable by block ID', async () => {
  const { request, seed, ids, sqlite } = await harness();
  seed('legacy-a', null, '昔の選手', 'strawberry_rush', 12);
  seed('legacy-b', null, '別の昔の選手', 'strawberry_rush', 11);
  const blocks = await (await request('/players/me/blocks', 'POST', { rankingId: 'legacy-a' })).json() as { id: string }[];
  assert.equal((await ids()).includes('legacy-a'), false);
  assert.equal((await ids()).includes('legacy-b'), true);
  sqlite.prepare('DELETE FROM rankings WHERE id = ?').run('legacy-a');
  const result = await request('/players/me/blocks', 'DELETE', { blockId: blocks[0].id });
  assert.deepEqual(await result.json(), []);
});

test('only an authenticated non-browser moderator can hide, dismiss, or restore, and actions are recorded', async () => {
  const { request, ids, env, sqlite } = await harness();
  const { id } = await (await request('/ranking-reports', 'POST', { rankingId: 'author-score', reason: 'other' })).json() as { id: string };
  const decision = { reportId: id, decision: 'hide' };
  assert.equal((await request('/moderation/reports', 'POST', decision)).status, 403);
  assert.equal((await request('/moderation/reports', 'POST', decision, ADMIN, 'http://localhost:8081')).status, 403);
  assert.equal((await request('/moderation/reports', 'OPTIONS', undefined, null, 'http://localhost:8081')).status, 403);
  assert.equal((await request('/moderation/reports', 'POST', { reportId: id, decision: 'erase' }, ADMIN)).status, 400);
  assert.equal((await request('/moderation/reports', 'POST', null, ADMIN)).status, 400);
  assert.equal((await request('/moderation/reports?status=invalid', 'GET', undefined, ADMIN)).status, 400);
  assert.equal((await request('/moderation/reports', 'POST', { reportId: crypto.randomUUID(), decision: 'hide' }, ADMIN)).status, 404);
  assert.equal((await request('/moderation/reports', 'POST', decision, ADMIN)).status, 200);
  assert.equal((await ids(null)).includes('author-score'), false);
  assert.equal((await ids(AUTHOR)).includes('author-score'), false);
  assert.equal((await request('/game-sessions', 'POST', { gameType: 'color_rush' }, AUTHOR)).status, 403);
  const history = await request('/players/me/history?gameType=strawberry_rush', 'GET', undefined, AUTHOR);
  assert.equal((await history.json() as unknown[]).length, 1);
  assert.equal((await request('/moderation/reports', 'POST', { reportId: id, decision: 'dismiss' }, ADMIN)).status, 200);
  assert.equal((await ids(null)).includes('author-score'), false);
  assert.equal((await request('/moderation/reports', 'POST', { reportId: id, decision: 'restore' }, ADMIN)).status, 200);
  assert.equal((await ids(null)).includes('author-score'), true);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM moderation_events').get()?.count, 3);
  env.MODERATION_ADMIN_TOKEN = undefined;
  assert.equal((await request('/moderation/reports', 'GET', undefined, ADMIN)).status, 503);
});

test('moderation limits cannot be bypassed by duplicate requests or filling the block list', async () => {
  const { request, hashes, seed, sqlite } = await harness();
  for (let index = 0; index < 200; index += 1) {
    sqlite.prepare('INSERT INTO player_blocks VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), hashes[0], `legacy:seed-${index}`, `seed-${index}`, 'テスト', new Date().toISOString());
  }
  assert.equal((await request('/players/me/blocks', 'POST', { rankingId: 'author-score' })).status, 409);
  for (let index = 0; index < 20; index += 1) {
    sqlite.prepare('INSERT INTO ranking_reports (id, reporter_hash, ranking_id, subject_key, name_snapshot, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), hashes[0], `reported-${index}`, 'legacy:fixture', 'テスト', 'other', new Date().toISOString());
  }
  assert.equal((await request('/ranking-reports', 'POST', { rankingId: 'author-score', reason: 'other' })).status, 429);
  sqlite.exec('DELETE FROM ranking_reports; DELETE FROM score_submission_buckets;');
  for (let index = 0; index < 9; index += 1) {
    seed(`network-${index}`, null);
    const response = await request('/ranking-reports', 'POST', { rankingId: `network-${index}`, reason: 'other' });
    assert.equal(response.status, index < 8 ? 200 : 429);
  }
});

test('score deletion removes the viewer block list and reports but does not lift an enforcement decision', async () => {
  const { request, sqlite, hashes } = await harness();
  await request('/players/me/blocks', 'POST', { rankingId: 'author-score' });
  await request('/ranking-reports', 'POST', { rankingId: 'author-score', reason: 'other' });
  sqlite.prepare('INSERT INTO moderated_subjects VALUES (?, ?, ?)').run(`owner:${hashes[0]}`, crypto.randomUUID(), new Date().toISOString());
  assert.equal((await request('/players/me/scores', 'DELETE')).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM player_blocks').get()?.count, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM ranking_reports').get()?.count, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM moderated_subjects').get()?.count, 1);
  const restrictions = await (await request('/moderation/restrictions', 'GET', undefined, ADMIN)).json() as { id: string }[];
  assert.equal(restrictions.length, 1);
  assert.equal((await request('/moderation/reports', 'POST', { enforcementId: restrictions[0].id, decision: 'restore' }, ADMIN)).status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM moderated_subjects').get()?.count, 0);
});

test('scheduled cleanup removes old reports and decisions, without dropping active blocks or enforcement', async () => {
  const { request, env, sqlite } = await harness();
  const receipt = await (await request('/ranking-reports', 'POST', { rankingId: 'author-score', reason: 'other' })).json() as { id: string };
  await request('/moderation/reports', 'POST', { reportId: receipt.id, decision: 'hide' }, ADMIN);
  await request('/players/me/blocks', 'POST', { rankingId: 'author-score' });
  await cleanupModerationData(env, new Date(Date.now() + 91 * 24 * 60 * 60 * 1000));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM ranking_reports').get()?.count, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM moderation_events').get()?.count, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM player_blocks').get()?.count, 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM moderated_subjects').get()?.count, 1);
});

test('the minimum name filter normalizes width and punctuation without substring censorship', () => {
  for (const name of ['死ね', 'し ね', 'ＦＵＣＫ', 'fuck-you']) {assert.equal(isClearlyInappropriateName(name), true);}
  for (const name of ['しねま', 'ころすけ', '普通の選手']) {assert.equal(isClearlyInappropriateName(name), false);}
  assert.throws(() => validateScoreSubmission({ gameType: 'color_rush', submissionId: '1234567890123456', gameSessionId: VIEWER, playerName: 'ＦＵＣＫ', score: 1, durationMs: 1000 }), /使用できない名前/);
});

test('operator NG rules immediately mask existing names and reject new posts, and removal restores safe display', async () => {
  const { request, seed, hashes } = await harness();
  seed('ng-existing', hashes[2], 'テスト禁止', 'color_rush');
  const add = async (term: string, matchType = 'exact') => request('/moderation/name-rules', 'POST', { term, matchType }, ADMIN);
  assert.equal((await request('/moderation/name-rules')).status, 403);
  assert.equal((await add('ﾃｽﾄ禁止')).status, 200);
  const rules = await (await add('テスト禁止')).json() as { id: string }[];
  assert.equal(rules.length, 1);
  const rejectedStart = await request('/game-sessions', 'POST', { gameType: 'color_rush', playerName: 'テスト禁止' });
  assert.equal(rejectedStart.status, 400);
  assert.equal((await rejectedStart.json() as { code: string }).code, 'NAME_NOT_ALLOWED');
  const rankings = await request('/rankings?gameType=color_rush');
  assert.equal((await rankings.json() as { playerName: string }[])[0].playerName, '非公開の名前');
  const session = await (await request('/game-sessions', 'POST', { gameType: 'color_rush' })).json() as { id: string };
  const score = { submissionId: crypto.randomUUID(), gameSessionId: session.id, playerName: 'テスト禁止', score: 1, gameType: 'color_rush', durationMs: 1000 };
  assert.equal((await request('/scores', 'POST', score)).status, 400);
  assert.equal((await request('/moderation/name-rules', 'DELETE', { ruleId: 'bad' }, ADMIN)).status, 400);
  assert.equal((await request('/moderation/name-rules', 'DELETE', { ruleId: rules[0].id }, ADMIN)).status, 200);
  assert.equal((await request('/scores', 'POST', score)).status, 201);
  assert.equal((await (await request('/rankings?gameType=color_rush')).json() as { playerName: string }[])[0].playerName, 'テスト禁止');
  assert.equal((await add('禁止', 'contains')).status, 200);
  assert.equal((await (await request('/rankings?gameType=color_rush')).json() as { playerName: string }[])[0].playerName, '非公開の名前');
  for (const [term, mode] of [['一', 'contains'], ['！', 'exact'], ['a'.repeat(49), 'exact'], ['a'.repeat(13), 'exact'], ['x', 'regex'], ['\u0000', 'exact']]) {
    assert.equal((await add(term, mode)).status, 400);
  }
  assert.equal((await request('/moderation/name-rules', 'POST', null, ADMIN)).status, 400);
});

test('NG rules are capped atomically without rejecting an existing rule at capacity', async () => {
  const { request, sqlite } = await harness();
  for (let index = 0; index < 100; index += 1) {
    sqlite.prepare('INSERT INTO moderation_name_rules VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), `term${index}`, 'exact', new Date().toISOString());
  }
  assert.equal((await request('/moderation/name-rules', 'POST', { term: 'new', matchType: 'exact' }, ADMIN)).status, 409);
  assert.equal((await request('/moderation/name-rules', 'POST', { term: 'term0', matchType: 'exact' }, ADMIN)).status, 200);
  assert.equal((await (await request('/moderation/name-rules', 'GET', undefined, ADMIN)).json() as unknown[]).length, 100);
});

test('a cached snapshot cannot resurrect a restricted name and database failure never leaks unchecked names', async () => {
  const { request, sqlite } = await harness();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  const responses = new Map<string, Response>();
  Object.defineProperty(globalThis, 'caches', { configurable: true, value: { default: {
    async match(key: Request) {return responses.get(key.url)?.clone();},
    async put(key: Request, response: Response) {responses.set(key.url, response.clone());},
    async delete() {return true;},
  } } });
  try {
    assert.equal((await request('/rankings', 'GET', undefined, null)).status, 200);
    const receipt = await (await request('/ranking-reports', 'POST', { rankingId: 'author-score', reason: 'other' })).json() as { id: string };
    await request('/moderation/reports', 'POST', { reportId: receipt.id, decision: 'hide' }, ADMIN);
    const cached = await request('/rankings', 'GET', undefined, null);
    assert.equal(cached.headers.get('x-rankings-cache'), 'hit');
    assert.equal(cached.headers.get('cache-control'), 'no-store');
    assert.equal((await cached.json() as { id: string }[]).some((entry) => entry.id === 'author-score'), false);
    sqlite.close();
    const unavailable = await request('/rankings', 'GET', undefined, null);
    assert.equal(unavailable.status, 500);
    assert.equal(JSON.stringify(await unavailable.json()).includes('同名の選手'), false);
  } finally {
    if (original) {Object.defineProperty(globalThis, 'caches', original);} else {Reflect.deleteProperty(globalThis, 'caches');}
  }
});
