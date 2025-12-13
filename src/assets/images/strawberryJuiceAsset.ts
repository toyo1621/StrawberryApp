// いちご汁の画像アセット
// Web環境では相対パスを使用（GitHub Pages用）
import { Platform } from 'react-native';

// ネイティブ環境用
const strawberryJuiceAsset = require('./strawberry-juice.png');

// Web環境用 - 画像が確実にバンドルされるように直接参照
const strawberryJuiceWebUri = './assets/src/assets/images/strawberry-juice.43c5c9eea98428df03b6ceceff0b04df.png';

export const strawberryJuiceImage = Platform.OS === 'web'
  ? { uri: strawberryJuiceWebUri }
  : strawberryJuiceAsset;

// 開発時に画像が参照されていることをMetro bundlerに知らせるための参照
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // Web環境でのダミー参照（実際には使用されない）
  console.log('Strawberry juice image URI:', strawberryJuiceWebUri);
}
