import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {
  cleanupExpiredGameSessions,
  cleanupRateLimitBuckets,
  Env,
  getPeriodStart,
} from './index.js';

type RankingRecord = {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  islandRegion: string;
  createdAt: string;
  ownerHash: string | null;
};

type SubmissionBucket = {
  identityHash: string;
  windowStart: number;
  submissionCount: number;
  expiresAt: string;
};

type GameSessionRecord = {
  id: string;
  ownerHash: string;
  gameType: string;
  islandRegion: string;
  startedAt: string;
  expiresAt: string;
  consumedAt: string | null;
  submissionId: string | null;
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
    if (this.sql.includes('FROM game_sessions') && this.sql.includes('WHERE id = ?')) {
      const [id] = this.params as [string];
      const session = this.db.gameSessions.find((entry) => entry.id === id);
      return session ? {
        id: session.id,
        owner_hash: session.ownerHash,
        game_type: session.gameType,
        island_region: session.islandRegion,
        started_at: session.startedAt,
        expires_at: session.expiresAt,
        consumed_at: session.consumedAt,
        submission_id: session.submissionId,
      } as T : null;
    }

    if (this.sql.includes('FROM rankings') && this.sql.includes('WHERE id = ?')) {
      const [id] = this.params as [string];
      const ranking = this.db.rankings.find((entry) => entry.id === id);
      return ranking ? {
        id: ranking.id,
        player_name: ranking.playerName,
        score: ranking.score,
        game_type: ranking.gameType,
        island_region: ranking.islandRegion,
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
          island_region: ranking.islandRegion,
          created_at: ranking.createdAt,
          owner_hash: ranking.ownerHash,
        })) as T[];
      return { results, meta: { served_by_region: 'LOCAL', served_by_primary: true } };
    }

    if (this.sql.includes('WITH owner_ranked')) {
      this.db.rankingQueryCount += 1;
      if (this.db.failRankingQueries) {
        throw new Error('Simulated leaderboard database failure.');
      }
      const [gameType, islandRegion] = this.params as [string, string];
      const hasPeriodStart = this.sql.includes('created_at >= ?');
      const periodStart = hasPeriodStart ? this.params[2] as string : null;
      const limit = this.params.at(-1) as number;
      const bestByPlayer = new Map<string, RankingRecord>();

      this.db.rankings
        .filter((entry) => (
          entry.gameType === gameType
          && entry.islandRegion === islandRegion
          && (!periodStart || entry.createdAt >= periodStart)
        ))
        .forEach((entry) => {
          const identity = entry.ownerHash
            ? `owner:${entry.ownerHash}`
            : `legacy:${entry.playerName.trim().toLocaleLowerCase()}`;
          const current = bestByPlayer.get(identity);
          if (
            !current
            || entry.score > current.score
            || (entry.score === current.score && entry.createdAt < current.createdAt)
          ) {
            bestByPlayer.set(identity, entry);
          }
        });

      const results = [...bestByPlayer.values()]
        .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
        .slice(0, limit)
        .map((ranking) => ({
          id: ranking.id,
          player_name: ranking.playerName,
          score: ranking.score,
          game_type: ranking.gameType,
          island_region: ranking.islandRegion,
          created_at: ranking.createdAt,
          owner_hash: ranking.ownerHash,
        })) as T[];
      return { results, meta: { served_by_region: 'LOCAL', served_by_primary: false } };
    }
    return { results: [] as T[], meta: {} };
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

    if (this.sql.includes('INSERT INTO game_sessions')) {
      const [id, ownerHash, gameType, islandRegion, startedAt, expiresAt] = this.params as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      this.db.gameSessions.push({
        id,
        ownerHash,
        gameType,
        islandRegion,
        startedAt,
        expiresAt,
        consumedAt: null,
        submissionId: null,
      });
      changes = 1;
    }

    if (this.sql.includes('UPDATE game_sessions')) {
      const [consumedAt, submissionId, id] = this.params as [string, string, string];
      const session = this.db.gameSessions.find((entry) => entry.id === id);
      if (session && !session.consumedAt && !session.submissionId) {
        session.consumedAt = consumedAt;
        session.submissionId = submissionId;
        changes = 1;
      }
    }

    if (this.sql.includes('INSERT INTO rankings')) {
      const [id, playerName, score, gameType, islandRegion, createdAt, ownerHash] = this.params as [
        string,
        string,
        number,
        string,
        string,
        string,
        string | null,
      ];
      const sessionId = this.params[7] as string | undefined;
      const sessionSubmissionId = this.params[8] as string | undefined;
      const canInsert = !this.sql.includes('WHERE EXISTS') || this.db.gameSessions.some((session) => (
        session.id === sessionId && session.submissionId === sessionSubmissionId
      ));
      if (canInsert) {
        if (this.db.rankings.some((ranking) => ranking.id === id)) {
          throw new Error('UNIQUE constraint failed: rankings.id');
        }
        this.db.rankings.push({ id, playerName, score, gameType, islandRegion, createdAt, ownerHash });
        changes = 1;
      }
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

    if (this.sql.includes('DELETE FROM game_sessions')) {
      const [cutoff] = this.params as [string];
      const previousLength = this.db.gameSessions.length;
      this.db.gameSessions = this.db.gameSessions.filter((session) => session.expiresAt >= cutoff);
      changes = previousLength - this.db.gameSessions.length;
    }

    return { success: true, meta: { changes } };
  }
}

