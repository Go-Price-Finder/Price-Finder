"use client";

import { useMemo, useState } from "react";
import ReviewCard from "./ReviewCard";
import type { Review } from "@/lib/types";

type SortId = "recent" | "highest" | "lowest" | "helpful";

// The build spec names three sorts (Most Recent, Highest Rating, Lowest
// Rating) but its own verification checklist calls for four — "Most
// Helpful" is the natural fourth given each review already has a Helpful
// button, so it's included here to reconcile the two.
const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "recent", label: "Most Recent" },
  { id: "highest", label: "Highest Rating" },
  { id: "lowest", label: "Lowest Rating" },
  { id: "helpful", label: "Most Helpful" },
];

const PAGE_SIZE = 5;

function sortReviews(reviews: Review[], sort: SortId): Review[] {
  const sorted = [...reviews];
  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => b.date.localeCompare(a.date));
    case "highest":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "lowest":
      return sorted.sort((a, b) => a.rating - b.rating);
    case "helpful":
      return sorted.sort((a, b) => b.helpfulCount - a.helpfulCount);
    default:
      return sorted;
  }
}

export default function ReviewsSection({ reviews }: { reviews: Review[] }) {
  const [sort, setSort] = useState<SortId>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const sorted = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);
  const visible = sorted.slice(0, visibleCount);

  function handleSort(next: SortId) {
    setSort(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-medium text-ivory-50">
            Customer Reviews ({reviews.length})
          </h2>
          <span aria-hidden className="mt-3 block h-[3px] w-14 rounded-full bg-gilt-500" />
        </div>
        <div role="group" aria-label="Sort reviews" className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => handleSort(opt.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  active
                    ? "border-gilt-500 bg-gilt-500 text-noir-950"
                    : "border-gilt-500/25 bg-noir-800 text-ivory-200 shadow-soft hover:border-gilt-400 hover:text-gilt-400"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="mt-6 text-sm text-ivory-300">No reviews yet.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {visible.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </ul>
      )}

      {visibleCount < sorted.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-6 w-full rounded-full border border-gilt-500/40 bg-noir-800 py-3 text-sm font-medium text-gilt-400 shadow-soft transition-colors hover:border-gilt-400 hover:bg-gilt-500/10 sm:w-auto sm:px-8"
        >
          Load More Reviews
        </button>
      )}
    </div>
  );
}
