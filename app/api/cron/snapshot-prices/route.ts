import { NextResponse } from "next/server";
import { snapshotPrices } from "@/lib/pricing/snapshotPrices";

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
