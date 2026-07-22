import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRankingsByPeriod,
  getPeriodStartDate,
  getUniquePlayerRankings,
  normalizePlayerName,
  rankingIdentity,
} from '../src/domain/rankings';
import { IslandRegion, RankingEntry, RankingPeriod } from '../src/types';

const entry = (id: string, playerName: string, score: number, createdAt: string): RankingEntry => ({
  id,
  playerName,
  score,
  gameType: 'strawberry_rush',
  islandRegion: IslandRegion.ALL,
  createdAt,
});

test('player names are normalized consistently for display and identity', () => {
  assert.equal(normalizePlayerName('  佐々木　太郎  '), '佐々木 太郎');
  assert.equal(rankingIdentity(' Player '), rankingIdentity('player'));
});

test('ranking periods start at midnight in Japan time', () => {
  const now = new Date('2026-07-21T15:30:00.000Z');
  assert.equal(getPeriodStartDate(RankingPeriod.DAILY, now).toISOString(), '2026-07-21T15:00:00.000Z');
  assert.equal(getPeriodStartDate(RankingPeriod.WEEKLY, now).toISOString(), '2026-07-19T15:00:00.000Z');
  assert.equal(getPeriodStartDate(RankingPeriod.MONTHLY, now).toISOString(), '2026-06-30T15:00:00.000Z');
});

test('period filtering excludes old and invalid timestamps', () => {
  const now = new Date('2026-07-21T15:30:00.000Z');
  const rankings = [
    entry('new', 'new', 10, '2026-07-21T15:05:00.000Z'),
    entry('old', 'old', 9, '2026-07-21T14:59:59.999Z'),
    entry('invalid', 'invalid', 8, 'not-a-date'),
  ];
  assert.deepEqual(filterRankingsByPeriod(rankings, RankingPeriod.DAILY, now).map(({ id }) => id), ['new']);
});

test('leaderboards keep one best score per normalized player and use earliest ties', () => {
  const rankings = [
    entry('first', 'Player', 10, '2026-01-02T00:00:00.000Z'),
    entry('best-late', ' player ', 20, '2026-01-03T00:00:00.000Z'),
    entry('best-early', 'PLAYER', 20, '2026-01-01T00:00:00.000Z'),
    entry('other', '別の人', 15, '2026-01-01T00:00:00.000Z'),
  ];

  assert.deepEqual(getUniquePlayerRankings(rankings).map(({ id }) => id), ['best-early', 'other']);
});
