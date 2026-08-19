import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import { getAllRealProducts, type RealProduct } from "@/lib/partners";
import { freshnessCutoffIso } from "@/lib/pricing/freshness";
import type { WishlistRetailerId } from "@/lib/types";

/**
 * The live-price override layer (Section 6.1 of the strategic growth
 * plan's "daily price refresh pipeline"). See
 * supabase/migrations/0006_add_current_prices.sql for the full "why" —
 * short version: product catalogs (name/description/image/slug) are
 * static TS files generated once by scripts/import-partner.mjs, but a
 * live price needs to change daily without a redeploy. `current_prices`
 * is a sparse Supabase table: a row means "this product's live price
 * differs from the static file," absence means "use the static price."
 *
 * Every price-reading call site should go through one of the two
 * functions below instead of reading `product.price` straight off
 * getAllRealProducts() — that's what actually makes a refreshed price
 * visible anywhere (product pages, price alerts, price_history
 * snapshotting). As of 2026-08-02 no caller has been migrated yet; this
 * file is the seam future call sites plug into, one at a time, starting
 * with the highest-value ones (price alerts, price_history) rather than
 * every page at once.
 */

export type CurrentPriceRow = {
  product_id: string;
  retailer: string;
  price: number;
  original_price: number | null;
  updated_at: string;
};

/** Fetch every row in current_prices as a Map keyed by `product_id` alone.
 *
 * `product_id` IS RealProduct.id — the full `${partnerId}:${slug}` string,
 * partner prefix included (see withLivePrice below, which queries by the
 * same equality). Appending `:${retailer}` here built keys shaped
 * `partner:slug:partner` that applyOverride's `overrides.get(product.id)`
 * could never match, so the merge was a silent no-op from 2026-08-02 to
 * 2026-08-16: current_prices was written daily and read by nothing,
 * price_history recorded the static price as if observed, and price
 * alerts never evaluated a live price. Full record:
 * claude/pricing-pipeline-findings-2026-08-16.md, Section 2. Retailer
 * needs no place in the key — it is derivable from the id's partner
 * prefix, and (product_id, retailer) is unique per the table's conflict
 * target with retailer always equal to that prefix for real partners. */
export async function fetchCurrentPriceOverrides(): Promise<
  Map<string, CurrentPriceRow>
> {
  const supabase = createAdminClient();
  // Read-side TTL (operator decision 2026-08-18, findings §9s): an
  // override whose updated_at is older than the freshness threshold is
  // NOT applied — the product falls back to its catalog price. An
  // uncorroborated old observation presented as a live price is the same
  // offence PriceHistoryChart was suppressed for. The row itself is
  // deliberately left in place (deletion would destroy the record of
  // what was genuinely observed); if matching resumes for that product,
  // the next refresh run re-stamps it and it self-heals back into use.
  // Paged (findings §17): this read was at 652 of PostgREST's 1,000-row
  // cap when audited, and aaawave matching alone could cross it. With
  // revalidate: false this runs at BUILD time, so a truncated read would
  // freeze silently-static prices into published pages until the next
  // deploy. Ordered by the (product_id, retailer) PK so ranges are
  // deterministic.
  const cutoff = freshnessCutoffIso();
  const rows = await fetchAllRows<CurrentPriceRow>((from, to) =>
    supabase
      .from("current_prices")
      .select("product_id, retailer, price, original_price, updated_at")
      .gte("updated_at", cutoff)
      .order("product_id")
      .order("retailer")
      .range(from, to)
  );

  const map = new Map<string, CurrentPriceRow>();
  for (const row of rows) {
    map.set(row.product_id, row);
  }
  return map;
}

function applyOverride(
  product: RealProduct,
  overrides: Map<string, CurrentPriceRow>
): RealProduct {
  const override = overrides.get(product.id);
  if (!override) return product;
  return {
    ...product,
    price: override.price,
    originalPrice: override.original_price ?? undefined,
  };
}

/** Same shape/contract as getAllRealProducts(), but with any live
 * current_prices override merged on top of each product's static price.
 * Requires a DB round-trip, so it's async — callers that were doing
 * `const products = getAllRealProducts()` synchronously need to become
 * `const products = await getAllRealProductsWithLivePrices()`. */
export async function getAllRealProductsWithLivePrices(): Promise<
  RealProduct[]
> {
  const [products, overrides] = await Promise.all([
    Promise.resolve(getAllRealProducts()),
    fetchCurrentPriceOverrides(),
  ]);
  return products.map((p) => applyOverride(p, overrides));
}

/** Single-product convenience wrapper — for pages/handlers that already
 * have one RealProduct (e.g. from getRealProduct()) and just need its
 * live price merged in, without paying for a full-catalog override fetch
 * keyed by every product. Still one DB round-trip per call; batch call
 * sites (search, listings, alerts) should prefer
 * getAllRealProductsWithLivePrices() instead so N products cost one
 * query, not N. */
export async function withLivePrice(product: RealProduct): Promise<RealProduct> {
  const supabase = createAdminClient();
  const [partnerId, ...slugParts] = product.id.split(":");
  // Same read-side TTL as fetchCurrentPriceOverrides above — the two
  // readers must agree on what counts as a live price.
  const { data, error } = await supabase
    .from("current_prices")
    .select("price, original_price")
    .eq("product_id", product.id)
    .eq("retailer", partnerId as WishlistRetailerId)
    .gte("updated_at", freshnessCutoffIso())
    .maybeSingle();

  // slugParts intentionally unused beyond validating id shape — product_id
  // IS product.id (the full "${partnerId}:${slug}" string), not just the
  // slug portion; retailer is the partnerId prefix. Both are passed above.
  void slugParts;

  if (error) throw error;
  if (!data) return product;

  return {
    ...product,
    price: data.price,
    originalPrice: data.original_price ?? undefined,
  };
}
