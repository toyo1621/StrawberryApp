import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables not found. Using demo mode.');
}


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