class FakeD1Database {
  rankings: RankingRecord[] = [];
  submissionBuckets: SubmissionBucket[] = [];
  gameSessions: GameSessionRecord[] = [];
  rankingQueryCount = 0;
  failRankingQueries = false;
  sessionConstraints: string[] = [];

  prepare(sql: string) {
    return new FakeStatement(sql, this);
  }

  async batch(statements: FakeStatement[]) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  withSession(constraint = 'first-unconstrained') {
    this.sessionConstraints.push(constraint);
    return this;
  }
}

class FakeCache implements Cache {
  private readonly responses = new Map<string, Response>();
  deleteCount = 0;

  async match(request: Request): Promise<Response | undefined> {
    return this.responses.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.responses.set(request.url, response.clone());
  }

  async delete(request: Request): Promise<boolean> {
    this.deleteCount += 1;
    return this.responses.delete(request.url);
  }

  async ageSnapshotsBy(durationMs: number): Promise<void> {
    for (const [key, response] of this.responses) {
      const value = await response.clone().json() as { cachedAt: number };
      value.cachedAt -= durationMs;
      this.responses.set(key, new Response(JSON.stringify(value), {
        headers: { 'cache-control': 'public, max-age=300' },
      }));
    }
  }
}

class FakeExecutionContext implements ExecutionContext {
  private readonly promises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.promises.push(promise);
  }

  async drain(): Promise<void> {
    await Promise.all(this.promises);
  }
}

const installFakeCache = (cache: FakeCache): (() => void) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'caches');
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { default: cache },
  });
  return () => {
    if (original) {
      Object.defineProperty(globalThis, 'caches', original);
    } else {
      Reflect.deleteProperty(globalThis, 'caches');
    }
  };
};

const createEnv = (overrides: Partial<Env> = {}): Env => ({
  DB: new FakeD1Database() as unknown as D1Database,
  ALLOWED_ORIGINS: 'https://toyo1621.github.io',
  RATE_LIMIT_SALT: 'test-rate-limit-salt-2026',
  ...overrides,
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
            gameSessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
            ...body,
          }
        : body,
    ),
  });
};

const startGameSession = async (
  env: Env,
  gameType: string,
  islandRegion: string | undefined = undefined,
  origin: string | undefined = 'https://toyo1621.github.io',
) => {
  const headers = new Headers({
    'content-type': 'application/json',
    'cf-connecting-ip': '203.0.113.10',
    'user-agent': 'node-test',
    authorization: `Bearer ${TEST_PLAYER_TOKEN}`,
  });
  if (origin) {
    headers.set('origin', origin);
  }
  const response = await worker.fetch(new Request('https://api.test/game-sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify({ gameType, islandRegion }),
  }), env);
  const body = await response.json() as { id?: string };
  assert.equal(response.status, 201);
  assert.equal(typeof body.id, 'string');
  return body.id as string;
};

