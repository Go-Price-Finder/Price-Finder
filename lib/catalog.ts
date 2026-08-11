/**
 * Supabase-backed replacement for lib/partners.ts — Step 12 of the
 * catalog/search/onboarding migration
 * (claude/catalog-search-onboarding-migration-scope-2026-08-03.md,
 * Section 3). Same 9 function names/return shapes as lib/partners.ts,
 * now async and backed by public.catalog_products/public.partners
 * (migration 0008) instead of the six static lib/<partner>-data.ts files.
 *
 * Per that doc's Step 2: nothing in the app imports this module yet — no
 * call sites are touched here. This is deliberately additive so it can be
 * verified (tsc/eslint clean, manual queries compared against
 * lib/partners.ts's live output for the same inputs) before Step 14 cuts
 * any of the ~30 real call sites over.
 *
 * Compliance note: catalog_products only ever contains rows the backfill
 * script wrote from lib/partners.ts's already-compliance-filtered
 * `PARTNERS` export (scripts/backfill-catalog-products.ts reads
 * `PARTNERS`, not `ALL_WIRED_PARTNERS`) — so the hard "is this partner
 * live at all" gate, and the per-partner image-pending placeholder swap,
 * are already baked into every row at write time. This module does not
 * re-check isPartnerLive()/canShowRealImages() — that would be re-deriving
 * something already true of the data, not a real check. The one
 * compliance concern NOT baked into the data is the per-SKU curated-
 * placement gate (excludedProducts in lib/partner-compliance.json), which
 * lib/partners.ts applies at read time in getFeaturedDeals/getBestSellers
 * — reproduced the same way here, for the same reason.
 *
 * Known gap, not solved here (flagging per the migration scope doc's own
 * Section 5 risk list, "Compliance gate has no DB representation" — this
 * is the analogous gap for the taxonomy): catalog_products only stores
 * `parent_category` (the department level). getPopulatedCategoryPaths and
 * getProductsByCategoryPath need the full 4-level taxonomy
 * (department/category/productTypeGroup/productType), which isn't a
 * stored column — see mapAllCatalogProductsToCategory below, which
 * recomputes it from each row via lib/category-mapper.ts, same as
 * lib/partners.ts's mapAllRealProductsToCategory does today. That's
 * functionally correct (same inputs, same already-memoized matchScore()
 * path fixed in the homepage LCP investigation). As of Step 14 Task 3 it
 * is also memoized per process, mirroring lib/partners.ts's
 * mappedProductsCache — see mapAllCatalogProductsToCategory below. That
 * covers a whole build (one process per worker); caching of the underlying
 * fetch across worker processes is a separate concern, handled by the
 * `unstable_cache` wrapper added in Step 14 Task 4 — see
 * fetchCatalogCached below.
 */

import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public";
import { mapProductToCategory, type CategoryMapping } from "./category-mapper";
import { requiresPerSkuFeatureCheck } from "./partner-compliance";
import type {
  RealProduct,
  Partner,
  RealCategory,
  CategoryPathResult,
} from "./catalog-types";

