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
 * path fixed in the homepage LCP investigation) but has no cross-request
 * cache — lib/partners.ts's version is cheap to memoize because it's a
 * module-level singleton computed once per process; this module has no
 * equivalent yet because Step 13 (rendering strategy) hasn't decided how
 * reads are cached. Do not treat this module as done for those two
 * functions until Step 13 picks a caching approach (e.g. `React.cache()`
 * or `unstable_cache`) and it's applied here.
 */

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
async function fetchCatalog(): Promise<{
  products: RealProduct[];
  partnersById: Map<string, PartnerMeta>;
}> {
  const supabase = createPublicClient();
  const [productsRes, partnersRes] = await Promise.all([
    supabase
      .from("catalog_products")
      .select(
        "id, partner_id, slug, name, description, price, original_price, image, images, category, parent_category, badge, rating_stars, rating_count, deep_link, variant_label"
      ),
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

  const products = (productsRes.data ?? []).map((row) =>
    toRealProduct(row, partnersById.get(row.partner_id)?.name ?? row.partner_id)
  );

  return { products, partnersById };
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

export async function getRealProduct(
  partnerId: string,
  slug: string
): Promise<RealProduct | undefined> {
  // A single filtered query, not getPartner()+find() — this is the
  // highest-traffic read (every product detail page) and the one most
  // worth not paying for a full-catalog fetch just to find one row.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("catalog_products")
    .select(
      "id, partner_id, slug, name, description, price, original_price, image, images, category, parent_category, badge, rating_stars, rating_count, deep_link, variant_label"
    )
    .eq("partner_id", partnerId)
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) return undefined;

  const { data: partnerRow, error: partnerError } = await supabase
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .maybeSingle();
  if (partnerError) throw partnerError;

  return toRealProduct(data, partnerRow?.name ?? partnerId);
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

// See the file-level comment's "Known gap" note — this recomputes the
// full 4-level taxonomy per call, same computation lib/partners.ts does
// once at module load. Correct; not yet cached across requests.
async function mapAllCatalogProductsToCategory(): Promise<
  { product: RealProduct; mapping: CategoryMapping }[]
> {
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
