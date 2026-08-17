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
 *
 * Takes the product slug because as-of is a property of the SOURCE FEED,
 * not the partner — tsar-bomba draws from two feeds with vintages 79 days
 * apart (see lib/price-as-of.ts).
 */
export default function PriceAsOfLabel({
  partnerId,
  slug,
}: {
  partnerId: string;
  slug: string;
}) {
  const iso = getPriceAsOf(partnerId, slug);
  if (!iso) return null;
  return (
    <p className="mt-1.5 text-xs text-ivory-400">
      Price as of {formatAsOfDate(iso)}
    </p>
  );
}
