import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchBar from "@/components/SearchBar";
import RealProductCard from "@/components/RealProductCard";
import { searchRealProducts } from "@/lib/partners";

export const metadata: Metadata = {
  title: "Search — Price Finder",
  description: "Search real products across every Price Finder partner.",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = q ? searchRealProducts(q) : [];

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-7xl px-5 pb-2 pt-12 text-center sm:px-8 sm:pt-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Search
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            {q ? `Results for “${q}”` : "Search Price Finder"}
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />

          <div className="mx-auto mt-8 max-w-xl">
            <SearchBar size="lg" placeholder="Try “achaar” or “chutney”…" />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {!q ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">
                Type a product, category, or partner name above to search.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">
                No products match “{q}” yet — we&rsquo;re still adding
                partners and products.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-6 text-sm text-ivory-300">
                {results.length} result{results.length === 1 ? "" : "s"}
              </p>
              <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {results.map((product) => (
                  <RealProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
