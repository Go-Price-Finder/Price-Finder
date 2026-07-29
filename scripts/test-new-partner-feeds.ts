#!/usr/bin/env -S npx tsx
/**
 * PART 4 of the taxonomy spec: runs the new-partner feeds (Canvas Vows,
 * King Koil, Tsarbomba) through lib/category-mapper.ts and reports counts,
 * category breakdown, low-confidence products, and sample mappings.
 * Read-only — does not touch lib/partners.ts or any live data, per "Do
 * NOT import live yet."
 *
 * Run with: node --env-file=.env --import tsx scripts/test-new-partner-feeds.ts
 */
import { gunzipSync } from "node:zlib";
import Papa from "papaparse";
import { mapProductToCategory, type ProductInput } from "../lib/category-mapper.js";

const FEED_LIST_URL = process.env.AWIN_FEED_LIST_URL;
if (!FEED_LIST_URL) {
  console.error("Missing AWIN_FEED_LIST_URL — run with node --env-file=.env --import tsx ...");
  process.exit(1);
}

const TARGETS: { match: string; partnerId: string }[] = [
  { match: "Canvas Vows", partnerId: "canvas-vows" },
  { match: "King Koil", partnerId: "king-koil" },
  { match: "Tsarbomba", partnerId: "tsar-bomba" },
];

type FeedListRow = {
  "Advertiser Name": string;
  "Membership Status": string;
  "Feed ID": string;
  "Feed Name": string;
  Language: string;
  Vertical: string;
  URL: string;
};

async function fetchFeedList(): Promise<FeedListRow[]> {
  const res = await fetch(FEED_LIST_URL!);
  if (!res.ok) throw new Error(`Feed list fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  return Papa.parse<FeedListRow>(text, { header: true, skipEmptyLines: true }).data;
}

async function downloadFeed(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Feed download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const csv = gunzipSync(buf).toString("utf8");
  return Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data;
}

function toProductInput(row: Record<string, string>, partnerId: string): ProductInput {
  return {
    title: row.product_name || "",
    description: row.description || row.product_short_description || "",
    brand: row.brand_name || "",
    partnerCategory: row.category_name || row.merchant_category || undefined,
    price: Number(row.search_price) || 0,
    url: row.aw_deep_link || row.merchant_deep_link || "",
    partnerId,
  };
}

function printSection(title: string) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);
}

async function main() {
  console.log(`Category mapper test against new-partner feeds`);
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log("Read-only — not importing into lib/partners.ts or the live catalog.");

  const feedList = await fetchFeedList();

  for (const target of TARGETS) {
    const candidates = feedList.filter(
      (r) => r["Advertiser Name"] === target.match && r["Membership Status"] === "active"
    );
    const chosen =
      candidates.find((c) => c["Language"] === "English" && !c["Vertical"]) ??
      candidates.find((c) => c["Language"] === "English") ??
      candidates[0];

    printSection(`${target.match.toUpperCase()} (partner-compliance id: "${target.partnerId}")`);
    if (!chosen) {
      console.log("  No active feed found.");
      continue;
    }
    console.log(`  Feed ${chosen["Feed ID"]} ("${chosen["Feed Name"] || "Default"}", ${chosen["Language"]})`);

    const rows = await downloadFeed(chosen.URL);
    console.log(`  Total products: ${rows.length}`);

    const mappings = rows.map((row) => ({
      row,
      mapping: mapProductToCategory(toProductInput(row, target.partnerId)),
    }));

    // Category breakdown: department -> category -> count
    const deptCounts = new Map<string, number>();
    const catCounts = new Map<string, number>();
    for (const { mapping } of mappings) {
      deptCounts.set(mapping.department, (deptCounts.get(mapping.department) ?? 0) + 1);
      const key = `${mapping.department} > ${mapping.category}`;
      catCounts.set(key, (catCounts.get(key) ?? 0) + 1);
    }
    console.log(`\n  By department:`);
    for (const [d, c] of [...deptCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${d}: ${c}`);
    }
    console.log(`\n  By category:`);
    for (const [c, n] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${c}: ${n}`);
    }

    // Low-confidence products
    const lowConfidence = mappings.filter((m) => m.mapping.confidenceScore < 70);
    console.log(`\n  Confidence < 70: ${lowConfidence.length} of ${rows.length} products`);
    for (const { row, mapping } of lowConfidence.slice(0, 15)) {
      console.log(
        `    [${mapping.confidenceScore}] "${(row.product_name || "").slice(0, 60)}"` +
          ` -> ${mapping.department} > ${mapping.category} > ${mapping.productType}`
      );
    }
    if (lowConfidence.length > 15) {
      console.log(`    ...and ${lowConfidence.length - 15} more`);
    }

    // Sample mappings
    console.log(`\n  Sample mappings (first 15):`);
    for (const { row, mapping } of mappings.slice(0, 15)) {
      console.log(
        `    "${(row.product_name || "").slice(0, 55)}"` +
          `\n      raw category: ${row.category_name || "(none)"} | price: $${row.search_price || "?"}` +
          `\n      -> ${mapping.department} > ${mapping.category} > ${mapping.productTypeGroup} > ${mapping.productType} (${mapping.confidenceScore})`
      );
    }
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
