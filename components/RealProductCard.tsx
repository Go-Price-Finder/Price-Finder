import Image from "next/image";
import Link from "next/link";
import type { RealProduct } from "@/lib/partners";
import { ExternalLinkIcon, StarIcon } from "./icons";

/**
 * Card for any real, live product (lib/partners.ts's normalized
 * RealProduct — currently just Brooklyn Delhi, but partner-agnostic by
 * design so a second partner's products render identically). Replaces the
 * Brooklyn-Delhi-specific BrooklynDelhiCard now that more than one section
 * (homepage, /brooklyn-delhi, /search) needs the same real-product card.
 *
 * Clicking the image/name goes to this product's own detail page on Price
 * Finder (not straight out to the partner's site) — the outbound purchase
 * link only happens via the explicit "Buy Now" button. "View Details" and
 * "Buy Now" sit together in one row so it's always clear which click does
 * what.
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
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-soft-xl">
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
            about the product line up on the same baseline. */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={product.href}
            className="line-clamp-2 flex-1 font-display text-base font-semibold leading-snug text-ivory-50 transition-colors hover:text-gilt-400"
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

        {product.rating && (
          <div className="flex items-center gap-1.5">
            <StarIcon className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-semibold text-orange-400">
              {product.rating.stars}
            </span>
            <span className="text-xs text-ivory-400">
              ({product.rating.count})
            </span>
          </div>
        )}

        {/* View Details (internal) and Buy Now (outbound) together on one
            row, same size, so it's obvious both are equally valid next
            steps rather than one being a disabled/secondary action. */}
        <div className="mt-2 flex items-center gap-2">
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
            Buy Now
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
