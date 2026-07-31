import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getPartner, slugifyRealCategory } from "@/lib/partners";
import { BROOKLYN_DELHI_CATEGORIES } from "@/lib/brooklyn-delhi-data";

export const metadata: Metadata = {
  title: "Brooklyn Delhi — Go Price Finder",
  description:
    "Shop Brooklyn Delhi's Indian-inspired condiments, cookbooks, and merch — real products, real prices, straight from the maker.",
};

export default function BrooklynDelhiPage() {
  const partner = getPartner("brooklyn-delhi");
  const products = partner?.products ?? [];

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
            <span className="text-ivory-200">Brooklyn Delhi</span>
          </nav>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-2 pt-6 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
              Featured Partner
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold text-ivory-50 sm:text-4xl">
              Brooklyn Delhi
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ivory-300 sm:text-base">
              Indian-inspired achaars, chutneys, curries, cookbooks, and merch
              from Brooklyn Delhi — {products.length} products, organized by
              category. Every price and link below goes straight to Brooklyn
              Delhi&rsquo;s own store.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-14">
            {(() => {
              let priorityIndex = 0;
              return BROOKLYN_DELHI_CATEGORIES.map((category) => {
                const items = products.filter((p) => p.category === category);
                if (items.length === 0) return null;

                return (
                  <section key={category} id={slugifyRealCategory(category)} className="scroll-mt-24">
                    <div className="flex items-baseline justify-between gap-4 border-b border-gilt-500/25 pb-3">
                      <h2 className="font-display text-xl font-semibold text-ivory-50 sm:text-2xl">
                        {category}
                      </h2>
                      <span className="text-xs font-medium text-ivory-400">
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                      {items.map((product) => (
                        <RealProductCard key={product.id} product={product} priority={priorityIndex++ < 4} />
                      ))}
                    </div>
                  </section>
                );
              });
            })()}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
