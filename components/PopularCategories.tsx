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
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Popular categories
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-md text-balance text-ivory-300">
            Real categories from our real partners — more will show up here
            as we onboard more shops.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/brooklyn-delhi#${category.slug}`}
              className="group relative flex aspect-[4/5] overflow-hidden rounded-3xl shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft-xl sm:aspect-square"
            >
              <Image
                src={category.image}
                alt={`${category.name} category`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-noir-950/85 via-noir-950/15 to-transparent" />
              <div className="relative mt-auto flex w-full flex-col gap-1 p-5">
                <h3 className="font-display text-lg font-medium text-ivory-50 sm:text-xl">
                  {category.name}
                </h3>
                <span className="text-xs font-medium text-ivory-100/80">
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
