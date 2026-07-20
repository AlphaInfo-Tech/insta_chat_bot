import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/database/types';

let cachedClient: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedClient;
}
