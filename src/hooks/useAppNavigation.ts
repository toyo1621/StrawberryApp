import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { GameState } from '../types';

type AppNavigation = {
  showRules: () => void;
  backFromRules: () => void;
  showMyPage: () => void;
  backFromMyPage: () => void;
  showPrivacyPolicy: () => void;
  backFromPrivacyPolicy: () => void;
  showTermsOfService: () => void;
  backFromTermsOfService: () => void;
  showSettings: () => void;
  backFromSettings: () => void;
};

export const useAppNavigation = (
  setGameState: Dispatch<SetStateAction<GameState>>,
): AppNavigation => useMemo(() => ({
  showRules: () => setGameState(GameState.RULES),
  backFromRules: () => setGameState(GameState.START),
  showMyPage: () => setGameState(GameState.MY_PAGE),
  backFromMyPage: () => setGameState(GameState.START),
  showPrivacyPolicy: () => setGameState(GameState.PRIVACY_POLICY),
  backFromPrivacyPolicy: () => setGameState(GameState.MY_PAGE),
  showTermsOfService: () => setGameState(GameState.TERMS_OF_SERVICE),
  backFromTermsOfService: () => setGameState(GameState.MY_PAGE),
  showSettings: () => setGameState(GameState.SETTINGS),
  backFromSettings: () => setGameState(GameState.MY_PAGE),
}), [setGameState]);
