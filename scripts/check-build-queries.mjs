#!/usr/bin/env node
/** Fails if a build made more catalog round trips than expected. Guards the
 * Step 13 decision: unstable_cache must dedupe fetchCatalog build-wide. A
 * regression here (a call site bypassing the cache, or the cache key going
 * stale) shows up as a query-count jump long before it shows up as a
 * slowdown — build time is unchanged by this, so timing cannot catch it. */
import { readFileSync } from "node:fs";

const [, , logPath, maxArg] = process.argv;
if (!logPath) {
  console.error("usage: check-build-queries.mjs <build.log> [max]");
  process.exit(2);
}
const max = Number(maxArg ?? 2);
const hits = (readFileSync(logPath, "utf8").match(/__FETCH_CATALOG_HIT__/g) ?? []).length;
console.log(`catalog round trips: ${hits} (max ${max})`);
if (hits > max) {
  console.error(`FAIL: ${hits} round trips exceeds ${max} — unstable_cache is not deduping.`);
  process.exit(1);
}
console.log("PASS");
