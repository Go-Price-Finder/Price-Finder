/**
 * Registry of real, live retail partners on Price Finder — as opposed to
 * lib/data.ts's sanitized mock catalog (fake "Store 1"–"Store 5" listings
 * with "Price TBA" everywhere, kept around only for the legacy
 * /trending, /deals, and /products demo pages).
 *
 * Everything real on the homepage (Featured Deals, Best Sellers, Popular
 * Categories, Our Partners, search) is driven from this file.
 *
 * Onboarding a new partner is meant to be scriptable, not a hand-edit:
 * run `node scripts/import-partner.mjs` (see that file's header comment)
 * and it does every step below for you —
 *   1. generates lib/<partner-id>-data.ts from the source CSV
 *   2. inserts the import statement at PARTNER_IMPORTS_MARKER below
 *   3. inserts the PARTNERS array entry at PARTNER_REGISTRY_MARKER below
 * Every partner's data file shares one shape (see `RawPartnerProduct`
 * below), so a single generic `normalizeProduct` handles all of them —
 * there is deliberately no per-partner normalizer function to remember to
 * add or forget (that gap — a partner's data file existing but never
 * being wired into PARTNERS — is exactly what caused EVDANCE and Golden
 * Maple to silently show 0 products on the live site after their first
 * import; see the 2026-07-25 history note in the project's build-notes
 * doc). If you're editing this file by hand instead of via the script,
 * only ever add new lines at the two markers below — everything else
 * should stay generic.
 */

import { getParentCategory } from "./category-map";

import {
  BROOKLYN_DELHI_PRODUCTS,
  type BrooklynDelhiProduct,
} from "./brooklyn-delhi-data";
import { EVDANCE_PRODUCTS, type EvdanceProduct } from "./evdance-data";
import {
  GOLDEN_MAPLE_PRODUCTS,
  type GoldenMapleProduct,
} from "./golden-maple-data";
// PARTNER_IMPORTS_MARKER — scripts/import-partner.mjs inserts new
// `import { X_PRODUCTS, type XProduct } from "./x-data";` lines directly
// above this comment. Don't remove the comment itself.

/** The shape every partner's raw per-product data file already uses
 * (see lib/brooklyn-delhi-data.ts, lib/evdance-data.ts,
 * lib/golden-maple-data.ts) — every field here except `category` is
 * passed through as-is by normalizeProduct below. Partner-specific
 * `*Product` types (e.g. `EvdanceProduct`) are structurally identical to
 * this and just narrow `category` to that partner's own string union;
 * TypeScript's structural typing lets normalizeProduct accept any of them
 * without a cast. */
type RawPartnerProduct = {
  slug: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  deepLink: string;
  image: string;
  images: string[];
  category: string;
  badge?: string;
  rating?: { stars: number; count: number };
};

/** The shape every partner's products get normalized to, so homepage
 * sections and search can treat every real retailer identically instead
 * of special-casing each one's original data shape. */
export type RealProduct = {
  /** Globally unique across all partners: `${partnerId}:${slug}`. */
  id: string;
  slug: string;
  partnerId: string;
  partnerName: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  /** Specific subcategory as the partner's own data names it (e.g.
   * "Brushes", "Extension Cords & Cables") — shown on product cards and
   * partner pages. */
  category: string;
  /** Broad, browsable parent category (e.g. "Art & Craft Supplies")
   * auto-derived from `category` via lib/category-map.ts — this is what
   * Popular Categories tiles and /category pages group by, so a handful
   * of partners with a dozen-plus subcategories between them still
   * produce a small, useful set of category tiles instead of one tile
   * per subcategory. */
  parentCategory: string;
  badge?: string;
  rating?: { stars: number; count: number };
  deepLink: string;
  /** Path to this product's own detail page on Price Finder. */
  href: string;
};

export type Partner = {
  id: string;
  name: string;
  tagline: string;
  /** No real logo asset exists for this partner yet — cards render a
   * wordmark instead of an <img>. Swap in a real `logo` image path here
   * once one is supplied. */
  logo?: string;
  href: string;
  products: RealProduct[];
};

/** The one normalizer every partner's products go through. Partner data
 * files intentionally all share `RawPartnerProduct`'s shape so this never
 * needs a partner-specific variant — see the file-level comment. */
function normalizeProduct(
  product: RawPartnerProduct,
  partnerId: string,
  partnerName: string
): RealProduct {
  return {
    id: `${partnerId}:${product.slug}`,
    slug: product.slug,
    partnerId,
    partnerName,
    name: product.name,
    description: product.description,
    price: product.price,
    originalPrice: product.originalPrice,
    image: product.image,
    images: product.images,
    category: product.category,
    parentCategory: getParentCategory(product.category).name,
    badge: product.badge,
    rating: product.rating,
    deepLink: product.deepLink,
    href: `/${partnerId}/${product.slug}`,
  };
}

