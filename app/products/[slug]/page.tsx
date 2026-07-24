import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ImageCarousel from "@/components/ImageCarousel";
import RetailerList from "@/components/RetailerList";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import ReviewsSection from "@/components/ReviewsSection";
import ProductCard from "@/components/ProductCard";
import CategoryPageTemplate from "@/components/CategoryPageTemplate";
import WishlistButton from "@/components/WishlistButton";
import BuyButton from "@/components/BuyButton";
import { ChevronRightIcon } from "@/components/icons";
import {
  formatPrice,
  getCategoryDisplayName,
  getKnownCategorySlugs,
  getProductById,
  getProductsByCategorySlug,
  getRelatedProducts,
  slugifyCategory,
  trendingProducts,
} from "@/lib/data";
import type { Product } from "@/lib/types";

/**
 * This single dynamic segment serves two different pages — a product's
 * own detail page (`/products/p1`) and a category grid (`/products/
 * furniture`) — because Next.js requires every page at the same route
 * position to share one dynamic-segment name ("id" and "category" can't
 * coexist as siblings under /products/*). `slug` is checked against known
 * product ids first, then against known category slugs.
 */

export function generateStaticParams() {
  const productParams = trendingProducts.map((product) => ({ slug: product.id }));
  const categoryParams = getKnownCategorySlugs().map((slug) => ({ slug }));
  return [...productParams, ...categoryParams];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const product = getProductById(slug);
  if (product) {
    return {
      title: `${product.name} — Price Finder`,
      description: `Compare ${product.retailers.length} retailer prices for ${product.name}, plus price history and reviews.`,
    };
  }

  const categoryName = getCategoryDisplayName(slug);
  if (categoryName) {
    return {
      title: `${categoryName} — Price Finder`,
      description: `Compare prices on ${categoryName.toLowerCase()} across every retailer we track.`,
    };
  }

  return { title: "Not found — Price Finder" };
}

/** Availability pill color — gilt for "In Stock", clay for low-stock
 * warnings, neutral noir for anything else (e.g. "Pre-order"). */
function availabilityClass(availability: string): string {
  if (availability === "In Stock") return "bg-gilt-500/15 text-gilt-400";
  if (availability.toLowerCase().includes("left")) return "bg-clay-400/10 text-clay-500";
  return "bg-noir-700 text-ivory-200";
}

function ProductDetailView({ product }: { product: Product }) {
  // Still computed (not shown) so downstream sorting keeps working — see
  // the "Discount TBA" text below for why the actual percentage isn't
  // rendered.
  const hasDiscount = Boolean(
    product.originalPrice && product.originalPrice > product.currentPrice
  );

  const related = getRelatedProducts(product, 4);
  const categorySlug = slugifyCategory(product.category);

  return (
    <>
      <Header />
      <main className="flex-1 pb-28 lg:pb-0">
        <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ivory-300">
            <Link href="/" className="shrink-0 transition-colors hover:text-gilt-400">
              Home
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            <Link
              href={`/products/${categorySlug}`}
              className="shrink-0 transition-colors hover:text-gilt-400"
            >
              {product.category}
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-ivory-200">{product.name}</span>
          </nav>
        </div>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <ImageCarousel images={product.images} alt={product.name} />

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
                {product.category}
              </span>
              <h1 className="mt-1 text-balance font-display text-3xl font-medium leading-tight text-ivory-50 sm:text-4xl">
                {product.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ivory-300">
                <span>Ratings coming soon</span>
              </div>

              <span
                className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${availabilityClass(
                  product.availability
                )}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {product.availability}
              </span>
            </div>

            <div className="rounded-3xl border border-gilt-500/20 bg-gilt-500/10 p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-4xl font-semibold text-price-text">
                  {formatPrice(product.currentPrice)}
                </span>
                {product.originalPrice && (
                  <span className="text-base text-ivory-300 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
              {hasDiscount && (
                <p className="mt-1 text-sm font-medium text-ivory-300">Discount TBA</p>
              )}

              <div className="mt-4 flex items-center gap-3">
                <BuyButton product={product} className="flex-1 justify-center sm:flex-none sm:px-8" />
                <WishlistButton
                  productId={product.id}
                  retailer={product.retailer}
                  currentPrice={product.currentPrice}
                  className="static"
                />
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-medium text-ivory-50">
                Compare {product.retailers.length} {product.retailers.length === 1 ? "store" : "stores"}
              </h2>
              <span aria-hidden className="mt-2 block h-[3px] w-10 rounded-full bg-gilt-500" />
              <RetailerList retailers={product.retailers} className="mt-3" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <h2 className="font-display text-2xl font-medium text-ivory-50">Description</h2>
          <span aria-hidden className="mt-3 block h-[3px] w-14 rounded-full bg-gilt-500" />
          <p className="mt-5 max-w-3xl text-balance leading-relaxed text-ivory-300">
            {product.description}
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <h2 className="font-display text-2xl font-medium text-ivory-50">Price history</h2>
          <span aria-hidden className="mt-3 block h-[3px] w-14 rounded-full bg-gilt-500" />
          <div className="mt-5 rounded-3xl border border-gilt-500/20 bg-noir-800 p-6 shadow-soft sm:p-8">
            <PriceHistoryChart history={product.priceHistory} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <ReviewsSection reviews={product.reviews} />
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8">
            <h2 className="font-display text-2xl font-medium text-ivory-50">Shop similar items</h2>
            <span aria-hidden className="mt-3 block h-[3px] w-14 rounded-full bg-gilt-500" />
            <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} variant="grid" />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sticky mobile CTA — the price and primary "View Deal" button stay
          reachable while scrolling a long product page on a small screen. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-noir-600 bg-noir-900/95 px-5 py-3 shadow-soft-xl backdrop-blur-md lg:hidden">
        <span className="font-display text-xl font-semibold text-price-text">
          {formatPrice(product.currentPrice)}
        </span>
        <BuyButton product={product} className="flex-1 justify-center" />
      </div>

      <Footer />
    </>
  );
}

function CategoryBreadcrumb({ categoryName }: { categoryName: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ivory-300">
      <Link href="/" className="shrink-0 transition-colors hover:text-gilt-400">
        Home
      </Link>
      <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-ivory-200">{categoryName}</span>
    </nav>
  );
}

export default async function ProductOrCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = getProductById(slug);
  if (product) {
    return <ProductDetailView product={product} />;
  }

  const categoryName = getCategoryDisplayName(slug);
  if (!categoryName) {
    // Neither a known product id nor a known category — a genuine typo,
    // not just a category that's temporarily empty.
    notFound();
  }

  const products = getProductsByCategorySlug(slug);

  return (
    <CategoryPageTemplate
      eyebrow="Shop by Category"
      title={categoryName}
      description={`Compare prices on ${categoryName.toLowerCase()} across every retailer we track, sorted and filtered your way.`}
      products={products}
      breadcrumb={<CategoryBreadcrumb categoryName={categoryName} />}
      emptyMessage={
        <>
          No products found in {categoryName} yet.{" "}
          <Link href="/trending" className="font-medium text-gilt-400 underline underline-offset-2">
            Browse trending products instead
          </Link>
          .
        </>
      }
    />
  );
}
