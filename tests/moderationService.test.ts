import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { GameMode } from '../src/types';

const values = new Map<string, string>();
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
  get length() {return values.size;},
  clear: () => values.clear(), getItem: (key: string) => values.get(key) ?? null,
  key: (index: number) => [...values.keys()][index] ?? null,
  removeItem: (key: string) => values.delete(key),
  setItem: (key: string, value: string) => {values.set(key, String(value));},
} } });
process.env.EXPO_PUBLIC_RANKINGS_API_URL = 'https://rankings.test';
const servicePromise = import('../src/services/moderationService');
const rankingPromise = import('../src/services/rankingService');
const block = { id: '11111111-1111-4111-8111-111111111111', rankingId: 'score-a', playerName: '選手', createdAt: '2026-10-23T00:00:00.000Z' };
beforeEach(() => {values.clear();});

test('block responses are strictly parsed before saving and never accept owner hashes', async () => {
  const service = await servicePromise;
  assert.deepEqual(service.parsePlayerBlocks([block]), [block]);
  for (const value of [null, {}, [null], [{ ...block, id: 'bad' }], [{ ...block, rankingId: 1 }],
    [{ ...block, playerName: 'あ'.repeat(13) }], [{ ...block, createdAt: 'bad' }], Array(201).fill(block)]) {
    assert.throws(() => service.parsePlayerBlocks(value), /Invalid block/);
  }
  assert.deepEqual(service.parsePlayerBlocks([{ ...block, owner_hash: 'not-public' }]), [block]);
});

test('reports send only the ranking ID and enumerated reason with private credentials', async () => {
  const service = await servicePromise;
  const seen: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {seen.push({ url: String(input), init }); return Response.json({ id: 'receipt', status: 'received' });};
  await service.reportRankingName('score-a', 'offensive');
  assert.equal(seen[0].url, 'https://rankings.test/ranking-reports');
  assert.deepEqual(JSON.parse(String(seen[0].init?.body)), { rankingId: 'score-a', reason: 'offensive' });
  assert.match(new Headers(seen[0].init?.headers).get('authorization') ?? '', /^Bearer [0-9a-f-]{36}$/);
  globalThis.fetch = async () => Response.json({ status: 'unknown' });
  await assert.rejects(service.reportRankingName('score-a', 'other'), /Invalid report receipt/);
});

test('block and unblock refresh persisted preferences and invalidate public caches without deleting private history or queued scores', async () => {
  const service = await servicePromise;
  values.set('strawberry_game_rankings', '[{"id":"old"}]');
  values.set('island_game_rankings_kanto', '[{"id":"old"}]');
  values.set('strawberry_player_history_v2_strawberry_rush', '[{"id":"mine"}]');
  values.set('strawberry_pending_scores_v1', '[{"submissionId":"queued"}]');
  let changes = 0;
  const unsubscribe = service.subscribeModerationChanges(() => {changes += 1;});
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => {
    methods.push(init?.method ?? 'GET');
    return Response.json(init?.method === 'DELETE' ? [] : [block]);
  };
  assert.deepEqual(await service.blockRankingPlayer('score-a'), [block]);
  assert.equal(values.has('strawberry_game_rankings'), false);
  assert.equal(values.has('island_game_rankings_kanto'), false);
  assert.equal(values.get('strawberry_player_history_v2_strawberry_rush'), '[{"id":"mine"}]');
  assert.equal(values.get('strawberry_pending_scores_v1'), '[{"submissionId":"queued"}]');
  assert.deepEqual(await service.loadPlayerBlocks(), [block]);
  assert.deepEqual(await service.refreshPlayerBlocks(), [block]);
  assert.deepEqual(await service.unblockRankingPlayer(block.id), []);
  assert.equal(changes, 2);
  unsubscribe();
  await service.clearLocalModerationData();
  assert.equal(changes, 2);
  assert.deepEqual(await service.loadPlayerBlocks(), []);
  assert.deepEqual(methods, ['POST', 'GET', 'DELETE']);
});

test('offline fallback never revives other users from stale caches when any block is active or block storage is corrupt', async () => {
  const ranking = await rankingPromise;
  const entries = [
    { id: 'score-b', playerName: '他人', score: 10, gameType: 'strawberry_rush', islandRegion: 'all', createdAt: block.createdAt },
    { id: 'mine', playerName: '本人', score: 5, gameType: 'strawberry_rush', islandRegion: 'all', createdAt: block.createdAt, isCurrentPlayer: true },
  ];
  values.set('strawberry_game_rankings', JSON.stringify(entries));
  globalThis.fetch = async () => Response.json({ error: 'offline' }, { status: 403 });
  const warn = console.warn;
  console.warn = () => undefined;
  try {
    for (const prefs of [JSON.stringify([block]), '{corrupt']) {
      values.set('strawberry_player_blocks_v1', prefs);
      const result = await ranking.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY);
      assert.deepEqual(result.entries.map((entry) => entry.id), ['mine']);
      assert.equal(result.stale, true);
    }
  } finally {console.warn = warn;}
});

test('deleting player data clears local blocks and notifies ranking views', async () => {
  const service = await servicePromise;
  const ranking = await rankingPromise;
  values.set('strawberry_player_blocks_v1', JSON.stringify([block]));
  values.set('player_private_token_v1', block.id);
  let notified = 0;
  const unsubscribe = service.subscribeModerationChanges(() => {notified += 1;});
  globalThis.fetch = async () => Response.json({ deleted: 0 });
  await ranking.deletePlayerRankingData();
  assert.equal(values.has('strawberry_player_blocks_v1'), false);
  assert.equal(values.has('player_private_token_v1'), false);
  assert.equal(notified, 1);
  unsubscribe();
});

test('a leaderboard response started before a block change cannot resurrect outdated entries', async () => {
  const service = await servicePromise;
  const ranking = await rankingPromise;
  let finishRead: ((response: Response) => void) | undefined;
  globalThis.fetch = async (url) => String(url).includes('/rankings?')
    ? new Promise<Response>((resolve) => {finishRead = resolve;}) : Response.json([block]);
  const reading = ranking.fetchRankingsForModeWithStatus(GameMode.STRAWBERRY);
  while (!finishRead) {await new Promise((resolve) => setTimeout(resolve, 1));}
  await service.blockRankingPlayer('score-a');
  finishRead(Response.json([{ id: 'different-old-score', playerName: '古い名前', score: 10, gameType: 'strawberry_rush', islandRegion: 'all', createdAt: block.createdAt }]));
  assert.deepEqual((await reading).entries, []);
});
