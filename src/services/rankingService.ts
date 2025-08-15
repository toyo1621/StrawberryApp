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
const RANKING_LIMIT = 10;
const STORAGE_KEY = 'strawberry_game_rankings';

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

// ローカルストレージにランキングを保存
const saveLocalRankings = (rankings: RankingEntry[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
  } catch (error) {
    console.error('Failed to save local rankings:', error);
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
      limit_param: RANKING_LIMIT
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
    .slice(0, RANKING_LIMIT);
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
      .slice(0, RANKING_LIMIT);
    
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
        .slice(0, RANKING_LIMIT);
      
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
      .slice(0, RANKING_LIMIT);
    
    saveLocalRankings(updatedRankings);
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