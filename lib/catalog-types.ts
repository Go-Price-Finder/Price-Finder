/**
 * Shared catalog types — the neutral home for the shapes both
 * lib/partners.ts (static) and lib/catalog.ts (Supabase-backed) speak.
 *
 * Extracted during Step 14 because lib/catalog.ts imported these FROM
 * lib/partners.ts, meaning the replacement module depended on the module
 * it replaces — which made deleting lib/partners.ts impossible. This file
 * has no runtime imports and no side effects, so importing it from a
 * client component is safe (unlike lib/partners.ts, which pulls ~1.47MB
 * of static data files; see the 2026-08-01 homepage LCP regression).
 */

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
  /** Walmart-taxonomy department (e.g. "Toys & Games") auto-derived via
   * lib/category-mapper.ts — this is what /category pages group by, so a
   * handful of partners with a dozen-plus raw subcategories between them
   * still produce a small, useful set of category pages instead of one
   * page per subcategory. Department, not the mapper's full 4-level
   * depth, per the Stage 3 recommendation: most populated categories are
   * 1:1 with their department anyway, and going deeper would mean several
   * single-digit-product pages. */
  parentCategory: string;
  badge?: string;
  rating?: { stars: number; count: number };
  deepLink: string;
  /** Path to this product's own detail page on Price Finder. */
  href: string;
  /** See RawPartnerProduct.variantLabel in lib/partners.ts. */
  variantLabel?: string;
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

export type RealCategory = {
  slug: string;
  name: string;
  image: string;
  itemCount: number;
};

export type CategoryPathResult = {
  department: string;
  category: string;
  productTypeGroup: string;
  productType: string;
  products: RealProduct[];
};
