import { NextResponse } from "next/server";
import { refreshPrices } from "@/lib/pricing/refreshPrices";
import { pingHealthcheck } from "@/lib/monitoring/pingHealthcheck";
import { createAdminClient } from "@/lib/supabase/admin";
import { freshnessCutoffIso } from "@/lib/pricing/freshness";

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
            feedId: p.feedId ?? null,
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
        failures.push(
          `${p.partnerId} (feed ${p.feedId ?? "?"}): matched 0 of ${p.feedRows} feed rows — matching is broken`
        );
      }
    }

    // Freshness, count-based and per-partner (threshold derivation in
    // lib/pricing/freshness.ts). The first version of this control used
    // max(updated_at), which only reddens when EVERY row is stale — one
    // partner silently dropping out of matching (the zombie shape,
    // findings §9r/§9s) leaves MAX fresh and the check green. The
    // assertion is: ZERO override rows older than the threshold, reported
    // per partner, because "golden-maple stopped matching" and
    // "everything died" must not produce the same signal. Checked AFTER
    // the run, so rows this run stamped are fresh by construction.
    const supabase = createAdminClient();
    const { data: staleRows, error: freshErr } = await supabase
      .from("current_prices")
      .select("product_id, retailer")
      .lt("updated_at", freshnessCutoffIso());
    if (freshErr) {
      failures.push(`freshness read failed: ${freshErr.message}`);
    } else if (staleRows && staleRows.length > 0) {
      const byPartner: Record<string, number> = {};
      for (const r of staleRows) byPartner[r.retailer] = (byPartner[r.retailer] ?? 0) + 1;
      failures.push(
        `freshness: ${staleRows.length} override row(s) older than the 2-day limit — per partner: ` +
          Object.entries(byPartner)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ") +
          ` — these prices are not corroborated by any current feed and the read-side TTL is excluding them`
      );
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
