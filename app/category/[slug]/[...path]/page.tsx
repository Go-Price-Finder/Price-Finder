import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getProductsByCategoryPath, getPopulatedCategoryPaths } from "@/lib/partners";

/**
 * Nested product-type page — where a populated product-type pill on
 * /categories links now (e.g. "T-Shirts (3)" under Unisex Clothing), so
 * clicking it shows only that leaf's real products instead of its whole
 * parent department. `path` is always exactly [categorySlug, ptgSlug,
 * productTypeSlug]; anything else 404s. Category/productTypeGroup levels
 * don't get their own pages — only the leaf does — so those two segments
 * of the breadcrumb below are plain text, not links.
 */
export function generateStaticParams() {
  return getPopulatedCategoryPaths().map(({ deptSlug, path }) => ({
    slug: deptSlug,
    path,
  }));
}

function resolvePath(slug: string, path: string[]) {
  if (path.length !== 3) return undefined;
  const [catSlug, ptgSlug, typeSlug] = path;
  return getProductsByCategoryPath(slug, catSlug, ptgSlug, typeSlug);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}): Promise<Metadata> {
  const { slug, path } = await params;
  const result = resolvePath(slug, path);
  if (!result) return { title: "Not found — Price Finder" };
  return {
    title: `${result.productType} — Price Finder`,
    description: `Every real ${result.productType.toLowerCase()} product we're tracking, from all our partners.`,
  };
}

export default async function CategoryLeafPage({
  params,
}: {
  params: Promise<{ slug: string; path: string[] }>;
}) {
  const { slug, path } = await params;
  const result = resolvePath(slug, path);
  if (!result) notFound();

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
            <Link href="/categories" className="transition-colors hover:text-gilt-400">
              Categories
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <Link href={`/category/${slug}`} className="transition-colors hover:text-gilt-400">
              {result.department}
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span>{result.category}</span>
            <ChevronRightIcon className="h-3 w-3" />
            <span>{result.productTypeGroup}</span>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="text-ivory-200">{result.productType}</span>
          </nav>
        </div>

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 text-center sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Category
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            {result.productType}
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            {result.products.length} real {result.products.length === 1 ? "product" : "products"} in{" "}
            {result.productType}, from our real partners.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {result.products.map((product) => (
              <RealProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
