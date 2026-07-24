"use client";

import { createBrowserClient } from "@supabase/ssr";
import { Database } from "./database.types";

/**
 * Supabase client for use in Client Components (browser only). Create a
 * fresh instance per call rather than a shared singleton — `@supabase/ssr`
 * is designed around this so auth state stays correctly synced with
 * cookies across tabs/reloads.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
