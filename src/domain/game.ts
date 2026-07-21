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
