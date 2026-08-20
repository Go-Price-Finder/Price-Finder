import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getFeaturedDeals } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Deals — Go Price Finder",
  description:
    "Real products whose store publishes a list price above what it charges today. Most partner feeds publish no list price, so this is not the whole catalogue.",
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
export default async function DealsPage() {
  const deals = await getFeaturedDeals();

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
            Products whose store publishes a list price above what it
            charges today — genuine markdowns from our partners, never a
            fabricated discount. Most of our partners&rsquo; feeds publish
            no list price at all, so this page is not a complete picture of
            what is discounted; it is everything we can prove.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {deals.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              {/* This used to say "No active deals right now", which is the
                  purest form of the §46 defect: it converted "no partner
                  feed published a list price" into "nothing is discounted".
                  We cannot see whether these stores are discounting; we can
                  only see whether they told us a list price. */}
              <p className="text-sm text-ivory-300">
                No partner is currently publishing a list price above what
                it charges, so we have nothing here we can prove. That is
                not the same as nothing being discounted — most feeds send
                us no list price at all.
              </p>
              <Link
                href="/trending"
                className="mt-2 rounded-full bg-gilt-500 px-4 py-2 text-xs font-semibold text-accent-ink transition-colors hover:bg-gilt-400"
              >
                Browse trending products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {deals.map((product, index) => (
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
