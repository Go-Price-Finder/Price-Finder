import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { PartnerRefreshResult } from "@/lib/pricing/refreshPrices";

/**
 * The refresh_runs writer (migration 0017 v2; findings §9y). Two BINDING
 * contract clauses, both operator-ruled 2026-08-19:
 *
 * 1. NULL, never 0, for any counter belonging to a stage this entry never
 *    reached. Counters initialise to 0 in memory, so the mapping below
 *    keys off PartnerRefreshResult.stage — recorded fact, not inference.
 *    Zero and unknown must not collapse: that collapse is the origin of
 *    the fifteen-day story (§9r) and does not get to re-enter here.
 * 2. Skip entries are WRITTEN, never omitted, under the feed_status
 *    sentinel id (none:<partner>). A skipped partner that leaves no row
 *    is indistinguishable from a partner nobody tried — clause 1's
 *    ambiguity in a different column.
 *
 * Returns an error message (for the route to surface as a loud failure)
 * or null on success — a telemetry write that fails silently would be
 * the original sin all over again.
 */
export async function recordRefreshRuns(
  supabase: SupabaseClient<Database>,
  args: {
    runId: string;
    route: string;
    startedAt: string;
    finishedAt: string;
    partners: PartnerRefreshResult[];
    /** Per-partner stale-override counts from the route's freshness
     * check, or null when that read itself failed (unknown ≠ 0 there
     * too). */
    stalePerPartner: Record<string, number> | null;
  }
): Promise<string | null> {
  const rows = args.partners.map((p) => {
    const stage = p.stage;
    // Stage thresholds: which counter groups are KNOWN at each stage.
    const downloadKnown = stage === "downloaded" || stage === "diffed" || stage === "done";
    const diffKnown = stage === "diffed" || stage === "done";
    const upsertKnown = stage === "done";
    return {
      run_id: args.runId,
      route: args.route,
      partner_id: p.partnerId,
      feed_id: p.feedId ?? `none:${p.partnerId}`,
      feed_rows: downloadKnown ? p.feedRows : null,
      matched: downloadKnown ? p.matched : null,
      matched_by_id: downloadKnown ? p.matchedById : null,
      matched_by_name: downloadKnown ? p.matchedByName : null,
      // Migration 0022 — the gtin quartet. Two layers of NULL, both
      // honest and distinct by clause 1's logic: stage-unknown (this
      // entry never reached matching) and strategy-unused (the partner's
      // matchStrategy has no "gtin" — the in-memory counters stay null,
      // see PartnerRefreshResult). A partner that RAN the strategy and
      // matched nothing writes a genuine 0. The three collision/usable
      // counters are the churn instrument: whether a merchant's gtins
      // are stable enough for a primary key is answered by diffing them
      // across runs (baseline 2026-08-19: feed=2, catalog=0, usable=498).
      matched_by_gtin: downloadKnown ? p.matchedByGtin : null,
      gtin_collisions_in_feed: downloadKnown ? p.gtinCollisionsInFeed : null,
      gtin_collisions_in_catalog: downloadKnown ? p.gtinCollisionsInCatalog : null,
      gtin_keys_usable: downloadKnown ? p.gtinKeysUsable : null,
      compared: downloadKnown ? p.compared : null,
      duplicate_key_collisions: downloadKnown ? p.duplicateKeyCollisions : null,
      new_rows: diffKnown ? p.newRows : null,
      changed_vs_current: diffKnown ? p.changedVsCurrent : null,
      unchanged_vs_current: diffKnown ? p.unchangedVsCurrent : null,
      upserted: upsertKnown ? p.upserted : null,
      stale_overrides: args.stalePerPartner ? (args.stalePerPartner[p.partnerId] ?? 0) : null,
      error_message: p.errors.length ? p.errors.join("; ").slice(0, 2000) : null,
      started_at: args.startedAt,
      finished_at: args.finishedAt,
    };
  });

  const { error } = await supabase.from("refresh_runs").insert(rows);
  return error ? `refresh_runs write failed: ${error.message}` : null;
}
