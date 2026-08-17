import type { Metadata } from "next";
import Link from "next/link";
import PriceAsOfLabel from "@/components/PriceAsOfLabel";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import ProductGallery from "@/components/ProductGallery";
import RealProductCard from "@/components/RealProductCard";
import WishlistButton from "@/components/WishlistButton";
import PriceHistoryChart from "@/components/PriceHistoryChart";
import PriceAlertCTA from "@/components/PriceAlertCTA";
import { ChevronRightIcon, ExternalLinkIcon, StarIcon } from "@/components/icons";
import { getAllRealProducts, getPartner, getRealProduct } from "@/lib/catalog";
import { buildProductJsonLd } from "@/lib/structured-data";

export async function generateStaticParams() {
  const partner = await getPartner("evdance");
  return (partner?.products ?? []).map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getRealProduct("evdance", slug);
  if (!product) return { title: "Not found — Go Price Finder" };
  return {
    title: `${product.name} — EVDANCE — Go Price Finder`,
    description: product.description.slice(0, 155),
  };
}

export default async function EvdanceProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getRealProduct("evdance", slug);
  if (!product) notFound();

  const hasDiscount =
    typeof product.originalPrice === "number" && product.originalPrice > product.price;

  const related = (await getAllRealProducts())
    .filter((p) => p.partnerId === "evdance" && p.category === product.category && p.slug !== product.slug)
    .slice(0, 4);

  return (
    <>
      <Header />
      <JsonLd data={buildProductJsonLd(product)} />
      <main className="flex-1">
        {/* Breadcrumb — Home / EVDANCE / Product Name */}
        <div className="mx-auto max-w-7xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ivory-400">
            <Link href="/" className="transition-colors hover:text-gilt-400">
              Home
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <Link href="/evdance" className="transition-colors hover:text-gilt-400">
              EVDANCE
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="text-ivory-200">{product.name}</span>
          </nav>

          <Link
            href="/evdance"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ivory-100 transition-colors hover:text-gilt-400"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
            Back to EVDANCE
          </Link>
        </div>

        <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <ProductGallery images={product.images} alt={product.name} />

            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
                  {product.category} · {product.partnerName}
                </span>
                <h1 className="mt-2 font-display text-2xl font-semibold text-ivory-50 sm:text-3xl">
                  {product.name}
                </h1>
              </div>

              {product.rating && (
                <div className="flex items-center gap-1.5">
                  <StarIcon className="h-5 w-5 text-orange-400" />
                  <span className="text-base font-semibold text-orange-400">
                    {product.rating.stars}
                  </span>
                  <span className="text-sm text-ivory-400">
                    ({product.rating.count} rating{product.rating.count === 1 ? "" : "s"})
                  </span>
                </div>
              )}

              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl font-semibold tabular-nums text-price-text">
                  ${product.price.toLocaleString()}
                </span>
                {hasDiscount && (
                  <span className="text-base tabular-nums text-ivory-400 line-through">
                    ${(product.originalPrice as number).toLocaleString()}
                  </span>
                )}
                {product.badge && (
                  <span className="rounded-full bg-gilt-500 px-2.5 py-1 text-[11px] font-semibold text-accent-ink">
                    {product.badge}
                  </span>
                )}
                <WishlistButton
                  productId={product.id}
                  retailer="evdance"
                  currentPrice={product.price}
                  className="static ml-auto"
                />
              </div>

              <PriceAsOfLabel partnerId="evdance" slug={product.slug} />

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <a
                  href={product.deepLink}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gilt-500 px-6 py-3 text-sm font-semibold text-accent-ink transition-colors hover:bg-gilt-400"
                >
                  View on EVDANCE
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
                <a
                  href="#details"
                  className="flex flex-1 items-center justify-center rounded-full border border-gilt-500/30 bg-noir-800 px-6 py-3 text-sm font-semibold text-ivory-100 transition-colors hover:border-gilt-400 hover:text-gilt-400"
                >
                  View Details
                </a>
              </div>

              <p className="text-xs text-ivory-400">
                &ldquo;View on EVDANCE&rdquo; takes you to EVDANCE&rsquo;s own store to complete your purchase.
              </p>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
                <PriceHistoryChart
                  productId={product.id}
                  retailer="evdance"
                  currentPrice={product.price}
                />
                <PriceAlertCTA
                  productId={product.id}
                  retailer="evdance"
                  currentPrice={product.price}
                />
              </div>

              <div id="details" className="mt-4 scroll-mt-24 border-t border-gilt-500/20 pt-6">
                <h2 className="font-display text-lg font-semibold text-ivory-50">
                  Product Details
                </h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ivory-300">
                  {product.description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {related.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
            <h2 className="mb-6 font-display text-xl font-semibold text-ivory-50">
              More from {product.category}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {related.map((p) => (
                <RealProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
