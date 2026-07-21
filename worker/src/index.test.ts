import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanupRateLimitBuckets, Env, getPeriodStart } from './index.js';

type RankingRecord = {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
  ownerHash: string | null;
};

type SubmissionBucket = {
  identityHash: string;
  windowStart: number;
  submissionCount: number;
  expiresAt: string;
};

class FakeStatement {
  private params: unknown[] = [];

  constructor(
    private readonly sql: string,
    private readonly db: FakeD1Database,
  ) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.sql.includes('FROM rankings') && this.sql.includes('WHERE id = ?')) {
      const [id] = this.params as [string];
      const ranking = this.db.rankings.find((entry) => entry.id === id);
      return ranking ? {
        id: ranking.id,
        player_name: ranking.playerName,
        score: ranking.score,
        game_type: ranking.gameType,
        created_at: ranking.createdAt,
        owner_hash: ranking.ownerHash,
      } as T : null;
    }

    if (this.sql.includes('SELECT score') && this.sql.includes('owner_hash = ?')) {
      const [gameType, ownerHash] = this.params as [string, string];
      const ranking = this.db.rankings
        .filter((entry) => entry.gameType === gameType && entry.ownerHash === ownerHash)
        .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))[0];
      return ranking ? { score: ranking.score } as T : null;
    }

    if (this.sql.includes('SELECT 1 AS ok')) {
      return { ok: 1 } as T;
    }

    return null;
  }

  async all<T>() {
    if (this.sql.includes('FROM rankings') && this.sql.includes('owner_hash = ?')) {
      const [gameType, ownerHash, limit] = this.params as [string, string, number];
      const results = this.db.rankings
        .filter((entry) => entry.gameType === gameType && entry.ownerHash === ownerHash)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map((ranking) => ({
          id: ranking.id,
          player_name: ranking.playerName,
          score: ranking.score,
          game_type: ranking.gameType,
          created_at: ranking.createdAt,
          owner_hash: ranking.ownerHash,
        })) as T[];
      return { results };
    }
    return { results: [] as T[] };
  }

  async run() {
    let changes = 0;
    if (this.sql.includes('INSERT INTO score_submission_buckets')) {
      const [identityHash, windowStart, expiresAt, limit] = this.params as [string, number, string, number];
      const existing = this.db.submissionBuckets.find(
        (bucket) => bucket.identityHash === identityHash && bucket.windowStart === windowStart,
      );
      if (!existing) {
        this.db.submissionBuckets.push({ identityHash, windowStart, submissionCount: 1, expiresAt });
        changes = 1;
      } else if (existing.submissionCount < limit) {
        existing.submissionCount += 1;
        existing.expiresAt = expiresAt;
        changes = 1;
      }
    }

    if (this.sql.includes('INSERT INTO rankings')) {
      const [id, playerName, score, gameType, createdAt, ownerHash] = this.params as [
        string,
        string,
        number,
        string,
        string,
        string | null,
      ];
      this.db.rankings.push({ id, playerName, score, gameType, createdAt, ownerHash });
      changes = 1;
    }

    if (this.sql.includes('DELETE FROM score_submission_buckets')) {
      const [cutoff] = this.params as [string];
      const previousLength = this.db.submissionBuckets.length;
      this.db.submissionBuckets = this.db.submissionBuckets.filter((bucket) => bucket.expiresAt >= cutoff);
      changes = previousLength - this.db.submissionBuckets.length;
    }

    if (this.sql.includes('DELETE FROM rankings WHERE owner_hash = ?')) {
      const [ownerHash] = this.params as [string];
      const previousLength = this.db.rankings.length;
      this.db.rankings = this.db.rankings.filter((entry) => entry.ownerHash !== ownerHash);
      changes = previousLength - this.db.rankings.length;
    }

    return { success: true, meta: { changes } };
  }
}

class FakeD1Database {
  rankings: RankingRecord[] = [];
  submissionBuckets: SubmissionBucket[] = [];

  prepare(sql: string) {
    return new FakeStatement(sql, this);
  }
}

const createEnv = (): Env => ({
  DB: new FakeD1Database() as unknown as D1Database,
  ALLOWED_ORIGINS: 'https://toyo1621.github.io',
  RATE_LIMIT_SALT: 'test-rate-limit-salt-2026',
});

let submissionSequence = 0;
const TEST_PLAYER_TOKEN = '01234567-89ab-4cde-8f01-23456789abcd';
const scoreRequest = (body: unknown, origin: string | undefined = 'https://toyo1621.github.io') => {
  const headers = new Headers({
    'content-type': 'application/json',
    'cf-connecting-ip': '203.0.113.10',
    'user-agent': 'node-test',
  });
  if (origin) {
    headers.set('origin', origin);
  }
  headers.set('authorization', `Bearer ${TEST_PLAYER_TOKEN}`);
  return new Request('https://api.test/scores', {
    method: 'POST',
    headers,
    body: JSON.stringify(
      body && typeof body === 'object' && !Array.isArray(body)
        ? {
            submissionId: `test_submission_${String(submissionSequence += 1).padStart(6, '0')}`,
            ...body,
          }
        : body,
    ),
  });
};

test('rejects score submissions from disallowed origins', async () => {
  const env = createEnv();
  const response = await worker.fetch(scoreRequest({
    playerName: 'ぱん',
    score: 10,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }, 'https://example.com'), env);

  assert.equal(response.status, 403);
});

