import { formatAsOfDate, getPriceAsOf } from "@/lib/price-as-of";

/**
 * The honesty label under every displayed price: when this price was last
 * verified against the partner's data. Decided 2026-08-17 (see
 * claude/pricing-pipeline-findings-2026-08-16.md, "Remedy decision" and
 * §6): the page previously implied a currency it didn't have — no price
 * anywhere on the site said when it was last verified. This converts a
 * hidden error into one the customer can evaluate, and it is truthful at
 * $6 of drift or three months of it.
 *
 * Server component, zero client JS. Renders nothing for an unknown
 * partner rather than guessing a date.
 */
export default function PriceAsOfLabel({ partnerId }: { partnerId: string }) {
  const iso = getPriceAsOf(partnerId);
  if (!iso) return null;
  return (
    <p className="mt-1.5 text-xs text-ivory-400">
      Price as of {formatAsOfDate(iso)}
    </p>
  );
}
