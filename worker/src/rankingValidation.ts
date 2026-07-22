export const GAME_TYPES = [
  'strawberry_rush',
  'island_rush',
  'flag_rush',
  'color_rush',
] as const;

export type GameType = typeof GAME_TYPES[number];

export const PERIODS = ['all', 'daily', 'weekly', 'monthly'] as const;

export type RankingPeriod = typeof PERIODS[number];

export const ISLAND_REGIONS = [
  'all',
  'hokkaido_tohoku',
  'kanto',
  'chubu_kinki',
  'chugoku',
  'shikoku',
  'kyushu',
  'okinawa',
] as const;

export type IslandRegion = typeof ISLAND_REGIONS[number];

export type GameScoreProfile = {
  maxScore: number;
  maxScorePerSecond: number;
};

const DEFAULT_GAME_TYPE: GameType = 'strawberry_rush';
const MAX_PLAYER_NAME_LENGTH = 12;
const CONTROL_OR_MARKUP_PATTERN = /[\u0000-\u001f\u007f<>]/;
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const PLAYER_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GAME_TYPE_SET = new Set<string>(GAME_TYPES);
const PERIOD_SET = new Set<string>(PERIODS);
const ISLAND_REGION_SET = new Set<string>(ISLAND_REGIONS);

export const MAX_GAME_DURATION_MS = 5 * 60 * 1000;

export const SCORE_PROFILES: Record<GameType, GameScoreProfile> = {
  strawberry_rush: {
    maxScore: 5_000,
    maxScorePerSecond: 17,
  },
  island_rush: {
    maxScore: 3_000,
    maxScorePerSecond: 10,
  },
  flag_rush: {
    maxScore: 1_000,
    maxScorePerSecond: 4,
  },
  color_rush: {
    maxScore: 1_000,
    maxScorePerSecond: 4,
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
  submissionId?: unknown;
  playerName?: unknown;
  score?: unknown;
  gameType?: unknown;
  islandRegion?: unknown;
  durationMs?: unknown;
  playerToken?: unknown;
};

export type ScoreSubmission = {
  submissionId: string;
  playerName: string;
  score: number;
  gameType: GameType;
  islandRegion: IslandRegion;
  durationMs: number;
  playerToken?: string;
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

export const parseIslandRegion = (
  value: unknown,
  gameType: GameType,
): IslandRegion => {
  const region = value === undefined || value === null || value === '' ? 'all' : value;
  if (typeof region !== 'string' || !ISLAND_REGION_SET.has(region)) {
    throw new ValidationError(400, 'Unsupported island region.');
  }

  if (gameType !== 'island_rush' && region !== 'all') {
    throw new ValidationError(400, 'Island region is only supported for island rankings.');
  }

  return region as IslandRegion;
};

export const validateScoreSubmission = (body: RawScoreSubmission | null): ScoreSubmission => {
  const submissionId = body?.submissionId;
  const playerName = normalizePlayerName(body?.playerName);
  const score = body?.score;
  const gameType = parseGameType(body?.gameType);
  const islandRegion = parseIslandRegion(body?.islandRegion, gameType);
  const durationMs = body?.durationMs;
  const playerToken = body?.playerToken;

  if (typeof submissionId !== 'string' || !SUBMISSION_ID_PATTERN.test(submissionId)) {
    throw new ValidationError(400, 'A valid submission ID is required.');
  }

  if (typeof body?.gameType !== 'string') {
    throw new ValidationError(400, 'Game type is required.');
  }

  if (!playerName) {
    throw new ValidationError(400, 'Player name is required.');
  }

  if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
    throw new ValidationError(400, `Player name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer.`);
  }

  if (CONTROL_OR_MARKUP_PATTERN.test(playerName)) {
    throw new ValidationError(400, 'Player name contains unsupported characters.');
  }

  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
    throw new ValidationError(400, 'Score must be a non-negative integer.');
  }

  const profile = SCORE_PROFILES[gameType];
  if (score > profile.maxScore) {
    throw new ValidationError(400, 'Score is outside the accepted range for this game.');
  }

  if (typeof durationMs !== 'number' || !Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > MAX_GAME_DURATION_MS) {
    throw new ValidationError(400, 'Game duration is outside the accepted range.');
  }

  if (playerToken !== undefined && (typeof playerToken !== 'string' || !PLAYER_TOKEN_PATTERN.test(playerToken))) {
    throw new ValidationError(400, 'Player token is invalid.');
  }

  const maxScoreForDuration = Math.ceil((durationMs / 1000) * profile.maxScorePerSecond);
  if (score > maxScoreForDuration) {
    throw new ValidationError(400, 'Score is too high for the reported game duration.');
  }

  return {
    submissionId,
    playerName,
    score,
    gameType,
    islandRegion,
    durationMs,
    ...(playerToken ? { playerToken } : {}),
  };
};

export const validatePlayerToken = (value: unknown): string => {
  if (typeof value !== 'string' || !PLAYER_TOKEN_PATTERN.test(value)) {
    throw new ValidationError(401, 'A valid player token is required.');
  }
  return value;
};

export const validatePlayerName = (value: unknown): string => {
  const playerName = normalizePlayerName(value);
  if (!playerName || playerName.length > MAX_PLAYER_NAME_LENGTH || CONTROL_OR_MARKUP_PATTERN.test(playerName)) {
    throw new ValidationError(400, 'Invalid player name.');
  }
  return playerName;
};