// Deliberately NOT `import { slugifyRealCategory } from "./partners"` —
// even a single named value import from lib/partners.ts executes that
// module's top-level imports, which unconditionally pull in all six
// lib/<partner>-data.ts files (~1.47MB). That exact mistake (a client
// component importing from lib/partners.ts just to read two numbers) is
// what caused the homepage LCP regression fixed on 2026-08-01 — the whole
// point of this migration is to stop needing that module at all. The
// function itself is two lines of pure string logic; duplicating it here
// is cheaper and safer than importing it.
export function slugifyRealCategory(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type PartnerMeta = {
  name: string;
  tagline: string;
  href: string;
  logo?: string;
  displayOrder: number;
};

/**
 * price/original_price/rating_stars are Postgres `numeric` columns —
 * PostgREST returns these as strings over the wire (avoiding
 * float-precision loss for arbitrary-precision decimals), not JS numbers.
 * Every numeric field from catalog_products must go through this before
 * being treated as a number; assuming the wire type already matches
 * RealProduct's `number` fields is exactly the kind of "field is
 * populated" shortcut the post-import verification runbook warns against
 * taking without checking the actual value/type.
 */
function toNumber(value: string | number | null): number | undefined {
  if (value === null) return undefined;
  return typeof value === "number" ? value : Number(value);
}

function toRealProduct(
  row: {
    id: string;
    partner_id: string;
    slug: string;
    name: string;
    description: string;
    price: string;
    original_price: string | null;
    image: string;
    images: string[];
    category: string;
    parent_category: string;
    badge: string | null;
    rating_stars: string | null;
    rating_count: number | null;
    deep_link: string;
    variant_label: string | null;
  },
  partnerName: string
): RealProduct {
  const stars = toNumber(row.rating_stars);
  return {
    id: row.id,
    slug: row.slug,
    partnerId: row.partner_id,
    partnerName,
    name: row.name,
    description: row.description,
    price: toNumber(row.price) ?? 0,
    originalPrice: toNumber(row.original_price),
    image: row.image,
    images: row.images,
    category: row.category,
    parentCategory: row.parent_category,
    badge: row.badge ?? undefined,
    rating:
      stars !== undefined && row.rating_count !== null
        ? { stars, count: row.rating_count }
        : undefined,
    deepLink: row.deep_link,
    href: `/${row.partner_id}/${row.slug}`,
    variantLabel: row.variant_label ?? undefined,
  };
}

/**
 * One Supabase round trip for partners + one for catalog_products, joined
 * in memory. Two queries rather than a single `.select("*, partners(*)")`
 * embed so the partner-metadata shape (and any future caller that only
 * needs partners, e.g. an "Our Partners" section) stays simple to read —
 * revisit if profiling ever shows the extra round trip matters at this
 * table size.
 */
async function fetchCatalogRaw(): Promise<{
  products: RealProduct[];
  partnerEntries: [string, PartnerMeta][];
}> {
  const supabase = createPublicClient();
  const [productsRes, partnersRes] = await Promise.all([
    supabase
      .from("catalog_products")
      .select(
        "id, partner_id, slug, name, description, price, original_price, image, images, category, parent_category, badge, rating_stars, rating_count, deep_link, variant_label"
      )
      // Ordered by (partner_id, sort_order) — migration 0010. Without this the
      // read order is whatever Postgres returns, which had ALREADY diverged
      // from the static arrays for golden-maple, canvas-vows and tsar-bomba
      // (measured 2026-08-09) and was silently changing related-product
      // selection on 476 pages. Anything that does .filter().slice(n) or has a
      // non-total sort comparator inherits this order — getBestSellers'
      // badged path does no sorting at all.
      .order("partner_id")
      .order("sort_order"),
    supabase
      .from("partners")
      .select("id, name, tagline, href, logo_url, display_order")
      .order("display_order"),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (partnersRes.error) throw partnersRes.error;

  const partnersById = new Map<string, PartnerMeta>();
  for (const p of partnersRes.data ?? []) {
    partnersById.set(p.id, {
      name: p.name,
      tagline: p.tagline,
      href: p.href,
      logo: p.logo_url ?? undefined,
      displayOrder: p.display_order,
    });
  }

  // Rows arrive ordered by (partner_id, sort_order) — correct WITHIN each
  // partner, but partner blocks come back alphabetically by id, whereas the
  // static PARTNERS array interleaves them in curated display order. Re-sort
  // the blocks by the partner's display_order (0009). Array.prototype.sort is
  // stable per spec, so intra-partner sort_order (0010) is preserved.
  //
  // This matters because getFeaturedDeals, getBestSellers and every
  // .filter().slice(n) read the flat list: without it, getAllRealProducts()
  // returns the same products in a different sequence than lib/partners.ts.
  //
  // The re-sort lives INSIDE the cached function deliberately: the ordering is
  // then baked into the cached snapshot itself, so no caller can observe an
  // unsorted array and no future refactor of the thin wrapper below can drop
  // it. Do not "simplify" this away to the DB ordering alone — see the
  // 2026-08-11 checkpoint in the Step 14 plan.
  const products = (productsRes.data ?? [])
    .map((row) => toRealProduct(row, partnersById.get(row.partner_id)?.name ?? row.partner_id))
    .sort(
      (a, b) =>
        (partnersById.get(a.partnerId)?.displayOrder ?? 0) -
        (partnersById.get(b.partnerId)?.displayOrder ?? 0)
    );

  return { products, partnerEntries: [...partnersById.entries()] };
}

/**
 * The whole catalog, fetched once and reused for the rest of the build.
 *
 * Measured 2026-08-09 on a 348-page partner: 349 catalog round trips
 * uncached vs **1** with this wrapper. Build time is identical either way
 * (~38.6s) because Next fans page generation across 12 workers — so this is
 * a database-load and snapshot-consistency win, NOT a build-speed win. Do
 * not remove it after benchmarking build times and finding no difference;
 * build speed was never the argument. What it buys is that every page in a
 * build renders from ONE read of the catalog, so a `refresh-prices` cron run
 * landing mid-build cannot ship pre-refresh prices on some pages and
 * post-refresh on others.
 *
 * `"use cache"` was measured and rejected: it caches per worker process, so
 * the same build made 17 round trips across 12 workers instead of 1.
 *
 * `unstable_cache` serializes its return value as JSON, and a `Map` does not
 * survive that — hence the array-of-entries return shape here, with the
 * `Map` rebuilt on the near side of the cache boundary in fetchCatalog().
 *
 * ⚠ The cache key must be bumped ("catalog-v1" -> "catalog-v2", ...) whenever
 * fetchCatalogRaw's RETURN SHAPE changes. A persisted entry written by an
 * older shape is replayed verbatim into the new code under the same key, and
 * the mismatch surfaces as undefined fields at render time rather than as a
 * cache miss.
 *
 * ⚠ Only usable inside a Next.js render/request context. `unstable_cache`
 * throws "Invariant: incrementalCache missing" when called from a plain
 * `tsx`/node script, so standalone scripts that import this module (e.g.
 * scripts/verify-catalog-migration.ts) need an incremental-cache stub
 * installed on `globalThis.__incrementalCache` before importing it.
 */
const fetchCatalogCached = unstable_cache(fetchCatalogRaw, ["catalog-v1"], {
  revalidate: false,
  tags: ["catalog"],
});

/**
 * Thin wrapper that restores the `Map` the rest of this module expects.
 * Deliberately holds no logic beyond the `Map` rebuild — everything that
 * shapes the data (including the load-bearing display-order re-sort) lives
 * inside the cached function so it is captured by the snapshot.
 */
async function fetchCatalog(): Promise<{
  products: RealProduct[];
  partnersById: Map<string, PartnerMeta>;
}> {
  const { products, partnerEntries } = await fetchCatalogCached();
  return { products, partnersById: new Map(partnerEntries) };
}

export async function getAllRealProducts(): Promise<RealProduct[]> {
  const { products } = await fetchCatalog();
  return products;
}

export async function getPartner(id: string): Promise<Partner | undefined> {
  const { products, partnersById } = await fetchCatalog();
  const meta = partnersById.get(id);
  if (!meta) return undefined;
  return {
    id,
    name: meta.name,
    tagline: meta.tagline,
    href: meta.href,
    logo: meta.logo,
    products: products.filter((p) => p.partnerId === id),
  };
}

/**
 * Every live partner, in curated display order — the replacement for
 * lib/partners.ts's `PARTNERS` constant.
 *
 * Ordered by partners.display_order (migration 0009), NOT by id and NOT by
 * whatever order Postgres returns rows in. The static PARTNERS array's order
 * is curated and matches neither: measured 2026-08-09, row order was
 * brooklyn-delhi, tsar-bomba, king-koil, evdance, golden-maple, canvas-vows
 * and alphabetical was brooklyn-delhi, canvas-vows, evdance, golden-maple,
 * king-koil, tsar-bomba — the curated order is neither. Dropping the sort
 * silently reorders "Our Partners" on the homepage and sitemap.xml.
 *
 * The sort is explicit here as well as in fetchCatalog's query, so this does
 * not depend on Map insertion order surviving a future refactor.
 */
export async function getPartners(): Promise<Partner[]> {
  const { products, partnersById } = await fetchCatalog();
  return [...partnersById.entries()]
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      tagline: meta.tagline,
      href: meta.href,
      logo: meta.logo,
      products: products.filter((p) => p.partnerId === id),
    }));
}

