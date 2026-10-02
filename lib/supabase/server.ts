import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/types/database.types";

import { getSupabaseEnv } from "./env";

// Server client for Server Components, Server Actions and Route Handlers.
// It acts as the signed-in user (anon key + session cookie), so RLS applies.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Safe to ignore: proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
