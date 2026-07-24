"use client";

import { useMemo, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";
import ProductCard from "./ProductCard";
import { getDiscountPct } from "@/lib/data";
import type { Product } from "@/lib/types";

type SortId = "best-deals" | "best-ratings" | "price-asc" | "price-desc";

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "best-deals", label: "Best Deals" },
  { id: "best-ratings", label: "Best Ratings" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
];

function sortProducts(products: Product[], sort: SortId): Product[] {
  const sorted = [...products];
  switch (sort) {
    case "best-deals":
      return sorted.sort((a, b) => getDiscountPct(b) - getDiscountPct(a));
    case "best-ratings":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "price-asc":
      return sorted.sort((a, b) => a.currentPrice - b.currentPrice);
    case "price-desc":
      return sorted.sort((a, b) => b.currentPrice - a.currentPrice);
    default:
      return sorted;
  }
}

/**
 * Shared shell for the product-grid category pages (/trending, /deals,
 * /how-it-works) — a hero, a client-side sort bar, and a responsive
 * ProductCard grid. Each page passes in its own curated `products` list
 * (lib/data.ts-derived, computed server-side in the page component) and
 * copy; this component owns only the interactive sort state.
 *
 * `children` renders below the grid, so a page can still add its own
 * additional content (e.g. /how-it-works keeps its 3-step explanation
 * section underneath the curated product grid).
 */
export default function CategoryPageTemplate({
  eyebrow,
  title,
  description,
  products,
  defaultSort = "best-deals",
  emptyMessage = "No products match right now — check back soon.",
  breadcrumb,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
  defaultSort?: SortId;
  emptyMessage?: React.ReactNode;
  /** Optional breadcrumb row rendered above the hero (e.g. Home > Furniture
   * on /products/[slug]'s category pages). /trending, /deals, and
   * /how-it-works don't pass one and render unchanged. */
  breadcrumb?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [sort, setSort] = useState<SortId>(defaultSort);
  const sortedProducts = useMemo(() => sortProducts(products, sort), [products, sort]);

  return (
    <>
      <Header />
      <main className="flex-1">
        {breadcrumb && (
          <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">{breadcrumb}</div>
        )}

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-12 text-center sm:px-8 sm:pt-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            {eyebrow}
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            {title}
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">{description}</p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div
            role="group"
            aria-label="Sort products"
            className="mb-8 flex flex-wrap items-center gap-2"
          >
            {SORT_OPTIONS.map((opt) => {
              const active = sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSort(opt.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
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

          {sortedProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">{emptyMessage}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} variant="grid" />
              ))}
            </div>
          )}
        </section>

        {children}
      </main>
      <Footer />
    </>
  );
}
