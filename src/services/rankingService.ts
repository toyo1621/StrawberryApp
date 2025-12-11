import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import type { Database } from './supabase';

type RankingRow = Database['public']['Tables']['rankings']['Row'];
type RankingInsert = Database['public']['Tables']['rankings']['Insert'];

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
}

const GAME_TYPE = 'strawberry_rush';
const ISLAND_GAME_TYPE = 'island_rush';
const FLAG_GAME_TYPE = 'flag_rush';
const RANKING_LIMIT = 30;
const STORAGE_KEY = 'strawberry_game_rankings';
const ISLAND_STORAGE_KEY = 'island_game_rankings';
const FLAG_STORAGE_KEY = 'flag_game_rankings';

// ローカルストレージからランキングを読み込み
const loadLocalRankings = async (): Promise<RankingEntry[]> => {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local rankings:', error);
    return [];
  }
};

// ローカルストレージから島ランキングを読み込み
const loadLocalIslandRankings = async (): Promise<RankingEntry[]> => {
  try {
    const stored = await AsyncStorage.getItem(ISLAND_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local island rankings:', error);
    return [];
  }
};

// ローカルストレージから国旗ランキングを読み込み
const loadLocalFlagRankings = async (): Promise<RankingEntry[]> => {
  try {
    const stored = await AsyncStorage.getItem(FLAG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local flag rankings:', error);
    return [];
  }
};

// ローカルストレージにランキングを保存
const saveLocalRankings = async (rankings: RankingEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local rankings:', error);
  }
};

// ローカルストレージに島ランキングを保存
const saveLocalIslandRankings = async (rankings: RankingEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(ISLAND_STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local island rankings:', error);
  }
};

// ローカルストレージに国旗ランキングを保存
const saveLocalFlagRankings = async (rankings: RankingEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local flag rankings:', error);
  }
};

// 新しいIDを生成
const generateId = (): string => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// データベースの行をRankingEntryに変換
const mapRowToRankingEntry = (row: RankingRow): RankingEntry => ({
  id: row.id,
  playerName: row.player_name,
  score: row.score,
  gameType: row.game_type,
  createdAt: row.created_at,
});

// ランキングを取得
export const fetchRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const localRankings = await loadLocalRankings();
    return getUniquePlayerRankings(localRankings);
  }

  try {
    // 各プレイヤーの最高スコアのみを取得するクエリ
    const { data, error } = await supabase.rpc('get_top_rankings', {
      game_type_param: GAME_TYPE,
      limit_param: 30
    });

    if (error) {
      console.error('Error fetching rankings:', error);
      // エラーの場合はローカルストレージにフォールバック
      const localRankings = await loadLocalRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = await loadLocalRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 島ランキングを取得
export const fetchIslandRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const localRankings = await loadLocalIslandRankings();
    return getUniquePlayerRankings(localRankings);
  }

  try {
    // 各プレイヤーの最高スコアのみを取得するクエリ
    const { data, error } = await supabase.rpc('get_top_rankings', {
      game_type_param: ISLAND_GAME_TYPE,
      limit_param: 30
    });

    if (error) {
      console.error('Error fetching island rankings:', error);
      // エラーの場合はローカルストレージにフォールバック
      const localRankings = await loadLocalIslandRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch island rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = await loadLocalIslandRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 国旗ランキングを取得
export const fetchFlagRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const localRankings = await loadLocalFlagRankings();
    return getUniquePlayerRankings(localRankings);
  }

  try {
    // 各プレイヤーの最高スコアのみを取得するクエリ
    const { data, error } = await supabase.rpc('get_top_rankings', {
      game_type_param: FLAG_GAME_TYPE,
      limit_param: 30
    });

    if (error) {
      console.error('Error fetching flag rankings:', error);
      // エラーの場合はローカルストレージにフォールバック
      const localRankings = await loadLocalFlagRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch flag rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = await loadLocalFlagRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 各プレイヤーの最高スコアのみを取得する関数
const getUniquePlayerRankings = (rankings: RankingEntry[]): RankingEntry[] => {
  const playerBestScores = new Map<string, RankingEntry>();
  
  rankings.forEach(entry => {
    const existing = playerBestScores.get(entry.playerName);
    if (!existing || entry.score > existing.score || 
        (entry.score === existing.score && entry.createdAt < existing.createdAt)) {
      playerBestScores.set(entry.playerName, entry);
    }
  });
  
  return Array.from(playerBestScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
};

// 新しいスコアを保存
export const saveScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = await loadLocalRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    await saveLocalRankings(updatedRankings);
    return newEntry;
  }

  try {
    const insertData: RankingInsert = {
      player_name: playerName.trim(),
      score,
      game_type: GAME_TYPE,
    };

    const { data, error } = await supabase
      .from('rankings')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving score:', error);
      // エラーの場合はローカルストレージにフォールバック
      const newEntry: RankingEntry = {
        id: generateId(),
        playerName: playerName.trim(),
        score,
        gameType: GAME_TYPE,
        createdAt: new Date().toISOString(),
      };

      const currentRankings = await loadLocalRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      await saveLocalRankings(updatedRankings);
      return newEntry;
    }

    return data ? mapRowToRankingEntry(data) : null;
  } catch (error) {
    console.error('Failed to save score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = await loadLocalRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    await saveLocalRankings(updatedRankings);
    return newEntry;
  }
};

// 新しい島スコアを保存
export const saveIslandScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: ISLAND_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = await loadLocalIslandRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    await saveLocalIslandRankings(updatedRankings);
    return newEntry;
  }

  try {
    const insertData: RankingInsert = {
      player_name: playerName.trim(),
      score,
      game_type: ISLAND_GAME_TYPE,
    };

    const { data, error } = await supabase
      .from('rankings')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving island score:', error);
      // エラーの場合はローカルストレージにフォールバック
      const newEntry: RankingEntry = {
        id: generateId(),
        playerName: playerName.trim(),
        score,
        gameType: ISLAND_GAME_TYPE,
        createdAt: new Date().toISOString(),
      };

      const currentRankings = await loadLocalIslandRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      await saveLocalIslandRankings(updatedRankings);
      return newEntry;
    }

    return data ? mapRowToRankingEntry(data) : null;
  } catch (error) {
    console.error('Failed to save island score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: ISLAND_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = await loadLocalIslandRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    await saveLocalIslandRankings(updatedRankings);
    return newEntry;
  }
};

// 新しい国旗スコアを保存
export const saveFlagScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: FLAG_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = await loadLocalFlagRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    await saveLocalFlagRankings(updatedRankings);
    return newEntry;
  }

  try {
    const insertData: RankingInsert = {
      player_name: playerName.trim(),
      score,
      game_type: FLAG_GAME_TYPE,
    };

    const { data, error } = await supabase
      .from('rankings')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving flag score:', error);
      // エラーの場合はローカルストレージにフォールバック
      const newEntry: RankingEntry = {
        id: generateId(),
        playerName: playerName.trim(),
        score,
        gameType: FLAG_GAME_TYPE,
        createdAt: new Date().toISOString(),
      };

      const currentRankings = await loadLocalFlagRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      await saveLocalFlagRankings(updatedRankings);
      return newEntry;
    }

    return data ? mapRowToRankingEntry(data) : null;
  } catch (error) {
    console.error('Failed to save flag score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: FLAG_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = await loadLocalFlagRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    await saveLocalFlagRankings(updatedRankings);
    return newEntry;
  }
};

