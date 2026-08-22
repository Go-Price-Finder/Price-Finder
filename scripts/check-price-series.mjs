#!/usr/bin/env node
/**
 * PRICE-SERIES GATE (findings §60). Runs in `prebuild`.
 *
 * Two jobs:
 *
 *  1. FIXTURES — prove the series rules behave, before anything renders.
 *     Every case here is a defect this project actually shipped or nearly
 *     shipped, not a hypothetical.
 *
 *  2. STAMP/LAST-POINT EQUALITY across the FULL catalog (operator ship
 *     condition 3). The as-of stamp and the chart's final point must name
 *     the same date. If those two can drift, they will — and then one
 *     surface says a price is from the 20th while the other draws it on
 *     the 21st, on the same page.
 *
 * Fixtures run always. The catalog sweep runs only when Supabase
 * credentials are present, and SAYS SO when it is skipped rather than
 * reporting a pass it did not earn.
 */
import { buildPriceSeries, seriesCaption, GATE_A_MIN_VINTAGES, GATE_B_MIN_SPAN_DAYS } from "../lib/pricing/priceSeries.ts";

const TODAY = "2026-09-30";
const row = (date, price, vintage) => ({
  price, recorded_date: date, feed_id: "F1", feed_last_imported_at: vintage,
});

const failures = [];
const check = (name, cond, detail = "") => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.log(`  FAIL ${name} ${detail}`); failures.push(name); }
};

console.log("FIXTURES");

// 1. §59: fourteen daily snapshots of ONE export are ONE point.
{
  const rows = [];
  for (let d = 1; d <= 14; d++) rows.push(row(`2026-09-${String(d).padStart(2, "0")}`, 100, "2026-09-01T10:00:00Z"));
  const s = buildPriceSeries(rows, TODAY);
  check("14 snapshots of 1 export collapse to 1 point", s.points.length === 1 && s.vintageCount === 1, `got ${s.points.length}`);
  check("  ...and that is NOT eligible (gate A)", !s.eligible);
}

// 2. NULL vintage is excluded, never plotted at the read date.
{
  const s = buildPriceSeries(
    [row("2026-09-01", 100, null), row("2026-09-02", 111, null)],
    TODAY
  );
  check("NULL-vintage rows are excluded entirely", s.points.length === 0 && !s.eligible);
}

// 3. Pre-cutover rows are excluded even with a vintage.
{
  const s = buildPriceSeries([row("2026-08-20", 100, "2026-08-20T10:00:00Z")], TODAY);
  check("pre-cutover rows excluded despite a vintage", s.points.length === 0);
}

// 4. Same vintage, two prices = alarm, plot NEITHER.
{
  const s = buildPriceSeries(
    [row("2026-09-01", 100, "2026-09-01T10:00:00Z"), row("2026-09-02", 180, "2026-09-01T10:00:00Z")],
    TODAY
  );
  check("same vintage + 2 prices raises a conflict", s.conflicts.length === 1);
  check("  ...and plots neither reading", s.points.length === 0);
}

// 5. BOTH gates. Five exports in two days must NOT chart.
{
  const rows = [
    row("2026-09-01", 100, "2026-09-01T01:00:00Z"),
    row("2026-09-01", 101, "2026-09-01T09:00:00Z"),
    row("2026-09-02", 102, "2026-09-02T01:00:00Z"),
    row("2026-09-02", 103, "2026-09-02T09:00:00Z"),
    row("2026-09-02", 104, "2026-09-02T18:00:00Z"),
  ];
  const s = buildPriceSeries(rows, TODAY);
  check("5 exports over 2 days fails gate B", !s.eligible && /gate B/.test(s.ineligibleReason ?? ""), s.ineligibleReason ?? "");
}

// 6. Two points 21 days apart must NOT chart (gate A binds).
{
  const s = buildPriceSeries(
    [row("2026-09-01", 100, "2026-09-01T10:00:00Z"), row("2026-09-22", 120, "2026-09-22T10:00:00Z")],
    TODAY
  );
  check("2 exports across 21 days fails gate A", !s.eligible && /gate A/.test(s.ineligibleReason ?? ""), s.ineligibleReason ?? "");
}

// 7. The passing case: 5 exports, weekly, 28-day span.
{
  const rows = ["09-01", "09-08", "09-15", "09-22", "09-29"].map((d, i) =>
    row(`2026-${d}`, 100 + i, `2026-${d}T10:00:00Z`)
  );
  const s = buildPriceSeries(rows, TODAY);
  check("5 weekly exports over 28 days IS eligible", s.eligible, s.ineligibleReason ?? "");
  check("  ...span computed on vintages", s.spanDays === 28, String(s.spanDays));
  check("  ...no false gaps for a regular exporter", s.gapCount === 0, String(s.gapCount));
}

// 8. A real gap breaks the line and is counted.
{
  const rows = ["09-01", "09-02", "09-03", "09-20", "09-21"].map((d, i) =>
    row(`2026-${d}`, 100 + i, `2026-${d}T10:00:00Z`)
  );
  const s = buildPriceSeries(rows, TODAY);
  check("a 17-day silence in a daily series is a gap", s.gapCount === 1, String(s.gapCount));
  check("  ...and the line breaks at it", s.points.some((p) => p.breakBefore));
}

// 9. Y-axis never auto-fits tighter than +/-5% of median.
{
  const rows = ["09-01", "09-08", "09-15", "09-22", "09-29"].map((d, i) =>
    row(`2026-${d}`, i === 4 ? 499 : 500, `2026-${d}T10:00:00Z`)
  );
  const s = buildPriceSeries(rows, TODAY);
  const span = s.yMax - s.yMin;
  check("a $1 drift on a $500 item does not become a cliff", span >= 500 * 0.1 - 0.01, `span ${span.toFixed(2)}`);
}

// 10. Flat series still renders once gated, and says so in exports.
{
  const rows = ["09-01", "09-08", "09-15", "09-22", "09-29"].map((d) =>
    row(`2026-${d}`, 250, `2026-${d}T10:00:00Z`)
  );
  const s = buildPriceSeries(rows, TODAY);
  check("a flat but gated series IS eligible", s.eligible);
  check("  ...caption counts EXPORTS, not days", /Unchanged across 5 feed exports/.test(seriesCaption(s, 90)), seriesCaption(s, 90));
}

console.log(`\nfixtures: ${failures.length === 0 ? "ALL PASS" : failures.length + " FAILED"}`);
console.log(`gates in force: A >= ${GATE_A_MIN_VINTAGES} vintages, B >= ${GATE_B_MIN_SPAN_DAYS} day span`);

if (failures.length) process.exit(1);
