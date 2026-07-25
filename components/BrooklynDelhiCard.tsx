import Image from "next/image";
import type { BrooklynDelhiProduct } from "@/lib/brooklyn-delhi-data";
import { formatBrooklynDelhiPrice } from "@/lib/brooklyn-delhi-data";
import { ExternalLinkIcon, StarIcon } from "./icons";

/**
 * Card for a real Brooklyn Delhi product. Visually modeled on ProductCard
 * (rounded-3xl, noir/gilt/ivory tokens, soft shadow, hover lift) but built
 * around BrooklynDelhiProduct instead of the site's mock multi-retailer
 * Product type — a real photo via next/image, a single real price, and a
 * live outbound "Buy Now" link instead of the site-wide disabled
 * "Coming Soon" BuyButton, per the confirmed decision to launch these
 * listings as clickable now.
 */
export default function BrooklynDelhiCard({
  product,
}: {
  product: BrooklynDelhiProduct;
}) {
  const hasDiscount =
    typeof product.originalPrice === "number" &&
    product.originalPrice > product.price;

  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-soft-xl">
      <div className="relative aspect-square w-full overflow-hidden bg-noir-700 ring-1 ring-inset ring-gilt-500/25">
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ivory-400">
          {product.category}
        </span>

        <h3 className="line-clamp-2 h-11 overflow-hidden text-ellipsis font-display text-base font-semibold leading-snug text-ivory-50">
          {product.name}
        </h3>

        {product.rating && (
          <div className="flex items-center gap-1 text-xs text-ivory-300">
            <StarIcon className="h-3.5 w-3.5 text-gilt-400" />
            <span className="font-medium text-ivory-100">
              {product.rating.stars}
            </span>
            <span className="text-ivory-400">
              ({product.rating.count})
            </span>
          </div>
        )}

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-semibold text-price-text">
              {formatBrooklynDelhiPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-ivory-400 line-through">
                {formatBrooklynDelhiPrice(product.originalPrice as number)}
              </span>
            )}
          </div>

          <a
            href={product.deepLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center gap-1.5 rounded-full bg-gilt-500 px-4 py-2 text-xs font-semibold text-noir-950 transition-colors hover:bg-gilt-400"
          >
            Buy Now
            <ExternalLinkIcon className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}
