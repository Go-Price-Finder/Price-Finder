import Link from "next/link";
import { getRealCategories } from "@/lib/partners";

/**
 * Flat index instead of photo tiles — part of the approved visual-direction
 * redesign. The old photo-tile grid sized every category to the same grid
 * cell but still put its raw item count next to the name, which visually
 * broadcast how lopsided the catalog is (Art & Craft Supplies at 348 vs.
 * Apparel & Accessories at 5). A flat row of equal-weight pills treats every
 * category as an equally legitimate entry point regardless of what's behind
 * it — the count moves to the category page's own subhead instead of living
 * on the homepage tile. Still entirely driven by lib/partners.ts's
 * getRealCategories(), so it still disappears if the catalog is ever empty
 * and still grows automatically as partners are added.
 */
export default function PopularCategories() {
  const categories = getRealCategories();

  if (categories.length === 0) return null;

  return (
    <section
      id="categories"
      className="relative flex scroll-mt-20 snap-start flex-col justify-center overflow-hidden py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Browse
          </span>
          <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
            Browse by category
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </div>

        <div className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="group flex flex-1 basis-52 flex-col gap-0.5 rounded-2xl border border-gilt-500/25 bg-noir-800 px-5 py-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-gilt-400/50 hover:shadow-soft-lg"
            >
              <span className="font-display text-lg font-medium text-ivory-50 transition-colors group-hover:text-gilt-400">
                {category.name}
              </span>
              <span className="text-xs text-ivory-400">
                {category.itemCount} product{category.itemCount === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