/** The per-partner category list that lib/<partner>-data.ts exports as
 * <PARTNER>_CATEGORIES. Those are hand-ordered; catalog_products stores
 * no ordering, so this returns first-appearance order from the catalog.
 * Task 2 Step 6 verifies that matches the curated order per partner —
 * if it ever does not, the landing page's category order changes. */
export async function getPartnerCategories(partnerId: string): Promise<string[]> {
  const { products } = await fetchCatalog();
  const seen: string[] = [];
  for (const p of products) {
    if (p.partnerId === partnerId && !seen.includes(p.category)) seen.push(p.category);
  }
  return seen;
}

/**
 * ⚠ CONDITIONAL ON THE RENDERING STRATEGY — read before changing any product
 * route to ISR or dynamic.
 *
 * This reads the product out of the cached full-catalog snapshot instead of
 * issuing its own query. That is correct ONLY BECAUSE the Step 13 decision
 * (`claude/catalog-search-onboarding-migration-scope-2026-08-03.md`, "Step 3
 * — Rendering strategy") keeps every product route fully static: every call
 * therefore happens at BUILD time, where the whole catalog has already been
 * fetched once into memory by fetchCatalogCached and the lookup is free. It
 * removes 1392 queries per build (2 queries × 2 calls per page — metadata and
 * body — × 348 pages on the largest partner), taking the build from 1394
 * catalog round trips to 2.
 *
 * The previous implementation — a targeted single-row query against
 * catalog_products plus one for the partner name — was NOT a mistake, and it
 * is still the right shape for REQUEST-time rendering. Measured 2026-08-09,
 * per product page:
 *
 *     single-row query        1.6 KB    71 ms
 *     full catalog snapshot   1610 KB   499 ms
 *
 * At request time, pulling the whole catalog to render one product is a 993×
 * payload regression and ~7× on latency. The single-row query only looks
 * wasteful under static rendering, because static generation turns "one small
 * query per request" into "1392 small queries per build" and the snapshot
 * amortises across all of them.
 *
 * THEREFORE: if any product route is ever switched to ISR (`export const
 * revalidate`) or dynamic rendering, the single-row query MUST be restored
 * for that route. This is not hypothetical — three routes are already `ƒ`
 * (Dynamic) today, `/search` among them, which is exactly why the Step 14
 * plan excludes `lib/search.ts` and the two cron paths from migrating to this
 * module at all. Ask "does this route render at request time?" of every call
 * site before pointing it here.
 *
 * (Folding both reads into one snapshot also closes a latent correctness bug:
 * generateMetadata and the page body previously issued independent queries
 * for the same product, so a catalog write landing between them could ship a
 * page whose metadata and body described different versions of it.)
 */
