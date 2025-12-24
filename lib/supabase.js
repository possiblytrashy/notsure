import { createClient } from '@supabase/supabase-js';

// These environment variables will be set in Vercel
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
