import { NextResponse } from "next/server";
import { syncAwinTransactions } from "@/lib/cashback/syncAwinTransactions";

/**
 * Triggered once a day by Vercel Cron (see vercel.json). Same CRON_SECRET
 * auth pattern as the other cron routes — see check-price-alerts/route.ts's
 * header comment for the full explanation.
 *
 * Polls a 3-day lookback window every run (not just "since yesterday") so a
 * transaction sitting in AWIN's "pending" state gets re-checked and its
 * eventual approval/decline still gets caught — see
 * lib/cashback/syncAwinTransactions.ts for why re-polling is safe (dedupe on
 * awin_transaction_id) and for the important caveat that this integration
 * has not yet been verified against a live AWIN response.
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
    const result = await syncAwinTransactions();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[sync-cashback] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Always run this fresh — never cache a cron endpoint's response.
export const dynamic = "force-dynamic";
