#!/usr/bin/env node
/**
 * MERGED-SLUG REDIRECT GATE (findings §50).
 *
 * The king-koil enrichment and the canvas-vows collapse removed or
 * renamed 191 product URLs that are already indexed. Every one of them
 * has a permanent redirect in lib/merged-slugs.json, consumed by
 * next.config.ts.
 *
 * A redirect map is a hand-shaped artifact pointing at machine-generated
 * data, which is exactly the shape that rots (rule 5e). This re-derives
 * the validation from the CURRENT data files on every build, so the map
 * cannot silently fall out of step with them:
 *
 *   - every `from` slug must NO LONGER exist as a product (otherwise the
 *     redirect shadows a live page)
 *   - every `to` slug MUST exist as a product (otherwise we 301 into a 404)
 *   - no chains (a target that is itself redirected), no self-redirects,
 *     no duplicate sources
 *
 * Runs in `prebuild`: it needs only the data files, so it fails before a
 * broken map can be built into a deployment.
 *
 * SELFTEST: MERGED_SLUGS_SELFTEST=1 injects one redirect pointing at a
 * slug that does not exist. MUST exit nonzero.
 */
import { readFileSync } from "node:fs";

const PARTNERS = {
  "king-koil": "lib/king-koil-data.ts",
  "canvas-vows": "lib/canvas-vows-data.ts",
};

const map = JSON.parse(readFileSync("lib/merged-slugs.json", "utf8"));
if (!Array.isArray(map) || map.length === 0) {
  console.error("FAIL: lib/merged-slugs.json is empty or not an array — nothing to validate, and a PASS would be vacuous.");
  process.exit(2);
}

/** Live product slugs, per partner, read from the generated data file. */
const live = new Set();
for (const [partner, path] of Object.entries(PARTNERS)) {
  const src = readFileSync(path, "utf8");
  const slugs = [...src.matchAll(/^\s{4}slug: "((?:[^"\\]|\\.)*)",/gm)].map((m) => m[1]);
  if (slugs.length === 0) {
    console.error(`FAIL: parsed zero slugs from ${path} — the parser is broken, and a broken parser's clean result is worthless (§19).`);
    process.exit(2);
  }
  for (const s of slugs) live.add(`/${partner}/${s}`);
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
  if (live.has(r.from)) failures.push(`SHADOWS A LIVE PAGE: ${r.from} still exists as a product but is redirected away`);
  if (!live.has(r.to)) failures.push(`REDIRECTS INTO A 404: ${r.from} -> ${r.to}, which is not a live product`);
  if (sourceSet.has(r.to)) failures.push(`CHAIN: ${r.from} -> ${r.to}, but ${r.to} is itself redirected`);
}

console.log(
  `Validated ${entries.length} merged-slug redirects against ${live.size} live product URLs ` +
    `across ${Object.keys(PARTNERS).length} partners.`
);

if (failures.length) {
  console.error("FAIL — the redirect map no longer matches the catalog:\n" + failures.slice(0, 12).map((f) => "- " + f).join("\n") +
    (failures.length > 12 ? `\n…and ${failures.length - 12} more` : ""));
  process.exit(1);
}
console.log("PASS — every merged slug redirects to a live page, no chains, no shadows.");
