#!/usr/bin/env node
/**
 * MERGED-SLUG REDIRECT GATE (findings §50).
 *
 * The king-koil enrichment and the canvas-vows collapse removed or
 * renamed 191 product URLs that are already indexed. Every one of them
 * has a permanent redirect in lib/merged-slugs.json, consumed by
 * next.config.ts.
 *
 * READS THE RENDERED SITEMAP, NOT THE STATIC DATA FILES — and the first
 * version of this gate got that wrong, which is the whole reason the
 * comment is here. It validated against lib/<partner>-data.ts, passed,
 * and shipped three king-koil URLs that were still live in the sitemap
 * while returning 308. The site renders from `catalog_products`
 * (migration 0008); the static files are the IMPORT ARTIFACT, not the
 * source of truth. Checking them was checking intent, not behaviour —
 * rule 5f, broken by the gate written to enforce rule 5e.
 *
 * A redirect map is a hand-shaped artifact pointing at machine-generated
 * data, which is exactly the shape that rots (rule 5e). This re-derives
 * the validation from the BUILD OUTPUT every build, so the map cannot
 * silently fall out of step with what is actually published:
 *
 *   - every `from` URL must be ABSENT from the rendered sitemap (a
 *     sitemap that advertises a redirecting URL hands Google a "page
 *     with redirect" for every entry)
 *   - every `to` URL MUST be present in the rendered sitemap
 *   - no chains (a target that is itself redirected), no self-redirects,
 *     no duplicate sources
 *
 * Runs in `postbuild`: it needs the rendered sitemap, which only exists
 * after a build.
 *
 * SELFTEST: MERGED_SLUGS_SELFTEST=1 injects one redirect pointing at a
 * slug that does not exist. MUST exit nonzero.
 */
import { readFileSync, existsSync } from "node:fs";

const SITEMAP = ".next/server/app/sitemap.xml.body";

const map = JSON.parse(readFileSync("lib/merged-slugs.json", "utf8"));
if (!Array.isArray(map) || map.length === 0) {
  console.error("FAIL: lib/merged-slugs.json is empty or not an array — nothing to validate, and a PASS would be vacuous.");
  process.exit(2);
}
if (!existsSync(SITEMAP)) {
  console.error(`FAIL: ${SITEMAP} not found. This gate validates against the RENDERED sitemap, so without a build there is nothing to check.`);
  process.exit(2);
}
const xml = readFileSync(SITEMAP, "utf8");
const published = new Set(
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ""))
);
if (published.size < 100) {
  console.error(`FAIL: rendered sitemap has only ${published.size} urls — the parse or the build is wrong, not the site.`);
  process.exit(2);
}

const entries = [...map];
if (process.env.MERGED_SLUGS_SELFTEST === "1") {
  entries.push({ from: "/king-koil/__selftest-source", to: "/king-koil/__selftest-target-does-not-exist", why: "SELFTEST" });
}

const failures = [];
const sources = entries.map((r) => r.from);
const sourceSet = new Set(sources);
if (sourceSet.size !== sources.length) failures.push(`${sources.length - sourceSet.size} duplicate source slug(s)`);

for (const r of entries) {
  if (!r.from || !r.to) { failures.push(`incomplete entry: ${JSON.stringify(r)}`); continue; }
  if (r.from === r.to) failures.push(`self-redirect: ${r.from}`);
  if (published.has(r.from)) failures.push(`STILL IN THE SITEMAP: ${r.from} is advertised to crawlers but returns a redirect`);
  if (!published.has(r.to)) failures.push(`REDIRECTS TO AN UNPUBLISHED URL: ${r.from} -> ${r.to}, which is not in the sitemap`);
  if (sourceSet.has(r.to)) failures.push(`CHAIN: ${r.from} -> ${r.to}, but ${r.to} is itself redirected`);
}

console.log(`Validated ${entries.length} merged-slug redirects against ${published.size} URLs in the rendered sitemap.`);

if (failures.length) {
  console.error("FAIL — the redirect map no longer matches the catalog:\n" + failures.slice(0, 12).map((f) => "- " + f).join("\n") +
    (failures.length > 12 ? `\n…and ${failures.length - 12} more` : ""));
  process.exit(1);
}
console.log("PASS — no redirected URL is still advertised, every target is published, no chains.");
