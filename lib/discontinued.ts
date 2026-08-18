/**
 * Products confirmed GONE at the retailer (merchant-site 404, verified
 * directly against the merchant — never via the AWIN tracking link —
 * 2026-08-19, findings doc §9x) whose pages deliberately stay live and
 * indexed. The dead outbound click is the harm; the page is not: the
 * product page's own content still answers the searcher, but sending
 * them to a retailer 404 is the trust failure a price-comparison site
 * can least afford (operator decision 2026-08-19).
 *
 * Deliberately a two-entry hand list, NOT a feature. The generalized
 * discontinued-product flow (feed-drop detection → availability check →
 * automatic CTA/schema downgrade) is the pattern to build AFTER the
 * Step 14 cutover, when feed churn across the full approved inventory
 * makes it routine — do not grow this list past a handful; build the
 * real thing instead.
 */
const DISCONTINUED_AT_RETAILER = new Set<string>([
  "golden-maple:face-skin-tones-acrylic-paint-set-10-x-20ml-non-toxic-water-based-for-miniature-figure-painting-limited",
  "evdance:evdance-u40-level-2-ev-charger-nema-14-50-j1772-wall-mounted-40a-etl-certification",
]);

export function isDiscontinuedAtRetailer(productId: string): boolean {
  return DISCONTINUED_AT_RETAILER.has(productId);
}
