import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import Pagination from "@/components/Pagination";
import { ChevronRightIcon } from "@/components/icons";
import { getPartner } from "@/lib/catalog";
import { paginate } from "@/lib/pagination";

export const metadata: Metadata = {
  title: "Canvas Vows — Go Price Finder",
  description:
    "Shop Canvas Vows' personalized wedding vow, anniversary, and family-name canvas wall art — real products, real prices, straight from the maker.",
};

/**
 * Already a flat grid (see the removed comment below for why — Canvas
 * Vows' feed has no real raw categories), now also paginated for the same
 * reason as Golden Maple/Tsar Bomba: 204 products in one page load was a
 * real, measured 1.5MB+ payload. Page 1 lives here; pages 2+ live at
 * /canvas-vows/page/[page].
 */
export default async function CanvasVowsPage() {
  const partner = await getPartner("canvas-vows");
  const allProducts = partner?.products ?? [];
  const { items: products, totalPages } = paginate(allProducts, 1);

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
              wall art from Canvas Vows — {allProducts.length} products.
              Every price and link below goes straight to Canvas
              Vows&rsquo; own store.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((product, index) => (
              <RealProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
          <Pagination basePath="/canvas-vows" currentPage={1} totalPages={totalPages} />
        </div>
      </main>
      <Footer />
    </>
  );
}
