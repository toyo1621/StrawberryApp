import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameMode, IslandRegion } from '../src/types';

const values = new Map<string, string>();
const localStorage = {
  get length() {
    return values.size;
  },
  clear: () => values.clear(),
  getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage },
});
process.env.EXPO_PUBLIC_RANKINGS_API_URL = 'https://rankings.test';

const rankingServicePromise = import('../src/services/rankingService');

const verifiedSession = (
  gameType: 'strawberry_rush' | 'island_rush' | 'flag_rush' | 'color_rush',
  islandRegion: IslandRegion = IslandRegion.ALL,
) => ({
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  gameType,
  islandRegion,
  startedAt: new Date(Date.now() - 30_000).toISOString(),
  expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
});

beforeEach(() => {
  values.clear();
});

test('game sessions are created with the local bearer token and requested scope', async () => {
  const rankingService = await rankingServicePromise;
  let requestBody: Record<string, unknown> | undefined;
  let authorization: string | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    authorization = new Headers(init?.headers).get('authorization');
    return Response.json({
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      gameType: requestBody.gameType,
      islandRegion: requestBody.islandRegion,
      startedAt: '2026-07-22T00:00:00.000Z',
      expiresAt: '2026-07-22T00:15:00.000Z',
    }, { status: 201 });
  };

  const session = await rankingService.createRankingGameSession(
    GameMode.ISLAND,
    IslandRegion.OKINAWA,
  );

  assert.equal(session?.islandRegion, IslandRegion.OKINAWA);
  assert.equal(requestBody?.gameType, 'island_rush');
  assert.match(String(authorization), /^Bearer [0-9a-f-]{36}$/i);
});

test('game session startup fails fast without retrying', async () => {
  const rankingService = await rankingServicePromise;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    throw new TypeError('offline');
  };

  await assert.rejects(
    rankingService.createRankingGameSession(GameMode.STRAWBERRY),
    /offline/,
  );
  assert.equal(attempts, 1);
});

test('leaderboard reads retry a throttled response using Retry-After', async () => {
  const rankingService = await rankingServicePromise;
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return Response.json(
        { error: 'Too many requests.' },
        { status: 429, headers: { 'retry-after': '0' } },
      );
    }
    return Response.json([]);
  };

  const result = await rankingService.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY);

  assert.equal(attempts, 2);
  assert.deepEqual(result.entries, []);
  assert.equal(result.source, 'remote');
});

test('a game without a verified session remains local and is not submitted', async () => {
  const rankingService = await rankingServicePromise;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error('score submission must not be attempted');
  };

  const saved = await rankingService.saveScoreForMode(
    GameMode.COLOR,
    'オフライン',
    2,
    { durationMs: 30_000 },
  );

  assert.equal(requests, 0);
  assert.equal(saved.destination, 'local');
  assert.equal(saved.verifiedForRanking, false);
  assert.equal(saved.queuedForSync, false);
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
    { durationMs: 30_000, gameSession: verifiedSession('strawberry_rush') },
  ).finally(() => {
    console.warn = originalWarn;
  });
  assert.equal(saved.queuedForSync, true);
  assert.equal(attempts, 2);
  const queued = JSON.parse(values.get('strawberry_pending_scores_v1') ?? '[]') as Record<string, unknown>[];
  assert.equal(queued.length, 1);
  assert.equal('playerToken' in queued[0], false);

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
  assert.equal(syncedBody?.gameSessionId, 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  assert.match(String(syncedAuthorization), /^Bearer [0-9a-f-]{36}$/i);
  assert.equal('playerToken' in (syncedBody ?? {}), false);
});

