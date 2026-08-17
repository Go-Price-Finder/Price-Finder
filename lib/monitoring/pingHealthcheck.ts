/**
 * Dead-man's-switch ping for the daily crons (healthchecks.io).
 *
 * Each cron route calls this at the END of a fully clean run — and only
 * then. The monitor alerts on ABSENCE: if a cron dies, hangs, errors, or
 * silently stops being scheduled, the ping never arrives and
 * healthchecks.io notifies the operator through a channel that is neither
 * Vercel nor Resend. That closes the gap this project has already been
 * bitten by twice: a cron can return 200 and do nothing for weeks
 * (refresh-prices, 2026-08), and a non-2xx cron status is recorded only
 * in pull-based places nobody is required to look at (findings doc §9d).
 * An alert channel must not route through the thing it monitors — this
 * one touches neither the Vercel runtime's health nor the Resend email
 * path.
 *
 * HEALTHCHECKS_PING_KEY is the project's ping key (Settings → Ping key on
 * healthchecks.io). Unset (e.g. local dev, or until the operator
 * provisions the account) every call is a silent no-op and the crons
 * behave exactly as before — the switch is INERT until the key exists.
 * `?create=1` auto-creates a check the first time a new slug pings, so no
 * per-check setup is needed beyond assigning each check a schedule and
 * grace window in the healthchecks.io UI.
 *
 * This function must never throw and must never meaningfully delay the
 * job it monitors: a failed or slow ping is swallowed after a short
 * timeout, because a missed ping IS the alert — the monitor fires on
 * absence, so the failure mode of the monitor is the monitor working.
 */
export async function pingHealthcheck(slug: string): Promise<void> {
  const key = process.env.HEALTHCHECKS_PING_KEY;
  if (!key) return;
  try {
    await fetch(`https://hc-ping.com/${key}/${slug}?create=1`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Swallowed deliberately — see header comment.
  }
}
