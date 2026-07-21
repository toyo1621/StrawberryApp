import test from 'node:test';
import assert from 'node:assert/strict';
import {
  API_GAME_TYPES,
  GAME_MODE_CONFIG,
  GAME_MODE_ORDER,
  createEmptyRankings,
  gameModeFromApiType,
} from '../src/gameConfig';

test('every game mode has one unique API type and an empty ranking bucket', () => {
  const apiTypes = GAME_MODE_ORDER.map((mode) => GAME_MODE_CONFIG[mode].apiType);
  assert.equal(new Set(apiTypes).size, GAME_MODE_ORDER.length);
  assert.deepEqual([...apiTypes].sort(), [...API_GAME_TYPES].sort());

  const empty = createEmptyRankings();
  GAME_MODE_ORDER.forEach((mode) => {
    assert.deepEqual(empty[mode], []);
    assert.equal(gameModeFromApiType(GAME_MODE_CONFIG[mode].apiType), mode);
  });
});
