/**
 * Price history strip for a real product card. Price Finder only just
 * launched, so every real product currently has exactly one price data
 * point — rather than fabricate a fake multi-point trend line (which the
 * rest of this site has deliberately avoided doing, see lib/data.ts's
 * sanitization notes), this renders an honest flat line with a single
 * "today" marker and a plain-language caption. Once a product has real
 * price history (multiple recorded prices over time), swap the flat line
 * for an actual polyline plotted from that data — the SVG viewBox/marker
 * setup here is already shaped to make that a drop-in change.
 */
export default function PriceHistorySparkline({
  price,
  originalPrice,
}: {
  price: number;
  originalPrice?: number;
}) {
  const hasDiscount = typeof originalPrice === "number" && originalPrice > price;

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-noir-600 bg-noir-800/50 px-2.5 py-2">
      <svg
        width="48"
        height="20"
        viewBox="0 0 48 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        <line
          x1="2"
          y1="10"
          x2="46"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="2 3"
          className="text-ivory-400/50"
        />
        <circle cx="46" cy="10" r="3" className="fill-gilt-500" />
      </svg>
      {/* Copy fixed 2026-08-19 (findings §25). The old captions made two
          false observation claims: "1 price drop ($X → $Y)" presented the
          FEED'S OWN MARKDOWN (originalPrice) as a drop we observed over
          time — we never observed the higher price — and "no price
          changes yet" was false for products where the daily refresh has
          recorded real changes. This card only knows price/originalPrice,
          so it now claims exactly what those fields support: a store
          markdown, and a true statement about what is coming.

          COUPLED TO A FLAG THAT IS OFF (§62). "Charts are on the way" is
          only true while PriceHistoryChart is actually on its way; that
          component is gated by NEXT_PUBLIC_PRICE_HISTORY_CHART, OFF, per
          claude/incident-2026-08-16-price-history-chart.md. If that flag
          is abandoned rather than flipped, this sentence becomes a
          standing promise nobody is keeping — delete it then, do not
          leave it. */}
      <span className="text-xs font-medium text-ivory-400">
        {hasDiscount
          ? `Marked down by the store: $${originalPrice} → $${price}`
          : "Price history charts are on the way"}
      </span>
    </div>
  );
}