// プレイヤーの最高スコアを取得
export const getPlayerBestScore = async (playerName: string): Promise<number> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const rankings = await loadLocalRankings();
    const playerScores = rankings
      .filter(entry => entry.playerName === playerName.trim())
      .map(entry => entry.score);
    
    return playerScores.length > 0 ? Math.max(...playerScores) : 0;
  }

  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('score')
      .eq('game_type', GAME_TYPE)
      .eq('player_name', playerName.trim())
      .order('score', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching player best score:', error);
      // エラーの場合はローカルストレージにフォールバック
      const rankings = await loadLocalRankings();
      const playerScores = rankings
        .filter(entry => entry.playerName === playerName.trim())
        .map(entry => entry.score);
      
      return playerScores.length > 0 ? Math.max(...playerScores) : 0;
    }

    return data?.score || 0;
  } catch (error) {
    console.error('Failed to fetch player best score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const rankings = await loadLocalRankings();
    const playerScores = rankings
      .filter(entry => entry.playerName === playerName.trim())
      .map(entry => entry.score);
    
    return playerScores.length > 0 ? Math.max(...playerScores) : 0;
  }
};

// 期間タイプの定義
export enum RankingPeriod {
  ALL = 'all',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

// 期間の開始日時を取得
const getPeriodStartDate = (period: RankingPeriod): Date => {
  const now = new Date();
  const start = new Date(now);
  
  switch (period) {
    case RankingPeriod.DAILY:
      start.setHours(0, 0, 0, 0);
      break;
    case RankingPeriod.WEEKLY:
      const dayOfWeek = now.getDay();
      const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      break;
    case RankingPeriod.MONTHLY:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      return new Date(0); // 全期間
  }
  
  return start;
};

// 期間別ランキングを取得（いちごモード）
export const fetchRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  const startDate = getPeriodStartDate(period);
  
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const localRankings = await loadLocalRankings();
    const filtered = period === RankingPeriod.ALL 
      ? localRankings
      : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
    return getUniquePlayerRankings(filtered);
  }

  try {
    let query = supabase
      .from('rankings')
      .select('*')
      .eq('game_type', GAME_TYPE)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true });

    if (period !== RankingPeriod.ALL) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query.limit(100); // 重複除去のため多めに取得

    if (error) {
      console.error('Error fetching rankings by period:', error);
      const localRankings = await loadLocalRankings();
      const filtered = period === RankingPeriod.ALL 
        ? localRankings
        : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
      return getUniquePlayerRankings(filtered);
    }

    const rankings = data?.map((row: RankingRow) => mapRowToRankingEntry(row)) || [];
    return getUniquePlayerRankings(rankings);
  } catch (error) {
    console.error('Failed to fetch rankings by period:', error);
    const localRankings = await loadLocalRankings();
    const filtered = period === RankingPeriod.ALL 
      ? localRankings
      : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
    return getUniquePlayerRankings(filtered);
  }
};

