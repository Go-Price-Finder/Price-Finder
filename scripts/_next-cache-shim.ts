/**
 * Makes lib/catalog.ts importable from a standalone `npx tsx` script.
 *
 * Since Step 14 Task 4, fetchCatalog is wrapped in `unstable_cache`, which
 * requires a Next.js incremental cache to be present. Outside a Next render
 * context there is none, and Next throws before running the callback:
 *
 *   Invariant: incrementalCache missing in unstable_cache async function fetchCatalogRaw()...
 *
 * That broke `npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts`
 * — the command the Step 14 plan's per-batch verification protocol depends on.
 *
 * The fix belongs here rather than in lib/catalog.ts. Making the library fall
 * back to an uncached fetch when no cache is present would mean a real Next
 * build silently doing 1394 queries instead of 2 if the cache were ever
 * missing — a silent degradation, which is exactly the failure shape this
 * project keeps getting bitten by. Better that production stays strict and
 * fails loudly, and that scripts opt in to a stub.
 *
 * The stub is a real in-memory store, not a no-op, so the JSON serialization
 * round-trip through the cache boundary is genuinely exercised — that is what
 * catches a value (a Map, say) that does not survive it.
 *
 * IMPORTANT: import this BEFORE lib/catalog.ts. ES import statements execute
 * in source order, so it must be the first import in the consuming script.
 */

import { AsyncLocalStorage } from "async_hooks";

type Global = {
  AsyncLocalStorage?: unknown;
  __incrementalCache?: unknown;
};

const g = globalThis as unknown as Global;

// Next's app-render module expects AsyncLocalStorage as a global in some
// build outputs; Node does not expose it as one.
g.AsyncLocalStorage ??= AsyncLocalStorage;

const store = new Map<string, unknown>();

g.__incrementalCache ??= {
  generateCacheKey: async (key: string) => key,
  get: async (key: string) => store.get(key) ?? null,
  set: async (key: string, value: unknown) => {
    store.set(key, value);
  },
};

export {};
