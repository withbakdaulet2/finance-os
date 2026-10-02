import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/types/database.types";

import { getSupabaseEnv } from "./env";

// Browser client for Client Components. Uses the anon key only; every query is
// still constrained by RLS.
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
