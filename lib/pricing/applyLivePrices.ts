import type { RealProduct } from "@/lib/catalog-types";
import { fetchCurrentPriceOverrides } from "@/lib/pricing/getEffectivePrice";

/**
 * LIVE-PRICE MERGE — BUILT, FLAGGED OFF, NOT SHIPPED (findings §54).
 *
 * Operator ruling 2026-08-21: build it behind a flag, do not ship it,
 * and bring the exact per-source label wording for approval before
 * anything renders to a visitor.
 *
 * WHY THE FLAG DEFAULTS OFF AND MUST STAY OFF UNTIL THE LABEL IS RULED
 * ON: every product page carries "Price as of <feed vintage>". That is
 * true of a catalog price and FALSE of a live-override price, whose real
 * observation time is current_prices.updated_at. Enabling this without a
 * source-aware label would convert a working honesty mechanism into a
 * false claim on ~89% of the catalogue — the §27 defect at the largest
 * scale available to us. The price and the label are ONE change.
 *
 * WHERE THIS RUNS: called from fetchCatalog(), the UNCACHED wrapper —
 * deliberately outside `unstable_cache(..., { revalidate: false })`.
 * Merging inside the cached function would freeze live prices at cache
 * fill, which is the opposite of live.
 *
 * WHAT IT STILL DOES NOT SOLVE, stated so nobody assumes otherwise:
 * partner and product pages are statically generated (SSG via
 * generateStaticParams). A price merged at build time is frozen in the
 * emitted HTML until the next build. Ungating alone therefore buys
 * build-frequency freshness, not live freshness — ISR (`revalidate`) or
 * a dynamic segment is a separate decision on top of this one.
 *
 * COST WHEN ENABLED: one extra Supabase round trip per fetchCatalog()
 * call. fetchCatalog is called by every accessor and runs concurrently
 * at build time, so this is not free; scripts/check-build-queries.mjs
 * should be re-run and its threshold revisited as part of enabling.
 */
export const LIVE_PRICES_ENABLED = process.env.LIVE_PRICES === "1";

export async function applyLivePrices(
  products: RealProduct[]
): Promise<RealProduct[]> {
  if (!LIVE_PRICES_ENABLED) return products;

  const overrides = await fetchCurrentPriceOverrides();
  return products.map((product) => {
    const override = overrides.get(product.id);
    if (!override) {
      return { ...product, priceSource: "catalog" as const, priceObservedAt: null };
    }
    return {
      ...product,
      price: override.price,
      priceSource: "live" as const,
      priceObservedAt: override.updated_at,
    };
  });
}
