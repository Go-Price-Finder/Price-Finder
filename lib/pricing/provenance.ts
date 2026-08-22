/**
 * PROVENANCE PRIMITIVES — the single source of truth for "what date does
 * this price belong to, and do we know it?" (findings §59/§60).
 *
 * Consumed by BOTH `resolveAsOfStamp` (the as-of label) and the price
 * series that feeds the history chart. One function, two callers. If
 * these two surfaces can compute the date differently they eventually
 * will, and then the stamp and the chart's last point disagree about
 * when a price changed — on the same page, next to a buy button.
 *
 * STANDING RULE §59, which this module exists to enforce:
 *
 *   A record of when we LOOKED is not a record of when it CHANGED.
 *   Any series plotted, counted or averaged over time must be keyed to
 *   the event's own timestamp, never to our observation schedule.
 *   Where the two differ, the event's timestamp wins and the observation
 *   cadence is not shown at all.
 *
 * Concretely: our snapshot job runs daily, but a merchant feed does not
 * re-export daily. Fourteen snapshots of four feed exports are FOUR
 * observations recorded fourteen times. Plotting fourteen points would
 * assert ten confirmations nobody made.
 */

/**
 * Rows before this date are excluded from every series, permanently.
 *
 * This is the "recorded cutover date" the 2026-08-16 suppression incident
 * named as an acceptable restore condition
 * (claude/incident-2026-08-16-price-history-chart.md). Before it the
 * table is not merely thinner, it is differently constituted:
 *
 *   - no `feed_last_imported_at` on ANY row, so nothing can be keyed to
 *     the event's own timestamp (§59 cannot be satisfied at all);
 *   - no `price_source` before 2026-08-17, so we cannot say where a
 *     price came from;
 *   - two partial snapshot days (08-02 lost 17 king-koil rows mid
 *     catalog re-import; 08-19 lost 953 of 1,453 when only the first
 *     500-row batch landed), neither detected at the time, so the loss
 *     rate over the period is a LOWER BOUND rather than a count;
 *   - nine apparent oscillations that were the pipeline reading a live
 *     price and then falling back to the catalog price it had been
 *     reading all along.
 *
 * Drawn as a chart, that last one becomes nine promotions that never
 * happened — the fabricated-observation defect rendered as a graph, on
 * the feature meant to prove we do not do that.
 */
export const PROVENANCE_CUTOVER_DATE = "2026-08-21";

/** The furthest back any series looks. Bounds the x-axis so a feed that
 * was frozen for months and then resumes cannot set the scale with one
 * ancient point and compress every recent observation into the last few
 * percent of the width — the auto-fit failure, on the other axis. */
export const SERIES_WINDOW_DAYS = 90;

/** A price_history row, in the only shape this module cares about. */
export type ProvenancedRow = {
  price: number;
  recorded_date: string;
  feed_id: string | null;
  feed_last_imported_at: string | null;
};

/**
 * Is this row an OBSERVATION we can place in time?
 *
 * A NULL vintage is excluded outright rather than degraded to its
 * snapshot date. Unknown provenance is not a weaker observation, it is a
 * different kind of thing — and plotting it at the read date is exactly
 * the §59 violation. brooklyn-delhi is the standing example: no AWIN feed
 * exists, so every one of its 29 products has a permanently NULL vintage
 * and is permanently excluded. That also makes it a positive control for
 * this branch that cannot evaporate.
 */
export function isObservedRow(row: ProvenancedRow): boolean {
  if (!row.feed_last_imported_at) return false;
  if (row.recorded_date < PROVENANCE_CUTOVER_DATE) return false;
  return true;
}

/** The ISO date (YYYY-MM-DD) a price belongs to: the merchant's own feed
 * export date, never our read date. */
export function vintageDate(feedLastImportedAt: string): string {
  return feedLastImportedAt.slice(0, 10);
}
