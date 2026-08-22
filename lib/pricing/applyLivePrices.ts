import type { RealProduct } from "@/lib/catalog-types";
import { fetchCurrentPriceOverrides } from "@/lib/pricing/getEffectivePrice";

/**
 * LIVE-PRICE MERGE — BUILT, FLAGGED OFF, NOT SHIPPED (findings §54).
 *
 * Operator ruling 2026-08-21: build it behind a flag, do not ship it,
 * and bring the exact per-source label wording for approval before
 * anything renders to a visitor.
 *
 * THE LABEL AND THE PRICE ARE ONE CHANGE, and both shipped together
 * (operator ruling, §55/§59). One sentence for both sources — "Price as
 * of {date}" — where the date is ALWAYS the FEED VINTAGE behind that
 * price. Enabling the price without a source-aware label would have
 * converted a working honesty mechanism into a false claim on most of
 * the catalogue; that is why the flag existed and why it could only be
 * flipped once current_prices could name the date.
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
/**
 * SHIPPED 2026-08-22, ON BY DEFAULT. `LIVE_PRICES=0` is the kill switch.
 *
 * RECORD (§62): claude/pricing-pipeline-findings-2026-08-16.md §55 (the
 * gated build and what it measured) and §58 (shipping it, and the defect
 * found on the way — this merged a live price while leaving the as-of
 * label reading a hardcoded null, so the price moved and the stamp did
 * not, on 26 pages). Flipping this to 0 re-freezes every page at its
 * build-time price; that is the intended emergency behaviour, not a
 * neutral default.
 *
 * Inverted from opt-in once the blocker cleared: current_prices carries
 * the feed vintage (migration 0023), refreshPrices writes it, and
 * resolveAsOfStamp names it. The reason for shipping is a correctness
 * problem, not a feature: our pages were staler than our own database —
 * two king-koil variants displayed prices the merchant had already
 * changed, and our own history had recorded the change on the day.
 */
export const LIVE_PRICES_ENABLED = process.env.LIVE_PRICES !== "0";

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
