#!/usr/bin/env node
/**
 * STALENESS HORIZON — MEASUREMENT ONLY (operator brief 2026-08-22).
 * Explicitly NOT an implementation. Underscore-prefixed: not a gate,
 * not wired into any build.
 *
 * Question: how old is the price data we are DISPLAYING, and how much
 * of the catalog goes dark if we suppress the number past a threshold?
 *
 * Reproduces the site's own decision path rather than a proxy for it:
 *   getEffectivePrice's read-side TTL decides live-vs-catalog, then
 *   resolveAsOfStamp decides the date. Measuring `current_prices` age
 *   directly would answer a different question and look like this one.
 */
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
import { FRESHNESS_LIMIT_MS } from "../lib/pricing/freshness.ts";
import { resolveAsOfStamp } from "../components/PriceAsOfLabel.tsx";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SKIPPED: credentials absent — not reporting a result it did not earn."); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);
console.log(`reference date: ${TODAY}\nTTL in force:   ${FRESHNESS_LIMIT_MS / 86400000} days\n`);

const products = await fetchAllRows((from, to) =>
  supabase.from("catalog_products").select("id, partner_id, slug").order("id").range(from, to));

const cp = new Map();
{
  const rows = await fetchAllRows((from, to) =>
    supabase.from("current_prices")
      .select("product_id, price, updated_at, feed_last_imported_at")
      .order("product_id").range(from, to));
  for (const r of rows) cp.set(r.product_id, r);
}


// POST-REMOVAL PROJECTION (operator ruling 2026-08-22): confirm the
// suppression rule's scope AFTER the cleanup rather than assuming it.
import { readFileSync as _rf } from "node:fs";
const removeSlugs = new Set();
if (process.env.SIMULATE_REMOVAL) {
  for (const f of ["canvas-vows", "tsar-bomba-default"]) {
    for (const [slug] of JSON.parse(_rf(`scripts/_h-${f}.json`, "utf8")).pairs) removeSlugs.add(slug);
  }
  if (process.env.SIMULATE_REMOVAL === "all") {
    for (const f of ["tsar-bomba", "evdance", "golden-maple"]) {
      const v = JSON.parse(_rf(`scripts/_verdict-${f}.json`, "utf8"));
      for (const [slug] of [...v.DIFFERENT, ...v.NOTHING]) removeSlugs.add(slug);
    }
  }
  console.log(`SIMULATING REMOVAL OF ${removeSlugs.size} products (mode: ${process.env.SIMULATE_REMOVAL})
`);
}

const BUCKETS = [[0,2],[3,7],[8,14],[15,30],[31,60],[61,90],[91,Infinity]];
const label = ([a,b]) => (b === Infinity ? "90+" : `${a}-${b}`);
const rows = [];
let noStamp = 0;

for (const p of products) {
  const o = cp.get(p.id);
  const fresh = o && NOW - Date.parse(o.updated_at) <= FRESHNESS_LIMIT_MS;
  const stamp = resolveAsOfStamp({
    partnerId: p.partner_id, slug: p.slug,
    priceSource: fresh ? "live" : "catalog",
    priceFeedVintage: fresh ? o.feed_last_imported_at : null,
  });
  if (removeSlugs.has(p.slug)) continue;
  if (!stamp) { noStamp++; continue; }
  const age = Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${stamp.iso}T00:00:00Z`)) / 86400000);
  rows.push({ ...p, iso: stamp.iso, age, source: fresh ? "live" : "catalog" });
}

console.log(`catalog_products rows (the live population): ${products.length}`);
console.log(`carrying a displayed as-of stamp:            ${rows.length}`);
console.log(`displaying a price with NO stamp at all:     ${noStamp}\n`);

console.log("PART 1 — age of the displayed price's vintage");
console.log("bucket   products   share   live   catalog   partners");
for (const b of BUCKETS) {
  const inB = rows.filter((r) => r.age >= b[0] && r.age <= b[1]);
  if (!inB.length) { console.log(`${label(b).padEnd(8)} ${"0".padStart(8)}`); continue; }
  const parts = [...new Set(inB.map((r) => r.partner_id))].sort();
  console.log(
    `${label(b).padEnd(8)} ${String(inB.length).padStart(8)} ${(100*inB.length/rows.length).toFixed(1).padStart(6)}% ` +
    `${String(inB.filter(r=>r.source==="live").length).padStart(6)} ${String(inB.filter(r=>r.source==="catalog").length).padStart(9)}   ${parts.join(", ")}`
  );
}

console.log("\nPART 2 — products that lose their displayed price at each threshold");
console.log("threshold   suppressed   share of stamped   share of ALL live products");
for (const t of [30, 45, 60, 90]) {
  const n = rows.filter((r) => r.age > t).length;
  console.log(`> ${String(t).padStart(2)} days ${String(n).padStart(12)} ${(100*n/rows.length).toFixed(1).padStart(17)}% ${(100*n/products.length).toFixed(1).padStart(26)}%`);
}

console.log("\nPART 3 — the 90+ bucket, by partner and vintage (spot-check candidates)");
const old = rows.filter((r) => r.age > 90);
const byV = new Map();
for (const r of old) {
  const k = `${r.partner_id} @ ${r.iso} (${r.age}d)`;
  byV.set(k, (byV.get(k) ?? 0) + 1);
}
for (const [k, n] of [...byV].sort()) console.log(`  ${String(n).padStart(4)}  ${k}`);
console.log("\n  five spot-check candidates (deterministic: first by slug):");
for (const r of old.slice().sort((a,b)=>a.slug.localeCompare(b.slug)).slice(0,5)) {
  console.log(`    ${r.partner_id}/${r.slug}  stamp ${r.iso}`);
}
