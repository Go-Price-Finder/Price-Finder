import { NextResponse } from "next/server";
import { refreshPrices } from "@/lib/pricing/refreshPrices";
import { pingHealthcheck } from "@/lib/monitoring/pingHealthcheck";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Freshness threshold derivation (findings §9r — argue it, don't pick it):
 * refreshPrices stamps updated_at on EVERY matched row it upserts, changed
 * or not, so max(current_prices.updated_at) measures "when did a refresh
 * run last demonstrably touch the table" — a cadence WE own (daily cron),
 * not merchant repricing, which nobody owns. 2 days = one fully missed or
 * silently-broken run, plus cron jitter. Raising this number fixes
 * nothing: it only converts missed runs into silence. If the cron cadence
 * changes, re-derive from the new cadence; a red here with an unchanged
 * cadence means the pipeline has not demonstrably observed prices for two
 * straight days, regardless of what any individual run returned.
 */
const FRESHNESS_LIMIT_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Triggered once a day by Vercel Cron (see vercel.json), scheduled before
 * check-price-alerts and snapshot-prices so both of those read whatever
 * this job just wrote to public.current_prices, same day.
 *
 * Same CRON_SECRET auth pattern as the other cron routes — see
 * check-price-alerts/route.ts's header comment for the full explanation.
 *
 * Only 3 of 6 real partners are covered as of 2026-08-02 (see
 * lib/pricing/refreshPrices.ts's PARTNER_AWIN_NAMES) — the other 3 are
 * intentionally skipped pending advertiser-name verification, not a bug.
 * Read the response body's per-partner `skipped` field to see why any
 * given partner didn't run.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await refreshPrices();

    // Persist the per-partner counters where something stores them (Vercel
    // runtime logs; retention-limited, so the response body carries them
    // too). The counters that discriminate "working against static feeds"
    // from "matching broken" — see PartnerRefreshResult's doc comments.
    for (const p of result.partners) {
      console.log(
        "[refresh-prices] " +
          JSON.stringify({
            partner: p.partnerId,
            skipped: p.skipped ?? null,
            feedRows: p.feedRows,
            matched: p.matched,
            compared: p.compared,
            unchangedVsCatalog: p.unchangedVsCatalog,
            priceChangesVsCatalog: p.priceChanges,
            newRows: p.newRows,
            changedVsCurrent: p.changedVsCurrent,
            unchangedVsCurrent: p.unchangedVsCurrent,
            upserted: p.upserted,
            errored: p.errors.length,
          })
      );
    }

    const failures: string[] = [];

    // Liveness: a verified partner whose feed downloaded but matched
    // NOTHING is broken matching, not a quiet day — the exact state a
    // bare 200 spent 15 days hiding.
    for (const p of result.partners) {
      if (!p.skipped && p.feedRows > 0 && p.matched === 0) {
        failures.push(`${p.partnerId}: matched 0 of ${p.feedRows} feed rows — matching is broken`);
      }
    }

    // Freshness: see FRESHNESS_LIMIT_MS derivation above. Checked AFTER
    // the run, so a working run (which stamps every matched row) turns
    // this green by having demonstrably observed prices — a stale value
    // here means neither this run nor any recent one touched the table.
    const supabase = createAdminClient();
    const { data: newest, error: freshErr } = await supabase
      .from("current_prices")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (freshErr) {
      failures.push(`freshness read failed: ${freshErr.message}`);
    } else if (!newest) {
      failures.push("freshness: current_prices is empty");
    } else {
      const ageMs = Date.now() - new Date(newest.updated_at).getTime();
      if (ageMs > FRESHNESS_LIMIT_MS) {
        failures.push(
          `freshness: max(current_prices.updated_at) is ${(ageMs / 86400000).toFixed(1)} days old ` +
            `(limit 2 days) — no refresh run has demonstrably touched current_prices within the limit`
        );
      }
    }

    // Dead-man's-switch: ping only when every partner ran clean AND the
    // liveness/freshness controls pass, so any silent failure shows up as
    // a MISSED ping (see lib/monitoring/pingHealthcheck.ts).
    const partnersClean = result.partners.every((p) => p.errors.length === 0);
    const ok = failures.length === 0;
    if (ok && partnersClean) {
      await pingHealthcheck("refresh-prices");
    }
    // Control failures are loud (500 — Vercel records the cron invocation
    // as failed); partner-level errors keep this route's original 200
    // shape and stay visible in the body and the withheld ping.
    return NextResponse.json({ ok, failures, ...result }, { status: ok ? 200 : 500 });
  } catch (error) {
    console.error("[refresh-prices] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Always run this fresh — never cache a cron endpoint's response.
export const dynamic = "force-dynamic";
