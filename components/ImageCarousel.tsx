"use client";

import { useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import ProductImagePlaceholder from "./ProductImagePlaceholder";

const SWIPE_THRESHOLD_PX = 40;

/**
 * Product detail page hero — main image with left/right arrows, a
 * clickable thumbnail strip, an "N of M" counter, and touch-swipe support
 * on mobile. Index-based rather than native scroll-snap so the counter,
 * arrows, and thumbnails all stay trivially in sync with each other.
 */
export default function ImageCarousel({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;

  function go(delta: number) {
    setIndex((i) => (i + delta + count) % count);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    if (deltaX > SWIPE_THRESHOLD_PX) go(-1);
    else if (deltaX < -SWIPE_THRESHOLD_PX) go(1);
    touchStartX.current = null;
  }

  return (
    <div>
      <div
        className="relative aspect-square w-full touch-pan-y overflow-hidden rounded-3xl border border-gilt-500/20 bg-noir-700 shadow-soft"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ProductImagePlaceholder
          key={images[index]}
          label={`${alt} — photo ${index + 1} of ${count}`}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-noir-800/90 text-ivory-100 shadow-soft backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:text-gilt-400 active:scale-95"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-noir-800/90 text-ivory-100 shadow-soft backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:text-gilt-400 active:scale-95"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-noir-950/80 px-3 py-1 text-xs font-medium text-ivory-50 backdrop-blur-sm">
              {index + 1} of {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              aria-label={`View photo ${i + 1} of ${count}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                i === index
                  ? "border-gilt-500"
                  : "border-transparent opacity-80 hover:border-gilt-500/30 hover:opacity-100"
              }`}
            >
              <ProductImagePlaceholder compact />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
