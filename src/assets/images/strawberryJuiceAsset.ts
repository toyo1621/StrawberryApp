// いちご汁の画像アセット
// Web環境では相対パスを使用（GitHub Pages用）
import { Platform } from 'react-native';

const strawberryJuiceAsset = require('./strawberry-juice.png');

export const strawberryJuiceImage = Platform.OS === 'web'
  ? { uri: './assets/src/assets/images/strawberry-juice.43c5c9eea98428df03b6ceceff0b04df.png' }
  : strawberryJuiceAsset;
