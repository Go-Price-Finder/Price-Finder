#!/usr/bin/env node
/**
 * WHO OWNS THE 15-30 DAY BUCKET? (operator brief 2026-08-22)
 *
 * The hypothesis to test, not assume: "a feed that stopped exporting
 * between late July and early August". Read-only.
 *
 * The bucket is defined by what the SITE DISPLAYS, so the question
 * decomposes into two that get confused:
 *   1. is the FEED stale (merchant stopped exporting), or
 *   2. is the feed fine and our REFRESH is not reaching these products,
 *      so they fall back to the hand-maintained catalog vintage?
 * Those have opposite remedies and only one of them is a dying feed.
 */
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { createClient } from "@supabase/supabase-js";
import { fetchAllRows } from "../lib/supabase/fetchAllRows.ts";
import { FRESHNESS_LIMIT_MS } from "../lib/pricing/freshness.ts";
import { resolveAsOfStamp } from "../components/PriceAsOfLabel.tsx";
import { getSourceFeedStatusId } from "../lib/price-as-of.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("SKIPPED: credentials absent."); process.exit(2); }
const supabase = createClient(url, key, { auth: { persistSession: false } });

const NOW = Date.now();
const TODAY = new Date(NOW).toISOString().slice(0, 10);

const products = await fetchAllRows((f, t) =>
  supabase.from("catalog_products").select("id, partner_id, slug").order("id").range(f, t));
const cp = new Map();
for (const r of await fetchAllRows((f, t) =>
  supabase.from("current_prices").select("product_id, updated_at, feed_last_imported_at").order("product_id").range(f, t))) cp.set(r.product_id, r);

// What the feeds themselves say TODAY, straight from AWIN's feed list.
console.log("=== A. ARE THE FEEDS ACTUALLY STALE? (AWIN feed list, live) ===");
const feedList = Papa.parse(await (await fetch(process.env.AWIN_FEED_LIST_URL)).text(), { header: true, skipEmptyLines: true }).data;
const feedInfo = new Map();
for (const r of feedList) {
  const id = String(r["Feed ID"] || "").trim();
  if (!id) continue;
  feedInfo.set(id, { name: `${r["Advertiser Name"]} / ${r["Feed Name"] || "Default"}`,
    lastImported: r["Last Imported"], products: r["No of products"] });
}
for (const id of ["F2639", "F1320", "F2615", "101819", "113495", "103552", "105368"]) {
  const f = feedInfo.get(id);
  if (!f) { console.log(`  ${id.padEnd(8)} NOT IN OUR FEED LIST`); continue; }
  const age = Math.round((NOW - Date.parse(f.lastImported.replace(" ", "T") + "Z")) / 86400000);
  console.log(`  ${id.padEnd(8)} ${String(age).padStart(3)}d  last export ${f.lastImported}  ${f.products} products  ${f.name}`);
}

// Now the bucket itself.
const rows = [];
for (const p of products) {
  const o = cp.get(p.id);
  const fresh = o && NOW - Date.parse(o.updated_at) <= FRESHNESS_LIMIT_MS;
  const stamp = resolveAsOfStamp({ partnerId: p.partner_id, slug: p.slug,
    priceSource: fresh ? "live" : "catalog",
    priceFeedVintage: fresh ? o.feed_last_imported_at : null });
  if (!stamp) continue;
  const age = Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${stamp.iso}T00:00:00Z`)) / 86400000);
  rows.push({ ...p, age, iso: stamp.iso, source: fresh ? "live" : "catalog",
    hasCpRow: !!o, cpAgeDays: o ? Math.round((NOW - Date.parse(o.updated_at)) / 86400000) : null,
    feedId: getSourceFeedStatusId(p.partner_id, p.slug) });
}

const bucket = rows.filter((r) => r.age >= 15 && r.age <= 30);
console.log(`\n=== B. THE 15-30 BUCKET: ${bucket.length} products ===`);
const by = new Map();
for (const r of bucket) {
  const k = `${r.partner_id}  feed ${r.feedId}  stamp ${r.iso} (${r.age}d)  via ${r.source}`;
  by.set(k, (by.get(k) ?? 0) + 1);
}
for (const [k, n] of [...by].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`);

console.log("\n=== C. WHY ARE THEY ON THE CATALOG PATH? ===");
const noRow = bucket.filter((r) => !r.hasCpRow).length;
const staleRow = bucket.filter((r) => r.hasCpRow).length;
console.log(`  no current_prices row at all (refresh never matched them) : ${noRow}`);
console.log(`  has a row but older than the ${FRESHNESS_LIMIT_MS / 86400000}-day TTL              : ${staleRow}`);
if (staleRow) {
  const ages = bucket.filter((r) => r.hasCpRow).map((r) => r.cpAgeDays).sort((a, b) => a - b);
  console.log(`     their row ages (days): min ${ages[0]}, median ${ages[Math.floor(ages.length / 2)]}, max ${ages[ages.length - 1]}`);
}

console.log("\n=== D. PER PARTNER: how much of each partner is on the catalog path? ===");
const partners = [...new Set(rows.map((r) => r.partner_id))].sort();
console.log("  partner          total   live   catalog   catalog%");
for (const p of partners) {
  const all = rows.filter((r) => r.partner_id === p);
  const live = all.filter((r) => r.source === "live").length;
  console.log(`  ${p.padEnd(16)} ${String(all.length).padStart(5)} ${String(live).padStart(6)} ${String(all.length - live).padStart(9)} ${(100 * (all.length - live) / all.length).toFixed(0).padStart(9)}%`);
}
