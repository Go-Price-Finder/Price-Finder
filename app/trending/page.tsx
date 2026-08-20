import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getRecentlyAdded } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "New Arrivals — Go Price Finder",
  description:
    "The newest products in the Go Price Finder catalogue, from our most recent partner imports.",
};

/**
 * "Recently added" (findings §28). This page used to be titled
 * "Trending products" and fed by getBestSellers() — a pool built from
 * three July hand-authored badges on one partner, i.e. a popularity
 * claim nobody measured (affiliate_clicks: 0 rows). Import recency is
 * data we actually hold, so that is what the page now claims. The ROUTE
 * stays /trending (it is indexed; a URL is an address, not a sentence) —
 * revisit the route name if a real popularity signal ever exists.
 */
export default async function TrendingPage() {
  const products = await getRecentlyAdded();

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
            <span className="text-ivory-200">New arrivals</span>
          </nav>
        </div>

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 text-center sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Recently added
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Recently added products
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            The newest products in our catalogue, from our most recent
            partner imports. We don&rsquo;t rank by popularity, because we
            have no traffic or sales data to rank with — when we do, a real
            ranking can live here.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">
                Nothing here yet.
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
