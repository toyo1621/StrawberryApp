import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanupRateLimitEvents, Env, getPeriodStart } from './index.js';

type RankingRecord = {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
};

type SubmissionEvent = {
  id: string;
  identityHash: string;
  createdAt: string;
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
    if (this.sql.includes('COUNT(*) AS count')) {
      const [identityHash, windowStart] = this.params as [string, string];
      const count = this.db.submissionEvents.filter(
        (event) => event.identityHash === identityHash && event.createdAt >= windowStart,
      ).length;

      return { count } as T;
    }

    if (this.sql.includes('FROM rankings') && this.sql.includes('WHERE id = ?')) {
      const [id] = this.params as [string];
      const ranking = this.db.rankings.find((entry) => entry.id === id);
      return ranking ? {
        id: ranking.id,
        player_name: ranking.playerName,
        score: ranking.score,
        game_type: ranking.gameType,
        created_at: ranking.createdAt,
      } as T : null;
    }

    if (this.sql.includes('SELECT 1 AS ok')) {
      return { ok: 1 } as T;
    }

    return null;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async run() {
    if (this.sql.includes('INSERT INTO score_submission_events')) {
      const [id, identityHash, createdAt] = this.params as string[];
      this.db.submissionEvents.push({ id, identityHash, createdAt });
    }

    if (this.sql.includes('INSERT INTO rankings')) {
      const [id, playerName, score, gameType, createdAt] = this.params as [
        string,
        string,
        number,
        string,
        string,
      ];
      this.db.rankings.push({ id, playerName, score, gameType, createdAt });
    }

    if (this.sql.includes('DELETE FROM score_submission_events')) {
      const [cutoff] = this.params as [string];
      this.db.submissionEvents = this.db.submissionEvents.filter((event) => event.createdAt >= cutoff);
    }

    return { success: true };
  }
}

class FakeD1Database {
  rankings: RankingRecord[] = [];
  submissionEvents: SubmissionEvent[] = [];

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
const scoreRequest = (body: unknown, origin = 'https://toyo1621.github.io') => new Request('https://api.test/scores', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'origin': origin,
    'cf-connecting-ip': '203.0.113.10',
    'user-agent': 'node-test',
  },
  body: JSON.stringify(
    body && typeof body === 'object' && !Array.isArray(body)
      ? { submissionId: `test_submission_${String(submissionSequence += 1).padStart(6, '0')}`, ...body }
      : body,
  ),
});

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
  assert.equal(db.submissionEvents.length, 1);
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
  assert.equal(db.submissionEvents.length, 1);
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
  db.submissionEvents = [
    { id: 'old', identityHash: 'old-hash', createdAt: '2026-07-21T00:00:00.000Z' },
    { id: 'current', identityHash: 'current-hash', createdAt: '2026-07-21T00:20:00.000Z' },
  ];

  await cleanupRateLimitEvents(env, new Date('2026-07-21T00:30:00.000Z'));

  assert.deepEqual(db.submissionEvents.map((event) => event.id), ['current']);
});
