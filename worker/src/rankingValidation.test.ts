import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  normalizePlayerName,
  parseGameType,
  parseIslandRegion,
  parseRankingPeriod,
  validatePlayerToken,
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
      islandRegion: 'all',
      durationMs: 30_000,
    }),
    {
      submissionId: 'validation_test_000002',
      playerName: 'ぱん',
      score: 194,
      gameType: 'strawberry_rush',
      islandRegion: 'all',
      durationMs: 30_000,
    },
  );
});

test('validates island ranking regions without changing existing nationwide submissions', () => {
  assert.equal(parseIslandRegion(undefined, 'island_rush'), 'all');
  assert.equal(parseIslandRegion('chugoku', 'island_rush'), 'chugoku');
  assert.equal(
    validateScoreSubmission(validScore({ gameType: 'island_rush', islandRegion: 'shikoku' })).islandRegion,
    'shikoku',
  );
  assert.throws(() => parseIslandRegion('unknown', 'island_rush'));
  assert.throws(() => parseIslandRegion('chugoku', 'strawberry_rush'));
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

test('accepts only version 4 UUID player tokens', () => {
  const token = '01234567-89ab-4cde-8f01-23456789abcd';
  assert.equal(validatePlayerToken(token), token);
  assert.equal(validateScoreSubmission(validScore({ playerToken: token })).playerToken, token);
  assert.throws(
    () => validatePlayerToken('predictable-token'),
    (error) => error instanceof ValidationError && error.status === 401,
  );
});
