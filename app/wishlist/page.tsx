"use client";

import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TargetPriceCell from "@/components/TargetPriceCell";
import ProductImagePlaceholder from "@/components/ProductImagePlaceholder";
import { HeartIcon, ChevronRightIcon } from "@/components/icons";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth-context";
import { formatPrice, formatShortDate, getRetailer } from "@/lib/data";

export default function WishlistPage() {
  const { items, loading: wishlistLoading, remove, clear } = useWishlist();
  const { user, loading: authLoading } = useAuth();

  const loading = authLoading || wishlistLoading;

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
                Your picks
              </span>
              <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
                Wishlist
              </h1>
              <p className="mt-2 text-sm text-ivory-300">
                {loading
                  ? "Loading your saved items…"
                  : items.length === 0
                    ? "Nothing saved yet."
                    : `Comparing ${items.length} item${items.length === 1 ? "" : "s"} across retailers, side by side.`}
              </p>
            </div>
            {!loading && user && items.length > 0 && (
              <button
                onClick={() => clear()}
                className="rounded-full border border-gilt-500/25 bg-noir-800 px-4 py-2 text-sm font-medium text-ivory-200 shadow-soft transition-all duration-200 hover:border-gilt-400 hover:text-ivory-50"
              >
                Clear wishlist
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl border border-gilt-500/20 bg-noir-800/50"
                />
              ))}
            </div>
          ) : !user ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/40 px-6 py-20 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-noir-800 text-clay-500 shadow-soft">
                <HeartIcon className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-medium text-ivory-50">
                Sign in to see your wishlist
              </p>
              <p className="max-w-sm text-sm text-ivory-300">
                Your saved items live on your account now, so you can pick up
                your comparisons on any device.
              </p>
              <Link
                href="/auth/login?redirectedFrom=/wishlist"
                className="group mt-1 inline-flex items-center gap-1 rounded-full bg-gilt-500 px-5 py-2.5 text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400"
              >
                Sign in
                <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-gilt-500/25 bg-noir-800/40 px-6 py-20 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-noir-800 text-clay-500 shadow-soft">
                <HeartIcon className="h-6 w-6" />
              </span>
              <p className="font-display text-lg font-medium text-ivory-50">
                Your wishlist is empty
              </p>
              <p className="max-w-sm text-sm text-ivory-300">
                Tap the heart icon on any product to save it here and compare
                prices across retailers later.
              </p>
              <Link
                href="/#trending"
                className="group mt-1 inline-flex items-center gap-1 rounded-full bg-gilt-500 px-5 py-2.5 text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400"
              >
                Browse trending products
                <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-gilt-500/25 bg-noir-800 shadow-soft">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-gilt-500/25 bg-noir-800/50 text-xs font-semibold uppercase tracking-wide text-ivory-300">
                      <th className="px-5 py-3 font-semibold">Product</th>
                      <th className="px-5 py-3 font-semibold">Retailer</th>
                      <th className="px-5 py-3 font-semibold">Price when saved</th>
                      <th className="px-5 py-3 font-semibold">Price alert</th>
                      <th className="px-5 py-3 font-semibold">Saved</th>
                      <th className="px-5 py-3 font-semibold text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const retailer = getRetailer(item.retailer);
                      const name = item.product?.name ?? "Unknown product";
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-noir-600 transition-colors last:border-0 hover:bg-noir-700/50"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                                <ProductImagePlaceholder compact />
                              </div>
                              <div>
                                <p className="line-clamp-2 max-w-[220px] font-display text-sm font-medium text-ivory-50">
                                  {name}
                                </p>
                                {item.product?.category && (
                                  <p className="text-xs text-ivory-300">
                                    {item.product.category}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${retailer.badgeClass}`}
                            >
                              {retailer.name}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-display text-sm font-semibold text-price-text">
                            {formatPrice(item.priceSaved)}
                          </td>
                          <td className="px-5 py-4">
                            <TargetPriceCell item={item} />
                          </td>
                          <td className="px-5 py-4 text-sm text-ivory-300">
                            {formatShortDate(item.createdAt)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() =>
                                remove({ id: item.productId, retailer: item.retailer })
                              }
                              aria-label={`Remove ${name} from wishlist`}
                              className="rounded-full border border-gilt-500/25 px-3 py-1.5 text-xs font-medium text-ivory-300 transition-colors hover:border-clay-400 hover:text-clay-500"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
