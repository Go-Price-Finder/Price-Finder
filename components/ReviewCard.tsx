"use client";

import { useState } from "react";
import { formatLongDate } from "@/lib/data";
import type { Review } from "@/lib/types";

export default function ReviewCard({ review }: { review: Review }) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpfulCount);
  const [marked, setMarked] = useState(false);

  return (
    <li className="rounded-2xl border border-ivory-400/20 bg-noir-800 p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* No real star rating behind this placeholder review yet. */}
        <span className="text-xs font-medium text-ivory-400">Rating coming soon</span>
        <span className="text-xs text-ivory-300">{formatLongDate(review.date)}</span>
      </div>

      <h4 className="mt-2.5 font-display text-base font-medium text-ivory-50">{review.title}</h4>
      <p className="mt-1.5 text-sm leading-relaxed text-ivory-300">{review.text}</p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ivory-100">{review.author}</span>
        <button
          type="button"
          aria-pressed={marked}
          onClick={() => {
            if (marked) return;
            setMarked(true);
            setHelpfulCount((c) => c + 1);
          }}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
            marked
              ? "border-gilt-500/30 bg-gilt-500/15 text-gilt-400"
              : "border-ivory-400/20 text-ivory-300 hover:border-gilt-400/40 hover:text-gilt-400"
          }`}
        >
          Helpful ({helpfulCount})
        </button>
      </div>
    </li>
  );
}
