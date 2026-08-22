import {
  isObservedRow,
  vintageDate,
  SERIES_WINDOW_DAYS,
  type ProvenancedRow,
} from "@/lib/pricing/provenance";

/**
 * Builds the price series the history chart plots (findings §60).
 *
 * PURE. No database, no React. The gates, the collapse, the gap detection
 * and the alarm are all decided here so they can be tested against
 * fixtures — the chart component only draws what this returns.
 *
 * THE UNIT IS THE FEED VINTAGE, NOT THE DAY (rule §59). Consecutive
 * snapshots carrying the same `feed_last_imported_at` are ONE observation
 * recorded repeatedly; they collapse to a single point placed at the
 * vintage date, not at any read date.
 */

/** Operator ruling 2026-08-22. BOTH gates must hold. */
export const GATE_A_MIN_VINTAGES = 5;
export const GATE_B_MIN_SPAN_DAYS = 21;

/** Y-axis must span at least ±5% of the median — so a $1 drift on a $500
 * item renders as a $1 drift, not as a cliff produced by auto-fitting the
 * axis to a two-dollar spread. Auto-fit is the commonest way an honest
 * dataset gets drawn dishonestly, and this one sits beside an affiliate
 * link. */
export const Y_AXIS_MIN_HALF_SPAN_RATIO = 0.05;

/** A gap is drawn as a break when it exceeds this multiple of the
 * product's own median inter-vintage interval — so a weekly exporter is
 * not accused of a gap every week, and a daily exporter's three-day
 * silence is not smoothed over. */
export const GAP_MULTIPLE = 2;

export type SeriesPoint = {
  /** ISO date of the merchant's feed export — the x position. */
  date: string;
  price: number;
  /** True when the line must BREAK before this point: the interval since
   * the previous vintage exceeded GAP_MULTIPLE x the median. */
  breakBefore: boolean;
};

