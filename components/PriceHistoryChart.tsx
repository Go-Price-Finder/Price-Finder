"use client";

import { useEffect, useState } from "react";
import { getCreateClient } from "@/lib/supabase/lazy-client";
import { formatPrice } from "@/lib/format-price";
import { buildPriceSeries, seriesCaption, type PriceSeries } from "@/lib/pricing/priceSeries";
import { SERIES_WINDOW_DAYS, type ProvenancedRow } from "@/lib/pricing/provenance";
import type { WishlistRetailerId } from "@/lib/types";

/**
 * Price history for a product detail page — RESTORED under the condition
 * written into its own suppression, and shipped behind a flag that is OFF
 * (findings §60).
 *
 * THE SUPPRESSION IT REPLACES (2026-08-16,
 * claude/incident-2026-08-16-price-history-chart.md). The previous
 * version's header claimed it showed "real rows, not fabricated data".
 * That was true of its INPUTS and false of its OUTPUT: price_history held
 * our own display price snapshotted daily, so 949 products rendered flat
 * lines asserting ~13 days of stability nobody measured, and five
 * king-koil products rendered movement that was the 87877a2 catalog
 * rewrite — worst, pump-7 showing "Lowest $79.95" against a current
 * $179.95, a 55.6% advantage at a price no customer could ever transact.
 *
 * Its stated restore condition was TWO things, and both now hold:
 *   1. rows carry provenance distinguishing observed merchant prices from
 *      display-price snapshots and catalog-rewrite artifacts — since
 *      2026-08-21 every row carries feed_id and feed_last_imported_at;
 *   2. the chart reads only observed rows, "or rows after a recorded
 *      cutover date" — PROVENANCE_CUTOVER_DATE is that date.
 *
 * WHAT THIS DRAWS, and the rule behind it (§59): a record of when we
 * LOOKED is not a record of when it CHANGED. The x unit is the merchant's
 * own feed export, never our snapshot schedule. Fourteen daily reads of
 * four exports are four points, not fourteen — plotting fourteen would
 * assert ten confirmations nobody made, which is the same defect the
 * suppression was for, drawn more diligently.
 *
 * NO LOADING STATE, DELIBERATELY. A product that fails the gates renders
 * NOTHING — no frame, no skeleton, no "not enough data yet". A skeleton
 * would promise a chart before we know one is warranted, and then either
 * flash away or harden into a placeholder that advertises absence. Most
 * of the catalog will be ineligible for weeks; absence is silent.
 */

/** OFF. Flip only when all four ship conditions hold, verified against
 * production data: a product passes both gates and its chart has been
 * read; the NULL-vintage exclusion has been EXERCISED on a real product;
 * the stamp/last-point equality test is green across the full catalog;
 * and an ineligible product renders nothing at all. */
const CHART_ENABLED = process.env.NEXT_PUBLIC_PRICE_HISTORY_CHART === "1";

export default function PriceHistoryChart(props: {
  productId: string;
  retailer: WishlistRetailerId;
  currentPrice: number;
}) {
  // Gate in a hook-free wrapper so the disabled path mounts nothing and
  // fetches nothing (an early return inside the inner component would
  // violate rules-of-hooks).
  if (!CHART_ENABLED) return null;
  return <PriceHistoryChartInner {...props} />;
}

function PriceHistoryChartInner({
  productId,
  retailer,
}: {
  productId: string;
  retailer: WishlistRetailerId;
  currentPrice: number;
}) {
  const [series, setSeries] = useState<PriceSeries | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCreateClient()
      .then((createClient) => {
        const supabase = createClient();
        const since = new Date();
        since.setDate(since.getDate() - SERIES_WINDOW_DAYS);
        // Bounded by (product_id, retailer) over a 90-day window, and the
        // table's PK is (product_id, retailer, recorded_date) — at most
        // one row per day, so <= 90 rows regardless of table size.
        return supabase
          .from("price_history")
          .select("price, recorded_date, feed_id, feed_last_imported_at")
          .eq("product_id", productId)
          .eq("retailer", retailer)
          .gte("recorded_date", since.toISOString().slice(0, 10))
          .order("recorded_date", { ascending: true });
      })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const built = buildPriceSeries(
          data as unknown as ProvenancedRow[],
          new Date().toISOString().slice(0, 10)
        );
        // SAME VINTAGE, TWO PRICES. The feed did not re-export, so a price
        // change cannot have been observed — most likely our own catalog
        // was re-imported underneath it. Neither reading is plotted; this
        // surfaces it rather than letting it vanish.
        if (built.conflicts.length > 0) {
          console.warn(
            `[price-history] same-vintage price conflict on ${productId}:`,
            built.conflicts
          );
        }
        setSeries(built);
      })
      .catch(() => {
        /* silence: absence is the correct rendering for an error too */
      });

    return () => {
      cancelled = true;
    };
  }, [productId, retailer]);

  if (!series || !series.eligible || series.points.length === 0) return null;

  return <Chart series={series} />;
}

const W = 560;
const H = 140;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 22;

function Chart({ series }: { series: PriceSeries }) {
  const { points, yMin, yMax } = series;
  const first = Date.parse(points[0].date);
  const last = Date.parse(points[points.length - 1].date);
  const spanMs = Math.max(last - first, 1);

  // DATE AXIS, never an index axis. Index-plotting silently compresses a
  // missing day into a smooth line, which is the classic way a gap
  // disappears. Here a gap occupies real horizontal space.
  const x = (d: string) => PAD_L + ((Date.parse(d) - first) / spanMs) * (W - PAD_L - PAD_R);
  const y = (p: number) => PAD_T + (1 - (p - yMin) / Math.max(yMax - yMin, 0.01)) * (H - PAD_T - PAD_B);

  // Break the path wherever the series says to. Separate <path>s rather
  // than one path with a Move, so nothing can accidentally join them.
  const segments: string[] = [];
  let current: string[] = [];
  for (const p of points) {
    if (p.breakBefore && current.length) {
      segments.push(current.join(" "));
      current = [];
    }
    current.push(`${current.length ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.price).toFixed(1)}`);
  }
  if (current.length) segments.push(current.join(" "));

  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <figure className="flex flex-col gap-2 rounded-2xl border border-gilt-500/20 bg-noir-800 p-4">
      <figcaption className="type-meta text-ivory-300">{seriesCaption(series)}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Price history: ${seriesCaption(series)} Range ${formatPrice(yMin)} to ${formatPrice(yMax)}.`}
      >
        {/* y bounds, labelled, so the reader can see the scale is not fitted to the noise */}
        {[yMax, yMin].map((v, i) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="currentColor" strokeWidth="1" className="text-gilt-500/15" />
            <text x={PAD_L - 6} y={y(v) + (i === 0 ? 4 : 0)} textAnchor="end" className="fill-ivory-400 text-[10px] tabular-nums">
              {formatPrice(v)}
            </text>
          </g>
        ))}
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gilt-500" />
        ))}
        {points.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.price)} r="2.5" className="fill-gilt-400">
            <title>{`${fmt(p.date)} — ${formatPrice(p.price)} (feed export)`}</title>
          </circle>
        ))}
        <text x={PAD_L} y={H - 6} className="fill-ivory-400 text-[10px]">{fmt(points[0].date)}</text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" className="fill-ivory-400 text-[10px]">
          {fmt(points[points.length - 1].date)}
        </text>
      </svg>
    </figure>
  );
}
