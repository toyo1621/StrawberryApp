import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMEPLAY_RULES, ticksToSeconds } from '../src/gameRules';
import { GameMode } from '../src/types';

test('all modes share the documented base time, points, and penalty', () => {
  Object.values(GAMEPLAY_RULES).forEach((rules) => {
    assert.equal(ticksToSeconds(rules.initialTimeTicks), 30);
    assert.equal(rules.regularPoints, 1);
    assert.equal(ticksToSeconds(rules.penaltyTicks), 3);
  });
});

test('mode-specific time and special-score rules are explicit', () => {
  const strawberry = GAMEPLAY_RULES[GameMode.STRAWBERRY];
  const island = GAMEPLAY_RULES[GameMode.ISLAND];

  assert.deepEqual(strawberry.shortCake, { chance: 0.03, points: 3, timeBonusTicks: 20 });
  assert.deepEqual(strawberry.wholeCake, { chance: 0.01, points: 5, timeBonusTicks: 50 });
  assert.equal(ticksToSeconds(strawberry.streak.timeBonusTicks), 0.5);
  assert.equal(ticksToSeconds(island.regularTimeBonusTicks), 0.3);
  assert.deepEqual(island.golden, { chance: 0.03, points: 3, timeBonusTicks: 10 });
  assert.equal(ticksToSeconds(GAMEPLAY_RULES[GameMode.FLAG].regularTimeBonusTicks), 1);
  assert.equal(ticksToSeconds(GAMEPLAY_RULES[GameMode.COLOR].regularTimeBonusTicks), 1);
});
