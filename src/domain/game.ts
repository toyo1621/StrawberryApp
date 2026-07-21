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
