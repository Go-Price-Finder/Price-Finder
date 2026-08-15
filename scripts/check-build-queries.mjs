#!/usr/bin/env node
/** Asserts a build made exactly the catalog round trips it should — split by
 * build phase, because the two phases mean completely different things.
 *
 *   render phase  (after "Generating static pages"): must be EXACTLY 0
 *   collect phase (before it):                       must EQUAL the number of
 *                                                    route modules that import
 *                                                    @/lib/catalog and define
 *                                                    generateStaticParams
 *
 * WHY BOTH ASSERTIONS ARE REQUIRED — do not delete either.
 *
 * The render-phase 0 is the invariant worth defending: it proves
 * unstable_cache is serving every one of the ~1043 page renders from a single
 * snapshot. But **0 passes vacuously**. Broken instrumentation, a renamed
 * marker string, a build that failed early, a log written before the phase
 * even started — all produce 0 markers and all go green. On its own this
 * assertion cannot tell "the cache is perfect" from "nothing was measured".
 *
 * The collect-phase assertion is what proves the instrument is alive, because
 * it expects a POSITIVE number. If the marker string breaks, collect drops to
 * 0 and fails loudly instead of the render check quietly passing.
 *
 * Someone will eventually notice the collect number changes every batch and
 * conclude it is noise. It is not. It is the liveness check. Removing it turns
 * the remaining assertion into one that cannot fail.
 *
 * WHY COLLECT IS NON-ZERO AT ALL (this is expected, not a leak):
 * Next runs each route module's generateStaticParams in its own worker process
 * during "Collecting page data", before the shared cache is populated, so each
 * migrated route pays exactly one fetch. Measured 2026-08-16 with three routes
 * migrated: 3 markers, all before "Generating static pages", 0 after.
 * This qualifies the Step 13 note that unstable_cache dedupes "cross-process":
 * it does during static generation, not during collect. That original
 * measurement had only ONE route migrated, so it could not have seen this.
 *
 * The collect expectation is DERIVED from the repo, never passed in. A
 * hand-maintained number is one somebody bumps to turn a red build green, and
 * that edit is indistinguishable from a legitimate increment.
 *
 * Run the build clean — an incremental build reuses cached output, never
 * re-runs data fetching, and produces 0 markers in BOTH phases:
 *   rm -rf .next && CATALOG_TRACE=1 npm run build > build.log 2>&1
 *   node scripts/check-build-queries.mjs build.log
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MARKER = "__FETCH_CATALOG_HIT__";
const PHASE_BOUNDARY = "Generating static pages";

/** Route modules that will each pay one collect-phase fetch: they import the
 * catalog module AND enumerate params. A landing page that imports the catalog
 * but has no generateStaticParams is collected without a separate worker pass
 * and does not add a marker — verified 2026-08-16. */
function countMigratedParamRoutes(dir = "app") {
  let n = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      n += countMigratedParamRoutes(p);
    } else if (entry === "page.tsx" || entry === "page.ts") {
      const src = readFileSync(p, "utf8");
      if (src.includes('from "@/lib/catalog"') && src.includes("generateStaticParams")) n++;
    }
  }
  return n;
}

const [, , logPath] = process.argv;
if (!logPath) {
  console.error("usage: check-build-queries.mjs <build.log>");
  process.exit(2);
}

const log = readFileSync(logPath, "utf8");
const lines = log.split(/\r?\n/);
const boundary = lines.findIndex((l) => l.includes(PHASE_BOUNDARY));

const before = lines.slice(0, boundary === -1 ? lines.length : boundary);
const after = boundary === -1 ? [] : lines.slice(boundary);
const collect = before.filter((l) => l.includes(MARKER)).length;
const render = after.filter((l) => l.includes(MARKER)).length;
const expected = countMigratedParamRoutes();

console.log(`collect phase: ${collect} (expected ${expected})`);
console.log(`render phase : ${render} (expected 0)`);

let failed = false;

if (boundary === -1) {
  console.error(
    `FAIL: no "${PHASE_BOUNDARY}" line in the log — the build did not reach static generation.\n` +
      `       This log cannot be used to judge cache behaviour. Check the build actually succeeded.`
  );
  failed = true;
}

if (collect !== expected) {
  console.error(
    `FAIL: collect phase made ${collect} round trips, expected ${expected}.\n` +
      `       Expected = route modules importing @/lib/catalog with generateStaticParams.\n` +
      (collect === 0
        ? `       0 means nothing was measured — a stale .next (rebuild with rm -rf .next), or the\n` +
          `       "${MARKER}" marker in lib/catalog.ts is missing/renamed. Do NOT "fix" this by\n` +
          `       lowering the expectation; the instrument is broken, not the cache.`
        : `       More than expected means a route is bypassing the cache. Fewer means a migrated\n` +
          `       route stopped enumerating params.`)
  );
  failed = true;
}

if (render !== 0) {
  console.error(
    `FAIL: ${render} round trips during static generation, expected 0.\n` +
      `       unstable_cache is not deduping across page renders — every page is refetching the\n` +
      `       catalog. Check the cache key and that fetchCatalogCached is still the only path.`
  );
  failed = true;
}

if (failed) process.exit(1);
console.log("PASS");
