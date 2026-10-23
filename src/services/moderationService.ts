import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest, hasRankingsApi } from './rankingsApiClient';
import { getPlayerToken } from './playerIdentityService';
import { clearPublicRankingSnapshots } from './rankingLocalStore';

export const REPORT_REASONS = [
  { value: 'offensive', label: '攻撃的・差別的・性的な名前' },
  { value: 'personal_information', label: '個人情報が含まれている' },
  { value: 'impersonation', label: 'なりすまし' },
  { value: 'other', label: 'その他の規約違反' },
] as const;
export type ReportReason = typeof REPORT_REASONS[number]['value'];
export type PlayerBlock = { id: string; rankingId: string; playerName: string; createdAt: string };
const STORAGE_KEY = 'strawberry_player_blocks_v1';
const listeners = new Set<() => void>();
let moderationRevision = 0;
export const getModerationRevision = (): number => moderationRevision;

export const parsePlayerBlocks = (value: unknown): PlayerBlock[] => {
  if (!Array.isArray(value) || value.length > 200) {throw new Error('Invalid block list.');}
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') {throw new Error('Invalid block entry.');}
    const item = entry as Record<string, unknown>;
    if (typeof item.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(item.id)
      || typeof item.rankingId !== 'string' || item.rankingId.length > 80
      || typeof item.playerName !== 'string' || [...item.playerName].length > 12
      || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) {
      throw new Error('Invalid block entry.');
    }
    return { id: item.id, rankingId: item.rankingId, playerName: item.playerName, createdAt: item.createdAt };
  });
};

export const loadPlayerBlocks = async (): Promise<PlayerBlock[]> => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored ? parsePlayerBlocks(JSON.parse(stored) as unknown) : [];
};

export const subscribeModerationChanges = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {listeners.delete(listener);};
};

const persistBlocks = async (blocks: PlayerBlock[]): Promise<PlayerBlock[]> => {
  moderationRevision += 1;
  await clearPublicRankingSnapshots();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  listeners.forEach((listener) => listener());
  return blocks;
};

const credentials = async () => ({ authorization: `Bearer ${await getPlayerToken()}` });

export const refreshPlayerBlocks = async (): Promise<PlayerBlock[]> => {
  if (!hasRankingsApi()) {return loadPlayerBlocks();}
  const blocks = await apiRequest('/players/me/blocks', parsePlayerBlocks, { headers: await credentials() });
  const previous = await loadPlayerBlocks().catch(() => null);
  if (JSON.stringify(previous) !== JSON.stringify(blocks)) {return persistBlocks(blocks);}
  return blocks;
};

export const blockRankingPlayer = async (rankingId: string): Promise<PlayerBlock[]> => {
  const blocks = await apiRequest('/players/me/blocks', parsePlayerBlocks, {
    method: 'POST', headers: await credentials(), body: JSON.stringify({ rankingId }),
  });
  return persistBlocks(blocks);
};

export const unblockRankingPlayer = async (blockId: string): Promise<PlayerBlock[]> => {
  const blocks = await apiRequest('/players/me/blocks', parsePlayerBlocks, {
    method: 'DELETE', headers: await credentials(), body: JSON.stringify({ blockId }),
  });
  return persistBlocks(blocks);
};

export const reportRankingName = async (rankingId: string, reason: ReportReason): Promise<void> => {
  await apiRequest('/ranking-reports', (body: unknown) => {
    if (!body || typeof body !== 'object' || (body as { status?: unknown }).status !== 'received') {
      throw new Error('Invalid report receipt.');
    }
  }, { method: 'POST', headers: await credentials(), body: JSON.stringify({ rankingId, reason }) });
};

export const clearLocalModerationData = async (): Promise<void> => {
  await AsyncStorage.removeItem(STORAGE_KEY);
  moderationRevision += 1;
  listeners.forEach((listener) => listener());
};
