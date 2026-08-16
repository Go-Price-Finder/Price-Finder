"use client";

import { useEffect, useState } from "react";
import { getCreateClient } from "@/lib/supabase/lazy-client";
import { formatPrice } from "@/lib/format-price";
import { HistoryIcon } from "./icons";
import type { WishlistRetailerId } from "@/lib/types";

type PriceHistoryRow = {
  price: number;
  recorded_date: string;
};

/**
 * Full price-history chart for a product detail page — the
 * camelcamelcamel-style feature this site was missing (see
 * claude/website-redesign-scale-architecture-plan-2026-08-03.md, Section
 * 4). Reads real rows from public.price_history (populated daily by
 * app/api/cron/snapshot-prices/route.ts, live since 2026-08-02/03), not
 * fabricated data — this site has a standing principle of never inventing
 * price trends (see PriceHistorySparkline.tsx's own comment on the same
 * issue for card previews).
 *
 * Queried client-side via the lazy Supabase browser client
 * (lib/supabase/lazy-client.ts) rather than as a server-rendered prop,
 * because every product page here is statically generated
 * (generateStaticParams, no revalidate) — a server-side fetch would bake
 * in whatever history existed at build time and never update between
 * deploys. A client fetch against price_history's public read-only RLS
 * policy (supabase/migrations/0005_add_price_history.sql) always shows
 * today's real data regardless of when the page was last built. This
 * mirrors the same lazy-import discipline as PriceAlertCTA.tsx and the
 * wishlist/auth providers — see lazy-client.ts's own comment for why
 * statically importing the Supabase SDK here would regress bundle size
 * on every one of the site's product page templates.
 *
 * Site launched 2026-08-02/03, so most products will have only a handful
 * of days of real history for a while. Below MIN_POINTS_FOR_CHART, this
 * intentionally falls back to the same honest "tracking since launch, no
 * chart yet" framing as PriceHistorySparkline rather than rendering a
 * misleading two-pixel line — once real history accumulates, swap the
 * card preview's sparkline too (out of scope here, tracked separately).
 */
const MIN_POINTS_FOR_CHART = 3;
const LOOKBACK_DAYS = 90;

/**
 * INCIDENT SUPPRESSION — 2026-08-16. Do not flip this back without reading
 * claude/incident-2026-08-16-price-history-chart.md.
 *
 * The header comment below says this chart shows "real rows, not fabricated
 * data." That is true of its INPUTS and false of its OUTPUT: price_history
 * has never held an observed merchant price — the snapshot cron records our
 * own static display price daily (the current_prices merge in
 * lib/pricing/getEffectivePrice.ts has never hit; see
 * claude/pricing-pipeline-findings-2026-08-16.md). Every chart therefore
 * asserted a price history nobody measured, and five king-koil products
 * rendered movement that was actually the 87877a2 catalog rewrite (worst:
 * pump-7, "Lowest $79.95" against a current $179.95 — a 55.6% swing no
 * customer could have transacted at). The 949 flat charts asserted 13 days
 * of price stability we never observed, which is the same fabrication with
 * a calmer face.
 *
 * RESTORE CONDITION: price_history rows carry provenance distinguishing
 * observed merchant prices from display-price snapshots and catalog-rewrite
 * artifacts, and the chart reads only observed rows. The merge fix alone is
 * NOT sufficient — it changes what future rows mean, not what the table
 * already contains.
 */
const PRICE_HISTORY_CHART_SUPPRESSED = true;

export default function PriceHistoryChart(props: {
  productId: string;
  retailer: WishlistRetailerId;
  currentPrice: number;
}) {
  // Gate lives in this hook-free wrapper so the suppressed path mounts
  // nothing and fetches nothing (an early return inside the inner component
  // would violate rules-of-hooks).
  if (PRICE_HISTORY_CHART_SUPPRESSED) return null;
  return <PriceHistoryChartInner {...props} />;
}

function PriceHistoryChartInner({
  productId,
  retailer,
  currentPrice,
}: {
  productId: string;
  retailer: WishlistRetailerId;
  currentPrice: number;
}) {
  const [rows, setRows] = useState<PriceHistoryRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getCreateClient()
      .then((createClient) => {
        const supabase = createClient();
        const since = new Date();
        since.setDate(since.getDate() - LOOKBACK_DAYS);

        return supabase
          .from("price_history")
          .select("price, recorded_date")
          .eq("product_id", productId)
          .eq("retailer", retailer)
          .gte("recorded_date", since.toISOString().slice(0, 10))
          .order("recorded_date", { ascending: true });
      })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) {
          setError(true);
          return;
        }
        setRows(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [productId, retailer]);

  // Loading state — same shape/height as the eventual chart so there's no
  // layout shift once data arrives.
  if (rows === null && !error) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-noir-600 bg-noir-800/50 px-3 py-4">
        <div className="h-4 w-4 animate-pulse rounded-full bg-ivory-400/30" />
        <span className="text-xs text-ivory-400">Loading price history…</span>
      </div>
    );
  }

  if (error || !rows || rows.length < MIN_POINTS_FOR_CHART) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-noir-600 bg-noir-800/50 px-3 py-3">
        <HistoryIcon className="h-4 w-4 shrink-0 text-ivory-400" />
        <span className="text-xs font-medium text-ivory-400">
          Price tracking just started for this item — check back soon for a full history chart.
        </span>
      </div>
    );
  }

  const prices = rows.map((r) => r.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const range = high - low || 1; // avoid div-by-zero when every point is equal

  const width = 320;
  const height = 72;
  const padX = 4;
  const padY = 8;

  const points = rows.map((r, i) => {
    const x = rows.length === 1 ? padX : padX + (i / (rows.length - 1)) * (width - padX * 2);
    const y = padY + (1 - (r.price - low) / range) * (height - padY * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = points[points.length - 1];

  const belowAverage = currentPrice < average;
  const atHistoricalLow = currentPrice <= low + 0.01;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-noir-600 bg-noir-800/50 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ivory-400">
        <HistoryIcon className="h-3.5 w-3.5" />
        Price history — last {LOOKBACK_DAYS} days
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-16 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={polyline}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gilt-500"
        />
        <circle cx={last.x} cy={last.y} r="3.5" className="fill-gilt-500" />
      </svg>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ivory-300">
        <span>
          Lowest: <span className="font-semibold text-ivory-100">{formatPrice(low)}</span>
        </span>
        <span>
          Average: <span className="font-semibold text-ivory-100">{formatPrice(average)}</span>
        </span>
        <span>
          Highest: <span className="font-semibold text-ivory-100">{formatPrice(high)}</span>
        </span>
      </div>

      {atHistoricalLow ? (
        <p className="text-xs font-medium text-gilt-400">
          This is the lowest price we&rsquo;ve tracked in the last {LOOKBACK_DAYS} days.
        </p>
      ) : belowAverage ? (
        <p className="text-xs font-medium text-gilt-400">
          Today&rsquo;s price is {Math.round((1 - currentPrice / average) * 100)}% below the{" "}
          {LOOKBACK_DAYS}-day average.
        </p>
      ) : null}
    </div>
  );
}
