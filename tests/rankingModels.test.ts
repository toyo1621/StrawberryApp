import assert from 'node:assert/strict';
import test from 'node:test';
import { RankingsApiError } from '../src/services/rankingsApiClient';
import { parseRankingEntries } from '../src/services/rankingModels';

const entry = {
  id: 'ranking-entry',
  playerName: '選手',
  score: 10,
  gameType: 'strawberry_rush',
  islandRegion: 'all',
  createdAt: '2026-07-22T00:00:00.000Z',
};

test('ranking responses accept only a boolean current-player marker', () => {
  assert.deepEqual(parseRankingEntries([{ ...entry, isCurrentPlayer: true }]), [
    { ...entry, isCurrentPlayer: true },
  ]);
  assert.throws(
    () => parseRankingEntries([{ ...entry, isCurrentPlayer: 'true' }]),
    (error) => error instanceof RankingsApiError,
  );
});

test('public ranking positions survive parsing and reject invalid counters', () => {
  assert.equal(parseRankingEntries([{ ...entry, publicRank: 42 }])[0].publicRank, 42);
  for (const publicRank of [0, -1, 1.5, NaN, '2', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => parseRankingEntries([{ ...entry, publicRank }]), RankingsApiError);
  }
});
