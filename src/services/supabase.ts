import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Expo Webビルドでは環境変数がビルド時に埋め込まれるため、Constantsから取得
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ||
                   process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ||
                       process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Key length:', supabaseAnonKey.length);
console.log('Supabase client will be created:', !!(supabaseUrl && supabaseAnonKey));

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Ranking features will be disabled.');
}

// 環境変数が設定されている場合のみSupabaseクライアントを作成
export const supabase: SupabaseClient<Database> | null = supabaseUrl && supabaseAnonKey &&
  supabaseUrl.startsWith('http') && supabaseAnonKey.length > 0
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;

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