import type { Metadata } from "next";
import {
  BROOKLYN_DELHI_CATEGORIES,
  BROOKLYN_DELHI_PRODUCTS,
} from "@/lib/brooklyn-delhi-data";
import BrooklynDelhiCard from "@/components/BrooklynDelhiCard";

export const metadata: Metadata = {
  title: "Brooklyn Delhi — Price Finder",
  description:
    "Shop Brooklyn Delhi's Indian-inspired condiments, cookbooks, and merch — real products, real prices, straight from the maker.",
};

export default function BrooklynDelhiPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
          Featured Maker
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ivory-50 sm:text-4xl">
          Brooklyn Delhi
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ivory-300 sm:text-base">
          Indian-inspired achaars, chutneys, curries, cookbooks, and merch
          from Brooklyn Delhi — {BROOKLYN_DELHI_PRODUCTS.length} products,
          organized by category. Every price and link below goes straight to
          Brooklyn Delhi&rsquo;s own store.
        </p>
      </div>

      <div className="mt-12 flex flex-col gap-14">
        {BROOKLYN_DELHI_CATEGORIES.map((category) => {
          const products = BROOKLYN_DELHI_PRODUCTS.filter(
            (product) => product.category === category
          );

          if (products.length === 0) return null;

          return (
            <section key={category}>
              <div className="flex items-baseline justify-between gap-4 border-b border-gilt-500/25 pb-3">
                <h2 className="font-display text-xl font-semibold text-ivory-50 sm:text-2xl">
                  {category}
                </h2>
                <span className="text-xs font-medium text-ivory-400">
                  {products.length} item{products.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                {products.map((product) => (
                  <BrooklynDelhiCard key={product.slug} product={product} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
