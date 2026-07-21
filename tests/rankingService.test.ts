import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameMode } from '../src/types';

const values = new Map<string, string>();
const localStorage = {
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => values.set(key, String(value)),
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage },
});
process.env.EXPO_PUBLIC_RANKINGS_API_URL = 'https://rankings.test';

const rankingServicePromise = import('../src/services/rankingService');

beforeEach(() => {
  values.clear();
});

test('an offline score is queued and synced with the same id', async () => {
  const rankingService = await rankingServicePromise;
  const originalWarn = console.warn;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    throw new TypeError('offline');
  };

  console.warn = () => undefined;
  const saved = await rankingService.saveScoreForMode(
    GameMode.STRAWBERRY,
    ' テスト ',
    12,
    { durationMs: 30_000 },
  ).finally(() => {
    console.warn = originalWarn;
  });
  assert.equal(saved.queuedForSync, true);
  assert.equal(attempts, 2);

  let syncedBody: Record<string, unknown> | undefined;
  let syncedAuthorization: string | null = null;
  globalThis.fetch = async (_input, init) => {
    syncedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    syncedAuthorization = new Headers(init?.headers).get('authorization');
    return Response.json({
      id: syncedBody.submissionId,
      playerName: syncedBody.playerName,
      score: syncedBody.score,
      gameType: syncedBody.gameType,
      createdAt: '2026-07-21T00:00:00.000Z',
    }, { status: 201 });
  };

  const result = await rankingService.syncPendingScores();
  assert.equal(result.synced, 1);
  assert.equal(result.pending, 0);
  assert.equal(syncedBody?.submissionId, saved.entry.id);
  assert.equal(syncedBody?.playerName, 'テスト');
  assert.match(String(syncedAuthorization), /^Bearer [0-9a-f-]{36}$/i);
  assert.equal('playerToken' in (syncedBody ?? {}), false);
});

test('a permanent API rejection is surfaced instead of queued', async () => {
  const rankingService = await rankingServicePromise;
  globalThis.fetch = async () => Response.json({ error: 'Rejected.' }, { status: 400 });

  await assert.rejects(
    rankingService.saveScoreForMode(GameMode.FLAG, 'テスト', 3, { durationMs: 30_000 }),
    /Rejected/,
  );

  const result = await rankingService.syncPendingScores();
  assert.deepEqual(result, { synced: 0, pending: 0, discarded: 0 });
});

test('cached ranking results are explicitly marked stale after an API failure', async () => {
  const rankingService = await rankingServicePromise;
  values.set('strawberry_game_rankings', JSON.stringify([{
    id: 'cached-score-0001',
    playerName: 'キャッシュ',
    score: 5,
    gameType: 'strawberry_rush',
    createdAt: '2026-07-21T00:00:00.000Z',
  }]));
  const originalWarn = console.warn;
  console.warn = () => undefined;
  globalThis.fetch = async () => { throw new TypeError('offline'); };

  const result = await rankingService.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY)
    .finally(() => { console.warn = originalWarn; });

  assert.equal(result.source, 'cache');
  assert.equal(result.stale, true);
  assert.equal(result.entries[0].playerName, 'キャッシュ');
});

test('one broken cache does not discard rankings from the other modes', async () => {
  const rankingService = await rankingServicePromise;
  const originalWarn = console.warn;
  const originalGetItem = localStorage.getItem;
  console.warn = () => undefined;
  localStorage.getItem = (key: string) => {
    if (key === 'island_game_rankings') {
      throw new Error('corrupt storage backend');
    }
    return originalGetItem(key);
  };
  globalThis.fetch = async () => { throw new TypeError('offline'); };

  const result = await rankingService.fetchAllRankingsWithStatus().finally(() => {
    localStorage.getItem = originalGetItem;
    console.warn = originalWarn;
  });

  assert.deepEqual(result.failedModes, [GameMode.ISLAND]);
  assert.equal(result.staleModes.includes(GameMode.STRAWBERRY), true);
  assert.deepEqual(result.rankings[GameMode.ISLAND], []);
});

test('queue overflow is reported and retains the newest 50 scores', async () => {
  const rankingService = await rankingServicePromise;
  const pending = Array.from({ length: 50 }, (_, index) => ({
    submissionId: `queued_submission_${String(index).padStart(4, '0')}`,
    playerName: '待機中',
    score: 1,
    gameType: 'strawberry_rush',
    durationMs: 30_000,
    createdAt: new Date(1_700_000_000_000 + index).toISOString(),
  }));
  values.set('strawberry_pending_scores_v1', JSON.stringify(pending));
  const originalWarn = console.warn;
  console.warn = () => undefined;
  globalThis.fetch = async () => { throw new TypeError('offline'); };

  const saved = await rankingService.saveScoreForMode(
    GameMode.STRAWBERRY,
    '新しいスコア',
    1,
    { durationMs: 30_000 },
  ).finally(() => { console.warn = originalWarn; });
  const retained = JSON.parse(values.get('strawberry_pending_scores_v1') ?? '[]') as { submissionId: string }[];

  assert.equal(saved.droppedPendingScores, 1);
  assert.equal(retained.length, 50);
  assert.notEqual(retained[0].submissionId, pending[0].submissionId);
  assert.equal(retained[49].submissionId, saved.entry.id);
});

test('private history and deletion use the local bearer token instead of a player name URL', async () => {
  const rankingService = await rankingServicePromise;
  const requests: { url: string; method: string; authorization: string | null }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    requests.push({ url, method: init?.method ?? 'GET', authorization: headers.get('authorization') });
    if (init?.method === 'DELETE') {
      return Response.json({ deleted: 2 });
    }
    return Response.json([{
      id: 'private-history-1',
      playerName: '本人',
      score: 8,
      gameType: 'strawberry_rush',
      createdAt: '2026-07-21T00:00:00.000Z',
    }]);
  };

  const history = await rankingService.fetchPlayerScoreHistory('URLに含めない名前');
  const deleted = await rankingService.deletePlayerRankingData();

  assert.equal(history.length, 1);
  assert.equal(deleted, 2);
  assert.match(requests[0].url, /\/players\/me\/history/);
  assert.doesNotMatch(requests[0].url, /URL/);
  assert.match(String(requests[0].authorization), /^Bearer [0-9a-f-]{36}$/i);
  assert.equal(requests[1].method, 'DELETE');
  assert.equal(requests[1].authorization, requests[0].authorization);
  assert.equal(values.has('player_private_token_v1'), false);
});