const submitVerifiedScore = async (
  env: Env,
  body: Record<string, unknown>,
  origin: string | undefined = 'https://toyo1621.github.io',
) => {
  const gameType = String(body.gameType);
  const islandRegion = typeof body.islandRegion === 'string' ? body.islandRegion : undefined;
  const gameSessionId = await startGameSession(env, gameType, islandRegion, origin);
  const db = env.DB as unknown as FakeD1Database;
  const session = db.gameSessions.find((entry) => entry.id === gameSessionId);
  if (session) {
    session.startedAt = new Date(Date.now() - Number(body.durationMs ?? 1_000)).toISOString();
  }
  return worker.fetch(scoreRequest({ ...body, gameSessionId }, origin), env);
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
  const env = createEnv();
  const response = await submitVerifiedScore(env, {
    playerName: 'ネイティブ',
    score: 2,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }, undefined);

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
  const response = await submitVerifiedScore(env, {
    playerName: '  ぱん  ',
    score: 10,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  });
  const body = await response.json() as RankingRecord;

  assert.equal(response.status, 201);
  assert.equal(body.playerName, 'ぱん');
  assert.equal(body.islandRegion, 'all');
  assert.equal(db.rankings.length, 1);
  assert.equal(db.submissionBuckets.length, 1);
  assert.equal(db.submissionBuckets[0].submissionCount, 1);
});

test('requires a server-issued session and rejects impossible elapsed time', async () => {
  const env = createEnv();
  const missingSession = await worker.fetch(scoreRequest({
    gameSessionId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    playerName: '未検証',
    score: 1,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }), env);
  assert.equal(missingSession.status, 400);

  const gameSessionId = await startGameSession(env, 'strawberry_rush');
  const forgedDuration = await worker.fetch(scoreRequest({
    gameSessionId,
    playerName: '時間偽装',
    score: 1,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  }), env);
  assert.equal(forgedDuration.status, 400);
});

test('a verified game session can be consumed only once', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  const gameSessionId = await startGameSession(env, 'color_rush');
  const session = db.gameSessions.find((entry) => entry.id === gameSessionId);
  if (session) {
    session.startedAt = new Date(Date.now() - 30_000).toISOString();
  }

  const first = await worker.fetch(scoreRequest({
    submissionId: 'single_session_score_0001',
    gameSessionId,
    playerName: '一回限り',
    score: 2,
    gameType: 'color_rush',
    durationMs: 30_000,
  }), env);
  const second = await worker.fetch(scoreRequest({
    submissionId: 'single_session_score_0002',
    gameSessionId,
    playerName: '二回目',
    score: 2,
    gameType: 'color_rush',
    durationMs: 30_000,
  }), env);

  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
  assert.equal(db.rankings.length, 1);
});

test('keeps nationwide, Chugoku, and Shikoku island rankings separate', async () => {
  const env = createEnv();
  const submissions = [
    { playerName: '全国選手', score: 3, islandRegion: undefined },
    { playerName: '中国選手', score: 8, islandRegion: 'chugoku' },
    { playerName: '四国選手', score: 6, islandRegion: 'shikoku' },
  ];

  for (const submission of submissions) {
    const response = await submitVerifiedScore(env, {
      ...submission,
      gameType: 'island_rush',
      durationMs: 30_000,
    });
    assert.equal(response.status, 201);
  }

  const nationwide = await worker.fetch(
    new Request('https://api.test/rankings?gameType=island_rush&period=all'),
    env,
  );
  const chugoku = await worker.fetch(
    new Request('https://api.test/rankings?gameType=island_rush&islandRegion=chugoku&period=all'),
    env,
  );
  const shikoku = await worker.fetch(
    new Request('https://api.test/rankings?gameType=island_rush&islandRegion=shikoku&period=all'),
    env,
  );

  assert.deepEqual(
    (await nationwide.json() as RankingRecord[]).map((entry) => [entry.playerName, entry.islandRegion]),
    [['全国選手', 'all']],
  );
  assert.deepEqual(
    (await chugoku.json() as RankingRecord[]).map((entry) => [entry.playerName, entry.islandRegion]),
    [['中国選手', 'chugoku']],
  );
  assert.deepEqual(
    (await shikoku.json() as RankingRecord[]).map((entry) => [entry.playerName, entry.islandRegion]),
    [['四国選手', 'shikoku']],
  );
});

