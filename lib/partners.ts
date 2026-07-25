/**
 * Registry of real, live retail partners on Price Finder — as opposed to
 * lib/data.ts's sanitized mock catalog (fake "Store 1"–"Store 5" listings
 * with "Price TBA" everywhere, kept around only for the legacy
 * /trending, /deals, and /products demo pages).
 *
 * Everything real on the homepage (Featured Deals, Best Sellers, Popular
 * Categories, Our Partners, search) is driven from this file, which is
 * intentionally the single place a new partner gets wired in: add the
 * partner's product data file, add one entry to PARTNERS below, and
 * every section that reads from getAllRealProducts()/getRealCategories()
 * picks it up automatically — no other file needs to change.
 */

import {
  BROOKLYN_DELHI_PRODUCTS,
  type BrooklynDelhiProduct,
} from "./brooklyn-delhi-data";

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
  category: string;
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

function normalizeBrooklynDelhi(product: BrooklynDelhiProduct): RealProduct {
  return {
    id: `brooklyn-delhi:${product.slug}`,
    slug: product.slug,
    partnerId: "brooklyn-delhi",
    partnerName: "Brooklyn Delhi",
    name: product.name,
    description: product.description,
    price: product.price,
    originalPrice: product.originalPrice,
    image: product.image,
    images: product.images,
    category: product.category,
    badge: product.badge,
    rating: product.rating,
    deepLink: product.deepLink,
    href: `/brooklyn-delhi/${product.slug}`,
  };
}

const BROOKLYN_DELHI_REAL_PRODUCTS = BROOKLYN_DELHI_PRODUCTS.map(
  normalizeBrooklynDelhi
);

/**
 * Every real, active partner. Add a new entry here (and its own
 * `normalize*` mapper above) to onboard another partner — every section
 * that reads from this file auto-populates.
 */
export const PARTNERS: Partner[] = [
  {
    id: "brooklyn-delhi",
    name: "Brooklyn Delhi",
    tagline: "Indian-inspired condiments, cookbooks & merch",
    href: "/brooklyn-delhi",
    products: BROOKLYN_DELHI_REAL_PRODUCTS,
  },
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

/** Only categories that currently have at least one real product —
 * auto-shrinks/grows as partners and their catalogs change. Each
 * category's tile image is its first product's real photo, not a
 * placeholder. */
export function getRealCategories(): RealCategory[] {
  const products = getAllRealProducts();
  const byCategory = new Map<string, RealProduct[]>();
  for (const product of products) {
    const list = byCategory.get(product.category) ?? [];
    list.push(product);
    byCategory.set(product.category, list);
  }
  return Array.from(byCategory.entries()).map(([name, items]) => ({
    slug: slugifyRealCategory(name),
    name,
    image: items[0].image,
    itemCount: items.length,
  }));
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

/** Simple case-insensitive substring search across name, description, and
 * category — real, functioning search over the real product catalog
 * (as opposed to the mock catalog's non-functional search bar). */
export function searchRealProducts(query: string): RealProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return getAllRealProducts().filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.partnerName.toLowerCase().includes(q)
  );
}
