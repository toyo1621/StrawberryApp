import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  normalizePlayerName,
  parseGameType,
  parseRankingPeriod,
  validateScoreSubmission,
} from './rankingValidation.js';

test('normalizes player names consistently', () => {
  assert.equal(normalizePlayerName('  佐々木　太郎  '), '佐々木 太郎');
});

test('accepts a plausible score submission', () => {
  assert.deepEqual(
    validateScoreSubmission({
      playerName: 'ぱん',
      score: 194,
      gameType: 'strawberry_rush',
      durationMs: 30_000,
    }),
    {
      playerName: 'ぱん',
      score: 194,
      gameType: 'strawberry_rush',
      durationMs: 30_000,
    },
  );
});

test('rejects unsupported game types and periods', () => {
  assert.throws(
    () => parseGameType('memory_rush'),
    (error) => error instanceof ValidationError && error.status === 400,
  );
  assert.throws(
    () => parseRankingPeriod('yearly'),
    (error) => error instanceof ValidationError && error.status === 400,
  );
});

test('rejects overlong or unsafe player names', () => {
  assert.throws(() => validateScoreSubmission({ playerName: '1234567890123', score: 1 }));
  assert.throws(() => validateScoreSubmission({ playerName: '<script>', score: 1 }));
});

test('rejects impossible scores', () => {
  assert.throws(() => validateScoreSubmission({ playerName: 'ぱん', score: 9999 }));
  assert.throws(() => validateScoreSubmission({
    playerName: 'ぱん',
    score: 100,
    gameType: 'island_rush',
    durationMs: 1_000,
  }));
});
