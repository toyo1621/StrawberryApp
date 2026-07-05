import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { Env } from './index.js';

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
  playerName: string;
  gameType: string;
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

    return null;
  }

  async all<T>() {
    return { results: [] as T[] };
  }

  async run() {
    if (this.sql.includes('INSERT INTO score_submission_events')) {
      const [id, identityHash, playerName, gameType, createdAt] = this.params as string[];
      this.db.submissionEvents.push({ id, identityHash, playerName, gameType, createdAt });
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
  RATE_LIMIT_SALT: 'test-salt',
});

const scoreRequest = (body: unknown, origin = 'https://toyo1621.github.io') => new Request('https://api.test/scores', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'origin': origin,
    'cf-connecting-ip': '203.0.113.10',
    'user-agent': 'node-test',
  },
  body: JSON.stringify(body),
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
