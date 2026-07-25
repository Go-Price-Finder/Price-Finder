"use client";

import { useMemo, useRef } from "react";
import { getBestSellers } from "@/lib/partners";
import { usePartnerFilter } from "@/lib/partner-filter-context";
import RealProductCard from "./RealProductCard";
import { ChevronRightIcon } from "./icons";

/**
 * Renamed from "Trending Picks" (the old TrendingNow.tsx, which read from
 * the mock catalog and filtered by the fake 5-store retailer list). Now
 * shows real "Best Seller"-badged products across every active, selected
 * partner (lib/partners.ts + Hero's PartnerFilterBar selection), and
 * disappears entirely if the selection yields nothing instead of showing
 * an empty rail.
 */
export default function BestSellers() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { selected, isFiltering } = usePartnerFilter();

  const products = useMemo(() => getBestSellers(selected), [selected]);

  const scroll = (direction: "left" | "right") => {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = node.clientWidth * 0.8;
    node.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (products.length === 0) return null;

  return (
    <section
      id="best-sellers"
      className="relative overflow-hidden py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
              Best Sellers
            </span>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
              Best sellers from our partners
            </h2>
            <span aria-hidden className="mt-4 block h-[3px] w-14 rounded-full bg-gilt-500" />
            {isFiltering && (
              <p className="mt-2 text-xs text-ivory-400">
                Filtered to your selected partners.
              </p>
            )}
          </div>

          {products.length > 4 && (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <button
                aria-label="Scroll left"
                onClick={() => scroll("left")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gilt-500/25 bg-noir-800 text-ivory-100 shadow-soft transition-all duration-200 hover:border-gilt-400 hover:text-gilt-400 active:scale-95"
              >
                <ChevronRightIcon className="h-4 w-4 rotate-180" />
              </button>
              <button
                aria-label="Scroll right"
                onClick={() => scroll("right")}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-gilt-500/25 bg-noir-800 text-ivory-100 shadow-soft transition-all duration-200 hover:border-gilt-400 hover:text-gilt-400 active:scale-95"
              >
                <ChevronRightIcon className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hide flex gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-8"
      >
        {products.map((product) => (
          <div key={product.id} className="w-[260px] shrink-0 sm:w-[280px]">
            <RealProductCard product={product} />
          </div>
        ))}
        <div className="w-1 shrink-0 sm:w-3" aria-hidden />
      </div>
    </section>
  );
}
