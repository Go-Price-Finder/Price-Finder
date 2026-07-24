"use client";

import { useEffect } from "react";
import { CloseIcon } from "./icons";
import ProductImagePlaceholder from "./ProductImagePlaceholder";
import RetailerList from "./RetailerList";
import type { Product } from "@/lib/types";

/**
 * The "at Amazon X stores" click-through — every retailer currently listing
 * this product, cheapest first. Opened from the bottom row of ProductCard;
 * BuyButton (the card's own "View Deal") is unrelated and stays untouched.
 */
export default function RetailerModal({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="retailer-modal-title"
    >
      <div
        className="absolute inset-0 bg-noir-950/60 backdrop-blur-sm animate-fade-up"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col animate-fade-up overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft-xl">
        <div className="flex items-start justify-between gap-4 border-b border-noir-600 p-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-noir-700">
              <ProductImagePlaceholder compact />
            </div>
            <div>
              <h2
                id="retailer-modal-title"
                className="line-clamp-2 font-display text-lg font-medium leading-snug text-ivory-50"
              >
                {product.name}
              </h2>
              <p className="mt-0.5 text-sm text-ivory-300">
                {product.retailers.length} {product.retailers.length === 1 ? "store" : "stores"}{" "}
                comparing this price
              </p>
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ivory-300 transition-colors hover:bg-noir-700 hover:text-ivory-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <RetailerList retailers={product.retailers} className="flex-1 overflow-y-auto p-6 pt-5" />
      </div>
    </div>
  );
}
