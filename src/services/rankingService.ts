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
const SQUARE_GAME_TYPE = 'square_rush';
const CUBE_GAME_TYPE = 'cube_rush';
const RANKING_LIMIT = 30;
const STORAGE_KEY = 'strawberry_game_rankings';
const ISLAND_STORAGE_KEY = 'island_game_rankings';
const FLAG_STORAGE_KEY = 'flag_game_rankings';
const SQUARE_STORAGE_KEY = 'square_game_rankings';
const CUBE_STORAGE_KEY = 'cube_game_rankings';

// ローカルストレージからランキングを読み込み
const loadLocalRankings = (): RankingEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local rankings:', error);
    return [];
  }
};

// ローカルストレージから島ランキングを読み込み
const loadLocalIslandRankings = (): RankingEntry[] => {
  try {
    const stored = localStorage.getItem(ISLAND_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local island rankings:', error);
    return [];
  }
};

// ローカルストレージから国旗ランキングを読み込み
const loadLocalFlagRankings = (): RankingEntry[] => {
  try {
    const stored = localStorage.getItem(FLAG_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local flag rankings:', error);
    return [];
  }
};

// ローカルストレージから平方数ランキングを読み込み
const loadLocalSquareRankings = (): RankingEntry[] => {
  try {
    const stored = localStorage.getItem(SQUARE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local square rankings:', error);
    return [];
  }
};

// ローカルストレージから立方数ランキングを読み込み
const loadLocalCubeRankings = (): RankingEntry[] => {
  try {
    const stored = localStorage.getItem(CUBE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load local cube rankings:', error);
    return [];
  }
};
// ローカルストレージにランキングを保存
const saveLocalRankings = (rankings: RankingEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local rankings:', error);
  }
};

// ローカルストレージに島ランキングを保存
const saveLocalIslandRankings = (rankings: RankingEntry[]): void => {
  try {
    localStorage.setItem(ISLAND_STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local island rankings:', error);
  }
};

// ローカルストレージに国旗ランキングを保存
const saveLocalFlagRankings = (rankings: RankingEntry[]): void => {
  try {
    localStorage.setItem(FLAG_STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local flag rankings:', error);
  }
};

// ローカルストレージに平方数ランキングを保存
const saveLocalSquareRankings = (rankings: RankingEntry[]): void => {
  try {
    localStorage.setItem(SQUARE_STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local square rankings:', error);
  }
};

// ローカルストレージに立方数ランキングを保存
const saveLocalCubeRankings = (rankings: RankingEntry[]): void => {
  try {
    localStorage.setItem(CUBE_STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local cube rankings:', error);
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
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const localRankings = loadLocalRankings();
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
      const localRankings = loadLocalRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = loadLocalRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 島ランキングを取得
export const fetchIslandRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const localRankings = loadLocalIslandRankings();
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
      const localRankings = loadLocalIslandRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch island rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = loadLocalIslandRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 国旗ランキングを取得
export const fetchFlagRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const localRankings = loadLocalFlagRankings();
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
      const localRankings = loadLocalFlagRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch flag rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = loadLocalFlagRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 平方数ランキングを取得
export const fetchSquareRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const localRankings = loadLocalSquareRankings();
    return getUniquePlayerRankings(localRankings);
  }

  try {
    // 各プレイヤーの最高スコアのみを取得するクエリ
    const { data, error } = await supabase.rpc('get_top_rankings', {
      game_type_param: SQUARE_GAME_TYPE,
      limit_param: 30
    });

    if (error) {
      console.error('Error fetching square rankings:', error);
      // エラーの場合はローカルストレージにフォールバック
      const localRankings = loadLocalSquareRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch square rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = loadLocalSquareRankings();
    return getUniquePlayerRankings(localRankings);
  }
};

// 立方数ランキングを取得
export const fetchCubeRankings = async (): Promise<RankingEntry[]> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const localRankings = loadLocalCubeRankings();
    return getUniquePlayerRankings(localRankings);
  }

  try {
    // 各プレイヤーの最高スコアのみを取得するクエリ
    const { data, error } = await supabase.rpc('get_top_rankings', {
      game_type_param: CUBE_GAME_TYPE,
      limit_param: 30
    });

    if (error) {
      console.error('Error fetching cube rankings:', error);
      // エラーの場合はローカルストレージにフォールバック
      const localRankings = loadLocalCubeRankings();
      return getUniquePlayerRankings(localRankings);
    }

    return data?.map((row: any) => mapRowToRankingEntry(row)) || [];
  } catch (error) {
    console.error('Failed to fetch cube rankings:', error);
    // エラーの場合はローカルストレージにフォールバック
    const localRankings = loadLocalCubeRankings();
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
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalRankings(updatedRankings);
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

      const currentRankings = loadLocalRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      saveLocalRankings(updatedRankings);
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

    const currentRankings = loadLocalRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalRankings(updatedRankings);
    return newEntry;
  }
};

// 新しい島スコアを保存
export const saveIslandScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: ISLAND_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalIslandRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalIslandRankings(updatedRankings);
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

      const currentRankings = loadLocalIslandRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      saveLocalIslandRankings(updatedRankings);
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

    const currentRankings = loadLocalIslandRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalIslandRankings(updatedRankings);
    return newEntry;
  }
};

// 新しい国旗スコアを保存
export const saveFlagScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: FLAG_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalFlagRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalFlagRankings(updatedRankings);
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

      const currentRankings = loadLocalFlagRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      saveLocalFlagRankings(updatedRankings);
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

    const currentRankings = loadLocalFlagRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalFlagRankings(updatedRankings);
    return newEntry;
  }
};

// 新しい平方数スコアを保存
export const saveSquareScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: SQUARE_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalSquareRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalSquareRankings(updatedRankings);
    return newEntry;
  }

  try {
    const insertData: RankingInsert = {
      player_name: playerName.trim(),
      score,
      game_type: SQUARE_GAME_TYPE,
    };

    const { data, error } = await supabase
      .from('rankings')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving square score:', error);
      // エラーの場合はローカルストレージにフォールバック
      const newEntry: RankingEntry = {
        id: generateId(),
        playerName: playerName.trim(),
        score,
        gameType: SQUARE_GAME_TYPE,
        createdAt: new Date().toISOString(),
      };

      const currentRankings = loadLocalSquareRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      saveLocalSquareRankings(updatedRankings);
      return newEntry;
    }

    return data ? mapRowToRankingEntry(data) : null;
  } catch (error) {
    console.error('Failed to save square score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: SQUARE_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalSquareRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalSquareRankings(updatedRankings);
    return newEntry;
  }
};

