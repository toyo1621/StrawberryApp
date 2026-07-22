import { Color } from '../types';

const EMOJI_LABELS: Record<string, string> = {
  '🍓': 'いちご',
  '🍰': 'ショートケーキ',
  '🎂': 'ホールケーキ',
  '🍎': 'りんご',
  '🍊': 'みかん',
  '🍇': 'ぶどう',
  '🍉': 'すいか',
  '🍍': 'パイナップル',
  '🍑': 'もも',
  '🥝': 'キウイ',
  '🫐': 'ブルーベリー',
  '🍒': 'さくらんぼ',
  '🍈': 'メロン',
};

export const shuffle = <T>(values: readonly T[], random: () => number = Math.random): T[] => {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

export const describeEmoji = (emoji: string): string => EMOJI_LABELS[emoji] ?? '絵文字の選択肢';

export const countryCodeToFlagEmoji = (countryCode: string): string => {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return '🏳️';
  }
  return [...code]
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join('');
};

export const progressPercent = (value: number, maximum: number): number => {
  if (!Number.isFinite(value) || !Number.isFinite(maximum) || maximum <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (value / maximum) * 100));
};

export const getColorCategory = (colorId: string): string => {
  const id = Number.parseInt(colorId, 10);
  if (!Number.isInteger(id) || id < 1) {return 'achromatic';}
  if (id >= 1 && id <= 20) {return 'red';}
  if (id <= 32) {return 'yellow-red';}
  if (id <= 40) {return 'yellow';}
  if (id <= 47) {return 'yellow-green';}
  if (id <= 56) {return 'green';}
  if (id <= 64) {return 'blue-green';}
  if (id <= 77) {return 'blue';}
  if (id <= 83) {return 'blue-violet';}
  if (id <= 89) {return 'violet';}
  if (id <= 95) {return 'red-violet';}
  if (id <= 108) {return 'brown';}
  if (id <= 120) {return 'grayish';}
  return 'achromatic';
};

export type ColorRound = {
  choices: [Color, Color];
  correctIndex: 0 | 1;
  target: Color;
};

const randomIndex = (length: number, random: () => number): number => {
  const value = random();
  const normalized = Number.isFinite(value) ? Math.min(Math.max(value, 0), 0.9999999999999999) : 0;
  return Math.floor(normalized * length);
};

const normalizedHex = (color: Color): string => color.hex.trim().toUpperCase();

export const getDistinctColorCandidates = (
  colors: readonly Color[],
  target: Color,
): Color[] => {
  const distinctColors = colors.filter((color) => (
    color.id !== target.id && normalizedHex(color) !== normalizedHex(target)
  ));
  const category = getColorCategory(target.id);
  const sameCategory = distinctColors.filter((color) => getColorCategory(color.id) === category);
  return sameCategory.length > 0 ? sameCategory : distinctColors;
};

export const createColorRound = (
  colors: readonly Color[],
  random: () => number = Math.random,
): ColorRound => {
  if (colors.length < 2) {
    throw new Error('At least two colors are required to create a round.');
  }

  const target = colors[randomIndex(colors.length, random)];
  const candidates = getDistinctColorCandidates(colors, target);
  if (candidates.length === 0) {
    throw new Error('At least two visually distinct colors are required to create a round.');
  }

  const distractor = candidates[randomIndex(candidates.length, random)];
  const correctIndex: 0 | 1 = random() < 0.5 ? 0 : 1;
  return {
    choices: correctIndex === 0 ? [target, distractor] : [distractor, target],
    correctIndex,
    target,
  };
};
