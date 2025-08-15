import { supabase } from './supabase';

export interface RankingEntry {
  id: string;
  playerName: string;
  score: number;
  gameType: string;
  createdAt: string;
}

// デモモードかどうかを判定
const isDemoMode = true; // 常にデモモードで動作

// デモ用のランキングデータ
const demoRankings: RankingEntry[] = [
  { 
    id: '1',
    playerName: 'いちごマスター', 
    score: 25,
    gameType: 'strawberry_rush',
    createdAt: new Date().toISOString()
  },
  { 
    id: '2',
    playerName: 'フルーツ王', 
    score: 20,
    gameType: 'strawberry_rush',
    createdAt: new Date().toISOString()
  },
  { 
    id: '3',
    playerName: 'スピードスター', 
    score: 18,
    gameType: 'strawberry_rush',
    createdAt: new Date().toISOString()
  },
];

const GAME_TYPE = 'strawberry_rush';
const RANKING_LIMIT = 10;

// ランキングを取得
export const fetchRankings = async (): Promise<RankingEntry[]> => {
  if (isDemoMode) {
    // デモモードでは固定のランキングを返す
    return Promise.resolve(demoRankings);
  }

  try {
    const { data, error } = await supabase
      .from('rankings')
      .select('*')
      .eq('game_type', GAME_TYPE)
      .order('score', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(RANKING_LIMIT);

    if (error) {
      console.error('Error fetching rankings:', error);
      return demoRankings;
    }

    return data?.map(row => ({
      id: row.id,
      playerName: row.player_name,
      score: row.score,
      gameType: row.game_type,
      createdAt: row.created_at,
    })) || demoRankings;
  } catch (error) {
    console.error('Failed to fetch rankings:', error);
    return demoRankings;
  }
};

// 新しいスコアを保存
export const saveScore = async (playerName: string, score: number): Promise<RankingEntry | null> => {
  if (isDemoMode) {
    console.log('Demo mode: Score would be saved:', { playerName, score });
    // デモモードでは保存をシミュレート
    const newEntry: RankingEntry = {
      id: Date.now().toString(),
      playerName: playerName.trim(),
      score,
      gameType: GAME_TYPE,
      createdAt: new Date().toISOString()
    };
    
    // デモランキングに追加（実際には保存されない）
    demoRankings.push(newEntry);
    demoRankings.sort((a, b) => b.score - a.score);
    demoRankings.splice(RANKING_LIMIT); // 上位10位まで
    
    return newEntry;
  }

  try {
    const insertData = {
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
      return null;
    }

    return data ? {
      id: data.id,
      playerName: data.player_name,
      score: data.score,
      gameType: data.game_type,
      createdAt: data.created_at,
    } : null;
  } catch (error) {
    console.error('Failed to save score:', error);
    return null;
  }
};

// プレイヤーの最高スコアを取得
export const getPlayerBestScore = async (playerName: string): Promise<number> => {
  if (isDemoMode) {
    const playerEntry = demoRankings.find(entry => entry.playerName === playerName.trim());
    return playerEntry?.score || 0;
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

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching player best score:', error);
      return 0;
    }

    return data?.score || 0;
  } catch (error) {
    console.error('Failed to fetch player best score:', error);
    return 0;
  }
};