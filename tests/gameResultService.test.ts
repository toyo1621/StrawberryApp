import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameMode, IslandRegion } from '../src/types';

const values = new Map<string, string>();
let failStorageReads = false;
const localStorage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: (key: string) => {
    if (failStorageReads) {throw new Error('storage unavailable');}
    return values.get(key) ?? null;
  },
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
};

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage },
});
process.env.EXPO_PUBLIC_RANKINGS_API_URL = 'https://rankings.test';

const gameResultServicePromise = import('../src/services/gameResultService');

beforeEach(() => {
  values.clear();
  failStorageReads = false;
});

const playerToken = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const gameSession = () => ({
  id: crypto.randomUUID(),
  gameType: 'strawberry_rush' as const,
  islandRegion: IslandRegion.ALL,
  startedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
});

test('ranking opt-out saves locally and returns an explicit result state', async () => {
  const { saveGameResult } = await gameResultServicePromise;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error('network must not be used');
  };

  const outcome = await saveGameResult({
    gameMode: GameMode.COLOR,
    islandRegion: IslandRegion.ALL,
    playerName: '端末プレイヤー',
    score: 2,
    durationMs: 30_000,
    gameSession: null,
    onlineRankingsEnabled: false,
  });

  assert.equal(requests, 0);
  assert.equal(outcome.rankings, null);
  assert.match(outcome.notice, /オンラインランキングはオフ/);
  assert.equal(outcome.warning, null);
  assert.equal(outcome.entry.score, 2);
});

test('a verified score and refreshed leaderboard produce one successful outcome', async () => {
  const { saveGameResult } = await gameResultServicePromise;
  values.set('player_private_token_v1', playerToken);
  let savedEntry: Record<string, unknown> | null = null;
  let leaderboardAuthorization: string | null = null;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/scores')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      savedEntry = {
        id: body.submissionId,
        playerName: body.playerName,
        score: body.score,
        gameType: body.gameType,
        islandRegion: body.islandRegion,
        createdAt: '2026-07-22T00:00:00.000Z',
      };
      return Response.json(savedEntry, { status: 201 });
    }
    leaderboardAuthorization = new Headers(init?.headers).get('authorization');
    return Response.json(
      leaderboardAuthorization === `Bearer ${playerToken}` && savedEntry ? [savedEntry] : [],
    );
  };

  const outcome = await saveGameResult({
    gameMode: GameMode.STRAWBERRY,
    islandRegion: IslandRegion.ALL,
    playerName: 'オンライン',
    score: 5,
    durationMs: 30_000,
    gameSession: {
      id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      gameType: 'strawberry_rush',
      islandRegion: IslandRegion.ALL,
      startedAt: '2026-07-22T00:00:00.000Z',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    onlineRankingsEnabled: true,
  });

  assert.equal(outcome.rankings?.length, 1);
  assert.equal(leaderboardAuthorization, `Bearer ${playerToken}`);
  assert.match(outcome.notice, /ランキングにスコアを保存/);
  assert.equal(outcome.warning, null);
});

test('a temporary submission failure reports the queued score and queue overflow', async () => {
  const { saveGameResult } = await gameResultServicePromise;
  values.set('player_private_token_v1', playerToken);
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  values.set('strawberry_pending_scores_v1', JSON.stringify(Array.from({ length: 50 }, (_, index) => ({
    submissionId: `pending-${index}`,
    playerName: '保存待ち',
    score: 1,
    gameType: 'strawberry_rush',
    islandRegion: 'all',
    durationMs: 30_000,
    createdAt: new Date(Date.now() + index).toISOString(),
    gameSessionId: `session-${index}`,
    gameSessionExpiresAt: expiresAt,
  }))));
  globalThis.fetch = async () => Response.json(
    { error: 'temporarily unavailable' },
    { status: 503, headers: { 'retry-after': '0' } },
  );

  const outcome = await saveGameResult({
    gameMode: GameMode.STRAWBERRY,
    islandRegion: IslandRegion.ALL,
    playerName: '送信待ち',
    score: 3,
    durationMs: 30_000,
    gameSession: gameSession(),
    onlineRankingsEnabled: true,
  });

  assert.equal(outcome.rankings?.length, 1);
  assert.match(outcome.notice, /次回オンライン時/);
  assert.match(outcome.warning ?? '', /保存待ち上限/);
});

test('a stale local leaderboard is distinguished after a verified save', async () => {
  const { saveGameResult } = await gameResultServicePromise;
  values.set('player_private_token_v1', playerToken);
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('/scores')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ ...body, id: body.submissionId, createdAt: new Date().toISOString() }, { status: 201 });
    }
    return Response.json({ error: 'offline' }, { status: 503, headers: { 'retry-after': '0' } });
  };

  const outcome = await saveGameResult({
    gameMode: GameMode.STRAWBERRY,
    islandRegion: IslandRegion.ALL,
    playerName: '保存成功',
    score: 4,
    durationMs: 30_000,
    gameSession: gameSession(),
    onlineRankingsEnabled: true,
  });

  assert.equal(outcome.rankings?.length, 1);
  assert.match(outcome.notice, /端末に保存したランキング/);
  assert.equal(outcome.warning, null);
});

test('leaderboard refresh failure never changes a verified save into a save failure', async () => {
  const { saveGameResult } = await gameResultServicePromise;
  values.set('player_private_token_v1', playerToken);
  globalThis.fetch = async (input, init) => {
    if (String(input).includes('/scores')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({ ...body, id: body.submissionId, createdAt: new Date().toISOString() }, { status: 201 });
    }
    failStorageReads = true;
    return Response.json({ error: 'offline' }, { status: 503, headers: { 'retry-after': '0' } });
  };

  const outcome = await saveGameResult({
    gameMode: GameMode.STRAWBERRY,
    islandRegion: IslandRegion.ALL,
    playerName: '表示失敗',
    score: 5,
    durationMs: 30_000,
    gameSession: gameSession(),
    onlineRankingsEnabled: true,
  });
  failStorageReads = false;

  assert.equal(outcome.rankings, null);
  assert.match(outcome.notice, /ランキングにスコアを保存/);
  assert.match(outcome.warning ?? '', /ランキング表示を更新できません/);
});
