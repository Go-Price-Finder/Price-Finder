"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ThemeToggle from "./ThemeToggle";
import { ChevronRightIcon, HeartIcon } from "./icons";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth-context";
import { signOutAction } from "@/lib/supabase/actions";

/* ---------------------------------------------------------------------------
 * SiteHeader
 *
 * STRUCTURE is the operator-delivered design (2026-08-19): two rows, a
 * "Stores" mega menu with a category rail + store panel and a pinned
 * "See all stores" button, monogram tiles, flag-as-location-indicator.
 * COLOURS are the site's token system (noir/gilt/ivory), per the operator's
 * correction: the delivered stone/white/rose values were placeholders
 * "written by someone who had not seen the site", and the site has TWO
 * themes driven by these tokens — a hardcoded palette is wrong in both.
 * Token classes here render correctly under light and dark exactly like
 * every other surface (findings §32).
 *
 * SIGNED-IN AFFORDANCES restored per the same ruling (a live functional
 * regression, not a design question): wishlist link with live count,
 * account state with sign-out, theme toggle, the live-suggestion
 * SearchBar, and the back button on non-home pages — everything the
 * replaced header carried, in the new design language, EXCEPT the old
 * notifications bell, which was a button with no handler (a dead control,
 * §24's family) and is deliberately not resurrected. Log in / Sign up
 * render only when signed out.
 *
 * Data comes in as props. Nothing is hardcoded except the nav labels, each
 * of which must point at a route that exists:
 *   /stores  /deals  /trending  /guides  /how-it-works
 * (/gift-cards is deliberately absent — see the NAV comment below)
 *
 * "Stores", not "Partners" -- partner is our word for a commercial
 * relationship; a shopper thinks in stores. Use the visitor's word.
 *
 * The rail's first row is "All stores", selected by default, so the panel
 * opens full rather than showing two stores until you hover something --
 * that default is what makes a rail read well at seven stores instead of
 * at seventy.
 *
 * Deliberately ABSENT, each for a stated reason:
 *   - Country picker  US-only. The flag is a location indicator, not a
 *                     control. A dropdown offering no alternative would be
 *                     a dead control. No currency shown: we take no
 *                     payment, so currency was never ours to state.
 *   - Store logos     every partner's logo_url is NULL by design (we do
 *                     not hotlink the network CDN). StoreTile renders a
 *                     monogram at the exact footprint a logo would occupy,
 *                     so hosting logos later is not a layout change.
 *   - Notifications bell  the old header's was a handler-less button — a
 *                     dead control. It returns when notifications exist.
 *   - Restaurants, flights, hotels, pharmacy, AI shopping -- we do not
 *                     have them. Their absence is the point of the design.
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
  // (2026-08-19, ruling upheld; record: claude/handover-2026-08-19.md,
  // standing rule 3 — never ship navigation to a section that does not
  // exist, because a nav item IS a claim that it does): no Rakuten
  // credentials are wired, no Giftcards.com feed is available, and
  // lib/partner-compliance.json has no giftcards.com entry (terms never
  // reviewed), so no page with genuine content can be built today — and
  // a nav item promises a section exists.
  // REINSTATE when all three exist, in the SAME commit as a real
  // /gift-cards page: { label: "Gift cards", href: "/gift-cards" },
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
  const [signingOut, setSigningOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { count } = useWishlist();
  const { user, loading, signOutLocally } = useAuth();
  const isHome = pathname === "/";

  const storeById = new Map(stores.map((s) => [s.id, s]));

  async function handleSignOut() {
    setSigningOut(true);
    await signOutLocally();
    await signOutAction();
  }

  // Close on route change.
  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  // SCROLL TRAP FIX (operator item 1, 2026-08-19): with the mega menu
  // open, the wheel used to scroll the page behind it. Lock page scroll
  // while open, compensating for the scrollbar width so locking causes
  // no layout shift (a shift on open would be a worse bug than the trap).
  // The rail's own container carries overflow-y-auto +
  // overscroll-contain, so it scrolls internally and its overscroll does
  // not chain to the (locked) page. Decision, stated: while the menu is
  // open the page does not scroll ANYWHERE — wheel outside the menu does
  // nothing, and the existing click-outside/Escape handlers close it.
  // The mobile drawer needs no lock: it renders IN FLOW (pushes content
  // down rather than overlaying), so page scroll with the drawer open is
  // ordinary document scrolling, not a trap.
  useEffect(() => {
    if (!menuOpen) return;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPadding = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPadding;
    };
  }, [menuOpen]);

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

  /** ONE shared geometry for the account-row pills (operator item 2):
   * Wishlist and Log out must share height, padding, radius, font size
   * and weight — extracted here so the values cannot drift apart on the
   * next edit, which is exactly what hand-matched values do. h-11 is the
   * header row's control height (wishlist icon, flag, theme toggle,
   * mobile button all sit on it). Colours stay per-button. */
  const ACCOUNT_PILL =
    // whitespace-nowrap lives on the SHARED class, not on the one pill
    // that happened to wrap ("Log out" broke to two lines): a fix applied
    // to a single instance is the same bug waiting at a narrower
    // breakpoint. Every pill using this class is immune by construction.
    "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200";

  /** Wishlist link with live count — desktop and mobile share it. */
  function WishlistLink({ className = "" }: { className?: string }) {
    return (
      <Link
        href="/wishlist"
        aria-label={`Wishlist, ${count} saved item${count === 1 ? "" : "s"}`}
        className={`relative flex h-11 w-11 items-center justify-center rounded-full text-ivory-100 transition-colors hover:bg-noir-700 hover:text-ivory-50 ${className}`}
      >
        <HeartIcon className="h-5 w-5" filled={count > 0} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gilt-500 px-1 text-[10px] font-semibold text-accent-ink">
            {count}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div ref={wrapRef} className="relative z-50">
      <header className="sticky top-0 border-b border-gilt-500/20 bg-noir-900/85 backdrop-blur-md">
        {/* ---------------- row 1: back · logo · search · account ---------------- */}
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          {!isHome && (
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gilt-500/25 bg-noir-800 text-ivory-100 shadow-soft transition-all duration-200 hover:border-gilt-400 hover:text-gilt-400 sm:flex"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
            </button>
          )}

          <Link href="/" className="shrink-0" aria-label="Go Price Finder home">
            <Logo />
          </Link>

          {/* Live-suggestion search (the replaced header's SearchBar, not a
              plain GET form — the suggestion dropdown was one of the
              affordances the first integration lost). */}
          <div className="mx-auto hidden w-full max-w-2xl md:block">
            <SearchBar placeholder="Search products across our stores" />
          </div>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <WishlistLink className="hidden lg:flex" />
            <ThemeToggle />

            {loading ? (
              <div className="hidden h-11 w-24 animate-pulse rounded-full bg-noir-700 sm:block" />
            ) : user ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/wishlist"
                  className={`${ACCOUNT_PILL} gap-2 border border-ivory-100/10 pl-1.5 pr-4 text-ivory-50 hover:border-gilt-400/40 hover:bg-gilt-500/10`}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gilt-500/15 text-xs font-semibold text-gilt-400">
                    {user.email?.charAt(0).toUpperCase() ?? "?"}
                  </span>
                  Wishlist
                </Link>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className={`${ACCOUNT_PILL} border border-gilt-500/40 bg-noir-800 px-4 text-gilt-400 hover:border-gilt-400 hover:bg-gilt-500/10 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {signingOut ? "Logging out…" : "Log out"}
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className={`${ACCOUNT_PILL} hidden px-4 text-ivory-200 hover:bg-noir-700 hover:text-ivory-50 sm:flex`}
                >
                  Log in
                </Link>
                <Link
                  href="/auth/signup"
                  className={`${ACCOUNT_PILL} hidden bg-gilt-500 px-5 text-accent-ink shadow-soft hover:bg-gilt-400 active:scale-[0.98] sm:flex`}
                >
                  Sign up
                </Link>
              </>
            )}

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
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ivory-100 transition hover:bg-noir-700 md:hidden"
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
                ? "bg-gilt-500 text-accent-ink"
                : "text-ivory-200 hover:bg-noir-700 hover:text-ivory-50"
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
                    ? "bg-noir-700 text-ivory-50"
                    : "text-ivory-200 hover:bg-noir-700 hover:text-ivory-50"
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
              <div className="overflow-hidden rounded-2xl border border-gilt-500/25 bg-noir-800 shadow-soft-xl">
                {/* See all stores -- a real button, not a text link */}
                <div className="flex items-center justify-between gap-4 border-b border-noir-700 px-5 py-4">
                  <Link
                    href="/stores"
                    className="inline-flex items-center gap-2 rounded-full bg-gilt-500 px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-soft transition hover:bg-gilt-400 active:scale-[0.98]"
                  >
                    See all stores
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                  <p className="truncate text-sm text-ivory-400">
                    {stores.length} stores &middot;{" "}
                    {stores.reduce((n, x) => n + x.productCount, 0).toLocaleString()}{" "}
                    products, checked daily
                  </p>
                </div>

                <div className="grid grid-cols-12">
                  {/* left: category rail */}
                  <div className="col-span-4 border-r border-noir-700 bg-noir-900/40 p-3 lg:col-span-3">
                    <div className="max-h-[27rem] overflow-y-auto overscroll-contain pr-1">
                      <RailItem
                        label="All stores"
                        count={stores.length}
                        active={activeCategory === ALL}
                        onSelect={() => setActiveCategory(ALL)}
                      />
                      <div className="my-2 border-t border-noir-700" />
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
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-ivory-400">
                        {activeCategoryName}
                      </h3>
                      {activeCategory !== ALL && (
                        <Link
                          href={`/category/${activeCategory}`} /* detail route is /category/[slug]; /categories/<slug> does not exist */
                          className="shrink-0 text-sm font-medium text-ivory-400 transition hover:text-gilt-400"
                        >
                          Browse category &rarr;
                        </Link>
                      )}
                    </div>

                    {activeStores.length === 0 ? (
                      <p className="py-12 text-center text-sm text-ivory-400">
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
        <div className="border-b border-gilt-500/20 bg-noir-900 px-4 pb-6 pt-2 md:hidden">
          <div className="mb-4">
            <SearchBar placeholder="Search products" />
          </div>

          <Link href="/stores" className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-ivory-50 hover:bg-noir-800">
            Stores
          </Link>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-ivory-50 hover:bg-noir-800">
              {item.label}
            </Link>
          ))}
          <Link
            href="/wishlist"
            className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-medium text-ivory-50 hover:bg-noir-800"
          >
            Wishlist
            {count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gilt-500 px-1.5 text-[11px] font-semibold text-accent-ink">
                {count}
              </span>
            )}
          </Link>

          <div className="mt-4 flex items-center gap-2 border-t border-noir-700 pt-4">
            {loading ? (
              <div className="h-11 flex-1 animate-pulse rounded-full bg-noir-700" />
            ) : user ? (
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex-1 rounded-full border border-gilt-500/40 bg-noir-800 py-3 text-center text-sm font-medium text-gilt-400 disabled:opacity-60"
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            ) : (
              <>
                <Link href="/auth/login" className="flex-1 rounded-full border border-gilt-500/25 py-3 text-center text-sm font-medium text-ivory-100">
                  Log in
                </Link>
                <Link href="/auth/signup" className="flex-1 rounded-full bg-gilt-500 py-3 text-center text-sm font-medium text-accent-ink">
                  Sign up
                </Link>
              </>
            )}
            <ThemeToggle />
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
      className="group flex items-center gap-2 rounded-2xl border border-transparent p-3 transition hover:border-gilt-500/30 hover:bg-noir-700/60"
    >
      {/* One footprint, two fills. A cleared logo renders on a LIGHT PLATE
          in BOTH themes — merchant marks are overwhelmingly dark artwork
          and disappear on a dark surface, so the plate is baked into the
          asset (scripts/fetch-partner-logos.mjs) and repeated here so the
          box reads as deliberate rather than as a pasted-on chip. The
          monogram keeps the accent-tinted fill. Identical h-11 w-11
          either way: swapping one for the other is not a layout change. */}
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-[13px] font-semibold ring-1 ring-inset transition ${
          store.logoUrl
            ? "bg-[#f4f4f2] ring-noir-950/10"
            : "bg-gilt-500/10 text-ivory-50 ring-gilt-500/15 group-hover:bg-gilt-500/20"
        }`}
      >
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.logoUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-contain p-1"
          />
        ) : (
          monogram
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ivory-50">
          {store.name}
        </span>
        {store.tagline ? (
          <span className="block truncate text-xs text-ivory-400">
            {store.tagline}
          </span>
        ) : (
          <span className="block text-xs text-ivory-400 tabular-nums">
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
          ? "bg-noir-700 font-medium text-ivory-50 shadow-soft"
          : "text-ivory-300 hover:bg-noir-700/60 hover:text-ivory-50"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="ml-3 shrink-0 text-xs tabular-nums text-ivory-400">
        {count}
      </span>
    </button>
  );
}
