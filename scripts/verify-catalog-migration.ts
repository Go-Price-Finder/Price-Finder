/**
 * Step 12 verification helper — compares lib/catalog.ts's (Supabase-backed)
 * output against lib/partners.ts's (static, still-live) output for the
 * same handful of manual queries, per the build guide's Step 12 prompt:
 * "verifies it against a handful of manual test queries compared to the
 * old lib/partners.ts output for the same inputs."
 *
 * Requires real Supabase credentials in the environment
 * (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) — this script
 * does not read or fabricate them. It only reads the DB, never writes.
 *
 * Run with: npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
 *
 * The --env-file flag is required (Node 20.6+). Plain
 * `npx tsx scripts/verify-catalog-migration.ts` does NOT work on any
 * machine: tsx does not load .env.local, and Next.js only loads it for
 * `next dev/build/start` — never for a standalone script. Without the
 * flag this crashes in createPublicClient() before running a single
 * comparison. If your credentials are already exported in the shell,
 * drop the flag.
 */
// MUST be first: installs a stub Next incremental cache so lib/catalog.ts's
// unstable_cache wrapper (Step 14 Task 4) works outside a Next render context.
// Without it this script throws "Invariant: incrementalCache missing" before
// running a single comparison. See the file's own header for why the shim
// lives here rather than as a fallback inside lib/catalog.ts.
import "./_next-cache-shim";

import * as fromStatic from "../lib/partners";
import * as fromCatalog from "../lib/catalog";

let failures = 0;