const BROOKLYN_DELHI_REAL_PRODUCTS = BROOKLYN_DELHI_PRODUCTS.map(
  (p: BrooklynDelhiProduct) => normalizeProduct(p, "brooklyn-delhi", "Brooklyn Delhi")
);
const EVDANCE_REAL_PRODUCTS = EVDANCE_PRODUCTS.map((p: EvdanceProduct) =>
  normalizeProduct(p, "evdance", "EVDANCE")
);
const GOLDEN_MAPLE_REAL_PRODUCTS = GOLDEN_MAPLE_PRODUCTS.map(
  (p: GoldenMapleProduct) => normalizeProduct(p, "golden-maple", "Golden Maple")
);

/**
 * Every real, active partner. scripts/import-partner.mjs appends new
 * entries at PARTNER_REGISTRY_MARKER below — every section that reads
 * from getAllRealProducts()/getRealCategories() picks a new entry up
 * automatically, no other file needs to change.
 */
export const PARTNERS: Partner[] = [
  {
    id: "brooklyn-delhi",
    name: "Brooklyn Delhi",
    tagline: "Indian-inspired condiments, cookbooks & merch",
    href: "/brooklyn-delhi",
    products: BROOKLYN_DELHI_REAL_PRODUCTS,
  },
  {
    id: "evdance",
    name: "EVDANCE",
    tagline: "EV charging cables, adapters & portable chargers",
    href: "/evdance",
    products: EVDANCE_REAL_PRODUCTS,
  },
  {
    id: "golden-maple",
    name: "Golden Maple",
    tagline: "Artist brushes, model-making & miniature painting supplies",
    href: "/golden-maple",
    products: GOLDEN_MAPLE_REAL_PRODUCTS,
  },
  // PARTNER_REGISTRY_MARKER — scripts/import-partner.mjs inserts new
  // `{ id, name, tagline, href, products }` entries directly above this
  // comment. Don't remove the comment itself.
];

export function getAllRealProducts(): RealProduct[] {
  return PARTNERS.flatMap((partner) => partner.products);
}

export function getPartner(id: string): Partner | undefined {
  return PARTNERS.find((partner) => partner.id === id);
}

export function getRealProduct(
  partnerId: string,
  slug: string
): RealProduct | undefined {
  return getPartner(partnerId)?.products.find((p) => p.slug === slug);
}

export type RealCategory = {
  slug: string;
  name: string;
  image: string;
  itemCount: number;
};

export function slugifyRealCategory(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Parent categories that currently have at least one real product —
 * auto-shrinks/grows as partners and their catalogs change. Grouped by
 * `parentCategory` (see lib/category-map.ts), not the specific `category`
 * subcategory, so a handful of partners with a dozen-plus subcategories
 * between them still produce a small, browsable set of tiles instead of
 * one tile per subcategory. Each category's tile image is its first
 * product's real photo, not a placeholder. */
export function getRealCategories(): RealCategory[] {
  const products = getAllRealProducts();
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

/** A single parent category by its slug, plus only the real products in
 * it — used by the dedicated per-category page so clicking "Art & Craft
 * Supplies" on Popular Categories shows every product from every partner
 * in that parent category, not just one partner's or one subcategory's. */
export function getCategoryBySlug(
  slug: string
): (RealCategory & { products: RealProduct[] }) | undefined {
  const category = getRealCategories().find((c) => c.slug === slug);
  if (!category) return undefined;
  return {
    ...category,
    products: getAllRealProducts().filter(
      (p) => p.parentCategory === category.name
    ),
  };
}

/** Real markdowns only — a product counts as a deal when it has a real
 * originalPrice greater than its current price. Empty array (not a
 * fabricated fallback) when nothing is actually on sale. */
export function getFeaturedDeals(): RealProduct[] {
  return getAllRealProducts()
    .filter((p) => typeof p.originalPrice === "number" && p.originalPrice > p.price)
    .sort((a, b) => {
      const pctA = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
      const pctB = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
      return pctB - pctA;
    });
}

/** "Best sellers" — real products carrying a "Best Seller" badge from the
 * source data, falling back to the highest-rated products if no partner
 * has tagged any yet, so the section never shows an arbitrary slice. */
export function getBestSellers(partnerIds?: string[]): RealProduct[] {
  const pool = partnerIds
    ? getAllRealProducts().filter((p) => partnerIds.includes(p.partnerId))
    : getAllRealProducts();

  const badged = pool.filter((p) => p.badge === "Best Seller");
  if (badged.length > 0) return badged;

  return [...pool]
    .filter((p) => p.rating)
    .sort((a, b) => (b.rating?.stars ?? 0) - (a.rating?.stars ?? 0))
    .slice(0, 8);
}
