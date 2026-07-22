import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';
import { GameState } from '../types';

const SCREEN_ANNOUNCEMENTS: Record<GameState, string> = {
  [GameState.START]: 'ホーム画面',
  [GameState.PLAYING]: 'いちごモードを開始しました',
  [GameState.ISLAND_PLAYING]: '島モードを開始しました',
  [GameState.FLAG_PLAYING]: '国旗モードを開始しました',
  [GameState.COLOR_PLAYING]: '色モードを開始しました',
  [GameState.MEMORY_GAME]: '記憶チャレンジ1問目',
  [GameState.MEMORY_GAME_2]: '記憶チャレンジ2問目',
  [GameState.GAME_OVER]: 'ゲーム終了画面',
  [GameState.RULES]: 'ゲームルール画面',
  [GameState.MY_PAGE]: 'マイページ',
  [GameState.SETTINGS]: '設定画面',
  [GameState.PRIVACY_POLICY]: 'プライバシーポリシー画面',
  [GameState.TERMS_OF_SERVICE]: '利用規約画面',
};

export const useScreenAnnouncement = (gameState: GameState): void => {
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(SCREEN_ANNOUNCEMENTS[gameState]);
  }, [gameState]);
};