// 期間別島ランキングを取得
export const fetchIslandRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  const startDate = getPeriodStartDate(period);
  
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const localRankings = await loadLocalIslandRankings();
    const filtered = period === RankingPeriod.ALL 
      ? localRankings
      : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
    return getUniquePlayerRankings(filtered);
  }

  try {
    let query = supabase
      .from('rankings')
      .select('*')
      .eq('game_type', ISLAND_GAME_TYPE)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true });

    if (period !== RankingPeriod.ALL) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query.limit(100); // 重複除去のため多めに取得

    if (error) {
      console.error('Error fetching island rankings by period:', error);
      const localRankings = await loadLocalIslandRankings();
      const filtered = period === RankingPeriod.ALL 
        ? localRankings
        : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
      return getUniquePlayerRankings(filtered);
    }

    const rankings = data?.map((row: RankingRow) => mapRowToRankingEntry(row)) || [];
    return getUniquePlayerRankings(rankings);
  } catch (error) {
    console.error('Failed to fetch island rankings by period:', error);
    const localRankings = await loadLocalIslandRankings();
    const filtered = period === RankingPeriod.ALL 
      ? localRankings
      : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
    return getUniquePlayerRankings(filtered);
  }
};

// 期間別国旗ランキングを取得
export const fetchFlagRankingsByPeriod = async (period: RankingPeriod): Promise<RankingEntry[]> => {
  const startDate = getPeriodStartDate(period);
  
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const localRankings = await loadLocalFlagRankings();
    const filtered = period === RankingPeriod.ALL 
      ? localRankings
      : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
    return getUniquePlayerRankings(filtered);
  }

  try {
    let query = supabase
      .from('rankings')
      .select('*')
      .eq('game_type', FLAG_GAME_TYPE)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true });

    if (period !== RankingPeriod.ALL) {
      query = query.gte('created_at', startDate.toISOString());
    }

    const { data, error } = await query.limit(100); // 重複除去のため多めに取得

    if (error) {
      console.error('Error fetching flag rankings by period:', error);
      const localRankings = await loadLocalFlagRankings();
      const filtered = period === RankingPeriod.ALL 
        ? localRankings
        : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
      return getUniquePlayerRankings(filtered);
    }

    const rankings = data?.map((row: RankingRow) => mapRowToRankingEntry(row)) || [];
    return getUniquePlayerRankings(rankings);
  } catch (error) {
    console.error('Failed to fetch flag rankings by period:', error);
    const localRankings = await loadLocalFlagRankings();
    const filtered = period === RankingPeriod.ALL 
      ? localRankings
      : localRankings.filter(entry => new Date(entry.createdAt) >= startDate);
    return getUniquePlayerRankings(filtered);
  }
};

// プレイヤーのスコア履歴を取得（いちごモード）
export const fetchPlayerScoreHistory = async (playerName: string, gameType: string = GAME_TYPE): Promise<RankingEntry[]> => {
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    const storageKey = gameType === ISLAND_GAME_TYPE 
      ? ISLAND_STORAGE_KEY 
      : gameType === FLAG_GAME_TYPE 
      ? FLAG_STORAGE_KEY 
      : STORAGE_KEY;
    
    const stored = await AsyncStorage.getItem(storageKey);
    const rankings: RankingEntry[] = stored ? JSON.parse(stored) : [];
    
    return rankings
      .filter(entry => entry.playerName === playerName.trim())
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // 新しい順
      });
  }

  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
      .eq('game_type', gameType)
      .eq('player_name', playerName.trim())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching player score history:', error);
      const storageKey = gameType === ISLAND_GAME_TYPE 
        ? ISLAND_STORAGE_KEY 
        : gameType === FLAG_GAME_TYPE 
        ? FLAG_STORAGE_KEY 
        : STORAGE_KEY;
      
      const stored = await AsyncStorage.getItem(storageKey);
      const rankings: RankingEntry[] = stored ? JSON.parse(stored) : [];
      
      return rankings
        .filter(entry => entry.playerName === playerName.trim())
        .sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
    }

    return data?.map((row: RankingRow) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch player score history:', error);
    const storageKey = gameType === ISLAND_GAME_TYPE 
      ? ISLAND_STORAGE_KEY 
      : gameType === FLAG_GAME_TYPE 
      ? FLAG_STORAGE_KEY 
      : STORAGE_KEY;
    
    const stored = await AsyncStorage.getItem(storageKey);
    const rankings: RankingEntry[] = stored ? JSON.parse(stored) : [];
    
    return rankings
      .filter(entry => entry.playerName === playerName.trim())
      .sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
  }
};