"use client";

import { useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { getFeaturedDeals } from "@/lib/partners";
import RealProductCard from "./RealProductCard";
import { ChevronRightIcon, ExternalLinkIcon } from "./icons";

/**
 * Real markdowns only, from lib/partners.ts's getFeaturedDeals() — a
 * product only shows up here when it has a genuine originalPrice greater
 * than its current price, from any active partner. No mock/"Price TBA"
 * data anymore, and the whole section disappears rather than show a
 * fabricated markdown when nothing is actually on sale.
 *
 * One or two real deals render as a single spotlight card instead of a
 * horizontal rail — a 4-across scroller with one small card floating in
 * empty space read as unfinished, not curated. The rail only kicks in once
 * there's enough real inventory to actually fill it.
 */
export default function FeaturedDeals() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const deals = useMemo(() => getFeaturedDeals(), []);

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

  const isSpotlight = deals.length <= 2;

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
            <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
              Real markdowns right now
            </h2>
            <span aria-hidden className="mt-4 block h-[3px] w-14 rounded-full bg-gilt-500" />
          </div>

          {!isSpotlight && deals.length > 4 && (
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

      {isSpotlight ? (
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div
            className={`grid gap-5 ${deals.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}
          >
            {deals.map((deal) => {
              const hasDiscount =
                typeof deal.originalPrice === "number" && deal.originalPrice > deal.price;
              const pct = hasDiscount
                ? Math.round(((deal.originalPrice! - deal.price) / deal.originalPrice!) * 100)
                : 0;
              return (
                <div
                  key={deal.id}
                  className="grid overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft sm:grid-cols-2"
                >
                  <div className="relative aspect-square sm:aspect-auto">
                    <Image
                      src={deal.image}
                      alt={deal.name}
                      fill
                      sizes="(min-width: 640px) 40vw, 100vw"
                      className="object-cover"
                    />
                    {deal.badge && (
                      <span className="absolute left-4 top-4 rounded-full bg-gilt-500 px-3 py-1 text-[11px] font-semibold text-noir-950 shadow-soft">
                        {deal.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
                    <span className="text-xs uppercase tracking-wide text-ivory-400">
                      {deal.category} · {deal.partnerName}
                    </span>
                    <h3 className="font-display text-2xl font-semibold leading-tight text-ivory-50">
                      {deal.name}
                    </h3>
                    <div className="flex items-baseline gap-3">
                      <span className="font-display text-2xl font-semibold tabular-nums text-price-text">
                        ${deal.price.toLocaleString()}
                      </span>
                      <span className="text-base tabular-nums text-ivory-400 line-through">
                        ${deal.originalPrice!.toLocaleString()}
                      </span>
                      <span className="rounded-full bg-gilt-500/15 px-2.5 py-1 text-xs font-semibold text-gilt-500">
                        {pct}% off
                      </span>
                    </div>
                    <a
                      href={deal.deepLink}
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-gilt-500 px-6 py-3 text-sm font-semibold text-noir-950 transition-colors hover:bg-gilt-400"
                    >
                      View on {deal.partnerName}
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="scrollbar-hide flex gap-5 overflow-x-auto scroll-smooth px-5 pb-4 sm:px-8"
        >
          {deals.map((product) => (
            <div key={product.id} className="w-[260px] shrink-0 sm:w-[280px]">
              <RealProductCard product={product} />
            </div>
          ))}
          <div className="w-1 shrink-0 sm:w-3" aria-hidden />
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Link
          href="/deals"
          className="group mt-6 inline-flex items-center gap-1 text-sm font-medium text-ivory-100 transition-colors hover:text-gilt-400"
        >
          View all deals
          <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