export type PriceSeries = {
  points: SeriesPoint[];
  /** Vintages, not days. This is what the caption counts. */
  vintageCount: number;
  spanDays: number;
  gapCount: number;
  medianIntervalDays: number | null;
  yMin: number;
  yMax: number;
  /** True only when BOTH gates hold. The chart renders nothing otherwise
   * — no frame, no skeleton, no "not enough data yet". Absence is silent. */
  eligible: boolean;
  /** Why it is not eligible, for logs and tests. Never rendered. */
  ineligibleReason: string | null;
  /** SAME VINTAGE, TWO PRICES. An alarm, not two data points: the feed
   * did not re-export, so a price change cannot have been observed. Most
   * likely OUR catalog was re-imported underneath it — precisely what
   * migration 0015's catalog_price_at_snapshot comment predicted. Both
   * readings are dropped; neither is silently preferred. */
  conflicts: { date: string; prices: number[] }[];
};

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function buildPriceSeries(
  rows: ProvenancedRow[],
  today: string
): PriceSeries {
  // `conflicts` is threaded through EVERY early return. The first
  // version rebuilt an empty object here and silently discarded the
  // alarms it had just detected — on the one path where a conflict is
  // guaranteed (every vintage conflicted, so nothing is left to plot).
  // An alarm that is computed and then dropped is worse than one never
  // written: the code looks like it reports.
  const empty = (reason: string, conflicts: PriceSeries["conflicts"] = []): PriceSeries => ({
    points: [], vintageCount: 0, spanDays: 0, gapCount: 0,
    medianIntervalDays: null, yMin: 0, yMax: 0,
    eligible: false, ineligibleReason: reason, conflicts,
  });

  const windowStart = new Date(Date.parse(today) - SERIES_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  // 1. Observed rows only, inside the bounded window.
  const observed = rows.filter(
    (r) => isObservedRow(r) && vintageDate(r.feed_last_imported_at as string) >= windowStart
  );
  if (observed.length === 0) return empty("no observed rows with a feed vintage in the window");

  // 2. Collapse to one point per distinct vintage instant. Two snapshots
  //    of one export are one observation.
  const byVintage = new Map<string, Set<number>>();
  for (const r of observed) {
    const key = r.feed_last_imported_at as string;
    if (!byVintage.has(key)) byVintage.set(key, new Set());
    byVintage.get(key)!.add(Number(r.price));
  }

  const conflicts: PriceSeries["conflicts"] = [];
  const collapsed: { date: string; price: number }[] = [];
  for (const [vintage, prices] of [...byVintage.entries()].sort()) {
    if (prices.size > 1) {
      conflicts.push({ date: vintageDate(vintage), prices: [...prices].sort((a, b) => a - b) });
      continue; // plot NEITHER
    }
    collapsed.push({ date: vintageDate(vintage), price: [...prices][0] });
  }

  if (collapsed.length === 0) {
    return empty("every vintage in the window was a same-vintage price conflict", conflicts);
  }

  // GATE A COUNTS EXPORTS, NOT DATES. A merchant re-exporting five times
  // in two days HAS made five exports — gate A is satisfied and gate B is
  // what must reject it, which is the operator's stated reason for having
  // both. Counting dates here would have let gate A do gate B's job and
  // silently weakened the pair. (First implementation got this wrong; the
  // "5 exports over 2 days" fixture caught it.)
  const vintageCount = collapsed.length;

  // PLOTTING collapses by date, because two points cannot share an x on a
  // date axis. The day's LAST export wins — it is the price that stood at
  // the end of that day.
  const byDate = new Map<string, number>();
  for (const c of collapsed) byDate.set(c.date, c.price); // sorted asc, so last wins
  const dated = [...byDate.entries()]
    .map(([date, price]) => ({ date, price }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const spanDays = dayDiff(dated[0].date, dated[dated.length - 1].date);

  // 3. Gaps, measured against this product's own cadence.
  const intervals: number[] = [];
  for (let i = 1; i < dated.length; i++) intervals.push(dayDiff(dated[i - 1].date, dated[i].date));
  const sorted = [...intervals].sort((a, b) => a - b);
  const medianIntervalDays = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : null;

  let gapCount = 0;
  const points: SeriesPoint[] = dated.map((d, i) => {
    if (i === 0 || medianIntervalDays === null) return { ...d, breakBefore: false };
    const isGap = intervals[i - 1] > GAP_MULTIPLE * Math.max(medianIntervalDays, 1);
    if (isGap) gapCount++;
    return { ...d, breakBefore: isGap };
  });

  // 4. Y range: never auto-fit tighter than +/-5% of the median price.
  const prices = points.map((p) => p.price).sort((a, b) => a - b);
  const median = prices.length % 2
    ? prices[(prices.length - 1) / 2]
    : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
  const dataMin = prices[0];
  const dataMax = prices[prices.length - 1];
  const floor = median * (1 - Y_AXIS_MIN_HALF_SPAN_RATIO);
  const ceil = median * (1 + Y_AXIS_MIN_HALF_SPAN_RATIO);
  const yMin = Math.min(dataMin, floor);
  const yMax = Math.max(dataMax, ceil);

  // 5. Gates. BOTH, measured inside the window.
  let ineligibleReason: string | null = null;
  if (vintageCount < GATE_A_MIN_VINTAGES) {
    ineligibleReason = `gate A: ${vintageCount} distinct feed vintages, need ${GATE_A_MIN_VINTAGES}`;
  } else if (spanDays < GATE_B_MIN_SPAN_DAYS) {
    ineligibleReason = `gate B: ${spanDays}-day span, need ${GATE_B_MIN_SPAN_DAYS}`;
  }

  return {
    points, vintageCount, spanDays, gapCount, medianIntervalDays,
    yMin, yMax,
    eligible: ineligibleReason === null,
    ineligibleReason,
    conflicts,
  };
}

/** The caption, in the merchant's own units. Counts EXPORTS, never days —
 * saying "unchanged for 14 days" when the feed exported four times would
 * assert ten confirmations nobody made (§59). */
export function seriesCaption(series: PriceSeries): string {
  const changed = new Set(series.points.map((p) => p.price)).size > 1;
  const first = series.points[0]?.date;
  const exports = `${series.vintageCount} feed export${series.vintageCount === 1 ? "" : "s"}`;
  const gaps = series.gapCount
    ? ` ${series.gapCount} gap${series.gapCount === 1 ? "" : "s"} where no export was recorded.`
    : "";
  return changed
    ? `Across ${exports} since ${first}.${gaps}`
    : `Unchanged across ${exports} since ${first}.${gaps}`;
}
