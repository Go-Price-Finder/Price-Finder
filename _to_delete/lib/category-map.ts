/**
 * Parent-category classifier. Reads config/category-rules.json — the same
 * file scripts/import-partner.mjs reads — so a product's parent category
 * is always identical whether it was just computed live on the site or
 * computed during import. Do not hardcode category logic anywhere else;
 * edit config/category-rules.json instead.
 *
 * Why this exists: before this, the site had 22 raw subcategories (Food,
 * Cook Book, Clothing, Bag, Fridge Accessories, six EVDANCE ones, eleven
 * Golden Maple ones) each becoming its own Popular Categories tile — with
 * only 3 partners, that's a wall of near-empty tiles instead of a small
 * number of categories a shopper could actually browse. Parent categories
 * group raw subcategories into ~5 broad, browsable buckets automatically,
 * by keyword, with no per-partner or per-product manual assignment.
 * Product cards and partner pages still show the specific raw subcategory
 * (e.g. "Brushes") — only category tiles, /category pages, and Popular
 * Categories use the parent.
 */

import categoryRules from "@/config/category-rules.json";

export type CategoryRule = {
  slug: string;
  name: string;
  keywords: string[];
};

const PARENT_RULES = categoryRules.parents as CategoryRule[];
const FALLBACK = categoryRules.fallback as { slug: string; name: string };

/** Every parent category defined in the taxonomy, in priority order —
 * exposed for anything that wants the full list rather than deriving it
 * from live product data (e.g. an admin/preview tool). */
export const PARENT_CATEGORIES: CategoryRule[] = PARENT_RULES;

/**
 * Classify a raw subcategory string (as it appears in a partner's own
 * data — "Extension Cords & Cables", "Drawing & Painting Kits", etc.)
 * into its parent category. First rule whose keyword list contains a
 * case-insensitive substring match on the raw category wins; a raw
 * category that matches nothing falls through to the fallback parent
 * ("General Merchandise") rather than being dropped or throwing — every
 * product always ends up with a parent category.
 */
export function getParentCategory(rawCategory: string): {
  slug: string;
  name: string;
} {
  const haystack = rawCategory.toLowerCase();
  for (const rule of PARENT_RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return { slug: rule.slug, name: rule.name };
    }
  }
  return FALLBACK;
}