test('ranks verified players by owner while preserving legacy name deduplication', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  db.rankings.push(
    {
      id: 'owner-a-old',
      playerName: '同じ名前',
      score: 4,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:00:00.000Z',
      ownerHash: 'a'.repeat(64),
    },
    {
      id: 'owner-b',
      playerName: '同じ名前',
      score: 8,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:01:00.000Z',
      ownerHash: 'b'.repeat(64),
    },
    {
      id: 'owner-a-new',
      playerName: '改名後',
      score: 10,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:02:00.000Z',
      ownerHash: 'a'.repeat(64),
    },
    {
      id: 'legacy-low',
      playerName: ' 旧選手 ',
      score: 3,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:03:00.000Z',
      ownerHash: null,
    },
    {
      id: 'legacy-high',
      playerName: '旧選手',
      score: 6,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:04:00.000Z',
      ownerHash: null,
    },
  );

  const response = await worker.fetch(
    new Request('https://api.test/rankings?gameType=strawberry_rush&period=all'),
    env,
  );
  const body = await response.json() as RankingRecord[];

  assert.equal(response.status, 200);
  assert.deepEqual(body.map(({ id, playerName, score }) => ({ id, playerName, score })), [
    { id: 'owner-a-new', playerName: '改名後', score: 10 },
    { id: 'owner-b', playerName: '同じ名前', score: 8 },
    { id: 'legacy-high', playerName: '旧選手', score: 6 },
  ]);
});

test('coalesces concurrent leaderboard cache misses and reads through a replica session', async () => {
  const cache = new FakeCache();
  const restoreCache = installFakeCache(cache);
  try {
    const env = createEnv();
    const db = env.DB as unknown as FakeD1Database;
    db.rankings.push({
      id: 'cached-leaderboard-entry',
      playerName: 'キャッシュ選手',
      score: 11,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:00:00.000Z',
      ownerHash: 'c'.repeat(64),
    });
    const context = new FakeExecutionContext();
    const requestUrl = 'https://api.test/rankings?gameType=strawberry_rush&period=all&limit=30';
    const responses = await Promise.all(
      Array.from({ length: 40 }, () => worker.fetch(new Request(requestUrl), env, context)),
    );
    await context.drain();

    assert.equal(responses.every((response) => response.status === 200), true);
    assert.equal(db.rankingQueryCount, 1);
    assert.deepEqual(db.sessionConstraints, ['first-unconstrained']);
    assert.equal(responses[0].headers.get('x-d1-region'), 'LOCAL');
    assert.equal(responses[0].headers.get('x-d1-primary'), 'false');

    const cached = await worker.fetch(new Request(requestUrl), env);
    assert.equal(cached.headers.get('x-rankings-cache'), 'hit');
    assert.equal(db.rankingQueryCount, 1);
  } finally {
    restoreCache();
  }
});

test('an authenticated leaderboard refresh bypasses cache and reads from primary', async () => {
  const cache = new FakeCache();
  const restoreCache = installFakeCache(cache);
  try {
    const env = createEnv();
    const db = env.DB as unknown as FakeD1Database;
    const requestUrl = 'https://api.test/rankings?gameType=strawberry_rush&period=all&limit=30';
    assert.equal((await worker.fetch(new Request(requestUrl), env)).status, 200);

    db.rankings.push({
      id: 'just-created-entry',
      playerName: '直後の選手',
      score: 12,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:00:00.000Z',
      ownerHash: 'e'.repeat(64),
    });
    const response = await worker.fetch(new Request(requestUrl, {
      headers: { authorization: `Bearer ${TEST_PLAYER_TOKEN}` },
    }), env);
    const body = await response.json() as RankingRecord[];

    assert.equal(response.headers.get('x-rankings-cache'), 'bypass');
    assert.deepEqual(body.map((entry) => entry.id), ['just-created-entry']);
    assert.equal(db.rankingQueryCount, 2);
    assert.deepEqual(db.sessionConstraints, ['first-unconstrained', 'first-primary']);
  } finally {
    restoreCache();
  }
});

test('serves a recent stale leaderboard snapshot when D1 is unavailable', async () => {
  const cache = new FakeCache();
  const restoreCache = installFakeCache(cache);
  try {
    const env = createEnv();
    const db = env.DB as unknown as FakeD1Database;
    db.rankings.push({
      id: 'stale-leaderboard-entry',
      playerName: '保存済み選手',
      score: 9,
      gameType: 'flag_rush',
      islandRegion: 'all',
      createdAt: '2026-07-22T00:00:00.000Z',
      ownerHash: 'd'.repeat(64),
    });
    const requestUrl = 'https://api.test/rankings?gameType=flag_rush&period=all&limit=30';
    assert.equal((await worker.fetch(new Request(requestUrl), env)).status, 200);
    await cache.ageSnapshotsBy(60_000);
    db.failRankingQueries = true;

    const response = await worker.fetch(new Request(requestUrl), env);
    const body = await response.json() as RankingRecord[];
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-rankings-cache'), 'stale');
    assert.deepEqual(body.map((entry) => entry.id), ['stale-leaderboard-entry']);
    assert.equal(db.rankingQueryCount, 2);
  } finally {
    restoreCache();
  }
});

