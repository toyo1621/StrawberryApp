import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Using demo mode.');
}

// 環境変数が設定されていない場合は、ダミーのクライアントを作成
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export type Database = {
  public: {
    Tables: {
      rankings: {
        Row: {
          id: string;
          player_name: string;
          score: number;
          game_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_name: string;
          score: number;
          game_type?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_name?: string;
          score?: number;
          game_type?: string;
          created_at?: string;
        };
      };
    };
  };
};