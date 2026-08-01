"use client";

/**
 * Lazily loads lib/supabase/client.ts — and, transitively, the full
 * @supabase/supabase-js browser SDK (including its Realtime/websocket
 * client, which this app never uses anywhere) — on first call instead of
 * at module-evaluation time.
 *
 * Why this exists: AuthProvider and WishlistProvider (app/providers.tsx)
 * are mounted on every single page via the root layout. A static
 * `import { createClient } from "./client"` in either of them means
 * webpack bundles @supabase/ssr -> @supabase/supabase-js (which
 * unconditionally constructs a RealtimeClient in its constructor, so the
 * ~193KB realtime-js module can't be tree-shaken out even though it's
 * never used) into the critical-path JS for every page load, whether or
 * not the visitor is logged in. Confirmed via a from-scratch production
 * build on 2026-08-01: two chunks totaling ~256KB
 * (createBrowserClient/GoTrueClient + realtime-js) shipped in the "shared
 * by all" bundle on 28 of the app's 34 page templates. See
 * claude/homepage-lcp-investigation-2026-08-01.md, "TBT investigation"
 * section, for the full trace.
 *
 * Using a dynamic import() here code-splits that ~256KB into its own
 * chunk that loads asynchronously after initial hydration, off the
 * critical rendering path, instead of being parsed synchronously as part
 * of every page's initial bundle.
 *
 * Memoizes the import() promise, not the client — lib/supabase/client.ts's
 * own createClient() still returns a fresh client instance per call
 * (@supabase/ssr is designed around that for keeping auth state synced
 * across tabs/reloads); this only avoids re-issuing the dynamic import
 * itself on every call.
 */
let modulePromise: Promise<typeof import("./client")> | null = null;

export function getCreateClient() {
  if (!modulePromise) {
    modulePromise = import("./client");
  }
  return modulePromise.then((mod) => mod.createClient);
}
