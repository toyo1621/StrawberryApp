import { GameState } from '../types';

export const getBackDestination = (state: GameState): GameState | null => {
  if (state === GameState.START) {
    return null;
  }
  if (state === GameState.SETTINGS
    || state === GameState.PRIVACY_POLICY
    || state === GameState.TERMS_OF_SERVICE) {
    return GameState.MY_PAGE;
  }
  return GameState.START;
};
