"use client";

import { useState } from "react";
import Link from "next/link";
import { Product } from "@/lib/types";
import { formatPrice, getRetailer } from "@/lib/data";
import { useTilt } from "@/lib/use-tilt";
import { HistoryIcon } from "./icons";
import WishlistButton from "./WishlistButton";
import BuyButton from "./BuyButton";
import RetailerModal from "./RetailerModal";
import ProductImagePlaceholder from "./ProductImagePlaceholder";

export default function ProductCard({
  product,
  variant = "rail",
}: {
  product: Product;
  /**
   * "rail" (default) — fixed width, used in horizontal scrollers like
   * TrendingNow.tsx. "grid" — stretches to fill its container, used in
   * CSS-grid contexts like CategoryPageTemplate.tsx's product grid.
   */
  variant?: "rail" | "grid";
}) {
  const [retailersOpen, setRetailersOpen] = useState(false);
  const retailer = getRetailer(product.retailer);
  const tilt = useTilt<HTMLElement>();

  // Still computed (not shown) so "Best Deals" sorting elsewhere keeps
  // working — see the "Discount TBA" badge below for why the actual
  // percentage isn't rendered.
  const hasDiscount = Boolean(
    product.originalPrice && product.originalPrice > product.currentPrice
  );

  return (
    <>
      <article
        ref={tilt.ref}
        onPointerMove={tilt.onPointerMove}
        onPointerLeave={tilt.onPointerLeave}
        className={`group relative flex flex-col overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft transition-[transform,box-shadow] duration-200 ease-out will-change-transform hover:shadow-soft-xl ${
          variant === "grid" ? "w-full" : "w-[260px] shrink-0 sm:w-[280px]"
        }`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-noir-700 ring-1 ring-inset ring-gilt-500/25">
          {/* The image itself is the only thing inside the link — badges and
              the wishlist button are absolutely-positioned siblings, not
              descendants, since nesting a <button> inside an <a> is invalid
              HTML and would break their independent click handling. */}
          <Link
            href={`/products/${product.id}`}
            aria-label={product.name}
            className="absolute inset-0 block"
          >
            <ProductImagePlaceholder />
          </Link>

          {product.isBestPrice && (
            <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full bg-gilt-500 px-2.5 py-1 text-[11px] font-semibold text-noir-950 shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-noir-950" />
              Best Price
            </span>
          )}

          {hasDiscount && (
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-noir-950/90 px-2.5 py-1 text-[11px] font-semibold text-ivory-100 backdrop-blur-sm">
              Discount TBA
            </span>
          )}

          <WishlistButton
            productId={product.id}
            retailer={product.retailer}
            currentPrice={product.currentPrice}
            className="absolute bottom-3 right-3"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ivory-400">
              {product.category}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${retailer.badgeClass}`}
            >
              {retailer.name}
            </span>
          </div>

          {/* Fixed height (2 lines at text-base/leading-snug = 16px * 1.375 * 2
              = 44px = h-11), not just a max via line-clamp alone — this is
              what makes every card reserve the same vertical space for the
              name regardless of whether it's one line or two, so the
              rating/price/retailer rows below always land on the same
              Y-axis across a row of cards with different name lengths. */}
          <Link
            href={`/products/${product.id}`}
            className="line-clamp-2 h-11 overflow-hidden text-ellipsis font-display text-base font-semibold leading-snug text-ivory-50 transition-colors hover:text-gilt-400"
          >
            {product.name}
          </Link>

          <div className="flex items-center gap-1 text-xs text-ivory-400">
            <span>Ratings coming soon</span>
          </div>

          <div className="mt-1 flex items-end justify-between gap-2">
            <div className="flex items-baseline gap-2">
              {/* One uniform price color regardless of theme or best-price
                  status — see --color-price-text in globals.css. The
                  "Best Price" badge above the image already communicates
                  that distinction; the price text itself no longer changes
                  shade for it. */}
              <span className="font-display text-xl font-semibold text-price-text">
                {formatPrice(product.currentPrice)}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-ivory-400 line-through">
                  {formatPrice(product.originalPrice)}
                </span>
              )}
            </div>
            <BuyButton product={product} />
          </div>

          {/* No real historical pricing exists for this mock catalog — a
              sparkline/percentage here would just be a fabricated chart, so
              this is now a plain, non-interactive placeholder rather than a
              button that opens a chart modal. */}
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-noir-600 bg-noir-800/50 px-2.5 py-2 text-ivory-400">
            <HistoryIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium">Price history coming soon</span>
          </div>

          <button
            type="button"
            onClick={() => setRetailersOpen(true)}
            className="group/retailers mt-1 flex items-center justify-between border-t border-noir-600 pt-3 text-xs text-ivory-300 transition-colors hover:text-gilt-400"
          >
            <span>Multiple retailers</span>
            <span className="underline decoration-gilt-500/40 decoration-dashed underline-offset-2 transition-colors group-hover/retailers:decoration-gilt-400">
              data coming soon
            </span>
          </button>
        </div>
      </article>

      <RetailerModal
        open={retailersOpen}
        onClose={() => setRetailersOpen(false)}
        product={product}
      />
    </>
  );
}
