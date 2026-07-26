import Image from "next/image";
import Link from "next/link";
import type { RealProduct } from "@/lib/partners";
import { ExternalLinkIcon, StarIcon } from "./icons";
import PriceHistorySparkline from "./PriceHistorySparkline";

/**
 * Card for any real, live product (lib/partners.ts's normalized
 * RealProduct — partner-agnostic by design, so Brooklyn Delhi, EVDANCE,
 * and Golden Maple products all render identically). Replaces the old
 * Brooklyn-Delhi-specific BrooklynDelhiCard now that more than one section
 * (homepage, partner pages, /search, /category) needs the same
 * real-product card.
 *
 * Clicking the image/name goes to this product's own detail page on Price
 * Finder (not straight out to the partner's site) — the outbound
 * affiliate link only happens via the explicit "View on [Partner]" button.
 * "View Details" and "View on [Partner]" sit together in one row so it's
 * always clear which click does what.
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
}: {
  product: RealProduct;
}) {
  const hasDiscount =
    typeof product.originalPrice === "number" &&
    product.originalPrice > product.price;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-soft-xl">
      <Link
        href={product.href}
        aria-label={product.name}
        className="relative block aspect-square w-full overflow-hidden bg-noir-700 ring-1 ring-inset ring-gilt-500/25"
      >
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />

        {product.badge && (
          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-gilt-500 px-2.5 py-1 text-[11px] font-semibold text-noir-950 shadow-soft">
            {product.badge}
          </span>
        )}
      </Link>

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
            <span className="font-display text-lg font-semibold text-price-text">
              ${product.price.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="ml-1.5 text-xs text-ivory-400 line-through">
                ${(product.originalPrice as number).toLocaleString()}
              </span>
            )}
          </div>
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

        {/* View Details (internal) and "View on [Partner]" (outbound,
            the affiliate deep link) together on one row, same size, so
            it's obvious both are equally valid next steps rather than one
            being a disabled/secondary action. The outbound button's label
            names the actual partner rather than a generic "Buy Now" —
            more accurate for an affiliate referral link that lands on the
            partner's own store, not a completed purchase on this site.
            mt-auto pins this row to the bottom of the card regardless of
            how much space the content above takes up. */}
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link
            href={product.href}
            className="flex-1 rounded-full border border-gilt-500/30 bg-noir-700 px-3 py-2 text-center text-xs font-semibold text-ivory-100 transition-colors hover:border-gilt-400 hover:text-gilt-400"
          >
            View Details
          </Link>
          <a
            href={product.deepLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gilt-500 px-3 py-2 text-xs font-semibold text-noir-950 transition-colors hover:bg-gilt-400"
          >
            View on {product.partnerName}
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
