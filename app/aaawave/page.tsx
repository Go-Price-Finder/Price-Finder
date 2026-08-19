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
  title: "AAAwave — Go Price Finder",
  description:
    "Shop AAAwave's computer components, storage, mini PCs and networking gear — real products, real prices, straight from the retailer.",
};

/**
 * Flat, paginated grid — same shared lib/pagination.ts slicing every
 * large-catalog partner page uses. Page 1 lives here; pages 2+ live at
 * /aaawave/page/[page].
 */
export default async function AaawavePage() {
  const partner = await getPartner("aaawave");
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
            <span className="text-ivory-200">AAAwave</span>
          </nav>
        </div>

        <div className="mx-auto max-w-7xl px-5 pb-2 pt-6 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
              Featured Partner
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold text-ivory-50 sm:text-4xl">
              AAAwave
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-ivory-300 sm:text-base">
              Computer components, storage, mini PCs and networking gear from
              AAAwave — {allProducts.length} products. Every price and link
              below goes straight to AAAwave&rsquo;s own store.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {products.map((product, index) => (
              <RealProductCard key={product.id} product={product} priority={index < 4} />
            ))}
          </div>
          <Pagination basePath="/aaawave" currentPage={1} totalPages={totalPages} />
        </div>
      </main>
      <Footer />
    </>
  );
}
