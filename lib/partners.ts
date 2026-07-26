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
 *
 * COMPLIANCE GATE — hard requirement, enforced here regardless of how a
 * partner got wired into the array below: no partner's products are ever
 * returned by getAllRealProducts()/getPartner()/etc. unless
 * lib/partner-compliance.ts's isPartnerLive() says that partner has
 * passed terms review (an entry exists, status is "active", and the
 * comparison-engine eligibility is explicitly confirmed). A partner
 * failing that check is filtered out entirely at module load, below —
 * this is the render-time backstop for the same gate
 * scripts/import-partner.mjs enforces at import time, so a bad status
 * value or a hand-added PARTNERS entry can't bypass it. Per-partner image
 * restrictions (imageUsagePermission: "pending") and per-SKU
 * Best-Sellers/Deals restrictions (excludedProducts: true) are enforced
 * the same way, more narrowly — see normalizeProduct and
 * getFeaturedDeals/getBestSellers below.
 */

import { getParentCategory } from "./category-map";
import {
  IMAGE_PENDING_PLACEHOLDER,
  canShowRealImages,
  isPartnerLive,
  requiresPerSkuFeatureCheck,
} from "./partner-compliance";

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
 * needs a partner-specific variant — see the file-level comment.
 *
 * Compliance image gate lives here: when canShowRealImages(partnerId) is
 * false (imageUsagePermission: "pending" in lib/partner-compliance.json —
 * currently Brooklyn Delhi, awaiting written confirmation), every real
 * photo is swapped for IMAGE_PENDING_PLACEHOLDER instead of the vendor's
 * actual product image. This runs for every product from that partner
 * with no per-product opt-out — the restriction is per-partner, not
 * per-SKU, so there's no data field that could accidentally let one
 * product's real photo through while the rest are gated. */
function normalizeProduct(
  product: RawPartnerProduct,
  partnerId: string,
  partnerName: string
): RealProduct {
  const imagesAllowed = canShowRealImages(partnerId);
  return {
    id: `${partnerId}:${product.slug}`,
    slug: product.slug,
    partnerId,
    partnerName,
    name: product.name,
    description: product.description,
    price: product.price,
    originalPrice: product.originalPrice,
    image: imagesAllowed ? product.image : IMAGE_PENDING_PLACEHOLDER,
    images: imagesAllowed
      ? product.images
      : [IMAGE_PENDING_PLACEHOLDER],
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
 * Every partner wired into the codebase — NOT the same as "every partner
 * that displays," see PARTNERS below. scripts/import-partner.mjs appends
 * new entries at PARTNER_REGISTRY_MARKER — every section that reads from
 * getAllRealProducts()/getRealCategories() picks a new entry up
 * automatically, no other file needs to change.
 */
const ALL_WIRED_PARTNERS: Partner[] = [
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

/**
 * Every partner that actually displays on the live site — ALL_WIRED_PARTNERS
 * filtered through the compliance gate (lib/partner-compliance.ts's
 * isPartnerLive). A partner can be present in the codebase (data file
 * written, wired into ALL_WIRED_PARTNERS above) and still never appear
 * here — e.g. its compliance status was changed back from "active", or it
 * was wired in by hand without going through scripts/import-partner.mjs's
 * own gate. This is the one list every homepage section, partner page,
 * category page, and search query actually reads from
 * (getAllRealProducts/getPartner/etc. below all derive from PARTNERS, not
 * ALL_WIRED_PARTNERS) — so a compliance failure here means the partner is
 * invisible everywhere on the site, not just skipped in one section.
 */
export const PARTNERS: Partner[] = ALL_WIRED_PARTNERS.filter((partner) => {
  const live = isPartnerLive(partner.id);
  if (!live && process.env.NODE_ENV !== "production") {
    // Intentional build/dev-time visibility into why a wired-in partner
    // isn't showing; not a runtime error, so this shouldn't throw and
    // break the build.
    console.warn(
      `[compliance] "${partner.id}" is wired into lib/partners.ts but is not "active" and comparison-engine-confirmed in lib/partner-compliance.json — its ${partner.products.length} product(s) will not display anywhere on the site.`
    );
  }
  return live;
});

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
 * fabricated fallback) when nothing is actually on sale.
 *
 * Compliance gate: excludes every product from a partner whose
 * excludedProducts flag is set in lib/partner-compliance.json (some SKUs
 * are excluded from commission and must be verified per-SKU before
 * featuring — RealProduct doesn't model a per-SKU override yet, so until
 * it does, the conservative behavior is to leave that partner's products
 * out of curated placements like Deals entirely rather than risk
 * featuring an excluded SKU). Its products still appear on its own
 * partner page and in search — this only gates the curated sections. */
export function getFeaturedDeals(): RealProduct[] {
  return getAllRealProducts()
    .filter((p) => !requiresPerSkuFeatureCheck(p.partnerId))
    .filter((p) => typeof p.originalPrice === "number" && p.originalPrice > p.price)
    .sort((a, b) => {
      const pctA = a.originalPrice ? (a.originalPrice - a.price) / a.originalPrice : 0;
      const pctB = b.originalPrice ? (b.originalPrice - b.price) / b.originalPrice : 0;
      return pctB - pctA;
    });
}

/** "Best sellers" — real products carrying a "Best Seller" badge from the
 * source data, falling back to the highest-rated products if no partner
 * has tagged any yet, so the section never shows an arbitrary slice.
 *
 * Same per-SKU compliance gate as getFeaturedDeals above — a partner
 * flagged excludedProducts is left out of Best Sellers entirely until its
 * products get a real per-SKU commission-exclusion check. */
export function getBestSellers(partnerIds?: string[]): RealProduct[] {
  const pool = (
    partnerIds
      ? getAllRealProducts().filter((p) => partnerIds.includes(p.partnerId))
      : getAllRealProducts()
  ).filter((p) => !requiresPerSkuFeatureCheck(p.partnerId));

  const badged = pool.filter((p) => p.badge === "Best Seller");
  if (badged.length > 0) return badged;

  return [...pool]
    .filter((p) => p.rating)
    .sort((a, b) => (b.rating?.stars ?? 0) - (a.rating?.stars ?? 0))
    .slice(0, 8);
}