test('a score queued during synchronization is not overwritten by the sync result', async () => {
  const rankingService = await rankingServicePromise;
  values.set('strawberry_pending_scores_v1', JSON.stringify([{
    submissionId: 'sync_in_progress_score_0001',
    playerName: '同期中',
    score: 2,
    gameType: 'strawberry_rush',
    islandRegion: 'all',
    durationMs: 30_000,
    createdAt: '2026-07-22T00:00:00.000Z',
    gameSessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    gameSessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  }]));

  let releaseSync!: () => void;
  let markSyncStarted!: () => void;
  let markNewScoreAttempted!: () => void;
  const syncRelease = new Promise<void>((resolve) => { releaseSync = resolve; });
  const syncStarted = new Promise<void>((resolve) => { markSyncStarted = resolve; });
  const newScoreAttempted = new Promise<void>((resolve) => { markNewScoreAttempted = resolve; });
  let newScoreAttempts = 0;
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    if (body.playerName === '同期中') {
      markSyncStarted();
      await syncRelease;
      return Response.json({
        id: body.submissionId,
        playerName: body.playerName,
        score: body.score,
        gameType: body.gameType,
        islandRegion: body.islandRegion,
        createdAt: '2026-07-22T00:00:30.000Z',
      }, { status: 201 });
    }
    newScoreAttempts += 1;
    if (newScoreAttempts === 2) {
      markNewScoreAttempted();
    }
    throw new TypeError('offline');
  };

  const originalWarn = console.warn;
  console.warn = () => undefined;
  try {
    const syncing = rankingService.syncPendingScores();
    await syncStarted;
    const saving = rankingService.saveScoreForMode(
      GameMode.STRAWBERRY,
      '同時追加',
      3,
      { durationMs: 30_000, gameSession: verifiedSession('strawberry_rush') },
    );
    await newScoreAttempted;
    releaseSync();

    const [syncResult, saveResult] = await Promise.all([syncing, saving]);
    const retained = JSON.parse(
      values.get('strawberry_pending_scores_v1') ?? '[]',
    ) as Record<string, unknown>[];

    assert.deepEqual(syncResult, { synced: 1, pending: 0, discarded: 0 });
    assert.equal(saveResult.queuedForSync, true);
    assert.deepEqual(retained.map((score) => score.submissionId), [saveResult.entry.id]);
  } finally {
    console.warn = originalWarn;
    releaseSync();
  }
});

test('legacy pending scores are sanitized without losing a retryable score', async () => {
  const rankingService = await rankingServicePromise;
  values.set('strawberry_pending_scores_v1', JSON.stringify([{
    submissionId: 'legacy_pending_score_0001',
    playerName: '旧キュー',
    score: 2,
    gameType: 'strawberry_rush',
    islandRegion: 'all',
    durationMs: 30_000,
    createdAt: '2026-07-22T00:00:00.000Z',
    playerToken: '01234567-89ab-4cde-8f01-23456789abcd',
    gameSessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    gameSessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  }]));
  globalThis.fetch = async () => { throw new TypeError('offline'); };

  const result = await rankingService.syncPendingScores();
  const retained = JSON.parse(values.get('strawberry_pending_scores_v1') ?? '[]') as Record<string, unknown>[];

  assert.deepEqual(result, { synced: 0, pending: 1, discarded: 0 });
  assert.equal(retained[0].submissionId, 'legacy_pending_score_0001');
  assert.equal('playerToken' in retained[0], false);
});

test('a permanent API rejection is surfaced instead of queued', async () => {
  const rankingService = await rankingServicePromise;
  globalThis.fetch = async () => Response.json({ error: 'Rejected.' }, { status: 400 });

  await assert.rejects(
    rankingService.saveScoreForMode(GameMode.FLAG, 'テスト', 3, {
      durationMs: 30_000,
      gameSession: verifiedSession('flag_rush'),
    }),
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

test('a successful empty leaderboard response removes stale cached rankings', async () => {
  const rankingService = await rankingServicePromise;
  values.set('strawberry_game_rankings', JSON.stringify([{
    id: 'stale-remote-score',
    playerName: '移動済み',
    score: 99,
    gameType: 'strawberry_rush',
    islandRegion: IslandRegion.ALL,
    createdAt: '2026-07-20T00:00:00.000Z',
  }]));
  globalThis.fetch = async () => Response.json([]);

  const result = await rankingService.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY);

  assert.deepEqual(result.entries, []);
  assert.deepEqual(JSON.parse(values.get('strawberry_game_rankings') ?? 'null'), []);
});

test('authoritative leaderboard refresh preserves only scores still waiting to sync', async () => {
  const rankingService = await rankingServicePromise;
  const pendingEntry = {
    id: 'pending-score-id',
    playerName: '未送信',
    score: 4,
    gameType: 'strawberry_rush',
    islandRegion: IslandRegion.ALL,
    createdAt: '2026-07-22T00:00:00.000Z',
  };
  values.set('strawberry_game_rankings', JSON.stringify([
    pendingEntry,
    { ...pendingEntry, id: 'stale-score-id', playerName: '削除済み' },
  ]));
  values.set('strawberry_pending_scores_v1', JSON.stringify([{
    submissionId: pendingEntry.id,
    playerName: pendingEntry.playerName,
    score: pendingEntry.score,
    gameType: pendingEntry.gameType,
    islandRegion: pendingEntry.islandRegion,
    durationMs: 30_000,
    createdAt: pendingEntry.createdAt,
  }]));
  globalThis.fetch = async () => Response.json([]);

  await rankingService.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY);
  const cached = JSON.parse(values.get('strawberry_game_rankings') ?? '[]') as { id: string }[];

  assert.deepEqual(cached.map((entry) => entry.id), [pendingEntry.id]);
});

test('private history survives an authoritative leaderboard refresh', async () => {
  const rankingService = await rankingServicePromise;
  let requestCount = 0;
  globalThis.fetch = async (_input, init) => {
    requestCount += 1;
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({
        id: body.submissionId,
        playerName: body.playerName,
        score: body.score,
        gameType: body.gameType,
        islandRegion: body.islandRegion,
        createdAt: '2026-07-22T00:00:00.000Z',
      }, { status: 201 });
    }
    return Response.json([]);
  };

  const saved = await rankingService.saveScoreForMode(
    GameMode.STRAWBERRY,
    '履歴保持',
    3,
    { durationMs: 30_000, gameSession: verifiedSession('strawberry_rush') },
  );
  await rankingService.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY);
  const originalWarn = console.warn;
  console.warn = () => undefined;
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  const history = await rankingService.fetchPlayerScoreHistory('履歴保持')
    .finally(() => { console.warn = originalWarn; });

  assert.ok(requestCount >= 2);
  assert.equal(history.some((entry) => entry.id === saved.entry.id), true);
});

