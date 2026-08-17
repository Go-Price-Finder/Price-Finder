import { createAdminClient } from "@/lib/supabase/admin";
import { getAllRealProducts, type RealProduct } from "@/lib/partners";
import {
  fetchCurrentPriceOverrides,
  type CurrentPriceRow,
} from "@/lib/pricing/getEffectivePrice";
import type { WishlistRetailerId } from "@/lib/types";

export type SnapshotPricesResult = {
  /** Total real products found in the static catalog at run time. */
  attempted: number;
  /** Rows successfully written (or already up to date) in price_history. */
  written: number;
  errors: { productId: string; message: string }[];
};

/**
 * The daily price-history snapshot — triggered by
 * app/api/cron/snapshot-prices/route.ts (Vercel Cron, once a day).
 *
 * Records today's price for every real product into public.price_history,
 * so Price History and Price Alerts have real, accumulating day-over-day
 * data instead of none. This is Phase 0's highest-leverage infrastructure
 * piece per the project's strategic-growth-plan doc (Section 6.1).
 *
 * SCOPE — read this before assuming this "fixes" price freshness: this job
 * snapshots whatever price getAllRealProductsWithLivePrices() resolves —
 * the static partner catalog (lib/partners.ts), overridden by any row in
 * public.current_prices for that product (see
 * lib/pricing/getEffectivePrice.ts and
 * supabase/migrations/0006_add_current_prices.sql). As of 2026-08-02,
 * current_prices is empty (nothing populates it yet — that's the
 * still-to-be-built AWIN feed-ingestion cron), so in practice this job's
 * behavior is unchanged from before: it snapshots the static price. But
 * the moment that ingestion job starts writing real overrides, this job
 * picks them up automatically, with no further change needed here.
 *
 * Upserts on (product_id, retailer, recorded_date) so re-running the job
 * the same day — e.g. a manual retry after a partial failure — updates
 * that day's row instead of creating a duplicate snapshot.
 *
 * Runs with the service-role client (lib/supabase/admin.ts) since it
 * writes rows for every product, not on behalf of one signed-in caller.
 */
/** One provenanced snapshot row. Extracted as a pure function so the
 * source/price/provenance logic is testable without a Supabase write —
 * see scratch-tested equivalence: `price` here must equal what
 * getAllRealProductsWithLivePrices() would return for the same product
 * (both paths merge via the same fetchCurrentPriceOverrides map). */
export function buildSnapshotRow(
  product: RealProduct,
  override: CurrentPriceRow | undefined
) {
  return {
    product_id: product.id,
    retailer: product.partnerId as WishlistRetailerId,
    price: override ? override.price : product.price,
    // Provenance (migration 0015). price_source says where `price` came
    // from; observed_at is when that price was last actually observed
    // upstream. For live_override rows that is current_prices.updated_at
    // — with a documented caveat: updated_at is set on INSERT only (the
    // upsert's ON CONFLICT path does not touch it), so it can understate
    // freshness for a row whose price was re-confirmed since insert. It
    // is the only observation timestamp that exists today; the feed_*
    // columns below are the eventual honest source and are written as
    // explicit NULLs until feed persistence lands.
    price_source: override ? ("live_override" as const) : ("catalog_fallback" as const),
    observed_at: override ? override.updated_at : null,
    catalog_price_at_snapshot: product.price,
    feed_id: null,
    feed_last_imported_at: null,
    feed_last_checked_at: null,
  };
}

export async function snapshotPrices(): Promise<SnapshotPricesResult> {
  const supabase = createAdminClient();
  // Merge is done here explicitly (static catalog + override map) rather
  // than through getAllRealProductsWithLivePrices(), because provenance
  // needs to know WHICH products had an override — the merged product
  // alone can't say. Price equivalence with that function is exact: same
  // override map, same lookup key, same fallback.
  const products = getAllRealProducts();
  const overrides = await fetchCurrentPriceOverrides();

  const result: SnapshotPricesResult = {
    attempted: products.length,
    written: 0,
    errors: [],
  };

  // Batched to keep each request body reasonable — 957 products today,
  // but this shouldn't need revisiting as the catalog grows into the
  // low thousands.
  const BATCH_SIZE = 500;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products
      .slice(i, i + BATCH_SIZE)
      .map((product) => buildSnapshotRow(product, overrides.get(product.id)));

    const { error } = await supabase
      .from("price_history")
      .upsert(batch, { onConflict: "product_id,retailer,recorded_date" });

    if (error) {
      for (const row of batch) {
        result.errors.push({ productId: row.product_id, message: error.message });
      }
      continue;
    }

    result.written += batch.length;
  }

  return result;
}
