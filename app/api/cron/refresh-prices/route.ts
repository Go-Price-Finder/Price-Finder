import { NextResponse } from "next/server";
import { refreshPrices } from "@/lib/pricing/refreshPrices";
import { pingHealthcheck } from "@/lib/monitoring/pingHealthcheck";

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
    // Dead-man's-switch: ping only when every partner ran clean, so a
    // partner-level failure shows up as a MISSED ping even though this
    // route's HTTP status is unchanged (see lib/monitoring/pingHealthcheck.ts).
    if (result.partners.every((p) => p.errors.length === 0)) {
      await pingHealthcheck("refresh-prices");
    }
    return NextResponse.json({ ok: true, ...result });
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
