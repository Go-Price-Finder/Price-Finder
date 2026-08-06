/**
 * Step 12 verification helper — compares lib/catalog.ts's (Supabase-backed)
 * output against lib/partners.ts's (static, still-live) output for the
 * same handful of manual queries, per the build guide's Step 12 prompt:
 * "verifies it against a handful of manual test queries compared to the
 * old lib/partners.ts output for the same inputs."
 *
 * Requires real Supabase credentials in the environment
 * (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) — this script
 * does not read or fabricate them; run it wherever .env.local already has
 * them (the local machine, or a session with the Supabase MCP connector
 * enabled and env vars configured). It only reads, never writes.
 *
 * Run with: npx tsx scripts/verify-catalog-migration.ts
 */
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

async function main() {
  console.log("Backfill is documented as ~60% complete as of 2026-08-05 —");
  console.log("this script will legitimately report count MISMATCHES for");
  console.log("any partner not yet fully backfilled. Read failures in that");
  console.log("light, not as an automatic module bug.\n");

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
  const staticBest = fromStatic.getBestSellers();
  const catalogBest = await fromCatalog.getBestSellers();
  report(
    "getBestSellers() count",
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
