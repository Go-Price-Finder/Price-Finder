import { NextResponse } from "next/server";
import { checkPriceDrops } from "@/lib/alerts/checkPriceDrops";

/**
 * Triggered once a day by Vercel Cron (see vercel.json). Vercel
 * automatically sends `Authorization: Bearer $CRON_SECRET` when it calls a
 * cron path, as long as a CRON_SECRET env var is set on the project — this
 * checks for that exact header so the endpoint can't be triggered by
 * anyone who finds the URL. Standard Vercel Cron auth pattern:
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 *
 * If CRON_SECRET isn't set (e.g. local development), the check is skipped
 * so `next dev` and manual `curl`/browser testing still work. Never leave
 * CRON_SECRET unset in production — see .env.local.example.
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
    const result = await checkPriceDrops();
    // Per-row failures are collected (not thrown) inside checkPriceDrops so
    // one bad row can't stop the rest — but a run where any send or update
    // failed must not report success. Vercel only marks a cron invocation
    // as failed on a non-2xx status, so returning 200 here would hide every
    // send failure from the one place failures are recorded.
    const ok = result.errors.length === 0;
    return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
  } catch (error) {
    console.error("[check-price-alerts] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Always run this fresh — never cache a cron endpoint's response.
export const dynamic = "force-dynamic";
