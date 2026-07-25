import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getFeaturedDeals } from "@/lib/partners";

export const metadata: Metadata = {
  title: "Deals — Price Finder",
  description:
    "Every real product currently marked down across our partners, all in one place.",
};

/**
 * Rebuilt on real data (lib/partners.ts's getFeaturedDeals) — previously
 * this page filtered the legacy mock catalog (lib/data.ts's
 * trendingProducts), which meant real visitors could land here and see
 * placeholder "Price TBA" cards with fake prices and disabled buy buttons.
 * getFeaturedDeals() only returns products with a genuine originalPrice >
 * price markdown, so this page (and the homepage's Featured Deals section)
 * now honestly show nothing rather than a fabricated deal when no real
 * product is on sale.
 */
export default function DealsPage() {
  const deals = getFeaturedDeals();

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
            <span className="text-ivory-200">Deals</span>
          </nav>
        </div>

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 text-center sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Deals
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Best deals
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            Every real product currently priced below its original price —
            genuine markdowns from our partners, never a fabricated
            discount.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {deals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">
                No active deals right now — check back soon, or browse
                everything that&apos;s trending.
              </p>
              <Link
                href="/trending"
                className="mt-2 rounded-full bg-gilt-500 px-4 py-2 text-xs font-semibold text-noir-950 transition-colors hover:bg-gilt-400"
              >
                Browse trending products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {deals.map((product) => (
                <RealProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
