"use client";

import { useMemo } from "react";
import { formatPrice, getRetailer } from "@/lib/data";
import { ExternalLinkIcon, StoreIcon } from "./icons";
import type { RetailerListing } from "@/lib/types";

/**
 * The retailer-by-retailer price list — cheapest first, each row with a
 * logo, name, price, and an outbound "View Deal" link. Shared by
 * RetailerModal (the "at Amazon X stores" click-through on ProductCard)
 * and the product detail page's full pricing table, so both present the
 * exact same rows the exact same way.
 */
export default function RetailerList({
  retailers,
  className = "",
}: {
  retailers: RetailerListing[];
  className?: string;
}) {
  const sorted = useMemo(() => [...retailers].sort((a, b) => a.price - b.price), [retailers]);

  return (
    <ul className={`space-y-2.5 ${className}`}>
      {sorted.map((listing, index) => {
        const retailer = getRetailer(listing.name);
        const isLowest = index === 0;
        return (
          <li
            key={listing.name}
            className={`flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${
              isLowest ? "border-gilt-400/40 bg-gilt-500/10" : "border-gilt-500/25 bg-noir-800"
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Generic icon rather than a real retailer logo — there's no
                  real store behind any of these listings yet. */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-noir-700 text-ivory-300 ring-1 ring-gilt-500/20"
                aria-hidden
              >
                <StoreIcon className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ivory-50">{retailer.name}</span>
                  {isLowest && (
                    <span className="rounded-full bg-gilt-500 px-2 py-0.5 text-[10px] font-semibold text-noir-950">
                      Best Price
                    </span>
                  )}
                </div>
                <span className="font-display text-lg font-semibold text-price-text">
                  {formatPrice(listing.price)}
                </span>
              </div>
            </div>

            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/deal inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gilt-500 px-4 py-2.5 text-xs font-semibold text-ivory-50 transition-all duration-200 hover:bg-gilt-400 active:scale-95 sm:w-auto"
            >
              View Deal
              <ExternalLinkIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover/deal:translate-x-0.5 group-hover/deal:-translate-y-0.5" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
