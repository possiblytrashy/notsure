import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// This prevents the "Invalid URL" error during Vercel's build phase
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase variables are missing. Checkout your Vercel Env settings.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
