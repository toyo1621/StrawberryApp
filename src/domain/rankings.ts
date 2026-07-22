import { RankingEntry, RankingPeriod } from '../types';

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const MAX_PLAYER_NAME_LENGTH = 12;

const UNSAFE_PLAYER_NAME_PATTERN = /[<>\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

export const normalizePlayerName = (value: string): string => {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
};

export const getPlayerNameLength = (value: string): number => (
  [...normalizePlayerName(value)].length
);

export const getPlayerNameValidationError = (value: string): string | null => {
  const playerName = normalizePlayerName(value);
  if (!playerName) {
    return 'プレイヤー名を入力してください。';
  }
  if ([...playerName].length > MAX_PLAYER_NAME_LENGTH) {
    return `プレイヤー名は${MAX_PLAYER_NAME_LENGTH}文字までです。`;
  }
  if (UNSAFE_PLAYER_NAME_PATTERN.test(playerName)) {
    return '使用できない文字が含まれています。';
  }
  return null;
};

export const rankingIdentity = (value: string): string => {
  return normalizePlayerName(value).toLocaleLowerCase('ja-JP');
};

export const getRankingPositionByEntryId = (
  rankings: RankingEntry[],
  entryId: string | null,
): number | null => {
  if (!entryId) {
    return null;
  }
  const index = rankings.findIndex((entry) => entry.id === entryId);
  return index >= 0 ? index + 1 : null;
};

export const getPeriodStartDate = (
  period: RankingPeriod,
  now: Date = new Date(),
): Date => {
  if (period === RankingPeriod.ALL) {
    return new Date(0);
  }

  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const year = jstNow.getUTCFullYear();
  const month = jstNow.getUTCMonth();
  const date = jstNow.getUTCDate();
  let startDay = date;

  if (period === RankingPeriod.WEEKLY) {
    const day = jstNow.getUTCDay();
    startDay -= day === 0 ? 6 : day - 1;
  }

  if (period === RankingPeriod.MONTHLY) {
    startDay = 1;
  }

  return new Date(Date.UTC(year, month, startDay) - JST_OFFSET_MS);
};

export const filterRankingsByPeriod = (
  rankings: RankingEntry[],
  period: RankingPeriod,
  now: Date = new Date(),
): RankingEntry[] => {
  if (period === RankingPeriod.ALL) {
    return rankings;
  }

  const startTime = getPeriodStartDate(period, now).getTime();
  return rankings.filter((entry) => {
    const createdAt = Date.parse(entry.createdAt);
    return Number.isFinite(createdAt) && createdAt >= startTime;
  });
};

export const getUniquePlayerRankings = (
  rankings: RankingEntry[],
  limit = 30,
): RankingEntry[] => {
  const bestByPlayer = new Map<string, RankingEntry>();

  rankings.forEach((entry) => {
    const identity = rankingIdentity(entry.playerName);
    if (!identity) {
      return;
    }

    const existing = bestByPlayer.get(identity);
    if (
      !existing
      || entry.score > existing.score
      || (entry.score === existing.score && entry.createdAt < existing.createdAt)
    ) {
      bestByPlayer.set(identity, entry);
    }
  });

  return [...bestByPlayer.values()]
    .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
};
