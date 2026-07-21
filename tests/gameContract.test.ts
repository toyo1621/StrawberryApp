import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_MODE_CONFIG, GAME_MODE_ORDER } from '../src/gameConfig';
import { ANSWER_FEEDBACK_MS, GAMEPLAY_RULES } from '../src/gameRules';
import { GameMode } from '../src/types';
import { MAX_GAME_DURATION_MS, SCORE_PROFILES } from '../worker/src/rankingValidation';

const MAX_POINTS_PER_ANSWER: Record<GameMode, number> = {
  [GameMode.STRAWBERRY]: GAMEPLAY_RULES[GameMode.STRAWBERRY].wholeCake.points,
  [GameMode.ISLAND]: GAMEPLAY_RULES[GameMode.ISLAND].golden.points,
  [GameMode.FLAG]: GAMEPLAY_RULES[GameMode.FLAG].regularPoints,
  [GameMode.COLOR]: GAMEPLAY_RULES[GameMode.COLOR].regularPoints,
};

test('client session limits and server score validation share one provable contract', () => {
  for (const mode of GAME_MODE_ORDER) {
    const rules = GAMEPLAY_RULES[mode];
    const profile = SCORE_PROFILES[GAME_MODE_CONFIG[mode].apiType];
    const maximumPoints = MAX_POINTS_PER_ANSWER[mode];
    const maximumAnswers = Math.floor(MAX_GAME_DURATION_MS / ANSWER_FEEDBACK_MS);

    assert.equal(rules.maxSessionTicks * 100, MAX_GAME_DURATION_MS);
    assert.ok(profile.maxScorePerSecond >= Math.ceil(maximumPoints * 1000 / ANSWER_FEEDBACK_MS));
    assert.ok(profile.maxScore >= maximumAnswers * maximumPoints);
  }
});
