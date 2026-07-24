"use client";

import { useMemo, useRef } from "react";
import { trendingProducts, getDiscountPct } from "@/lib/data";
import ProductCard from "./ProductCard";
import { ChevronRightIcon } from "./icons";

const FEATURED_COUNT = 10;

export default function FeaturedDeals() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  // The steepest discounts in the catalog, best deal first — a distinct cut
  // through the same catalog TrendingNow draws from (that rail is sorted by
  // "trending", this one by "biggest markdown"), so the two rails don't
  // just repeat each other.
  const deals = useMemo(
    () =>
      [...trendingProducts]
        .filter((p) => getDiscountPct(p) > 0)
        .sort((a, b) => getDiscountPct(b) - getDiscountPct(a))
        .slice(0, FEATURED_COUNT),
    []
  );

  const scroll = (direction: "left" | "right") => {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = node.clientWidth * 0.8;
    node.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  if (deals.length === 0) return null;

  return (
    <section
      id="featured-deals"
      className="relative overflow-hidden py-14 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
              Featured Deals
            </span>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
              The biggest markdowns right now
            </h2>
            <span aria-hidden className="mt-4 block h-[3px] w-14 rounded-full bg-gilt-500" />
          </div>

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
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hide flex gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-8"
      >
        {deals.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        <div className="w-1 shrink-0 sm:w-3" aria-hidden />
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <a
          href="/deals"
          className="group mt-6 inline-flex items-center gap-1 text-sm font-medium text-ivory-100 transition-colors hover:text-gilt-400"
        >
          View all deals
          <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  );
}
