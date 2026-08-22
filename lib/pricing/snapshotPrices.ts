import { createAdminClient } from "@/lib/supabase/admin";
import { getAllRealProducts, type RealProduct } from "@/lib/partners";
import {
  fetchCurrentPriceOverrides,
  type CurrentPriceRow,
} from "@/lib/pricing/getEffectivePrice";
import type { WishlistRetailerId } from "@/lib/types";
import { getSourceFeedStatusId } from "@/lib/price-as-of";

export type SnapshotPricesResult = {
  /** Total real products found in the static catalog at run time. */
  attempted: number;
  /** Rows successfully written (or already up to date) in price_history. */
  written: number;
  errors: { productId: string; message: string }[];
  /** Feed provenance actually stamped this run (findings §53). */
  provenance: { withFeedVintage: number; withoutFeedVintage: number };
  /** Per-partner coverage. FAILS LOUDLY — the route returns 500 and the
   * dead-man's-switch ping is skipped. Absent on 2026-08-02 is why five
   * king-koil catalog-refresh artifacts spent two days looking like
   * merchant repricing (findings §52/§53). */
  coverage: {
    ok: boolean;
    previousDate: string | null;
    perPartner: { partner: string; today: number; previous: number | null }[];
    /** FATAL: we wrote fewer rows than the catalog holds. Always a defect. */
    failures: string[];
    /** NOT fatal: the partner's population moved against yesterday. A real
     * import legitimately does this, so it must not 500 the cron — but any
     * movement measured ACROSS this boundary is not attributable to
     * merchants, so it is surfaced and the movement report excludes it. */
    populationChanges: string[];
  };
};

/** What feed_status knows about one feed, at snapshot time. */
export type FeedVintage = {
  feedId: string;
  lastImportedAt: string | null;
  lastCheckedAt: string | null;
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
  override: CurrentPriceRow | undefined,
  vintage: FeedVintage | null
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
    // Feed provenance (findings §53). Stamped from feed_status, which
    // scripts/sync-feed-status.mjs refreshes from the AWIN feed list
    // BEFORE this job runs. NULL means we genuinely do not know which
    // feed produced this price or when it was imported — never "the
    // feed did not refresh". The 18,154 rows written before this landed
    // are permanently NULL here and cannot be backfilled: feed_status is
    // current-state and nothing recorded its value on any past day.
    feed_id: vintage?.feedId ?? null,
    feed_last_imported_at: vintage?.lastImportedAt ?? null,
    feed_last_checked_at: vintage?.lastCheckedAt ?? null,
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

  // Feed vintage per feed, from feed_status (findings §53). Read once;
  // nine rows. A feed absent here, or present with a NULL import stamp,
  // yields NULL on the row — "unknown", never "unchanged".
  const { data: feedRows, error: feedErr } = await supabase
    .from("feed_status")
    .select("feed_id, feed_last_imported_at, feed_last_checked_at");
  const vintages = new Map<string, FeedVintage>();
  for (const f of feedRows ?? []) {
    vintages.set(f.feed_id, {
      feedId: f.feed_id,
      lastImportedAt: f.feed_last_imported_at,
      lastCheckedAt: f.feed_last_checked_at,
    });
  }

  const result: SnapshotPricesResult = {
    attempted: products.length,
    written: 0,
    errors: [],
    provenance: { withFeedVintage: 0, withoutFeedVintage: 0 },
    coverage: { ok: true, previousDate: null, perPartner: [], failures: [], populationChanges: [] },
  };
  if (feedErr) {
    // Not fatal — rows are still worth recording — but it must be visible,
    // and it suppresses the dead-man's-switch ping via errors[].
    result.errors.push({ productId: "(feed_status)", message: `feed vintage unavailable: ${feedErr.message}` });
  }

  const rowFor = (product: RealProduct) => {
    const override = overrides.get(product.id);
    // PROVENANCE TRAVELS WITH THE PRICE (findings §60). If this row's
    // price came from a current_prices override, its vintage is the one
    // recorded ON THAT ROW — not whatever feed_status happens to hold
    // now. Exactly as observed_at already comes from override.updated_at.
    //
    // Reading feed_status here instead was a real defect, caught by the
    // stamp/last-point agreement check before the chart shipped: two
    // sources for one fact. refreshPrices reads the AWIN feed list LIVE
    // at 11:00Z; feed_status is a cached copy from whenever it was last
    // synced. aaawave re-exported in between, so 500 products had a stamp
    // saying 2026-08-21 and a last plotted point saying 2026-08-20 — the
    // label and the chart disagreeing about the same price on the same
    // page.
    //
    // feed_status remains the source ONLY for catalog_fallback rows,
    // which have no override to inherit from.
    const feedId = getSourceFeedStatusId(product.partnerId, product.slug);
    const vintage: FeedVintage | null =
      override && override.feed_last_imported_at
        ? {
            feedId: override.feed_id ?? feedId ?? "",
            lastImportedAt: override.feed_last_imported_at,
            lastCheckedAt: null,
          }
        : feedId
          ? vintages.get(feedId) ?? null
          : null;
    if (vintage?.lastImportedAt) result.provenance.withFeedVintage++;
    else result.provenance.withoutFeedVintage++;
    return buildSnapshotRow(product, override, vintage);
  };

  // Batched to keep each request body reasonable — 957 products today,
  // but this shouldn't need revisiting as the catalog grows into the
  // low thousands.
  const BATCH_SIZE = 500;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE).map(rowFor);

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

  await assertPerPartnerCoverage(supabase, products, result);
  return result;
}

