"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

const SWIPE_THRESHOLD_PX = 40;

/**
 * Real-photo gallery/carousel for a product detail page — same
 * interaction pattern as ImageCarousel.tsx (arrows, thumbnail strip,
 * counter, touch-swipe) but backed by actual next/image photos instead of
 * ProductImagePlaceholder, since these are real product images.
 */
export default function ProductGallery({
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
    const deltaX =
      (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
    if (deltaX > SWIPE_THRESHOLD_PX) go(-1);
    else if (deltaX < -SWIPE_THRESHOLD_PX) go(1);
    touchStartX.current = null;
  }

  return (
    <div>
      <div
        className="relative aspect-[4/3] w-full touch-pan-y overflow-hidden rounded-2xl border border-gilt-500/20 bg-[#f4f4f2] shadow-soft"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          key={images[index]}
          src={images[index]}
          alt={`${alt} — photo ${index + 1} of ${count}`}
          fill
          priority
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-contain p-6"
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
            {/* bg-noir-800/text-ivory-100, matching the arrow controls
                above — NOT bg-noir-950. --color-noir-950 is the one token
                in the scale that is defined once and never flipped for
                dark mode (#17130f in both), so pairing it with ivory-50
                (which DOES flip, to #1b2740 in light) put dark navy text
                on near-black at 1.45:1 against a 6:1 floor, on every
                partner product page with more than one image. Live and
                unseen until the contrast gate stopped enumerating routes
                by hand (§48). */}
            <span className="absolute bottom-3 right-3 rounded-full bg-noir-800/90 px-3 py-1 text-xs font-medium text-ivory-100 backdrop-blur-sm">
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
              className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition-colors ${
                i === index
                  ? "border-gilt-500"
                  : "border-transparent opacity-80 hover:border-gilt-500/30 hover:opacity-100"
              }`}
            >
              <Image src={src} alt="" fill sizes="64px" className="object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