test('accepts native score submissions without an Origin header', async () => {
  const response = await worker.fetch(scoreRequest({
    playerName: 'ネイティブ',
    score: 2,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }, undefined), createEnv());

  assert.equal(response.status, 201);
});

test('rejects implausible score submissions', async () => {
  const env = createEnv();
  const response = await worker.fetch(scoreRequest({
    playerName: 'ぱん',
    score: 9_999,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }), env);

  assert.equal(response.status, 400);
});

test('rejects conflicting player credentials', async () => {
  const response = await worker.fetch(scoreRequest({
    playerName: 'ぱん',
    score: 1,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
    playerToken: 'fedcba98-7654-4321-8fed-cba987654321',
  }), createEnv());

  assert.equal(response.status, 400);
});

test('saves plausible score submissions', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  const response = await worker.fetch(scoreRequest({
    playerName: '  ぱん  ',
    score: 10,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }), env);
  const body = await response.json() as RankingRecord;

  assert.equal(response.status, 201);
  assert.equal(body.playerName, 'ぱん');
  assert.equal(db.rankings.length, 1);
  assert.equal(db.submissionBuckets.length, 1);
  assert.equal(db.submissionBuckets[0].submissionCount, 1);
});

test('treats a retried submission as idempotent', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  const body = {
    submissionId: 'retry_submission_000001',
    playerName: 'ぱん',
    score: 10,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  };

  const first = await worker.fetch(scoreRequest(body), env);
  const second = await worker.fetch(scoreRequest(body), env);

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(db.rankings.length, 1);
  assert.equal(db.submissionBuckets.length, 1);
  assert.equal(db.submissionBuckets[0].submissionCount, 1);
});

test('rejects non-JSON and oversized score requests', async () => {
  const env = createEnv();
  const nonJson = new Request('https://api.test/scores', {
    method: 'POST',
    headers: { origin: 'https://toyo1621.github.io', 'content-type': 'text/plain' },
    body: 'score=10',
  });
  const oversized = scoreRequest({
    playerName: 'a'.repeat(3_000),
    score: 1,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  });

  assert.equal((await worker.fetch(nonJson, env)).status, 415);
  assert.equal((await worker.fetch(oversized, env)).status, 413);
});

test('health check verifies the database and returns security headers', async () => {
  const response = await worker.fetch(new Request('https://api.test/health'), createEnv());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.equal(response.headers.get('x-api-version'), '2');
});

test('private history requires its bearer token and can be deleted by its owner', async () => {
  const env = createEnv();
  await worker.fetch(scoreRequest({
    playerName: '履歴テスト',
    score: 7,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }), env);

  const unauthorized = await worker.fetch(
    new Request('https://api.test/players/me/history?gameType=strawberry_rush'),
    env,
  );
  assert.equal(unauthorized.status, 401);

  const headers = { authorization: `Bearer ${TEST_PLAYER_TOKEN}` };
  const history = await worker.fetch(
    new Request('https://api.test/players/me/history?gameType=strawberry_rush', { headers }),
    env,
  );
  const entries = await history.json() as RankingRecord[];
  assert.equal(history.status, 200);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].score, 7);

  const otherHistory = await worker.fetch(
    new Request('https://api.test/players/me/history?gameType=strawberry_rush', {
      headers: { authorization: 'Bearer fedcba98-7654-4321-8fed-cba987654321' },
    }),
    env,
  );
  assert.deepEqual(await otherHistory.json(), []);

  const deleted = await worker.fetch(new Request('https://api.test/players/me/scores', {
    method: 'DELETE',
    headers: { ...headers, origin: 'https://toyo1621.github.io' },
  }), env);
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: 1 });
});

test('calculates daily, weekly, and monthly boundaries in Japan time', () => {
  const now = new Date('2026-07-21T15:30:00.000Z');
  assert.equal(getPeriodStart('daily', now), '2026-07-21T15:00:00.000Z');
  assert.equal(getPeriodStart('weekly', now), '2026-07-19T15:00:00.000Z');
  assert.equal(getPeriodStart('monthly', now), '2026-06-30T15:00:00.000Z');
  assert.equal(getPeriodStart('all', now), null);
});

test('rate limits repeated score submissions from the same client', async () => {
  const env = createEnv();

  for (let index = 0; index < 8; index += 1) {
    const response = await worker.fetch(scoreRequest({
      playerName: `player${index}`,
      score: 1,
      gameType: 'strawberry_rush',
      durationMs: 30_000,
    }), env);
    assert.equal(response.status, 201);
  }

  const limitedResponse = await worker.fetch(scoreRequest({
    playerName: 'limited',
    score: 1,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }), env);

  assert.equal(limitedResponse.status, 429);
});

test('removes transient rate-limit identifiers after the retention window', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  db.submissionBuckets = [
    { identityHash: 'old-hash', windowStart: 1, submissionCount: 1, expiresAt: '2026-07-21T00:29:59.000Z' },
    { identityHash: 'current-hash', windowStart: 2, submissionCount: 1, expiresAt: '2026-07-21T00:30:01.000Z' },
  ];

  await cleanupRateLimitBuckets(env, new Date('2026-07-21T00:30:00.000Z'));

  assert.deepEqual(db.submissionBuckets.map((bucket) => bucket.identityHash), ['current-hash']);
});
