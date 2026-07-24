/**
 * Pure decision logic for a single wishlist row: given its target price,
 * the product's current price, and whether an alert has already been sent
 * for the current dip, what should the cron job do?
 *
 * Kept separate from lib/alerts/checkPriceDrops.ts (which does the actual
 * Supabase/Resend I/O) so this — the actual comparison + reset rule the
 * feature is built around — can be unit-tested without a live Supabase
 * project or Resend key. See scripts/test-alert-logic.ts.
 */
export type AlertDecision =
  | { action: "send"; reason: "price_at_or_below_target" }
  | { action: "reset"; reason: "price_rose_above_target" }
  | { action: "none"; reason: "no_target" | "already_sent" | "above_target" };

export function evaluateAlertState(params: {
  targetPrice: number | null;
  currentPrice: number;
  alertSent: boolean;
}): AlertDecision {
  const { targetPrice, currentPrice, alertSent } = params;

  if (targetPrice == null) {
    return { action: "none", reason: "no_target" };
  }

  const atOrBelowTarget = currentPrice <= targetPrice;

  if (alertSent) {
    // Already alerted for this dip. The database trigger in
    // 0003_add_target_price.sql handles the "user changed target_price"
    // reset case; this handles the other one — price climbed back above
    // target after the alert, so a later dip should be able to alert
    // again. Only checkPriceDrops.ts sees the live current price, so this
    // is the only place that reset can happen.
    return atOrBelowTarget
      ? { action: "none", reason: "already_sent" }
      : { action: "reset", reason: "price_rose_above_target" };
  }

  return atOrBelowTarget
    ? { action: "send", reason: "price_at_or_below_target" }
    : { action: "none", reason: "above_target" };
}
