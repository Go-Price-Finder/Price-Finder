/**
 * The one freshness threshold for current_prices observations, shared by
 * the read-side TTL (lib/pricing/getEffectivePrice.ts — a stale override
 * is not APPLIED) and the refresh-prices route's freshness control (a
 * stale override existing at all is a per-partner failure).
 *
 * Derivation (findings doc §9r/§9s — argue it, don't pick it):
 * refreshPrices stamps updated_at on EVERY matched row it upserts,
 * changed or not, so a row's age measures "when did a refresh run last
 * corroborate this price against a live feed" — a cadence WE own (daily
 * cron), not merchant repricing, which nobody owns. 2 days = one fully
 * missed or silently-broken run, plus cron jitter. Raising this number
 * fixes nothing: it only converts missed runs into silence, and widens
 * the window in which an uncorroborated price is presented as live. If
 * the cron cadence changes, re-derive from the new cadence.
 */
export const FRESHNESS_LIMIT_MS = 2 * 24 * 60 * 60 * 1000;

/** ISO timestamp of the oldest updated_at still considered fresh. */
export function freshnessCutoffIso(now: number = Date.now()): string {
  return new Date(now - FRESHNESS_LIMIT_MS).toISOString();
}
