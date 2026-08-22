import { formatAsOfDate } from "@/lib/price-as-of";

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
 * NO FALLBACK VINTAGE, AS OF 2026-08-22 (§76). Until today, a product
 * without a live vintage fell back to FEED_VINTAGE — a hand-maintained
 * constant in lib/price-as-of.ts, frozen at import time. That constant
 * had read "2026-07-25" for ~298 products whose feeds had exported six
 * hours earlier, because it only changes when a human edits a file.
 *
 * §59 says a record of when we LOOKED is not a record of when it
 * CHANGED. A hardcoded literal is neither: it is a record of when
 * someone last edited a file. Migration 0023 already wrote the correct
 * rule one layer down — "A live price with NULL here renders no stamp --
 * never fall back to the catalog vintage" — and this is that rule
 * finally applied at the layer above it.
 *
 * PROMINENCE (2026-08-20, §45). This used to render as 11px dim grey text
 * tucked under the price — visually an apology for the price rather than
 * a reason to trust it. It is now a stamp: accent-ringed pill, primary
 * text colour, semibold, with a clock glyph. Nothing about what it CLAIMS
 * changed, and deliberately so — the wording stays "Price as of", because
 * the date is the source feed's VINTAGE, not a moment we checked. Writing
 * "Price checked <date>" would have been the more confident-sounding
 * phrase and a smaller version of exactly the defect this label exists to
 * fix. Style got louder; the claim did not move.
 */

function ClockGlyph() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" />
    </svg>
  );
}

/** Shared presentation so the detail page and the product card carry the
 * SAME stamp. Two components drifting apart is how a trust signal starts
 * reading as decoration on one surface and a warning on the other. */
export function PriceAsOfStamp({
  iso,
  label = "Price as of",
}: {
  iso: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gilt-500/10 px-2.5 py-1 ring-1 ring-inset ring-gilt-500/25">
      <ClockGlyph />
      <span className="type-meta font-semibold tabular-nums">
        {label} {formatAsOfDate(iso)}
      </span>
    </span>
  );
}

/**
 * ONE LABEL, BOTH SOURCES (operator ruling 2026-08-21, §55).
 *
 * "Price as of {date}" — for a catalog price and a live price alike.
 * What changes between them is which date fills the slot, not what the
 * sentence claims. There is no second wording to approve.
 *
 * THE DATE IS ALWAYS THE FEED VINTAGE — the merchant's own export
 * timestamp for the feed behind that price — never our read time. This
 * is why "Price checked", which this file proposed, was rejected:
 * `current_prices.updated_at` records when WE read the feed. A price
 * read on the 20th from a feed exported on the 14th is a
 * 14th-of-August price, and "Price checked 20 August" would overstate
 * freshness by six days — the catalog overstatement inverted.
 *
 * A consequence worth stating, because it disposes of the
 * static-generation worry from §54: because this label names a DATE
 * rather than claiming currency, a stale build degrades honestly on its
 * own. A date four days old simply reads as four days old.
 */
const AS_OF_LABEL = "Price as of";

/**
 * The ONE place that decides which stamp a product gets. Both surfaces
 * call it — the detail page via PriceAsOfLabel, the grid card directly —
 * because a live price with a catalog stamp on one surface and a live
 * stamp on the other is worse than either alone.
 *
 * Caught during the §54 build: the flagged merge changed the PRICE on
 * the page while the label kept its catalog date, reproducing precisely
 * the defect the flag exists to prevent, at 260-stamp scale, inside the
 * change meant to prevent it. Keep this as the single decision point.
 */
export function resolveAsOfStamp(product: {
  partnerId: string;
  slug: string;
  priceSource?: "catalog" | "live";
  priceFeedVintage?: string | null;
}): { iso: string; label: string } | null {
  // ONE SOURCE, NO FALLBACK. A stamp requires a real feed vintage that
  // travelled with the price (§63). Anything else renders nothing.
  //
  // `partnerId` and `slug` are retained in the signature deliberately:
  // every caller already passes them, and keeping them makes the
  // no-fallback decision visible AT the point where the old fallback
  // used to happen rather than silently absent from the call sites.
  // They are not read. If a future change wants them, it wants a
  // fallback, and it must reopen §76 first.
  return product.priceFeedVintage
    ? { iso: product.priceFeedVintage.slice(0, 10), label: AS_OF_LABEL }
    : null;
}

export default function PriceAsOfLabel({
  partnerId,
  slug,
  priceSource,
  priceFeedVintage,
}: {
  partnerId: string;
  slug: string;
  /** Present only when the live-price merge ran (LIVE_PRICES=1). */
  priceSource?: "catalog" | "live";
  priceFeedVintage?: string | null;
}) {
  const stamp = resolveAsOfStamp({ partnerId, slug, priceSource, priceFeedVintage });
  if (!stamp) return null;
  return (
    <p className="mt-3 text-ivory-50">
      <PriceAsOfStamp iso={stamp.iso} label={stamp.label} />
    </p>
  );
}
