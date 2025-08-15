import { createClient } from '@supabase/supabase-js';
// デモモードの場合は警告を表示
if (supabaseUrl === 'https://xyzcompany.supabase.co') {
  console.warn('Demo mode: Supabase functionality will be limited. Please set up your Supabase credentials.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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