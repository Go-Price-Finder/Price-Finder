import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";
import { getPartners } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "All Stores — Go Price Finder",
  description:
    "Every store Go Price Finder tracks — real catalogues, real prices, checked daily.",
};

/**
 * The stores index (2026-08-19). This route did not exist before the
 * SiteHeader redesign made "See all stores" the most prominent element in
 * the menu — a button that prominent cannot land on a 404 or a stub, so
 * this is a real grid fed by the same getPartners() every other surface
 * reads (compliance-filtered at source, §21). "Stores", not "Partners":
 * partner is our word for a commercial relationship; a shopper thinks in
 * stores.
 */
export default async function StoresPage() {
  const partners = await getPartners();
  const totalProducts = partners.reduce((n, p) => n + p.products.length, 0);

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
            <span className="text-ivory-200">Stores</span>
          </nav>
        </div>

        <section className="mx-auto max-w-7xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Stores
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            All stores
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mt-3 max-w-2xl text-ivory-300">
            {partners.length} stores, {totalProducts.toLocaleString()} products
            — every price checked daily against the store&rsquo;s own feed,
            and every listing shows when it was last verified.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner) => (
              <Link
                key={partner.id}
                href={partner.href}
                className="group rounded-2xl border border-gilt-500/20 bg-noir-800/70 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-gilt-400/40 hover:shadow-soft"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gilt-500/10 font-display text-lg font-semibold text-gilt-400">
                    {partner.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-lg font-medium text-ivory-50 group-hover:text-gilt-400">
                      {partner.name}
                    </h2>
                    <p className="text-xs tabular-nums text-ivory-400">
                      {partner.products.length} products
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-ivory-300">
                  {partner.tagline}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
