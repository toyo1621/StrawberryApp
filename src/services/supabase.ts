import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// デモモードの場合は警告を表示
if (supabaseUrl === 'https://demo.supabase.co') {
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