test('cached private history remains available after the player changes their display name', async () => {
  const rankingService = await rankingServicePromise;
  const saved = await rankingService.saveScoreForMode(
    GameMode.STRAWBERRY,
    '変更前',
    4,
    { durationMs: 30_000 },
  );
  const originalWarn = console.warn;
  console.warn = () => undefined;
  globalThis.fetch = async () => { throw new TypeError('offline'); };

  const history = await rankingService.fetchPlayerScoreHistory('変更後')
    .finally(() => { console.warn = originalWarn; });

  assert.equal(history.some((entry) => entry.id === saved.entry.id), true);
  assert.equal(history[0].playerName, '変更前');
});

test('island rankings are requested, saved, and cached by region', async () => {
  const rankingService = await rankingServicePromise;
  const requests: string[] = [];
  let postedBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      postedBody = body;
      return Response.json({
        id: body.submissionId,
        playerName: body.playerName,
        score: body.score,
        gameType: body.gameType,
        islandRegion: body.islandRegion,
        createdAt: '2026-07-21T00:00:00.000Z',
      }, { status: 201 });
    }

    const region = new URL(url).searchParams.get('islandRegion') ?? IslandRegion.ALL;
    return Response.json([{
      id: `ranking-${region}`,
      playerName: `${region}選手`,
      score: region === IslandRegion.CHUGOKU ? 8 : 6,
      gameType: 'island_rush',
      islandRegion: region,
      createdAt: '2026-07-21T00:00:00.000Z',
    }]);
  };

  const chugoku = await rankingService.fetchRankingsForModeWithStatus(
    GameMode.ISLAND,
    undefined,
    IslandRegion.CHUGOKU,
  );
  const shikoku = await rankingService.fetchRankingsForModeWithStatus(
    GameMode.ISLAND,
    undefined,
    IslandRegion.SHIKOKU,
  );
  await rankingService.saveScoreForMode(
    GameMode.ISLAND,
    '地域選手',
    5,
    {
      durationMs: 30_000,
      islandRegion: IslandRegion.CHUGOKU,
      gameSession: verifiedSession('island_rush', IslandRegion.CHUGOKU),
    },
  );

  assert.equal(chugoku.entries[0].islandRegion, IslandRegion.CHUGOKU);
  assert.equal(shikoku.entries[0].islandRegion, IslandRegion.SHIKOKU);
  assert.match(requests[0], /islandRegion=chugoku/);
  assert.match(requests[1], /islandRegion=shikoku/);
  assert.equal(values.has('island_game_rankings_chugoku'), true);
  assert.equal(values.has('island_game_rankings_shikoku'), true);
  assert.equal(values.has('island_game_rankings'), false);
  assert.equal(postedBody?.islandRegion, IslandRegion.CHUGOKU);
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
    { durationMs: 30_000, gameSession: verifiedSession('strawberry_rush') },
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

