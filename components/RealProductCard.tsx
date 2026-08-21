import Image from "next/image";
import Link from "next/link";
import type { RealProduct } from "@/lib/partners";
import { StarIcon } from "./icons";
import { PriceAsOfStamp, resolveAsOfStamp } from "./PriceAsOfLabel";
import PriceHistorySparkline from "./PriceHistorySparkline";
import WishlistButton from "./WishlistButton";
import type { WishlistRetailerId } from "@/lib/types";

/**
 * Card for any real, live product (lib/partners.ts's normalized
 * RealProduct — partner-agnostic by design, so Brooklyn Delhi, EVDANCE,
 * and Golden Maple products all render identically). Replaces the old
 * Brooklyn-Delhi-specific BrooklynDelhiCard now that more than one section
 * (homepage, partner pages, /search, /category) needs the same
 * real-product card.
 *
 * A single "View" button goes to this product's own detail page on Price
 * Finder — that page is where the explicit choice to continue to the
 * partner's store lives (its "View on [Partner]" button), not the card
 * itself. Naming a specific retailer on every card in a grid of dozens
 * added noise without adding a decision the shopper needed to make yet;
 * the card's job is just to get them to the one product they clicked.
 *
 * Every optional row below (rating, price-history) reserves its height
 * even when that product has no data for it, instead of only rendering
 * conditionally — that's what keeps every card the same height in a row
 * or grid, regardless of which products happen to have a rating yet.
 *
 * No "multiple retailers" indicator: RealProduct doesn't model alternate
 * listings for the same item yet (every product currently has exactly one
 * partner and one price). Add that back once the data actually supports
 * more than one retailer selling the same product — showing it now would
 * be exactly the kind of fabricated claim the rest of this site has
 * deliberately avoided.
 */
export default function RealProductCard({
  product,
  priority = false,
}: {
  product: RealProduct;
  /** Set for roughly the first row of a grid (see call sites) — the LCP
   * candidate on every listing page is whichever card lands top-left, and
   * without this next/image applies loading="lazy" + no preload link to
   * it like every other card, which is exactly what was inflating LCP
   * (confirmed via real DOM inspection on production, not assumed).
   * Deliberately NOT the default for every card: that would just move the
   * network congestion from "nothing prioritized" to "everything
   * prioritized," the same problem in a different shape. */
  priority?: boolean;
}) {
  const hasDiscount =
    typeof product.originalPrice === "number" &&
    product.originalPrice > product.price;

  // The as-of stamp belongs on the CARD too, not only the detail page
  // (§45). A price with no date on it is the same implied-currency defect
  // §6 removed from detail pages, and the grid is where most visitors
  // meet a price first. Same component as the detail page uses, so the
  // two surfaces cannot drift.
  const asOf = resolveAsOfStamp(product);

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gilt-500/25 bg-noir-800 shadow-soft transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-soft">
      {/* The image itself is the only thing inside the link — the badge and
          wishlist button are absolutely-positioned siblings, not
          descendants, since nesting a <button> inside an <a> is invalid
          HTML and would break their independent click handling. */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f4f4f2] ring-1 ring-inset ring-gilt-500/25">
        <Link href={product.href} aria-label={product.name} className="absolute inset-0 block">
          <Image
            src={product.image}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-contain p-4 transition-transform duration-300 ease-out group-hover:scale-105"
          />
        </Link>

        {product.badge && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-gilt-500 px-2.5 py-1 text-[11px] font-semibold text-accent-ink shadow-soft">
            {product.badge}
          </span>
        )}

        <WishlistButton
          productId={product.id}
          retailer={product.partnerId as WishlistRetailerId}
          currentPrice={product.price}
          className="absolute bottom-3 right-3"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-ivory-400">
            {product.category}
          </span>
          <span className="text-[11px] font-medium text-ivory-400">
            {product.partnerName}
          </span>
        </div>

        {/* Name and price share a row so the two most important facts
            about the product line up on the same baseline. min-h reserves
            2 lines' worth of space for the name regardless of whether it
            wraps, so every card in a row lines up. */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={product.href}
            className="line-clamp-2 min-h-[2.75rem] flex-1 font-display text-base font-semibold leading-snug text-ivory-50 transition-colors hover:text-gilt-400"
          >
            {product.name}
          </Link>
          <div className="shrink-0 text-right">
            <span className="font-display text-lg font-semibold tabular-nums text-price-text">
              ${product.price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="ml-1.5 text-xs tabular-nums text-ivory-400 line-through">
                ${(product.originalPrice as number).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Reserved-height row, same discipline as the rating row below:
            a partner with no known feed vintage renders no stamp, and
            without the reserve its card would come out shorter than the
            rest of the grid. */}
        <div className="flex h-7 items-center text-ivory-50">
          {asOf && <PriceAsOfStamp iso={asOf.iso} label={asOf.label} />}
        </div>

        {/* Fixed-height row whether or not this product has a rating yet,
            so cards without one (still early in the catalog) don't come
            out shorter than cards that do. */}
        <div className="flex h-5 items-center gap-1.5">
          {product.rating ? (
            <>
              <StarIcon className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">
                {product.rating.stars}
              </span>
              <span className="text-xs text-ivory-400">
                ({product.rating.count})
              </span>
            </>
          ) : (
            <span className="text-xs text-ivory-400">No ratings yet</span>
          )}
        </div>

        <PriceHistorySparkline
          price={product.price}
          originalPrice={product.originalPrice}
        />

        {/* Single "View" button — the choice to continue to the specific
            partner/retailer is offered on the product detail page this
            links to, not here. mt-auto pins this to the bottom of the
            card regardless of how much space the content above takes up. */}
        <div className="mt-auto pt-1">
          <Link
            href={product.href}
            className="block w-full rounded-full bg-gilt-500 px-3 py-2 text-center text-xs font-semibold text-accent-ink transition-colors hover:bg-gilt-400"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
