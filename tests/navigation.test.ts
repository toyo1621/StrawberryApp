import test from 'node:test';
import assert from 'node:assert/strict';
import { getBackDestination } from '../src/domain/navigation';
import { GameState } from '../src/types';

test('hardware back follows the visible navigation hierarchy', () => {
  assert.equal(getBackDestination(GameState.START), null);
  assert.equal(getBackDestination(GameState.SETTINGS), GameState.MY_PAGE);
  assert.equal(getBackDestination(GameState.PRIVACY_POLICY), GameState.MY_PAGE);
  assert.equal(getBackDestination(GameState.TERMS_OF_SERVICE), GameState.MY_PAGE);
  assert.equal(getBackDestination(GameState.MY_PAGE), GameState.START);
  assert.equal(getBackDestination(GameState.PLAYING), GameState.START);
  assert.equal(getBackDestination(GameState.GAME_OVER), GameState.START);
});