export async function getRealProduct(
  partnerId: string,
  slug: string
): Promise<RealProduct | undefined> {
  const { products } = await fetchCatalog();
  return products.find((p) => p.partnerId === partnerId && p.slug === slug);
}

/**
 * The `<title>` disambiguation suffix for a product detail page — the
 * replacement for lib/partners.ts's synchronous getProductTitleSuffix.
 *
 * Async here, unlike the original: it needs the partner's sibling products
 * to detect duplicate name+price collisions, and this module's getPartner
 * is async. All four call sites are already inside `generateMetadata`, so
 * they only need an added `await`.
 */
export async function getProductTitleSuffix(product: RealProduct): Promise<string> {
  const priceLabel = `$${product.price.toLocaleString()}`;
  const siblings = (await getPartner(product.partnerId))?.products ?? [];
  const colliding = siblings.filter(
    (p) => p.name === product.name && p.price === product.price
  );
  if (colliding.length <= 1) return priceLabel;
  if (product.variantLabel) return `${priceLabel} — ${product.variantLabel}`;
  const index = colliding.findIndex((p) => p.slug === product.slug) + 1;
  return `${priceLabel} — ${index} of ${colliding.length}`;
}

export async function getRealCategories(): Promise<RealCategory[]> {
  const products = await getAllRealProducts();
  const byCategory = new Map<string, RealProduct[]>();
  for (const product of products) {
    const list = byCategory.get(product.parentCategory) ?? [];
    list.push(product);
    byCategory.set(product.parentCategory, list);
  }
  return Array.from(byCategory.entries()).map(([name, items]) => ({
    slug: slugifyRealCategory(name),
    name,
    image: items[0].image,
    itemCount: items.length,
  }));
}

export async function getCategoryBySlug(
  slug: string
): Promise<(RealCategory & { products: RealProduct[] }) | undefined> {
  const [categories, products] = await Promise.all([
    getRealCategories(),
    getAllRealProducts(),
  ]);
  const category = categories.find((c) => c.slug === slug);
  if (!category) return undefined;
  return {
    ...category,
    products: products.filter((p) => p.parentCategory === category.name),
  };
}

