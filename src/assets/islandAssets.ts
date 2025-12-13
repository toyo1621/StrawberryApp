// Island SVG assets map
import { Platform } from 'react-native';

// SVGファイルをテキストとしてインポート
const islandAssetsNative: { [key: string]: any } = {
  '1_hokkaido_rebuntou.svg': require('./islands/1_hokkaido_rebuntou.svg'),
  '2_hokkaido_rishiritou.svg': require('./islands/2_hokkaido_rishiritou.svg'),
  '3_hokkaido_yagishiritou.svg': require('./islands/3_hokkaido_yagishiritou.svg'),
  '4_hokkaido_teuritou.svg': require('./islands/4_hokkaido_teuritou.svg'),
  '5_hokkaido_okushiritou.svg': require('./islands/5_hokkaido_okushiritou.svg'),
  '6_hokkaido_kojima.svg': require('./islands/6_hokkaido_kojima.svg'),
  '7_miyagi_oshima.svg': require('./islands/7_miyagi_oshima.svg'),
  '8_miyagi_izushima.svg': require('./islands/8_miyagi_izushima.svg'),
  '9_miyagi_enoshima.svg': require('./islands/9_miyagi_enoshima.svg'),
  '10_miyagi_ajishima.svg': require('./islands/10_miyagi_ajishima.svg'),
  '11_miyagi_tashirojima.svg': require('./islands/11_miyagi_tashirojima.svg'),
  '12_miyagi_kinkasan.svg': require('./islands/12_miyagi_kinkasan.svg'),
  '13_miyagi_sabusawajima.svg': require('./islands/13_miyagi_sabusawajima.svg'),
  '14_miyagi_nonoshima.svg': require('./islands/14_miyagi_nonoshima.svg'),
  '15_miyagi_katsurajima.svg': require('./islands/15_miyagi_katsurajima.svg'),
  '16_miyagi_hoojima.svg': require('./islands/16_miyagi_hoojima.svg'),
  '17_miyagi_miyatojima.svg': require('./islands/17_miyagi_miyatojima.svg'),
  '18_yamagata_tobishima.svg': require('./islands/18_yamagata_tobishima.svg'),
  '19_chiba_niemonjima.svg': require('./islands/19_chiba_niemonjima.svg'),
  '20_tokyo_oshima.svg': require('./islands/20_tokyo_oshima.svg'),
  '21_tokyo_toshima.svg': require('./islands/21_tokyo_toshima.svg'),
  '22_tokyo_nijima.svg': require('./islands/22_tokyo_nijima.svg'),
  '23_tokyo_shikinejima.svg': require('./islands/23_tokyo_shikinejima.svg'),
  '24_tokyo_kozushima.svg': require('./islands/24_tokyo_kozushima.svg'),
  '25_tokyo_miyakejima.svg': require('./islands/25_tokyo_miyakejima.svg'),
  '26_tokyo_mikurajima.svg': require('./islands/26_tokyo_mikurajima.svg'),
  '27_tokyo_hachijoshima.svg': require('./islands/27_tokyo_hachijoshima.svg'),
  '28_tokyo_aogashima.svg': require('./islands/28_tokyo_aogashima.svg'),
  '29_tokyo_chichijima.svg': require('./islands/29_tokyo_chichijima.svg'),
  '30_tokyo_hahajima.svg': require('./islands/30_tokyo_hahajima.svg'),
  '31_tokyo_ioujima.svg': require('./islands/31_tokyo_ioujima.svg'),
  '32_tokyo_minamitorishima.svg': require('./islands/32_tokyo_minamitorishima.svg'),
  '33_kanagawa_jogashima.svg': require('./islands/33_kanagawa_jogashima.svg'),
  '34_kanagawa_enoshima.svg': require('./islands/34_kanagawa_enoshima.svg'),
  '40_shizuoka_hatsushima.svg': require('./islands/40_shizuoka_hatsushima.svg'),
};

// Web環境ではSVGファイルをURIとして扱う
const getWebSvgUri = (svgContent: string): string => {
  const encoded = encodeURIComponent(svgContent);
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
};

export const islandAssets: { [key: string]: any } = Platform.OS === 'web'
  ? Object.keys(islandAssetsNative).reduce((acc, key) => {
      const svgContent = islandAssetsNative[key];
      acc[key] = { uri: getWebSvgUri(svgContent) };
      return acc;
    }, {} as { [key: string]: any })
  : islandAssetsNative;

