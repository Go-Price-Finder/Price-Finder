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
import WishlistButton from "@/components/WishlistButton";
import BuyButton from "@/components/BuyButton";
import { StarIcon, ChevronRightIcon } from "@/components/icons";
import {
  estimatedPurchaseCount,
  formatPrice,
  getProductById,
  getRelatedProducts,
  trendingProducts,
} from "@/lib/data";

export function generateStaticParams() {
  return trendingProducts.map((product) => ({ id: product.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) {
    return { title: "Product not found — Price Finder" };
  }
  return {
    title: `${product.name} — Price Finder`,
    description: `Compare ${product.retailers.length} retailer prices for ${product.name}, plus price history and reviews.`,
  };
}

/** Availability pill color — sage for "In Stock", clay for low-stock
 * warnings, neutral sand for anything else (e.g. "Pre-order"). */
function availabilityClass(availability: string): string {
  if (availability === "In Stock") return "bg-sage-50 text-sage-700";
  if (availability.toLowerCase().includes("left")) return "bg-clay-400/10 text-clay-500";
  return "bg-sand-100 text-ink-600";
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProductById(id);
  if (!product) notFound();

  const discount =
    product.originalPrice && product.originalPrice > product.currentPrice
      ? Math.round(
          ((product.originalPrice - product.currentPrice) / product.originalPrice) * 100
        )
      : null;

  const related = getRelatedProducts(product, 4);
  const purchaseCount = estimatedPurchaseCount(product);

  return (
    <>
      <Header />
      <main className="flex-1 pb-28 lg:pb-0">
        <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="shrink-0 transition-colors hover:text-sage-600">
              Home
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            <Link
              href="/trending"
              className="shrink-0 transition-colors hover:text-sage-600"
            >
              {product.category}
            </Link>
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-ink-600">{product.name}</span>
          </nav>
        </div>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-8 sm:px-8 lg:grid-cols-2 lg:gap-14">
          <ImageCarousel images={product.images} alt={product.name} />

          <div className="flex flex-col gap-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-sage-600">
                {product.category}
              </span>
              <h1 className="mt-1 text-balance font-display text-3xl font-medium leading-tight text-ink-900 sm:text-4xl">
                {product.name}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-500">
                <span className="flex items-center gap-1.5">
                  <StarIcon className="h-4 w-4 text-clay-500" />
                  <span className="font-medium text-ink-700">{product.rating} out of 5</span>
                </span>
                <span>{product.reviewCount.toLocaleString()} reviews</span>
                <span>{purchaseCount.toLocaleString()} people bought this</span>
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

            <div className="rounded-3xl border border-sand-200/70 bg-sage-50/50 p-5 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-4xl font-semibold text-sage-700">
                  {formatPrice(product.currentPrice)}
                </span>
                {product.originalPrice && (
                  <span className="text-base text-ink-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>
              {discount && (
                <p className="mt-1 text-sm font-medium text-clay-500">
                  ▼ down {discount}% from its tracked high
                </p>
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
              <h2 className="font-display text-lg font-medium text-ink-900">
                Compare {product.retailers.length} {product.retailers.length === 1 ? "store" : "stores"}
              </h2>
              <RetailerList retailers={product.retailers} className="mt-3" />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <h2 className="font-display text-2xl font-medium text-ink-900">Price history</h2>
          <div className="mt-5 rounded-3xl border border-sand-200/70 bg-white p-6 shadow-soft sm:p-8">
            <PriceHistoryChart history={product.priceHistory} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <ReviewsSection reviews={product.reviews} />
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8">
            <h2 className="font-display text-2xl font-medium text-ink-900">Shop similar items</h2>
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
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-sand-200 bg-white/95 px-5 py-3 shadow-soft-xl backdrop-blur-md lg:hidden">
        <span className="font-display text-xl font-semibold text-ink-900">
          {formatPrice(product.currentPrice)}
        </span>
        <BuyButton product={product} className="flex-1 justify-center" />
      </div>

      <Footer />
    </>
  );
}