// Memoized per process, same as lib/partners.ts's mappedProductsCache.
// mapProductToCategory() scores all 954 products against every taxonomy
// leaf — measured ~960ms, paid on EVERY call to getPopulatedCategoryPaths()
// or getProductsByCategoryPath() before this cache existed. An
// unstable_cache wrapper on fetchCatalog does not cover it: the mapping
// runs after the fetch returns.
//
// The promise is cached, not just the resolved array, because this function
// is async: two callers that enter before the first one finishes would both
// re-check a still-null value-cache and both recompute. The build does
// exactly that — generateStaticParams and the page component run
// concurrently per route. A rejected fetch clears the slot so a transient
// Supabase failure is not memoized for the life of the process.
//
// Safe for the same reason lib/partners.ts's version is: the product data
// is fixed for the lifetime of a process, and a content change requires a
// rebuild. The order it caches over is the curated one (partners.
// display_order from migration 0009, catalog_products.sort_order from 0010,
// plus fetchCatalog's stable JS re-sort), so the frozen sequence is the
// correct sequence, not an arbitrary one.
let mappedCatalogCache:
  | Promise<{ product: RealProduct; mapping: CategoryMapping }[]>
  | null = null;

function mapAllCatalogProductsToCategory(): Promise<
  { product: RealProduct; mapping: CategoryMapping }[]
> {
  if (mappedCatalogCache) return mappedCatalogCache;
  mappedCatalogCache = (async () => {
    const products = await getAllRealProducts();
    return products
      .map((product) => ({
        product,
        mapping: mapProductToCategory({
          title: product.name,
          description: product.description,
          brand: product.partnerName,
          partnerCategory: product.category,
          price: product.price,
          url: product.deepLink,
          partnerId: product.partnerId,
        }),
      }))
      .filter(({ mapping }) => mapping.department !== "Unclassified");
  })();
  mappedCatalogCache.catch(() => {
    mappedCatalogCache = null;
  });
  return mappedCatalogCache;
}

export async function getPopulatedCategoryPaths(): Promise<
  { deptSlug: string; path: [string, string, string] }[]
> {
  const seen = new Map<
    string,
    { deptSlug: string; path: [string, string, string] }
  >();
  for (const { mapping } of await mapAllCatalogProductsToCategory()) {
    const deptSlug = slugifyRealCategory(mapping.department);
    const catSlug = slugifyRealCategory(mapping.category);
    const ptgSlug = slugifyRealCategory(mapping.productTypeGroup);
    const typeSlug = slugifyRealCategory(mapping.productType);
    const key = `${deptSlug}/${catSlug}/${ptgSlug}/${typeSlug}`;
    if (!seen.has(key)) {
      seen.set(key, { deptSlug, path: [catSlug, ptgSlug, typeSlug] });
    }
  }
  return [...seen.values()];
}

export async function getProductsByCategoryPath(
  deptSlug: string,
  catSlug: string,
  ptgSlug: string,
  typeSlug: string
): Promise<CategoryPathResult | undefined> {
  let resolved: Omit<CategoryPathResult, "products"> | undefined;
  const products: RealProduct[] = [];

  for (const { product, mapping } of await mapAllCatalogProductsToCategory()) {
    if (
      slugifyRealCategory(mapping.department) !== deptSlug ||
      slugifyRealCategory(mapping.category) !== catSlug ||
      slugifyRealCategory(mapping.productTypeGroup) !== ptgSlug ||
      slugifyRealCategory(mapping.productType) !== typeSlug
    ) {
      continue;
    }
    resolved ??= {
      department: mapping.department,
      category: mapping.category,
      productTypeGroup: mapping.productTypeGroup,
      productType: mapping.productType,
    };
    products.push(product);
  }

  return resolved ? { ...resolved, products } : undefined;
}

export async function getFeaturedDeals(): Promise<RealProduct[]> {
  const products = await getAllRealProducts();
  return products
    .filter((p) => !requiresPerSkuFeatureCheck(p.partnerId))
    .filter((p) => typeof p.originalPrice === "number" && p.originalPrice > p.price)
    .sort((a, b) => {
      const pctA = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
      const pctB = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
      return pctB - pctA;
    });
}

export async function getBestSellers(
  partnerIds?: string[]
): Promise<RealProduct[]> {
  const all = await getAllRealProducts();
  const pool = (
    partnerIds ? all.filter((p) => partnerIds.includes(p.partnerId)) : all
  ).filter((p) => !requiresPerSkuFeatureCheck(p.partnerId));

  const badged = pool.filter((p) => p.badge === "Best Seller");
  if (badged.length > 0) return badged;

  return [...pool]
    .filter((p) => p.rating)
    .sort((a, b) => (b.rating?.stars ?? 0) - (a.rating?.stars ?? 0))
    .slice(0, 8);
}
