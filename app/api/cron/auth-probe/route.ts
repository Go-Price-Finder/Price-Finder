import { NextResponse } from "next/server";
import { runAuthProbe } from "@/lib/monitoring/authProbe";
import { pingHealthcheck } from "@/lib/monitoring/pingHealthcheck";

/**
 * Daily synthetic auth probe (see lib/monitoring/authProbe.ts) — walks
 * signup confirmation and password reset end to end as a user would.
 * Same CRON_SECRET auth pattern as the other cron routes — see
 * check-price-alerts/route.ts's header comment for the full explanation.
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
    const result = await runAuthProbe();
    // Any failed assertion must not report success (same rule as the other
    // crons), and the dead-man's ping fires only on a fully clean walk.
    const ok = result.errors.length === 0;
    if (ok) await pingHealthcheck("auth-probe");
    return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
  } catch (error) {
    console.error("[auth-probe] failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Always run this fresh — never cache a cron endpoint's response.
export const dynamic = "force-dynamic";
