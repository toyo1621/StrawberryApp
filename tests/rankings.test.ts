import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterRankingsByPeriod,
  getPlayerNameLength,
  getPlayerNameValidationError,
  getPeriodStartDate,
  getRankingPositionByEntryId,
  getLeaderboardEntries,
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

test('player names use Unicode characters and reject invisible display controls', () => {
  assert.equal(getPlayerNameLength('🍓'.repeat(12)), 12);
  assert.equal(getPlayerNameValidationError('🍓'.repeat(12)), null);
  assert.match(getPlayerNameValidationError('🍓'.repeat(13)) ?? '', /12文字/);
  assert.match(getPlayerNameValidationError('安全\u202e偽装') ?? '', /使用できない文字/);
  assert.match(getPlayerNameValidationError('名前\u200b') ?? '', /使用できない文字/);
  assert.match(getPlayerNameValidationError('名前\u061c') ?? '', /使用できない文字/);
  assert.match(getPlayerNameValidationError('<script>') ?? '', /使用できない文字/);
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

test('leaderboards preserve same-name owners and keep only the current player best', () => {
  const rankings = [
    entry('same-name-owner', 'Player', 18, '2026-01-02T00:00:00.000Z'),
    { ...entry('current-old', ' player ', 10, '2026-01-03T00:00:00.000Z'), isCurrentPlayer: true },
    { ...entry('current-best-late', 'PLAYER', 20, '2026-01-03T00:00:00.000Z'), isCurrentPlayer: true },
    { ...entry('current-best-early', 'PLAYER', 20, '2026-01-01T00:00:00.000Z'), isCurrentPlayer: true },
  ];

  assert.deepEqual(
    getLeaderboardEntries(rankings).map(({ id }) => id),
    ['current-best-early', 'same-name-owner'],
  );
});

test('the current rank uses submission id when names and scores are identical', () => {
  const rankings = [
    entry('another-owner', '同じ名前', 8, '2026-01-01T00:00:00.000Z'),
    entry('current-owner', '同じ名前', 8, '2026-01-02T00:00:00.000Z'),
  ];

  assert.equal(getRankingPositionByEntryId(rankings, 'current-owner'), 2);
  assert.equal(getRankingPositionByEntryId(rankings, 'missing'), null);
  assert.equal(getRankingPositionByEntryId(rankings, null), null);
});
