import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RealProductCard from "@/components/RealProductCard";
import { ChevronRightIcon } from "@/components/icons";
import { getCategoryBySlug, getRealCategories } from "@/lib/partners";

/**
 * Dedicated single-category page — this is where Popular Categories tiles
 * link now, instead of `/brooklyn-delhi#<slug>` (an anchor on the shared
 * partner page that stacked every category vertically, so clicking "Food"
 * scrolled to Food but left Clothing, Accessories, etc. visible right
 * below it). This route shows ONLY the clicked category's real products —
 * across every partner that has any, via getCategoryBySlug — with nothing
 * else on the page.
 */
export function generateStaticParams() {
  return getRealCategories().map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: "Not found — Price Finder" };
  return {
    title: `${category.name} — Price Finder`,
    description: `Every real ${category.name.toLowerCase()} product we're tracking, from all our partners.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) notFound();

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
            <span className="text-ivory-200">{category.name}</span>
          </nav>
        </div>

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 text-center sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Category
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            {category.name}
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            {category.itemCount} real {category.itemCount === 1 ? "product" : "products"} in{" "}
            {category.name}, from our real partners.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          {category.products.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/50 px-6 py-16 text-center">
              <p className="text-sm text-ivory-300">
                No products in this category right now — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {category.products.map((product) => (
                <RealProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
