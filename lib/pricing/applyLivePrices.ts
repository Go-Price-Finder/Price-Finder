import type { RealProduct } from "@/lib/catalog-types";
import { fetchCurrentPriceOverrides } from "@/lib/pricing/getEffectivePrice";

/**
 * LIVE-PRICE MERGE — BUILT, FLAGGED OFF, NOT SHIPPED (findings §54).
 *
 * Operator ruling 2026-08-21: build it behind a flag, do not ship it,
 * and bring the exact per-source label wording for approval before
 * anything renders to a visitor.
 *
 * WHY THE FLAG IS OFF, AND THE REASON IS NOW SPECIFIC RATHER THAN
 * CAUTIOUS (operator ruling 2026-08-21, §55): the label is ONE sentence
 * for both sources — "Price as of {date}" — where the date is always the
 * FEED VINTAGE behind that price. We cannot yet name that date for a
 * live price, because current_prices carries no vintage column. So the
 * flag stays off for a stated reason: WE CANNOT SAY WHAT DATE THE LIVE
 * PRICE IS AS OF. Not because the wording is unsettled — it is settled —
 * and not because of caching.
 *
 * updated_at is NOT a substitute. It records when we read the feed. A
 * price read on the 20th from a feed exported on the 14th is a
 * 14th-of-August price; stamping it "20 August" would overstate
 * freshness by six days — the catalog overstatement inverted.
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
      return { ...product, priceSource: "catalog" as const, priceFeedVintage: null };
    }
    return {
      ...product,
      price: override.price,
      priceSource: "live" as const,
      // The MERCHANT'S feed export timestamp (migration 0023, §56), not
      // updated_at — that is when WE read the feed, and a price read on
      // the 20th from a feed exported on the 14th is a 14th-of-August
      // price. NULL here renders no stamp rather than a wrong date.
      priceFeedVintage: override.feed_last_imported_at,
    };
  });
}
