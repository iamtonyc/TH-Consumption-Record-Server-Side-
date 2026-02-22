import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Use a placeholder if missing to prevent immediate crash on module load
// The actual error will be caught and displayed in the UI during fetchData
const validUrl = supabaseUrl && supabaseUrl.startsWith('http') ? supabaseUrl : 'https://placeholder.supabase.co';
const validKey = supabaseAnonKey || 'placeholder-key';

export const supabase = createClient(validUrl, validKey);

export interface Transaction {
  id?: number;
  date: string;
  category: string;
  item: string;
  vendor: string;
  amount: number;
  from_account: string;
  paid_by: string;
  created_at?: string;
}

export interface LookupItem {
  id?: number;
  name: string;
}
