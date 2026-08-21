import { NextResponse } from "next/server";
import { snapshotPrices } from "@/lib/pricing/snapshotPrices";
import { pingHealthcheck } from "@/lib/monitoring/pingHealthcheck";

/**
 * Triggered once a day by Vercel Cron (see vercel.json), ahead of
 * check-price-alerts, so a fresh snapshot exists before alerts evaluate
 * for the day. Uses the same Bearer-token auth pattern as that route — see
 * its header comment for why: Vercel sends `Authorization: Bearer
 * $CRON_SECRET` automatically as long as CRON_SECRET is set on the
 * project.
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
    const result = await snapshotPrices();
    // Dead-man's-switch: ping only on a fully clean run, so a silent
    // failure shows up as a MISSED ping even though this route's HTTP
    // status is unchanged (see lib/monitoring/pingHealthcheck.ts).
    if (result.errors.length === 0 && result.coverage.ok) {
      await pingHealthcheck("snapshot-prices");
    }
    // COVERAGE FAILS LOUDLY (findings §53). A partial snapshot, or a
    // partner whose row count moved against yesterday, returns 500 and
    // skips the ping. It is deliberately not a warning: the 2026-08-02
    // partial king-koil snapshot logged nothing, and five catalog-refresh
    // artifacts then sat in the record looking like merchant repricing
    // until someone read the table eighteen days later.
    if (!result.coverage.ok) {
      console.error("[snapshot-prices] COVERAGE FAILURE:", result.coverage.failures);
      return NextResponse.json({ ok: false, ...result }, { status: 500 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[snapshot-prices] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Always run this fresh — never cache a cron endpoint's response.
export const dynamic = "force-dynamic";
