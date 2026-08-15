import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types";

/**
 * Supabase client for public, read-only catalog data (public.partners,
 * public.catalog_products) — see supabase/migrations/0008_add_catalog_products.sql,
 * whose RLS policies already allow `select` to everyone (`using (true)`)
 * and define no insert/update/delete policy, so the anon key is
 * sufficient here and correct: there's no row-level access decision to
 * make, unlike lib/supabase/server.ts (per-user wishlist rows).
 *
 * Deliberately NOT lib/supabase/server.ts: that factory is async and
 * depends on `next/headers`' `cookies()`, which requires a request
 * context. lib/catalog.ts's functions are called from
 * `generateStaticParams` (build time, no request at all) as well as from
 * Server Components, so this client must not depend on cookies existing.
 *
 * Deliberately NOT lib/supabase/admin.ts either: that factory uses the
 * service-role key specifically to bypass RLS for one exclusive caller
 * (lib/alerts/checkPriceDrops.ts, which must read every user's wishlist
 * rows). Catalog reads don't need an RLS bypass — the table is already
 * public — so reaching for the service-role key here would be
 * over-privileged for no benefit.
 */
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY — both are required to create a public Supabase client. See .env.local.example."
    );
  }

  return createSupabaseClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