// 新しい立方数スコアを保存
export const saveCubeScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: CUBE_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalCubeRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalCubeRankings(updatedRankings);
    return newEntry;
  }

  try {
    const insertData: RankingInsert = {
      player_name: playerName.trim(),
      score,
      game_type: CUBE_GAME_TYPE,
    };

    const { data, error } = await supabase
      .from('rankings')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error saving cube score:', error);
      // エラーの場合はローカルストレージにフォールバック
      const newEntry: RankingEntry = {
        id: generateId(),
        playerName: playerName.trim(),
        score,
        gameType: CUBE_GAME_TYPE,
        createdAt: new Date().toISOString(),
      };

      const currentRankings = loadLocalCubeRankings();
      const updatedRankings = [...currentRankings, newEntry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 30);
      
      saveLocalCubeRankings(updatedRankings);
      return newEntry;
    }

    return data ? mapRowToRankingEntry(data) : null;
  } catch (error) {
    console.error('Failed to save cube score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const newEntry: RankingEntry = {
      id: generateId(),
      playerName: playerName.trim(),
      score,
      gameType: CUBE_GAME_TYPE,
      createdAt: new Date().toISOString(),
    };

    const currentRankings = loadLocalCubeRankings();
    const updatedRankings = [...currentRankings, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
    
    saveLocalCubeRankings(updatedRankings);
    return newEntry;
  }
};
// プレイヤーの最高スコアを取得
export const getPlayerBestScore = async (playerName: string): Promise<number> => {
  // Supabase環境変数がない場合はローカルストレージを使用
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    const rankings = loadLocalRankings();
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
      const rankings = loadLocalRankings();
      const playerScores = rankings
        .filter(entry => entry.playerName === playerName.trim())
        .map(entry => entry.score);
      
      return playerScores.length > 0 ? Math.max(...playerScores) : 0;
    }

    return data?.score || 0;
  } catch (error) {
    console.error('Failed to fetch player best score:', error);
    // エラーの場合はローカルストレージにフォールバック
    const rankings = loadLocalRankings();
    const playerScores = rankings
      .filter(entry => entry.playerName === playerName.trim())
      .map(entry => entry.score);
    
    return playerScores.length > 0 ? Math.max(...playerScores) : 0;
  }
};