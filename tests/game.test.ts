import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countryCodeToFlagEmoji,
  describeEmoji,
  progressPercent,
  shuffle,
} from '../src/domain/game';

test('shuffle is deterministic with an injected random source and does not mutate input', () => {
  const source = [1, 2, 3, 4];
  const values = [0.1, 0.7, 0.4];
  let index = 0;
  const result = shuffle(source, () => values[index++]);

  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.deepEqual(result, [2, 4, 3, 1]);
});

test('country codes become self-contained flag emoji', () => {
  assert.equal(countryCodeToFlagEmoji('jp'), '🇯🇵');
  assert.equal(countryCodeToFlagEmoji('GB'), '🇬🇧');
  assert.equal(countryCodeToFlagEmoji('invalid'), '🏳️');
});

test('progress percentage is clamped and handles invalid values', () => {
  assert.equal(progressPercent(15, 30), 50);
  assert.equal(progressPercent(45, 30), 100);
  assert.equal(progressPercent(-1, 30), 0);
  assert.equal(progressPercent(10, 0), 0);
});

test('choice emoji have spoken labels', () => {
  assert.equal(describeEmoji('🍓'), 'いちご');
  assert.equal(describeEmoji('🍒'), 'さくらんぼ');
  assert.equal(describeEmoji('unknown'), '絵文字の選択肢');
});
