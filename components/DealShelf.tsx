"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------------------------------------------------------------------
 * DealShelf — the band below the navigation.
 *
 * WHAT IT CLAIMS, AND WHY THE WORDING IS NOT NEGOTIABLE.
 *
 * Today every card is a MARKDOWN: the store's own list price against the store's
 * own current price, both taken from one feed row at one instant. We did not
 * watch the price fall. So the label is "Marked down by the store" and never
 * "price drop", "dropped", "was", or "saved" — those assert an observation over
 * time that we did not make. This is the exact defect removed from
 * PriceHistorySparkline; do not reintroduce it here, on a bigger surface.
 *
 * When observed movement exists, pass variant="movement" per item. The card
 * shape does not change; only the claim gets stronger, because by then it is
 * backed by two observations we actually took.
 *
 * NOT A SLIDESHOW. No auto-rotation, ever. Auto-advancing carousels are a known
 * usability and accessibility failure and they hide most of their content from
 * crawlers. This is a shelf: it scrolls when the reader scrolls it, every card
 * is a real link, and all of them are in the HTML.
 *
 * INTEGRATION NOTE (2026-08-20): delivered with a token vocabulary this
 * codebase does not have (--hairline, --surface-card, --text-primary,
 * text-h3/ui/meta). Those were mapped onto the real system —
 * gilt-500/20 hairline, noir-800 card, noir-700 raised, ivory-50/300
 * text, and the type-* scale classes from the typography spec. Structure,
 * behaviour and every word of the claim are the delivered file
 * unchanged; only colour/size names moved. Same treatment as SiteHeader
 * (§32).
 * ------------------------------------------------------------------------- */

export type ShelfItem = {
  id: string;
  href: string;
  name: string;
  image: string;
  storeName: string;
  price: number;
  /** The store's own list price. Only set when strictly greater than price. */
  originalPrice?: number | null;
  /** When we last verified this price. Rendered verbatim; never inferred. */
  checkedAt?: string | null;
  /** "markdown" today. "movement" only when two observations exist. */
  variant?: "markdown" | "movement";
};

type Props = {
  items: ShelfItem[];
  title?: string;
  subtitle?: string;
  seeAllHref?: string;
  seeAllLabel?: string;
};

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function DealShelf({
  items,
  title = "Marked down right now",
  subtitle,
  seeAllHref = "/deals",
  seeAllLabel = "See all",
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const nudge = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: "smooth" });
  };

  if (items.length === 0) return null; // no empty shelf, no placeholder cards

  return (
    <section
      aria-labelledby="deal-shelf-heading"
      className="border-b border-gilt-500/20 py-10 sm:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="deal-shelf-heading"
              className="type-h3 font-semibold tracking-tight text-ivory-50"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 type-meta text-ivory-300">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={seeAllHref}
              className="type-ui font-medium text-ivory-300 transition hover:text-ivory-50"
            >
              {seeAllLabel} &rarr;
            </Link>
            <div className="hidden gap-1 sm:flex">
              <ArrowButton dir={-1} disabled={atStart} onClick={() => nudge(-1)} />
              <ArrowButton dir={1} disabled={atEnd} onClick={() => nudge(1)} />
            </div>
          </div>
        </div>

        <div
          ref={railRef}
          tabIndex={0}
          role="region"
          aria-label={title}
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:px-0 [scrollbar-width:thin]"
        >
          {items.map((item) => (
            <ShelfCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Scroll left" : "Scroll right"}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gilt-500/20 transition disabled:opacity-30 disabled:cursor-default hover:enabled:bg-noir-700"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dir === -1 ? <path d="M10 3 5 8l5 5" /> : <path d="m6 3 5 5-5 5" />}
      </svg>
    </button>
  );
}

function ShelfCard({ item }: { item: ShelfItem }) {
  const hasMarkdown =
    typeof item.originalPrice === "number" && item.originalPrice > item.price;

  return (
    <Link
      href={item.href}
      className="group flex w-[248px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-gilt-500/20 bg-noir-800 transition hover:border-gilt-500/45"
    >
      {/* Fixed aspect ratio on every card. Mixed ratios are the strongest
          "unfinished" signal a product shelf can give. */}
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f4f4f2]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="type-meta uppercase tracking-wider text-ivory-300">
          {item.storeName}
        </span>

        <span className="line-clamp-2 type-ui font-medium leading-snug text-ivory-50">
          {item.name}
        </span>

        <span className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="tnum type-h3 font-bold tracking-tight text-price-text">
            {money(item.price)}
          </span>
          {hasMarkdown && (
            <span className="tnum type-meta text-ivory-300 line-through">
              {money(item.originalPrice as number)}
            </span>
          )}
        </span>

        {hasMarkdown && (
          <span className="type-meta text-ivory-300">
            {item.variant === "movement"
              ? "Price changed since our last check"
              : "Marked down by the store"}
          </span>
        )}

        {/* DEVIATION from the delivered file, flagged for the operator
            (§45). This said "Checked {date}". The value passed in is the
            SOURCE FEED'S VINTAGE — the date the feed asserting this price
            was produced — not a moment we performed a check. "Checked"
            asserts an action on that date; "Price as of" asserts the
            price's currency, which is the fact we hold. Every other
            surface (PriceAsOfLabel, on detail pages and product cards)
            already says "Price as of" for this exact datum, so leaving
            this one as "Checked" would have shipped two different claims
            about one number. Changed in the conservative direction, which
            is the same direction as the shelf's own wording rule. */}
        {item.checkedAt && (
          <span className="type-meta text-ivory-300">
            Price as of {item.checkedAt}
          </span>
        )}
      </div>
    </Link>
  );
}
