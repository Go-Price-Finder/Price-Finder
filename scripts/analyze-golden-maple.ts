#!/usr/bin/env -S npx tsx
/**
 * One-off analysis (not a permanent script) — groups Golden Maple's full
 * 348-product catalog by raw category and prints representative product
 * names per category, to identify real product-type clusters for
 * expanding config/walmart-taxonomy.json's Arts & Crafts section.
 */
import { getAllRealProducts } from "../lib/partners.js";

const products = getAllRealProducts().filter((p) => p.partnerId === "golden-maple");

const byCategory = new Map<string, typeof products>();
for (const p of products) {
  const list = byCategory.get(p.category) ?? [];
  list.push(p);
  byCategory.set(p.category, list);
}

for (const [cat, items] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n=== ${cat} (${items.length}) ===`);
  // Print every distinct "core" name (strip trailing size/color/version variants roughly)
  const seen = new Set<string>();
  for (const p of items) {
    const core = p.name
      .replace(/[-–]\s*(version|size|black|yellow|white|red|blue|green)\b.*$/i, "")
      .replace(/\(\d+\s*pcs?\)/i, "")
      .trim();
    if (!seen.has(core)) {
      seen.add(core);
      console.log(`  ${p.name}`);
    }
  }
}