/**
 * PER-PARTNER ROW-COUNT ASSERTION (findings §53). Fails loudly.
 *
 * On 2026-08-02 this job recorded 12 king-koil rows; from 08-03 it
 * recorded 29. Nothing noticed. Five products then showed a price change
 * on 08-03 that was our own catalog re-import (commit 87877a2, "Refresh
 * King Koil and Tsar Bomba catalogs from fresh AWIN feeds"), and those
 * five spent eighteen days in the record looking like merchant
 * repricing. A single count comparison would have flagged it the next
 * morning.
 *
 * TWO CHECKS, DELIBERATELY DIFFERENT SEVERITIES:
 *
 *   FATAL — today's row count for a partner is less than the catalog
 *   holds. That is a partial snapshot and is always a defect. Returns
 *   500 and skips the dead-man's-switch ping.
 *
 *   SURFACED, NOT FATAL — the partner's count moved against yesterday.
 *   A real import legitimately does this, and 500-ing the cron on every
 *   import day would train whoever reads the alert to ignore it. It is
 *   reported in the response and consumed by the movement report, which
 *   must not attribute movement to merchants across a boundary where the
 *   population changed. That distinction is the whole lesson: the
 *   2026-08-02 failure was a PARTIAL snapshot (fatal), while the
 *   2026-08-20 collapse was a deliberate population change (not fatal,
 *   but it invalidates comparisons across it).
 *
 * Counts, never fetches (standing rule 6): every read here is
 * `head: true` with an exact count, so it is immune to the PostgREST
 * 1,000-row cap.
 */
async function assertPerPartnerCoverage(
  supabase: ReturnType<typeof createAdminClient>,
  products: RealProduct[],
  result: SnapshotPricesResult
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: prevRow } = await supabase
    .from("price_history")
    .select("recorded_date")
    .lt("recorded_date", today)
    .order("recorded_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousDate: string | null = prevRow?.recorded_date ?? null;
  result.coverage.previousDate = previousDate;

  const partners = [...new Set(products.map((p) => p.partnerId))].sort();

  for (const partner of partners) {
    const expected = products.filter((p) => p.partnerId === partner).length;

    const { count: todayCount } = await supabase
      .from("price_history")
      .select("product_id", { count: "exact", head: true })
      .eq("recorded_date", today)
      .like("product_id", `${partner}:%`);

    let previousCount: number | null = null;
    if (previousDate) {
      const { count } = await supabase
        .from("price_history")
        .select("product_id", { count: "exact", head: true })
        .eq("recorded_date", previousDate)
        .like("product_id", `${partner}:%`);
      previousCount = count ?? null;
    }

    result.coverage.perPartner.push({
      partner,
      today: todayCount ?? 0,
      previous: previousCount,
    });

    // 1. Today must match what we set out to write. A shortfall is a
    //    partial snapshot — the 2026-08-02 failure shape exactly.
    if ((todayCount ?? 0) !== expected) {
      result.coverage.failures.push(
        `${partner}: wrote ${todayCount ?? 0} rows today but the catalog holds ${expected} — partial snapshot, do not compare this day to any other.`
      );
    }
    // 2. A move against yesterday means the population changed. NOT an
    //    error — a real import does this, and 500-ing the cron on every
    //    import day would train someone to ignore the alarm. Surfaced
    //    instead, and consumed by the movement report, which must not
    //    measure movement across a boundary where the population moved.
    if (previousCount !== null && previousCount !== (todayCount ?? 0)) {
      result.coverage.populationChanges.push(
        `${partner}: ${previousCount} rows on ${previousDate} vs ${todayCount ?? 0} today — population changed; movement across this boundary is not attributable to merchants.`
      );
    }
  }

  result.coverage.ok = result.coverage.failures.length === 0;
}
