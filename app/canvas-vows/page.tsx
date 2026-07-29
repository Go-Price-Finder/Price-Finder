import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getPartner } from "@/lib/partners";

export const metadata: Metadata = {
  title: "Canvas Vows — Price Finder",
  description:
    "Shop Canvas Vows' personalized wedding vow, anniversary, and family-name canvas wall art — real products, real prices, straight from the maker.",
};

/**
 * Flat grid, not the per-raw-category-sections pattern the other 3
 * partners use (Brooklyn Delhi/EVDANCE/Golden Maple) — Canvas Vows'
 * source feed leaves `category_name`/`merchant_category` empty for all
 * 204 products, so the raw `category` field is "Uncategorized" for the
 * whole catalog. That's exactly why the title-based override in
 * lib/category-mapper.ts exists (classifies from the product name
 * instead) — replicating the sectioned UI here would just render one
 * section literally titled "Uncategorized".
 */
export default function CanvasVowsPage() {
  const partner = getPartner("canvas-vows");
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
            <span className="text-ivory-200">Canvas Vows</span>
          </nav>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-2 pt-6 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
              Featured Partner
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold text-ivory-50 sm:text-4xl">
              Canvas Vows
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ivory-300 sm:text-base">
              Personalized wedding vow, anniversary, and family-name canvas
              wall art from Canvas Vows — {products.length} products. Every
              price and link below goes straight to Canvas Vows&rsquo; own
              store.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((product) => (
              <RealProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
