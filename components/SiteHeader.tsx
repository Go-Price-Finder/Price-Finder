"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/* ---------------------------------------------------------------------------
 * SiteHeader
 *
 * Data comes in as props. Nothing is hardcoded except the nav labels, each of
 * which must point at a route that exists:
 *   /stores  /deals  /trending  /guides  /how-it-works
 * (/gift-cards is deliberately absent — see the NAV comment below)
 *
 * "Stores", not "Partners" -- partner is our word for a commercial
 * relationship; a shopper thinks in stores. Use the visitor's word.
 *
 * The menu is a category rail on the left with a store panel on the right,
 * and a "See all stores" button pinned above both. The rail's first row is
 * "All stores", selected by default, so the panel opens full rather than
 * showing two stores until you hover something -- that default is what makes
 * a rail read well at seven stores instead of at seventy.
 *
 * /gift-cards SHIPS WITH THIS NAV ITEM, never after it. Discounted gift cards
 * are one of the few categories where the discount IS the product, so the
 * section is on-strategy -- but a nav item promises a section exists, and
 * nav-first is how a link becomes a promise nothing keeps.
 *
 * Deliberately ABSENT, each for a stated reason:
 *   - Country picker  US-only. The flag is a location indicator, not a
 *                     control. A dropdown offering no alternative would be a
 *                     dead control. No currency shown: we take no payment, so
 *                     currency was never ours to state.
 *   - Store logos     every partner's logo_url is NULL by design (we do not
 *                     hotlink the network CDN). StoreTile renders a monogram
 *                     at the exact footprint a logo would occupy, so hosting
 *                     logos later is not a layout change.
 *   - Restaurants, flights, hotels, pharmacy, AI shopping -- we do not have
 *                     them. Their absence is the point of the redesign.
 * ------------------------------------------------------------------------- */

export type HeaderStore = {
  id: string;
  name: string;
  href: string;
  tagline?: string | null;
  logoUrl?: string | null;
  productCount: number;
};

export type HeaderCategory = {
  slug: string;
  name: string;
  productCount: number;
  storeIds: string[];
};

type Props = {
  categories: HeaderCategory[];
  stores: HeaderStore[];
};

const NAV = [
  // "Gift cards" DROPPED per the operator's own sequencing rule
  // (2026-08-19): no Rakuten credentials are wired, no Giftcards.com feed
  // is available, and lib/partner-compliance.json has no giftcards.com
  // entry (terms never reviewed), so no page with genuine content can be
  // built today — and a nav item promises a section exists. REINSTATE
  // when all three exist, in the SAME commit as a real /gift-cards page:
  // { label: "Gift cards", href: "/gift-cards" },
  { label: "Deals", href: "/deals" },
  { label: "New arrivals", href: "/trending" },
  { label: "Buying guides", href: "/guides" },
  { label: "How it works", href: "/how-it-works" },
];

