import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getBestSellers } from "@/lib/partners";

export const metadata: Metadata = {
  title: "Trending — Go Price Finder",
  description:
    "Trending products across every real Go Price Finder partner — right now that's the same list as our Best Sellers.",
};

/**
 * Trending == Best Sellers for now — there's still no real traffic/sales
 * signal to compute a distinct "what's suddenly popular" ranking from, so
 * this page intentionally shows the exact same real data as the
 * homepage's Best Sellers section (getBestSellers() across every active
 * partner) rather than inventing a trending algorithm with no real usage
 * data behind it. Once there's real traffic/sales data, this can become
 * its own ranking.
 */
export default function TrendingPage() {
  const products = getBestSellers();

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ivory-400">
            <Link href="/" className="transition-colors hover:text-gilt-400">
              Home
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="text-ivory-200">Trending</span>
          </nav>
        </div>

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 text-center sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Trending
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Trending products
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            The same real products as our Best Sellers — trending and best
            sellers are the same list until we have real traffic and sales
            data to rank by instead.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">
                No trending products yet — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product, index) => (
                <RealProductCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