test('compatibility helpers preserve every game mode and ranking period', async () => {
  const rankingService = await rankingServicePromise;
  globalThis.fetch = async () => Response.json([]);

  const rankings = await Promise.all([
    rankingService.fetchRankings(),
    rankingService.fetchIslandRankings(IslandRegion.OKINAWA),
    rankingService.fetchFlagRankings(),
    rankingService.fetchColorRankings(),
    rankingService.fetchRankingsByPeriod(rankingService.RankingPeriod.WEEKLY),
    rankingService.fetchIslandRankingsByPeriod(rankingService.RankingPeriod.MONTHLY, IslandRegion.SHIKOKU),
    rankingService.fetchFlagRankingsByPeriod(rankingService.RankingPeriod.DAILY),
    rankingService.fetchColorRankingsByPeriod(rankingService.RankingPeriod.ALL),
  ]);
  assert.equal(rankings.every((entries) => entries.length === 0), true);

  const metadata = { durationMs: 30_000 };
  const saved = await Promise.all([
    rankingService.saveScore('互換いちご', 1, metadata),
    rankingService.saveIslandScore('互換しま', 1, metadata),
    rankingService.saveFlagScore('互換国旗', 1, metadata),
    rankingService.saveColorScore('互換カラー', 1, metadata),
  ]);
  assert.deepEqual(saved.map((result) => result.entry.gameType), [
    'strawberry_rush',
    'island_rush',
    'flag_rush',
    'color_rush',
  ]);
});

test('online ranking opt-out keeps pending scores on the device without network access', async () => {
  const rankingService = await rankingServicePromise;
  values.set('strawberry_pending_scores_v1', JSON.stringify([{
    submissionId: 'privacy_paused_score_0001',
    playerName: '端末のみ',
    score: 3,
    gameType: 'strawberry_rush',
    islandRegion: 'all',
    durationMs: 30_000,
    createdAt: '2026-07-22T00:00:00.000Z',
    gameSessionId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    gameSessionExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  }]));
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return Response.json([]);
  };

  const result = await rankingService.syncPendingScores({ onlineRankingsEnabled: false });

  assert.deepEqual(result, { synced: 0, pending: 1, discarded: 0 });
  assert.equal(requests, 0);
  assert.equal(JSON.parse(values.get('strawberry_pending_scores_v1') ?? '[]').length, 1);
});

test('disabling ranking participation can discard every unsent score explicitly', async () => {
  const rankingService = await rankingServicePromise;
  values.set('strawberry_pending_scores_v1', JSON.stringify([{
    submissionId: 'privacy_discard_score_0001',
    playerName: '削除待ち',
    score: 3,
    gameType: 'strawberry_rush',
    islandRegion: 'all',
    durationMs: 30_000,
    createdAt: '2026-07-22T00:00:00.000Z',
  }]));

  assert.equal(await rankingService.discardPendingRankingScores(), 1);
  assert.equal(values.has('strawberry_pending_scores_v1'), false);
});

test('an offline-only score fails clearly when its only durable storage is unavailable', async () => {
  const rankingService = await rankingServicePromise;
  const originalSetItem = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('storage full');
  };
  try {
    await assert.rejects(
      rankingService.saveScoreForMode(
        GameMode.COLOR,
        '保存失敗',
        2,
        { durationMs: 30_000 },
      ),
      /storage full/,
    );
  } finally {
    localStorage.setItem = originalSetItem;
  }
});

test('a remotely accepted score succeeds even when its local cache cannot be written', async () => {
  const rankingService = await rankingServicePromise;
  values.set('player_private_token_v1', 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee');
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({
      id: body.submissionId,
      playerName: body.playerName,
      score: body.score,
      gameType: body.gameType,
      islandRegion: body.islandRegion,
      createdAt: '2026-07-22T00:00:00.000Z',
    }, { status: 201 });
  };
  const originalSetItem = localStorage.setItem;
  const originalWarn = console.warn;
  localStorage.setItem = (key, value) => {
    if (key.includes('rankings') || key.includes('history')) {
      throw new Error('cache unavailable');
    }
    originalSetItem(key, value);
  };
  console.warn = () => undefined;
  try {
    const result = await rankingService.saveScoreForMode(
      GameMode.STRAWBERRY,
      '送信成功',
      4,
      { durationMs: 30_000, gameSession: verifiedSession('strawberry_rush') },
    );
    assert.equal(result.destination, 'remote');
    assert.equal(result.verifiedForRanking, true);
  } finally {
    localStorage.setItem = originalSetItem;
    console.warn = originalWarn;
  }
});

test('concurrent local scores are merged without a lost update', async () => {
  const rankingService = await rankingServicePromise;

  await Promise.all([
    rankingService.saveScoreForMode(
      GameMode.COLOR,
      '同時1',
      1,
      { durationMs: 30_000 },
    ),
    rankingService.saveScoreForMode(
      GameMode.COLOR,
      '同時2',
      2,
      { durationMs: 30_000 },
    ),
  ]);

  const leaderboard = JSON.parse(values.get('color_game_rankings') ?? '[]') as unknown[];
  const history = JSON.parse(values.get('strawberry_player_history_v2_color_rush') ?? '[]') as unknown[];
  assert.equal(leaderboard.length, 2);
  assert.equal(history.length, 2);
});