function report(label: string, pass: boolean, detail?: string) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${label}${detail ? `: ${detail}` : ""}`);
  if (!pass) failures++;
}

function sortedIds(products: { id: string }[]): string[] {
  return products.map((p) => p.id).sort();
}

/** Ids in their ACTUAL order — deliberately not sorted.
 *
 * sortedIds() above sorts both sides before comparing, so every check routing
 * through it is order-insensitive by construction. That blind spot let this
 * script pass 25/25 on 2026-08-09 while catalog row order had already diverged
 * from the static arrays for three of six partners, silently changing
 * related-product selection on 476 pages (fixed by migration 0010's
 * sort_order). Set equality is necessary but not sufficient: anything doing
 * .filter().slice(n), or sorting with a non-total comparator, inherits read
 * order. Assert sequence too. */
function orderedIds(products: { id: string }[]): string[] {
  return products.map((p) => p.id);
}

async function main() {
  console.log("Backfill completed 2026-08-09 — catalog_products holds all");
  console.log("954 products (Golden Maple 348, Tsar Bomba 272). Partial-");
  console.log("backfill count mismatches are no longer expected, so treat");
  console.log("any FAIL below as a real problem, not an in-progress import.\n");

  // 1. Total product count + id-set comparison.
  const staticAll = fromStatic.getAllRealProducts();
  const catalogAll = await fromCatalog.getAllRealProducts();
  report(
    "getAllRealProducts() count",
    staticAll.length === catalogAll.length,
    `static=${staticAll.length} catalog=${catalogAll.length}`
  );
  const staticIds = sortedIds(staticAll);
  const catalogIds = sortedIds(catalogAll);
  const missingFromCatalog = staticIds.filter((id) => !catalogIds.includes(id));
  const extraInCatalog = catalogIds.filter((id) => !staticIds.includes(id));
  report(
    "getAllRealProducts() id sets match",
    missingFromCatalog.length === 0 && extraInCatalog.length === 0,
    `missing=${missingFromCatalog.length} extra=${extraInCatalog.length}` +
      (missingFromCatalog.length ? ` e.g. ${missingFromCatalog.slice(0, 3).join(", ")}` : "")
  );

  // 1b. ORDER, not just membership — see orderedIds()'s comment.
  report(
    "getAllRealProducts() sequence",
    JSON.stringify(orderedIds(staticAll)) === JSON.stringify(orderedIds(catalogAll)),
    "flat read order must match lib/partners.ts, not just contain the same ids"
  );
  for (const partner of fromStatic.PARTNERS) {
    const s2 = orderedIds(partner.products);
    const c2 = orderedIds(catalogAll.filter((p) => p.partnerId === partner.id));
    const firstDiff = s2.findIndex((id, k) => id !== c2[k]);
    report(
      `product sequence — ${partner.id}`,
      JSON.stringify(s2) === JSON.stringify(c2),
      firstDiff === -1
        ? `${s2.length} products in order`
        : `diverges at index ${firstDiff}: static=${s2[firstDiff]} catalog=${c2[firstDiff] ?? "(missing)"}`
    );
  }

  // 2. getPartner() per partner — count + tagline/href.
  for (const partner of fromStatic.PARTNERS) {
    const catalogPartner = await fromCatalog.getPartner(partner.id);
    report(
      `getPartner("${partner.id}")`,
      !!catalogPartner &&
        catalogPartner.name === partner.name &&
        catalogPartner.tagline === partner.tagline &&
        catalogPartner.href === partner.href &&
        catalogPartner.products.length === partner.products.length,
      `static products=${partner.products.length} catalog products=${catalogPartner?.products.length ?? "undefined"}`
    );
  }

  // 3. getRealProduct() — one product per partner, full field diff.
  for (const partner of fromStatic.PARTNERS) {
    const sample = partner.products[0];
    if (!sample) continue;
    const fromCat = await fromCatalog.getRealProduct(partner.id, sample.slug);
    const fieldsMatch =
      !!fromCat &&
      fromCat.name === sample.name &&
      fromCat.price === sample.price &&
      fromCat.originalPrice === sample.originalPrice &&
      fromCat.category === sample.category &&
      fromCat.parentCategory === sample.parentCategory &&
      fromCat.deepLink === sample.deepLink &&
      fromCat.image === sample.image;
    report(
      `getRealProduct("${partner.id}", "${sample.slug}") field match`,
      fieldsMatch,
      fieldsMatch ? undefined : JSON.stringify({ static: sample, catalog: fromCat })
    );
  }

  // 3b. FULL field equality, every product, every field.
  //
  // Check 3 above spot-checks one product per partner across 8 fields. That
  // left two blind spots that were both found the hard way: `description` was
  // never compared at all, which is how 29 king-koil rows sat in the database
  // with U+00A0 normalized to U+0020 while the suite reported all-green; and
  // only 6 of 954 products were examined.
  //
  // This compares EVERY field of RealProduct for EVERY product. Coverage is
  // now a stated decision rather than an accident: the field list below is
  // derived from the RealProduct type, and anything added to that type should
  // be added here too. `images` and `rating` are compared by JSON value since
  // they are an array and an object.
  const catalogById = new Map(catalogAll.map((p) => [p.id, p]));
  for (const partner of fromStatic.PARTNERS) {
    const fieldDiffs = new Map<string, number>();
    let missing = 0;
    for (const sp of partner.products) {
      const cp = catalogById.get(sp.id);
      if (!cp) { missing++; continue; }
      const compare: [string, unknown, unknown][] = [
        ["slug", sp.slug, cp.slug],
        ["partnerId", sp.partnerId, cp.partnerId],
        ["partnerName", sp.partnerName, cp.partnerName],
        ["name", sp.name, cp.name],
        ["description", sp.description, cp.description],
        ["price", sp.price, cp.price],
        ["originalPrice", sp.originalPrice, cp.originalPrice],
        ["image", sp.image, cp.image],
        ["images", JSON.stringify(sp.images), JSON.stringify(cp.images)],
        ["category", sp.category, cp.category],
        ["parentCategory", sp.parentCategory, cp.parentCategory],
        ["badge", sp.badge, cp.badge],
        ["rating", JSON.stringify(sp.rating ?? null), JSON.stringify(cp.rating ?? null)],
        ["deepLink", sp.deepLink, cp.deepLink],
        ["href", sp.href, cp.href],
        ["variantLabel", sp.variantLabel, cp.variantLabel],
      ];
      for (const [field, a, b] of compare) {
        if (a !== b) fieldDiffs.set(field, (fieldDiffs.get(field) ?? 0) + 1);
      }
    }
    const summary = [...fieldDiffs.entries()].map(([f, n]) => `${f}×${n}`).join(", ");
    report(
      `full field equality — ${partner.id}`,
      fieldDiffs.size === 0 && missing === 0,
      fieldDiffs.size === 0 && missing === 0
        ? `${partner.products.length} products × 16 fields`
        : `${summary}${missing ? `, ${missing} missing from catalog` : ""}`
    );
  }

  // 4. getRealCategories() — name/count comparison.
  const staticCats = fromStatic.getRealCategories().sort((a, b) => a.name.localeCompare(b.name));
  const catalogCats = (await fromCatalog.getRealCategories()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  report(
    "getRealCategories() category count",
    staticCats.length === catalogCats.length,
    `static=${staticCats.length} catalog=${catalogCats.length}`
  );
  for (const cat of staticCats) {
    const match = catalogCats.find((c) => c.name === cat.name);
    report(
      `getRealCategories() "${cat.name}" itemCount`,
      match?.itemCount === cat.itemCount,
      `static=${cat.itemCount} catalog=${match?.itemCount ?? "missing"}`
    );
  }

  // 5. getFeaturedDeals() / getBestSellers() — count comparison only
  //    (order can legitimately differ by a hair on tie-breaks; count
  //    mismatches are the real signal).
  const staticDeals = fromStatic.getFeaturedDeals();
  const catalogDeals = await fromCatalog.getFeaturedDeals();
  report(
    "getFeaturedDeals() count",
    staticDeals.length === catalogDeals.length,
    `static=${staticDeals.length} catalog=${catalogDeals.length}`
  );
  const staticBest = fromStatic.getRecentlyAdded();
  const catalogBest = await fromCatalog.getRecentlyAdded();
  report(
    "getRecentlyAdded() count",
    staticBest.length === catalogBest.length,
    `static=${staticBest.length} catalog=${catalogBest.length}`
  );

  // 6. getPopulatedCategoryPaths() / getProductsByCategoryPath() — the two
  //    functions flagged in lib/catalog.ts's file header as recomputing
  //    the full taxonomy at read time. Spot-check one known-populated path.
  const staticPaths = fromStatic.getPopulatedCategoryPaths();
  const catalogPaths = await fromCatalog.getPopulatedCategoryPaths();
  report(
    "getPopulatedCategoryPaths() count",
    staticPaths.length === catalogPaths.length,
    `static=${staticPaths.length} catalog=${catalogPaths.length}`
  );
  if (staticPaths[0]) {
    const [catSlug, ptgSlug, typeSlug] = staticPaths[0].path;
    const staticResult = fromStatic.getProductsByCategoryPath(
      staticPaths[0].deptSlug,
      catSlug,
      ptgSlug,
      typeSlug
    );
    const catalogResult = await fromCatalog.getProductsByCategoryPath(
      staticPaths[0].deptSlug,
      catSlug,
      ptgSlug,
      typeSlug
    );
    report(
      `getProductsByCategoryPath() sample path (${staticPaths[0].deptSlug}/${catSlug}/${ptgSlug}/${typeSlug})`,
      staticResult?.products.length === catalogResult?.products.length,
      `static=${staticResult?.products.length ?? "undefined"} catalog=${catalogResult?.products.length ?? "undefined"}`
    );
  }

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script crashed:", err);
  process.exit(1);
});
