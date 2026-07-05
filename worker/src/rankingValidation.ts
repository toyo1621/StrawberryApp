export const GAME_TYPES = [
  'strawberry_rush',
  'island_rush',
  'flag_rush',
  'color_rush',
] as const;

export type GameType = typeof GAME_TYPES[number];

export const PERIODS = ['all', 'daily', 'weekly', 'monthly'] as const;

export type RankingPeriod = typeof PERIODS[number];

type GameScoreProfile = {
  maxScore: number;
  maxScorePerSecond: number;
};

const DEFAULT_GAME_TYPE: GameType = 'strawberry_rush';
const MAX_PLAYER_NAME_LENGTH = 12;
const CONTROL_OR_MARKUP_PATTERN = /[\u0000-\u001f\u007f<>]/;

const GAME_TYPE_SET = new Set<string>(GAME_TYPES);
const PERIOD_SET = new Set<string>(PERIODS);

const SCORE_PROFILES: Record<GameType, GameScoreProfile> = {
  strawberry_rush: {
    maxScore: 500,
    maxScorePerSecond: 20,
  },
  island_rush: {
    maxScore: 150,
    maxScorePerSecond: 8,
  },
  flag_rush: {
    maxScore: 150,
    maxScorePerSecond: 8,
  },
  color_rush: {
    maxScore: 200,
    maxScorePerSecond: 10,
  },
};

export class ValidationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type RawScoreSubmission = {
  playerName?: unknown;
  score?: unknown;
  gameType?: unknown;
  durationMs?: unknown;
};

export type ScoreSubmission = {
  playerName: string;
  score: number;
  gameType: GameType;
  durationMs?: number;
};

export const normalizePlayerName = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
};

export const parseGameType = (value: unknown, fallback: GameType = DEFAULT_GAME_TYPE): GameType => {
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }

  if (!GAME_TYPE_SET.has(value)) {
    throw new ValidationError(400, 'Unsupported game type.');
  }

  return value as GameType;
};

export const parseRankingPeriod = (value: string | null): RankingPeriod => {
  const period = value || 'all';
  if (!PERIOD_SET.has(period)) {
    throw new ValidationError(400, 'Unsupported ranking period.');
  }

  return period as RankingPeriod;
};

export const validateScoreSubmission = (body: RawScoreSubmission | null): ScoreSubmission => {
  const playerName = normalizePlayerName(body?.playerName);
  const score = typeof body?.score === 'number' ? body.score : Number(body?.score);
  const gameType = parseGameType(body?.gameType);
  const durationMs = typeof body?.durationMs === 'number' ? body.durationMs : Number(body?.durationMs);

  if (!playerName) {
    throw new ValidationError(400, 'Player name is required.');
  }

  if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
    throw new ValidationError(400, `Player name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer.`);
  }

  if (CONTROL_OR_MARKUP_PATTERN.test(playerName)) {
    throw new ValidationError(400, 'Player name contains unsupported characters.');
  }

  if (!Number.isInteger(score) || score < 0) {
    throw new ValidationError(400, 'Score must be a non-negative integer.');
  }

  const profile = SCORE_PROFILES[gameType];
  if (score > profile.maxScore) {
    throw new ValidationError(400, 'Score is outside the accepted range for this game.');
  }

  if (Number.isFinite(durationMs)) {
    if (!Number.isInteger(durationMs) || durationMs < 1000 || durationMs > 10 * 60 * 1000) {
      throw new ValidationError(400, 'Game duration is outside the accepted range.');
    }

    const maxScoreForDuration = Math.ceil((durationMs / 1000) * profile.maxScorePerSecond);
    if (score > maxScoreForDuration) {
      throw new ValidationError(400, 'Score is too high for the reported game duration.');
    }

    return {
      playerName,
      score,
      gameType,
      durationMs,
    };
  }

  return {
    playerName,
    score,
    gameType,
  };
};
