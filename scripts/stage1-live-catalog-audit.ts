#!/usr/bin/env -S npx tsx
/**
 * Stage 1 of the category-system reconciliation plan (see
 * PROJECT-CONTEXT.md's session log): runs every currently-live product
 * (all 449, across Brooklyn Delhi/EVDANCE/Golden Maple) through
 * lib/category-mapper.ts and reports the confidence distribution. This is
 * analysis only — doesn't touch lib/partners.ts, doesn't persist
 * anything, doesn't change what /category/[slug] actually uses today.
 *
 * Run with: npx tsx scripts/stage1-live-catalog-audit.ts
 */
import { getAllRealProducts } from "../lib/partners.js";
import { mapProductToCategory } from "../lib/category-mapper.js";

const products = getAllRealProducts();

const results = products.map((p) => ({
  product: p,
  mapping: mapProductToCategory({
    title: p.name,
    description: p.description,
    brand: p.partnerName,
    partnerCategory: p.category,
    price: p.price,
    url: p.deepLink,
    partnerId: p.partnerId,
  }),
}));

console.log(`Stage 1 — live catalog confidence audit`);
console.log(`Generated: ${new Date().toISOString()}`);
console.log(`Total live products: ${products.length}\n`);

// Distribution by 10-point bucket
const buckets = new Map<string, number>();
for (const { mapping } of results) {
  const bucketFloor = Math.floor(mapping.confidenceScore / 10) * 10;
  const key = `${bucketFloor}-${bucketFloor + 9}`;
  buckets.set(key, (buckets.get(key) ?? 0) + 1);
}
console.log("Confidence distribution (10-point buckets):");
for (let floor = 0; floor <= 90; floor += 10) {
  const key = `${floor}-${floor + 9}`;
  const count = buckets.get(key) ?? 0;
  const bar = "#".repeat(Math.round(count / 5));
  console.log(`  ${key.padEnd(7)} ${String(count).padStart(4)}  ${bar}`);
}

const below70 = results.filter((r) => r.mapping.confidenceScore < 70);
const atOrAbove70 = results.length - below70.length;
console.log(
  `\n>= 70 confidence: ${atOrAbove70} of ${results.length} (${((atOrAbove70 / results.length) * 100).toFixed(1)}%)`
);
console.log(
  `< 70 confidence:  ${below70.length} of ${results.length} (${((below70.length / results.length) * 100).toFixed(1)}%)`
);

// Breakdown by partner
console.log("\nBy partner:");
for (const partnerId of ["brooklyn-delhi", "evdance", "golden-maple"]) {
  const partnerResults = results.filter((r) => r.product.partnerId === partnerId);
  const partnerBelow70 = partnerResults.filter((r) => r.mapping.confidenceScore < 70);
  const avg =
    partnerResults.reduce((sum, r) => sum + r.mapping.confidenceScore, 0) / partnerResults.length;
  console.log(
    `  ${partnerId}: ${partnerResults.length} products, avg confidence ${avg.toFixed(1)}, ` +
      `${partnerBelow70.length} below 70 (${((partnerBelow70.length / partnerResults.length) * 100).toFixed(1)}%)`
  );
}

// Department/category breakdown for the whole catalog
const deptCounts = new Map<string, number>();
for (const { mapping } of results) {
  deptCounts.set(mapping.department, (deptCounts.get(mapping.department) ?? 0) + 1);
}
console.log("\nBy department (whole catalog):");
for (const [dept, count] of [...deptCounts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${dept}: ${count}`);
}

// Lowest-confidence examples for context
const sorted = [...results].sort((a, b) => a.mapping.confidenceScore - b.mapping.confidenceScore);
console.log("\n20 lowest-confidence products (for spot-checking):");
for (const { product, mapping } of sorted.slice(0, 20)) {
  console.log(
    `  [${mapping.confidenceScore}] (${product.partnerId}) "${product.name.slice(0, 55)}"` +
      ` -> ${mapping.department} > ${mapping.category} > ${mapping.productType}`
  );
}

console.log("\nDone.\n");
