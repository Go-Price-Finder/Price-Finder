/**
 * Standalone price formatter — deliberately NOT re-exported from
 * lib/data.ts's formatPrice. lib/data.ts imports getPartner from
 * lib/partners.ts, which statically imports all 6 partner data files
 * (~1.5MB, the same catalog module the 2026-08-01 LCP investigation
 * flagged and deferred behind dynamic import() in SearchBar.tsx). Any
 * client component that imports formatPrice from lib/data.ts drags that
 * entire catalog into its chunk even though it never touches the catalog
 * itself — confirmed 2026-08-03 via a from-scratch build showing product
 * page routes' First Load JS jump from 119kB to 260kB after
 * PriceHistoryChart.tsx/PriceAlertCTA.tsx imported formatPrice from
 * lib/data.ts (chunk 5647-*.js, the deferred search/Fuse.js/catalog
 * chunk, showed up in those routes' manifests as a result).
 *
 * Keep this file free of any import from lib/data.ts or lib/partners.ts.
 */
const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatPrice(value: number) {
  return PRICE_FORMATTER.format(value);
}
