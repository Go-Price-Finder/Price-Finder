"use client";

import { useMemo, useRef } from "react";
import { trendingProducts } from "@/lib/data";
import { useRetailerFilter } from "@/lib/retailer-filter-context";
import ProductCard from "./ProductCard";
import { ChevronRightIcon } from "./icons";

export default function TrendingNow() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { isSelected, selectAll, noneSelected } = useRetailerFilter();

  const visibleProducts = useMemo(
    () => trendingProducts.filter((p) => isSelected(p.retailer)),
    [isSelected]
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

  return (
    <section
      id="trending"
      className="relative flex min-h-screen scroll-mt-20 snap-start flex-col justify-center overflow-hidden py-16 sm:py-24"
    >
      {/* The old Three.js "tumbling field" background scene has been
          removed — this section is now a clean, transparent background
          (showing the global CinematicBackground through) ready for new,
          more subtle per-section animation. */}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
              Trending Now
            </span>
            <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
              Trending picks to compare
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

      {visibleProducts.length === 0 ? (
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-14 text-center">
            <p className="font-display text-lg font-medium text-ivory-50">
              {noneSelected
                ? "No retailers selected"
                : "No trending products match your retailer filter"}
            </p>
            <p className="max-w-sm text-sm text-ivory-300">
              {noneSelected
                ? "Choose at least one retailer to see trending products."
                : "Try selecting more retailers to see more results."}
            </p>
            <button
              onClick={selectAll}
              className="mt-1 rounded-full bg-gilt-500 px-5 py-2.5 text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400"
            >
              Show all retailers
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-8"
        >
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          <div className="w-1 shrink-0 sm:w-3" aria-hidden />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <a
          href="#"
          className="group mt-6 inline-flex items-center gap-1 text-sm font-medium text-ivory-100 transition-colors hover:text-gilt-400"
        >
          View all trending products
          <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </a>
      </div>
    </section>
  );
}
