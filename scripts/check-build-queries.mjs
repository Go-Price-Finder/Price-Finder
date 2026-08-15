#!/usr/bin/env node
/** Asserts a build made a plausible number of catalog round trips — at least
 * MIN, at most max.
 *
 * Guards the Step 13 decision that unstable_cache dedupes fetchCatalog
 * build-wide. A regression (a call site bypassing the cache, a stale cache
 * key) shows up as a count jump long before it shows up as a slowdown — build
 * time is unchanged by the cache, so timing cannot catch it.
 *
 * The FLOOR matters as much as the ceiling, and is the half that was missing.
 * This originally asserted a max only, and a max cannot catch measuring
 * nothing: on an incremental build Next reuses cached output, never re-runs
 * data fetching, and the log contains zero markers. Zero passes a max of 2 —
 * and would pass a max of 1, so tightening the ceiling would not have helped.
 * Observed on Batch 1: the first run reported 0 and read as "the cache is
 * working perfectly"; after `rm -rf .next` the real count was 1.
 *
 * Run the build clean:
 *   rm -rf .next && CATALOG_TRACE=1 npm run build > build.log 2>&1
 *   node scripts/check-build-queries.mjs build.log 2
 */
import { readFileSync } from "node:fs";

// At least one real fetch must have happened, or the build did not exercise
// the catalog and the number below means nothing.
const MIN = 1;

const [, , logPath, maxArg] = process.argv;
if (!logPath) {
  console.error("usage: check-build-queries.mjs <build.log> [max]");
  process.exit(2);
}
const max = Number(maxArg ?? 2);
const hits = (readFileSync(logPath, "utf8").match(/__FETCH_CATALOG_HIT__/g) ?? []).length;
console.log(`catalog round trips: ${hits} (expected ${MIN}-${max})`);

if (hits < MIN) {
  console.error(
    `FAIL: ${hits} round trips is below the floor of ${MIN} — this build measured nothing.\n` +
      `       Most likely a stale .next: an incremental build reuses cached output and never\n` +
      `       re-runs data fetching, so the log has no markers and the count is vacuously 0.\n` +
      `       Re-run with: rm -rf .next && CATALOG_TRACE=1 npm run build > <log> 2>&1\n` +
      `       If it is still 0 after a clean build, no route is reading lib/catalog.ts.`
  );
  process.exit(1);
}
if (hits > max) {
  console.error(`FAIL: ${hits} round trips exceeds ${max} — unstable_cache is not deduping.`);
  process.exit(1);
}
console.log("PASS");
