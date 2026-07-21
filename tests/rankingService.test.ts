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
  globalThis.fetch = async (_input, init) => {
    syncedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
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
