#!/usr/bin/env node
/**
 * FULL-CATALOG DEEP-LINK RESOLUTION, stage 1 (operator brief 2026-08-22).
 * Generalises scripts/_resolve-frozen-deeplinks.mjs to any partner/feed.
 *
 * Resolves `deep_link`'s AWIN `p=<id>` against the feed's own
 * `merchant_deep_link`. The links are NEVER followed: pclick resolves
 * server-side and the redirect registers a self-click (handover rule 15).
 *
 * Usage: node _resolve-links.mjs <partner> <feedCsv> [--exclude-slugs=<mjs export>]
 * Stage 2 (destination checking) runs from the merchant's own origin.
 */
import { readFileSync, writeFileSync } from "node:fs";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";

const [partner, feedCsv, excludeArg] = process.argv.slice(2);
if (!partner || !feedCsv) { console.error("usage: <partner> <feedCsv> [--exclude=<file.mjs>]"); process.exit(2); }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SKIPPED: credentials absent."); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

let exclude = new Set();
if (excludeArg) {
  const mod = await import("./" + excludeArg.replace("--exclude=", ""));
  exclude = Object.values(mod).find((v) => v instanceof Set) ?? new Set();
}

const rows = Papa.parse(readFileSync(feedCsv, "utf8"), { header: true, skipEmptyLines: true }).data;

// TWO FEED TEMPLATES, keyed differently. Classic AWIN feeds carry
// `aw_product_id` + `merchant_deep_link`. Google-template feeds (the
// F-prefixed ones: F1320, F2615, F2639) carry neither — their merchant URL
// is `link`, and the only place the AWIN product id appears is inside
// `aw_deep_link`'s own `p=` parameter. Detect rather than assume: reading a
// Google feed with classic column names yields zero matches and looks
// exactly like "no products resolve", which is a finding-shaped silence.
const first = rows[0] ?? {};
const template = "aw_product_id" in first ? "classic" : ("aw_deep_link" in first ? "google" : null);
if (!template) { console.error(`FAIL: ${feedCsv} has neither aw_product_id nor aw_deep_link — cannot key it.`); process.exit(2); }
const destCol = template === "classic" ? "merchant_deep_link" : "link";
const byId = new Map();
for (const r of rows) {
  let id = null;
  if (template === "classic") id = r.aw_product_id && String(r.aw_product_id).trim();
  else { try { id = new URL(r.aw_deep_link).searchParams.get("p"); } catch { id = null; } }
  if (id) byId.set(id, r);
}
console.log(`feed ${feedCsv}: ${template} template, ${byId.size} rows indexed (dest column: ${destCol})`);
if (byId.size === 0) { console.error("FAIL: zero rows indexed — that is a parse failure, not an empty feed."); process.exit(2); }

const all = await fetchAllRows((from, to) =>
  supabase.from("catalog_products").select("id, partner_id, slug, name, price, deep_link")
    .eq("partner_id", partner).order("id").range(from, to));
const cohort = all.filter((p) => !exclude.has(p.slug));
console.log(`${partner}: ${all.length} catalog products, ${cohort.length} in scope (${all.length - cohort.length} excluded)`);

const resolved = [], unmatched = [];
for (const p of cohort) {
  let pid = null;
  try { pid = new URL(p.deep_link).searchParams.get("p"); } catch { /* below */ }
  const row = pid ? byId.get(pid) : null;
  if (!row || !(row[destCol] || "").trim()) { unmatched.push({ slug: p.slug, pid, inFeed: !!row }); continue; }
  resolved.push({ partner, slug: p.slug, pid, ourPrice: p.price,
    feedPrice: row.search_price ?? row.price ?? null, dest: row[destCol].trim() });
}

console.log(`\nresolved to a merchant URL : ${resolved.length}`);
console.log(`unresolvable               : ${unmatched.length}`);
for (const u of unmatched.slice(0, 15)) console.log(`   ${u.slug}  p=${u.pid}  inFeed=${u.inFeed}`);
if (unmatched.length > 15) console.log(`   …and ${unmatched.length - 15} more`);

const origins = new Map();
for (const r of resolved) {
  let o = "(unparseable)";
  try { o = new URL(r.dest).origin; } catch { /* counted */ }
  origins.set(o, (origins.get(o) ?? 0) + 1);
}
console.log("\ndestination origins:");
for (const [o, n] of [...origins].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${o}`);

const paths = [...new Set(resolved.map((r) => { try { const u = new URL(r.dest); return u.pathname + u.search; } catch { return null; } }).filter(Boolean))];
console.log(`\ndistinct destination paths: ${paths.length}`);
writeFileSync(`scripts/_links-${partner}.json`, JSON.stringify({ resolved, unmatched, paths }, null, 2));
console.log(`wrote scripts/_links-${partner}.json`);