test('invalidates the affected leaderboard cache after a score is created', async () => {
  const cache = new FakeCache();
  const restoreCache = installFakeCache(cache);
  try {
    const env = createEnv();
    const db = env.DB as unknown as FakeD1Database;
    const requestUrl = 'https://api.test/rankings?gameType=color_rush&period=all&limit=30';
    await worker.fetch(new Request(requestUrl), env);
    assert.equal(db.rankingQueryCount, 1);

    const created = await submitVerifiedScore(env, {
      playerName: '更新選手',
      score: 2,
      gameType: 'color_rush',
      durationMs: 30_000,
    });
    assert.equal(created.status, 201);
    assert.equal(cache.deleteCount, 4);

    const refreshed = await worker.fetch(new Request(requestUrl), env);
    const body = await refreshed.json() as RankingRecord[];
    assert.equal(refreshed.headers.get('x-rankings-cache'), 'miss');
    assert.equal(body.some((entry) => entry.playerName === '更新選手'), true);
    assert.equal(db.rankingQueryCount, 2);
  } finally {
    restoreCache();
  }
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
  const gameSessionId = await startGameSession(env, 'strawberry_rush');
  const session = db.gameSessions.find((entry) => entry.id === gameSessionId);
  if (session) {
    session.startedAt = new Date(Date.now() - 30_000).toISOString();
  }
  const requestBody = { ...body, gameSessionId };

  const first = await worker.fetch(scoreRequest(requestBody), env);
  const second = await worker.fetch(scoreRequest(requestBody), env);

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(db.rankings.length, 1);
  assert.equal(db.submissionBuckets.length, 1);
  assert.equal(db.submissionBuckets[0].submissionCount, 1);
});

test('treats simultaneous retries for one session as one idempotent submission', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  const gameSessionId = await startGameSession(env, 'strawberry_rush');
  const session = db.gameSessions.find((entry) => entry.id === gameSessionId);
  if (session) {
    session.startedAt = new Date(Date.now() - 30_000).toISOString();
  }
  const body = {
    submissionId: 'concurrent_retry_000001',
    gameSessionId,
    playerName: '同時再送',
    score: 3,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  };

  const responses = await Promise.all([
    worker.fetch(scoreRequest(body), env),
    worker.fetch(scoreRequest(body), env),
  ]);

  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  assert.equal(db.rankings.filter((entry) => entry.id === body.submissionId).length, 1);
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

test('handles CORS preflights and unknown routes explicitly', async () => {
  const env = createEnv();
  const allowed = await worker.fetch(new Request('https://api.test/scores', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://toyo1621.github.io',
      'access-control-request-method': 'POST',
    },
  }), env);
  const rejected = await worker.fetch(new Request('https://api.test/scores', {
    method: 'OPTIONS',
    headers: { origin: 'https://example.com' },
  }), env);
  const missing = await worker.fetch(new Request('https://api.test/missing'), env);
  const missingPreflight = await worker.fetch(new Request('https://api.test/missing', {
    method: 'OPTIONS',
    headers: { origin: 'https://toyo1621.github.io' },
  }), env);
  const wrongPreflightMethod = await worker.fetch(new Request('https://api.test/scores', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://toyo1621.github.io',
      'access-control-request-method': 'GET',
    },
  }), env);
  const wrongMethod = await worker.fetch(new Request('https://api.test/rankings', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  }), env);

  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://toyo1621.github.io');
  assert.equal(allowed.headers.get('x-api-version'), '4');
  assert.equal(allowed.headers.get('x-release-id'), 'development');
  assert.equal(rejected.status, 403);
  assert.equal(missing.status, 404);
  assert.equal(missingPreflight.status, 404);
  assert.equal(wrongPreflightMethod.status, 405);
  assert.equal(wrongPreflightMethod.headers.get('allow'), 'POST, OPTIONS');
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get('allow'), 'GET, OPTIONS');
  assert.deepEqual(await missing.json(), { error: 'Not found' });
});