export default function SiteHeader({ categories, stores }: Props) {
  const ALL = "__all__";
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const storeById = new Map(stores.map((s) => [s.id, s]));

  // Close on route change.
  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape, and on click outside the header shell.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setMobileOpen(false);
      }
    }
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const activeCategoryName =
    activeCategory === ALL
      ? "All stores"
      : (categories.find((c) => c.slug === activeCategory)?.name ?? "Stores");

  const activeStores =
    activeCategory === ALL
      ? stores
      : (categories
          .find((c) => c.slug === activeCategory)
          ?.storeIds.map((id) => storeById.get(id))
          .filter((x): x is HeaderStore => Boolean(x)) ?? []);

  return (
    <div ref={wrapRef} className="relative z-50">
      <header className="border-b border-stone-200/70 bg-white/90 backdrop-blur-md">
        {/* ---------------- row 1: logo · search · account ---------------- */}
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 text-2xl font-semibold tracking-tight text-stone-900"
          >
            GoPrice<span className="text-rose-500">Finder</span>
          </Link>

          <form
            action="/search"
            className="relative mx-auto hidden w-full max-w-2xl md:block"
            role="search"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400"
            >
              <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.6" />
              <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products across our stores"
              aria-label="Search products"
              className="w-full rounded-full border border-stone-200 bg-stone-50 py-3.5 pl-13 pr-28 text-[15px] text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-stone-300 focus:bg-white focus:ring-4 focus:ring-stone-900/5"
              style={{ paddingLeft: "3.25rem" }}
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 active:scale-[0.98]"
            >
              Search
            </button>
          </form>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <Link
              href="/auth/login"
              className="hidden rounded-full px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="hidden rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 hover:shadow active:scale-[0.98] sm:inline-flex"
            >
              Sign up
            </Link>

            {/* Static, non-interactive. We serve one region; a picker that
                offers no alternative would be a control that does nothing. */}
            {/* Location indicator, not a control. We serve the United States
                only; there is nothing to switch to. No currency: we take no
                payment, so currency is not ours to state. */}
            <span
              title="You're shopping in the United States"
              aria-label="Shopping in the United States"
              role="img"
              className="hidden h-11 w-11 select-none items-center justify-center rounded-full text-xl leading-none lg:inline-flex"
            >
              🇺🇸
            </span>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-700 transition hover:bg-stone-100 md:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                {mobileOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
              </svg>
            </button>
          </div>
        </div>

        {/* ---------------- row 2: primary navigation ---------------- */}
        <nav className="mx-auto hidden max-w-7xl items-center gap-1 px-4 pb-3 sm:px-6 md:flex lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              menuOpen
                ? "bg-stone-900 text-white"
                : "text-stone-700 hover:bg-stone-100"
            }`}
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="6.5" height="6.5" rx="1.5" />
              <rect x="9.5" y="0" width="6.5" height="6.5" rx="1.5" />
              <rect x="0" y="9.5" width="6.5" height="6.5" rx="1.5" />
              <rect x="9.5" y="9.5" width="6.5" height="6.5" rx="1.5" />
            </svg>
            Stores
            <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m3 4.5 3 3 3-3" />
            </svg>
          </button>

          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-stone-100 text-stone-900"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ---------------- mega menu: category rail + store panel -------- */}
        {menuOpen && (
          <div className="absolute inset-x-0 top-full hidden md:block">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-[0_24px_70px_-20px_rgba(28,25,23,0.25)]">
                {/* See all stores -- a real button, not a text link */}
                <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
                  <Link
                    href="/stores"
                    className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 hover:shadow active:scale-[0.98]"
                  >
                    See all stores
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                  <p className="truncate text-sm text-stone-500">
                    {stores.length} stores &middot;{" "}
                    {stores.reduce((n, x) => n + x.productCount, 0).toLocaleString()}{" "}
                    products, checked daily
                  </p>
                </div>

                <div className="grid grid-cols-12">
                  {/* left: category rail */}
                  <div className="col-span-4 border-r border-stone-100 bg-stone-50/60 p-3 lg:col-span-3">
                    <div className="max-h-[27rem] overflow-y-auto pr-1">
                      <RailItem
                        label="All stores"
                        count={stores.length}
                        active={activeCategory === ALL}
                        onSelect={() => setActiveCategory(ALL)}
                      />
                      <div className="my-2 border-t border-stone-200/70" />
                      {categories.map((c) => (
                        <RailItem
                          key={c.slug}
                          label={c.name}
                          count={c.productCount}
                          active={c.slug === activeCategory}
                          onSelect={() => setActiveCategory(c.slug)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* right: stores in the selected category */}
                  <div className="col-span-8 p-6 lg:col-span-9">
                    <div className="mb-4 flex items-baseline justify-between gap-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
                        {activeCategoryName}
                      </h3>
                      {activeCategory !== ALL && (
                        <Link
                          href={`/category/${activeCategory}`} /* detail route is /category/[slug]; /categories/<slug> does not exist */
                          className="shrink-0 text-sm font-medium text-stone-500 transition hover:text-stone-900"
                        >
                          Browse category &rarr;
                        </Link>
                      )}
                    </div>

                    {activeStores.length === 0 ? (
                      <p className="py-12 text-center text-sm text-stone-400">
                        No stores in this category yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                        {activeStores.map((x) => (
                          <StoreTile key={x.id} store={x} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </header>

      {/* ---------------- mobile drawer ---------------- */}
      {mobileOpen && (
        <div className="border-b border-stone-200 bg-white px-4 pb-6 pt-2 md:hidden">
          <form action="/search" role="search" className="relative mb-4">
            <input
              type="search"
              name="q"
              placeholder="Search products"
              aria-label="Search products"
              className="w-full rounded-full border border-stone-200 bg-stone-50 px-5 py-3.5 text-[15px] outline-none focus:border-stone-300 focus:bg-white"
            />
          </form>

          <Link href="/stores" className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-stone-900 hover:bg-stone-50">
            Stores
          </Link>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-stone-900 hover:bg-stone-50">
              {item.label}
            </Link>
          ))}

          <div className="mt-4 flex gap-2 border-t border-stone-100 pt-4">
            <Link href="/auth/login" className="flex-1 rounded-full border border-stone-200 py-3 text-center text-sm font-medium text-stone-700">
              Log in
            </Link>
            <Link href="/auth/signup" className="flex-1 rounded-full bg-stone-900 py-3 text-center text-sm font-medium text-white">
              Sign up
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * StoreTile — monogram today, real logo the day we host one. Same footprint
 * either way, so adding logos is not a layout change.
 * ----------------------------------------------------------------------- */
function StoreTile({ store }: { store: HeaderStore }) {
  const monogram = store.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Link
      href={store.href}
      className="group flex items-center gap-3 rounded-2xl border border-transparent p-3 transition hover:border-stone-200 hover:bg-stone-50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-stone-100 to-stone-200 text-[13px] font-semibold text-stone-500 ring-1 ring-inset ring-stone-900/5 transition group-hover:from-rose-50 group-hover:to-rose-100 group-hover:text-rose-500">
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logoUrl} alt="" className="h-full w-full object-contain" />
        ) : (
          monogram
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-stone-900">
          {store.name}
        </span>
        {store.tagline ? (
          <span className="block truncate text-xs text-stone-500">
            {store.tagline}
          </span>
        ) : (
          <span className="block text-xs text-stone-400 tabular-nums">
            {store.productCount} products
          </span>
        )}
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------
 * RailItem — one row in the category rail.
 * ----------------------------------------------------------------------- */
function RailItem({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onSelect}
      onFocus={onSelect}
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm transition ${
        active
          ? "bg-white font-medium text-stone-900 shadow-sm"
          : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="ml-3 shrink-0 text-xs tabular-nums text-stone-400">
        {count}
      </span>
    </button>
  );
}
