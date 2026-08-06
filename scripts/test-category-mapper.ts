#!/usr/bin/env -S npx tsx
/**
 * Sanity-checks lib/category-mapper.ts against real, already-live products
 * from the three current partners — per PART 4 of the taxonomy spec.
 * Read-only: doesn't touch lib/partners.ts or any live data.
 *
 * Run with: npx tsx scripts/test-category-mapper.ts
 */
import { getAllRealProducts } from "../lib/partners.js";
import { mapProductToCategory } from "../lib/category-mapper.js";

function sample(partnerId: string, n: number) {
  return getAllRealProducts()
    .filter((p) => p.partnerId === partnerId)
    .slice(0, n);
}

function report(partnerId: string, n: number) {
  console.log(`\n${"=".repeat(64)}\n${partnerId} — ${n} sample products\n${"=".repeat(64)}`);
  for (const p of sample(partnerId, n)) {
    const mapping = mapProductToCategory({
      title: p.name,
      description: p.description,
      brand: p.partnerName,
      partnerCategory: p.category,
      price: p.price,
      url: p.deepLink,
      partnerId: p.partnerId,
    });
    console.log(`\n"${p.name}"`);
    console.log(`  raw category: ${p.category}  |  price: $${p.price}`);
    console.log(
      `  -> ${mapping.department} > ${mapping.category} > ${mapping.productTypeGroup} > ${mapping.productType}` +
        `  (confidence ${mapping.confidenceScore})`
    );
  }
}

report("brooklyn-delhi", 5);
report("evdance", 3);
report("golden-maple", 3);
