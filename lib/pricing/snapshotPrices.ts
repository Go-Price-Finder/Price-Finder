import { createAdminClient } from "@/lib/supabase/admin";
import { getAllRealProductsWithLivePrices } from "@/lib/pricing/getEffectivePrice";
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
export async function snapshotPrices(): Promise<SnapshotPricesResult> {
  const supabase = createAdminClient();
  const products = await getAllRealProductsWithLivePrices();

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
    const batch = products.slice(i, i + BATCH_SIZE).map((product) => ({
      product_id: product.id,
      retailer: product.partnerId as WishlistRetailerId,
      price: product.price,
    }));

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
