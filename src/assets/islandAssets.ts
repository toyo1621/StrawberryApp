// Island PNG assets map
import { Platform } from 'react-native';

const islandAssetsNative: { [key: string]: any } = {
  '1_hokkaido_rebuntou.svg': require('./islands_png/1_hokkaido_rebuntou.fd80723fb915e7dfa68cee49a3a84b98.png'),
  '2_hokkaido_rishiritou.svg': require('./islands_png/2_hokkaido_rishiritou.9cbe2f7c2a15d0c84e40280c62468f95.png'),
  '3_hokkaido_yagishiritou.svg': require('./islands_png/3_hokkaido_yagishiritou.486f958ab9195c8fc62ba5dabfae2676.png'),
  '4_hokkaido_teuritou.svg': require('./islands_png/4_hokkaido_teuritou.84a15eab8c9087525aae0c181ac8818a.png'),
  '5_hokkaido_okushiritou.svg': require('./islands_png/5_hokkaido_okushiritou.484c005849dddcddea8922a8686590f0.png'),
  '6_hokkaido_kojima.svg': require('./islands_png/6_hokkaido_kojima.13c93c339f04ae3abbdd7453969c19f8.png'),
  '7_miyagi_oshima.svg': require('./islands_png/7_miyagi_oshima.fdb716b5ba4e780fda270a5685e34fc2.png'),
  '8_miyagi_izushima.svg': require('./islands_png/8_miyagi_izushima.7d3d9001eac9d897d441c150e3cb5682.png'),
  '9_miyagi_enoshima.svg': require('./islands_png/9_miyagi_enoshima.e4e120158209d6f8fb7a7850559b36da.png'),
  '10_miyagi_ajishima.svg': require('./islands_png/10_miyagi_ajishima.f6707c3d27155fb6a3fe40f4d78053c1.png'),
  '11_miyagi_tashirojima.svg': require('./islands_png/11_miyagi_tashirojima.d82cc62c94ff32c202238a09cf3e9a5c.png'),
  '12_miyagi_kinkasan.svg': require('./islands_png/12_miyagi_kinkasan.e0560e62ca9a24e2dacbafb9c9a71d6d.png'),
  '13_miyagi_sabusawajima.svg': require('./islands_png/13_miyagi_sabusawajima.b73e381d0642bc633114e640bedf4e73.png'),
  '14_miyagi_nonoshima.svg': require('./islands_png/14_miyagi_nonoshima.ff33977df34cc6eb27e0e18408002c99.png'),
  '15_miyagi_katsurajima.svg': require('./islands_png/15_miyagi_katsurajima.c1413ad7cf74e01d7ff29a8aeadcc779.png'),
  '16_miyagi_hoojima.svg': require('./islands_png/16_miyagi_hoojima.63551cbfa7b92578d98a2a21830117e6.png'),
  '17_miyagi_miyatojima.svg': require('./islands_png/17_miyagi_miyatojima.d3c94f2dce69a1f14d7f5620f1da2887.png'),
  '18_yamagata_tobishima.svg': require('./islands_png/18_yamagata_tobishima.58abf5779a82333443e579235bfe8b45.png'),
  '19_chiba_niemonjima.svg': require('./islands_png/19_chiba_niemonjima.8b916ca7c86ba532c5184059cf496a30.png'),
  '20_tokyo_oshima.svg': require('./islands_png/20_tokyo_oshima.35413976e29156107b541ad874afefcc.png'),
  '21_tokyo_toshima.svg': require('./islands_png/21_tokyo_toshima.3cbad44d8becf736caedcc342cf7f1b6.png'),
  '22_tokyo_nijima.svg': require('./islands_png/22_tokyo_nijima.82880f57458e345b8624c20815c062d2.png'),
  '23_tokyo_shikinejima.svg': require('./islands_png/23_tokyo_shikinejima.46a4c4d95717a85c2aa7c276d7ba098b.png'),
  '24_tokyo_kozushima.svg': require('./islands_png/24_tokyo_kozushima.99735228bc8428c52072f047d3e48a26.png'),
  '25_tokyo_miyakejima.svg': require('./islands_png/25_tokyo_miyakejima.5382daa6a77e1aabfa8cc53531fd0bad.png'),
  '26_tokyo_mikurajima.svg': require('./islands_png/26_tokyo_mikurajima.6c45cb61941d016e6f12ad05fcd394d8.png'),
  '27_tokyo_hachijoshima.svg': require('./islands_png/27_tokyo_hachijoshima.20611fd75a43341315a4b2dff655b7c5.png'),
  '28_tokyo_aogashima.svg': require('./islands_png/28_tokyo_aogashima.b4230d339e47abae404f12461b5cec0f.png'),
  '29_tokyo_chichijima.svg': require('./islands_png/29_tokyo_chichijima.f80b74f537a185f0464db45e932075fa.png'),
  '30_tokyo_hahajima.svg': require('./islands_png/30_tokyo_hahajima.0c94e688ef7909b229b919269b64ddb4.png'),
  '31_tokyo_ioujima.svg': require('./islands_png/31_tokyo_ioujima.d0551ea12442572202965f635e01afbc.png'),
  '32_tokyo_minamitorishima.svg': require('./islands_png/32_tokyo_minamitorishima.a3a25c4c16cfe28401ac6f0484c3b373.png'),
  '33_kanagawa_jogashima.svg': require('./islands_png/33_kanagawa_jogashima.e0438c0458469022a7a75bec813a2b4d.png'),
  '34_kanagawa_enoshima.svg': require('./islands_png/34_kanagawa_enoshima.6f2ab1f0020907a27d10168a6762977c.png'),
  '40_shizuoka_hatsushima.svg': require('./islands_png/40_shizuoka_hatsushima.fff0a98a60f4e4d067f67bd28320e6a4.png'),
};

// Web環境ではPNGファイルをURIとして扱う
const getWebPngUri = (fileName: string): string => {
  // 拡張子を.svgから.pngに変更
  const pngFileName = fileName.replace('.svg', '.png');
  // islands_pngフォルダからハッシュ値付きのファイル名を構築
  const hashedFileName = Object.keys(islandAssetsNative).find(key => key === fileName);
  if (hashedFileName) {
    const asset = islandAssetsNative[hashedFileName];
    // Metroのasset拡張子からハッシュ付きファイル名を抽出
    const assetUri = asset.default?.uri || asset.uri;
    if (assetUri) {
      const fileNameWithHash = assetUri.split('/').pop();
      return `./assets/src/assets/islands_png/${fileNameWithHash}`;
    }
  }
  return `./assets/src/assets/islands_png/${pngFileName}`;
};

export const islandAssets: { [key: string]: any } = Platform.OS === 'web'
  ? Object.keys(islandAssetsNative).reduce((acc, key) => {
      acc[key] = { uri: getWebPngUri(key) };
      return acc;
    }, {} as { [key: string]: any })
  : islandAssetsNative;
