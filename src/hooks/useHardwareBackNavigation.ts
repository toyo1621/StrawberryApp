import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { getBackDestination } from '../domain/navigation';
import { GameState } from '../types';

export const useHardwareBackNavigation = (
  gameState: GameState,
  navigate: (state: GameState) => void,
): void => {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const destination = getBackDestination(gameState);
      if (destination === null) {
        return false;
      }
      navigate(destination);
      return true;
    });
    return () => subscription.remove();
  }, [gameState, navigate]);
};
