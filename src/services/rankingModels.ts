import {
  API_GAME_TYPES,
  type ApiGameType,
} from '../gameConfig';
import type {
  GameMode,
  RankingEntry,
  RankingsByMode,
} from '../types';
import { IslandRegion } from '../types';
import { RankingsApiError } from './rankingsApiClient';

export interface ScoreMetadata {
  durationMs: number;
  islandRegion?: IslandRegion;
  gameSession?: RankingGameSession | null;
}

export type RankingGameSession = {
  id: string;
  gameType: ApiGameType;
  islandRegion: IslandRegion;
  startedAt: string;
  expiresAt: string;
};

export type ScoreSaveResult = {
  entry: RankingEntry;
  destination: 'remote' | 'local';
  queuedForSync: boolean;
  droppedPendingScores: number;
  verifiedForRanking: boolean;
};

export type RankingFetchResult = {
  entries: RankingEntry[];
  source: 'remote' | 'cache' | 'local';
  stale: boolean;
};

export type AllRankingsFetchResult = {
  rankings: RankingsByMode;
  staleModes: GameMode[];
  failedModes: GameMode[];
};

export type SyncResult = {
  synced: number;
  pending: number;
  discarded: number;
};

export type PendingScore = {
  submissionId: string;
  playerName: string;
  score: number;
  gameType: ApiGameType;
  islandRegion: IslandRegion;
  durationMs: number;
  createdAt: string;
  gameSessionId?: string;
  gameSessionExpiresAt?: string;
};

const ISLAND_REGION_SET = new Set<string>(Object.values(IslandRegion));

export const isApiGameType = (value: unknown): value is ApiGameType => (
  typeof value === 'string' && API_GAME_TYPES.includes(value as ApiGameType)
);

export const normalizeIslandRegion = (
  gameType: ApiGameType,
  value: unknown,
): IslandRegion => {
  if (gameType === 'island_rush'
    && typeof value === 'string'
    && ISLAND_REGION_SET.has(value)) {
    return value as IslandRegion;
  }
  return IslandRegion.ALL;
};

export const toRankingEntry = (value: unknown): RankingEntry | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const entry = value as Partial<RankingEntry>;
  if (!(typeof entry.id === 'string'
    && typeof entry.playerName === 'string'
    && Number.isInteger(entry.score)
    && isApiGameType(entry.gameType)
    && typeof entry.createdAt === 'string'
    && Number.isFinite(Date.parse(entry.createdAt))
    && (entry.isCurrentPlayer === undefined || typeof entry.isCurrentPlayer === 'boolean'))) {
    return null;
  }

  return {
    id: entry.id,
    playerName: entry.playerName,
    score: entry.score as number,
    gameType: entry.gameType,
    islandRegion: normalizeIslandRegion(entry.gameType, entry.islandRegion),
    createdAt: entry.createdAt,
    ...(entry.isCurrentPlayer === true ? { isCurrentPlayer: true } : {}),
  };
};

export const parseRankingEntries = (value: unknown): RankingEntry[] => {
  if (!Array.isArray(value)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  const entries = value.map(toRankingEntry);
  if (entries.some((entry) => entry === null)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return entries as RankingEntry[];
};

export const parseRankingEntry = (value: unknown): RankingEntry => {
  const entry = toRankingEntry(value);
  if (!entry) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return entry;
};

export const parseGameSession = (value: unknown): RankingGameSession => {
  if (!value || typeof value !== 'object') {
    throw new RankingsApiError('The rankings API returned an invalid game session.');
  }
  const session = value as Partial<RankingGameSession>;
  if (!(typeof session.id === 'string'
    && isApiGameType(session.gameType)
    && typeof session.startedAt === 'string'
    && Number.isFinite(Date.parse(session.startedAt))
    && typeof session.expiresAt === 'string'
    && Number.isFinite(Date.parse(session.expiresAt)))) {
    throw new RankingsApiError('The rankings API returned an invalid game session.');
  }
  return {
    id: session.id,
    gameType: session.gameType,
    islandRegion: normalizeIslandRegion(session.gameType, session.islandRegion),
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
  };
};

export const parseDeleteResult = (value: unknown): { deleted: number } => {
  if (!value
    || typeof value !== 'object'
    || !Number.isInteger((value as { deleted?: unknown }).deleted)) {
    throw new RankingsApiError('The rankings API returned an invalid response.');
  }
  return { deleted: (value as { deleted: number }).deleted };
};

export const generateSubmissionId = (): string => {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return randomUuid;
  }
  return `score_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
};
