import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  normalizePlayerName,
  parseGameType,
  parseRankingPeriod,
  validateScoreSubmission,
} from './rankingValidation.js';

const validScore = (overrides: Record<string, unknown> = {}) => ({
  submissionId: 'validation_test_000001',
  playerName: 'ぱん',
  score: 10,
  gameType: 'strawberry_rush',
  durationMs: 30_000,
  ...overrides,
});

test('normalizes player names consistently', () => {
  assert.equal(normalizePlayerName('  佐々木　太郎  '), '佐々木 太郎');
});

test('accepts a plausible score submission', () => {
  assert.deepEqual(
    validateScoreSubmission({
      submissionId: 'validation_test_000002',
      playerName: 'ぱん',
      score: 194,
      gameType: 'strawberry_rush',
      durationMs: 30_000,
    }),
    {
      submissionId: 'validation_test_000002',
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
  assert.throws(() => validateScoreSubmission(validScore({ playerName: '1234567890123' })));
  assert.throws(() => validateScoreSubmission(validScore({ playerName: '<script>' })));
});

test('rejects impossible scores', () => {
  assert.throws(() => validateScoreSubmission(validScore({ score: 9999 })));
  assert.throws(() => validateScoreSubmission(validScore({
    score: 100,
    gameType: 'island_rush',
    durationMs: 1_000,
  })));
});

test('requires strict numeric fields, duration, and submission ID', () => {
  assert.throws(() => validateScoreSubmission(validScore({ submissionId: undefined })));
  assert.throws(() => validateScoreSubmission(validScore({ durationMs: undefined })));
  assert.throws(() => validateScoreSubmission(validScore({ score: '10' })));
  assert.throws(() => validateScoreSubmission(validScore({ gameType: undefined })));
});