test('returns a sanitized 500 response when an uncached leaderboard query fails', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  db.failRankingQueries = true;
  const response = await worker.fetch(new Request(
    'https://api.test/rankings?gameType=strawberry_rush&period=all&limit=3',
    { headers: { 'cache-control': 'no-cache' } },
  ), env);
  const body = await response.json() as { error: string; requestId: string };

  assert.equal(response.status, 500);
  assert.equal(body.error, 'The service is temporarily unavailable.');
  assert.equal(typeof body.requestId, 'string');
});

test('health check verifies the database and returns security headers', async () => {
  const response = await worker.fetch(new Request('https://api.test/health', {
    headers: { 'cf-ray': '../unsafe request id' },
  }), createEnv());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('vary'), 'Origin');
  assert.equal(response.headers.get('x-api-version'), '4');
  assert.equal(response.headers.get('x-release-id'), 'development');
  assert.equal(response.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('content-security-policy'), "default-src 'none'; frame-ancestors 'none'");
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'strawberry-rankings-api',
    version: 4,
    release: 'development',
  });
});

test('health check exposes the deployed Worker release tag', async () => {
  const response = await worker.fetch(
    new Request('https://api.test/health'),
    createEnv({
      CF_VERSION_METADATA: {
        id: 'worker-version-id',
        tag: 'git-commit-sha',
        timestamp: '2026-07-22T00:00:00.000Z',
      },
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-release-id'), 'git-commit-sha');
  assert.equal((await response.json() as { release: string }).release, 'git-commit-sha');
});

test('private history requires its bearer token and can be deleted by its owner', async () => {
  const env = createEnv();
  await submitVerifiedScore(env, {
    playerName: '履歴テスト',
    score: 7,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
  });

  const unauthorized = await worker.fetch(
    new Request('https://api.test/players/me/history?gameType=strawberry_rush'),
    env,
  );
  assert.equal(unauthorized.status, 401);

  const headers = { authorization: `Bearer ${TEST_PLAYER_TOKEN}` };
  const best = await worker.fetch(
    new Request('https://api.test/players/me/best?gameType=strawberry_rush', { headers }),
    env,
  );
  assert.deepEqual(await best.json(), { score: 7 });
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
    const response = await submitVerifiedScore(env, {
      playerName: `player${index}`,
      score: 1,
      gameType: 'strawberry_rush',
      durationMs: 30_000,
    });
    assert.equal(response.status, 201);
  }

  const limitedResponse = await worker.fetch(new Request('https://api.test/game-sessions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TEST_PLAYER_TOKEN}`,
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'node-test',
      origin: 'https://toyo1621.github.io',
    },
    body: JSON.stringify({ gameType: 'strawberry_rush', islandRegion: 'all' }),
  }), env);

  assert.equal(limitedResponse.status, 429);
  assert.equal(limitedResponse.headers.get('retry-after'), '60');
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

test('removes expired game sessions without touching active sessions', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  db.gameSessions = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      ownerHash: 'a'.repeat(64),
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      startedAt: '2026-07-21T00:00:00.000Z',
      expiresAt: '2026-07-21T00:29:59.000Z',
      consumedAt: null,
      submissionId: null,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      ownerHash: 'b'.repeat(64),
      gameType: 'flag_rush',
      islandRegion: 'all',
      startedAt: '2026-07-21T00:20:00.000Z',
      expiresAt: '2026-07-21T00:30:01.000Z',
      consumedAt: null,
      submissionId: null,
    },
  ];

  await cleanupExpiredGameSessions(env, new Date('2026-07-21T00:30:00.000Z'));

  assert.deepEqual(db.gameSessions.map((session) => session.id), ['22222222-2222-4222-8222-222222222222']);
});

test('scheduled maintenance removes both transient data sets', async () => {
  const env = createEnv();
  const db = env.DB as unknown as FakeD1Database;
  db.submissionBuckets = [
    { identityHash: 'expired-hash', windowStart: 1, submissionCount: 1, expiresAt: '2000-01-01T00:00:00.000Z' },
  ];
  db.gameSessions = [{
    id: '33333333-3333-4333-8333-333333333333',
    ownerHash: 'e'.repeat(64),
    gameType: 'flag_rush',
    islandRegion: 'all',
    startedAt: '2000-01-01T00:00:00.000Z',
    expiresAt: '2000-01-01T00:15:00.000Z',
    consumedAt: null,
    submissionId: null,
  }];

  await worker.scheduled({}, env);

  assert.deepEqual(db.submissionBuckets, []);
  assert.deepEqual(db.gameSessions, []);
});
