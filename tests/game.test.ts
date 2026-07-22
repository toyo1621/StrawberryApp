import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createColorRound,
  countryCodeToFlagEmoji,
  describeEmoji,
  getDistinctColorCandidates,
  getColorCategory,
  progressPercent,
  shuffle,
} from '../src/domain/game';
import { COLORS } from '../src/constants';

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

test('color categories preserve every documented boundary', () => {
  assert.equal(getColorCategory('1'), 'red');
  assert.equal(getColorCategory('20'), 'red');
  assert.equal(getColorCategory('21'), 'yellow-red');
  assert.equal(getColorCategory('64'), 'blue-green');
  assert.equal(getColorCategory('65'), 'blue');
  assert.equal(getColorCategory('120'), 'grayish');
  assert.equal(getColorCategory('121'), 'achromatic');
  assert.equal(getColorCategory('invalid'), 'achromatic');
});

test('every color has a visually distinct distractor in its preferred category', () => {
  for (const target of COLORS) {
    const candidates = getDistinctColorCandidates(COLORS, target);
    assert.ok(candidates.length > 0, `${target.name} must have a distractor`);
    for (const candidate of candidates) {
      assert.notEqual(candidate.id, target.id);
      assert.notEqual(candidate.hex.toUpperCase(), target.hex.toUpperCase());
    }
  }
});

test('color rounds are deterministic and never render two identical choices', () => {
  const values = [0.01, 0.4, 0.9];
  let index = 0;
  const round = createColorRound(COLORS, () => values[index++]);

  assert.equal(round.correctIndex, 1);
  assert.equal(round.choices[round.correctIndex].id, round.target.id);
  assert.notEqual(round.choices[0].id, round.choices[1].id);
  assert.notEqual(round.choices[0].hex.toUpperCase(), round.choices[1].hex.toUpperCase());
});
