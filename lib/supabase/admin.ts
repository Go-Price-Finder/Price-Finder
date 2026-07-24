import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

/**
 * Supabase client authenticated with the service-role key, which bypasses
 * Row Level Security entirely. Server-only — never import this from a
 * Client Component, a route that could leak it to the browser, or log its
 * key.
 *
 * Used exclusively by lib/alerts/checkPriceDrops.ts (the daily cron job),
 * which needs to read and update every user's wishlist rows to check price
 * drops, not just the rows the currently-signed-in caller owns. Every
 * other part of the app should keep using lib/supabase/client.ts (browser)
 * or lib/supabase/server.ts (Server Components / Actions / Route
 * Handlers acting on behalf of a signed-in user).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — both are required to create an admin Supabase client. See .env.local.example."
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
