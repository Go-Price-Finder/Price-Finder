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
    <div className="flex items-center gap-2 rounded-xl border border-noir-600 bg-noir-800/50 px-2.5 py-2">
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
      <span className="text-xs font-medium text-ivory-400">
        {hasDiscount
          ? `Tracking since launch — 1 price drop ($${originalPrice} → $${price})`
          : "Tracking since launch — no price changes yet"}
      </span>
    </div>
  );
}
