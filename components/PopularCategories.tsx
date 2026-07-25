import Link from "next/link";
import Image from "next/image";
import { getRealCategories } from "@/lib/partners";

/**
 * Rebuilt on real categories only (lib/partners.ts's getRealCategories) —
 * previously 12 fake placeholder tiles ("Furniture", "12,400+ items", a
 * generic gray placeholder image) that didn't correspond to anything
 * actually in the catalog. Now shows only categories with at least one
 * real product, a real photo from that category, and a real item count.
 * Auto-grows as more partners/categories are added; disappears entirely
 * if the real catalog is ever empty.
 */
export default function PopularCategories() {
  const categories = getRealCategories();

  if (categories.length === 0) return null;

  return (
    <section
      id="categories"
      className="relative flex min-h-screen scroll-mt-20 snap-start flex-col justify-center overflow-hidden py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Browse
          </span>
          <h2 className="mt-2 font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
            Popular categories
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-md text-balance text-ivory-300">
            Real categories from our real partners — more will show up here
            as we onboard more shops.
          </p>
        </div>

        {/* Fewer, larger columns than before (was up to 4 across on large
            screens) so each tile — and its photo — reads as bigger and
            more visible. Name/count now sit in their own panel below the
            photo instead of overlaid on top of it, so they never compete
            with the image for legibility. */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={`${category.partnerId}:${category.slug}`}
              href={`/${category.partnerId}#${category.slug}`}
              className="group flex flex-col overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft-xl"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={category.image}
                  alt={`${category.name} category`}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                />
              </div>
              <div className="flex flex-col gap-1 p-5 text-center">
                <h3 className="font-display text-xl font-medium text-ivory-50 sm:text-2xl">
                  {category.name}
                </h3>
                <span className="text-xs font-medium text-ivory-400">
                  {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
