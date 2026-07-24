"use client";

import Link from "next/link";
import { categories, slugifyCategory } from "@/lib/data";
import ProductImagePlaceholder from "./ProductImagePlaceholder";

export default function PopularCategories() {
  return (
    <section
      id="categories"
      className="relative flex min-h-screen scroll-mt-20 snap-start flex-col justify-center overflow-hidden py-16 sm:py-24"
    >
      {/* The old Three.js background scene (and this section's opaque
          bg-cream-50) have been removed — this section is now a clean,
          transparent background (showing the global CinematicBackground
          through), matching Hero/Loyalty/Trending/How It Works. */}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Browse
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Popular categories
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-md text-balance text-ivory-300">
            Explore curated collections and compare prices across every
            corner of your home — and beyond.
          </p>
        </div>

        {/* Full interactive grid — 12 tiles across a 2/3/4-column
            responsive layout, rather than the previous short 6-tile row. */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products/${slugifyCategory(category.name)}`}
              className="group relative flex aspect-[4/5] overflow-hidden rounded-3xl shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft-xl sm:aspect-square"
            >
              <ProductImagePlaceholder
                label={`${category.name} category`}
                className="transition-transform duration-500 ease-out group-hover:scale-110"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-noir-950/85 via-noir-950/15 to-transparent" />
              <div className="relative mt-auto flex w-full flex-col gap-1 p-5">
                <h3 className="font-display text-lg font-medium text-ivory-50 sm:text-xl">
                  {category.name}
                </h3>
                <span className="text-xs font-medium text-ivory-100/80">
                  {category.itemCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
