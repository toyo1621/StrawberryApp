import { Platform } from 'react-native';

// 丸ゴシックフォント設定（太め）
export const MARU_GOTHIC_FONT = Platform.select({
  ios: 'Hiragino Maru Gothic ProN',
  android: 'sans-serif',
  default: 'sans-serif',
});

// 太めのフォントウェイト設定
export const FONT_WEIGHT_BOLD = '700';
export const FONT_WEIGHT_SEMIBOLD = '600';
export const FONT_WEIGHT_MEDIUM = '500';
