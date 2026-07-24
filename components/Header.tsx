"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Logo from "./Logo";
import SearchBar from "./SearchBar";
import ThemeToggle from "./ThemeToggle";
import { BellIcon, CloseIcon, HeartIcon, MenuIcon } from "./icons";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth-context";
import { signOutAction } from "@/lib/supabase/actions";

const NAV_LINKS = [
  { label: "Trending", href: "/trending" },
  { label: "Categories", href: "/#categories" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Deals", href: "/deals" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { count } = useWishlist();
  const { user, loading, signOutLocally } = useAuth();
  const [signingOut, startSignOut] = useTransition();

  function handleSignOut() {
    startSignOut(async () => {
      // Clear client-side auth state (and with it, anything derived from
      // it — the avatar below, the wishlist context) immediately, then
      // let the server action clear the session cookie and redirect.
      await signOutLocally();
      await signOutAction();
    });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gilt-500/20 bg-noir-900/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="relative text-sm font-medium text-ivory-100 transition-colors hover:text-ivory-50 after:absolute after:-bottom-1 after:left-0 after:h-[1.5px] after:w-0 after:bg-gilt-500 after:transition-all after:duration-300 hover:after:w-full"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden max-w-md flex-1 md:block">
          <SearchBar />
        </div>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          <Link
            href="/wishlist"
            aria-label={`Wishlist, ${count} saved item${count === 1 ? "" : "s"}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ivory-100 transition-colors hover:bg-noir-700 hover:text-ivory-50"
          >
            <HeartIcon className="h-5 w-5" filled={count > 0} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gilt-500 px-1 text-[10px] font-semibold text-noir-950">
                {count}
              </span>
            )}
          </Link>
          <button
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ivory-100 transition-colors hover:bg-noir-700 hover:text-ivory-50"
          >
            <BellIcon className="h-5 w-5" />
          </button>
          <ThemeToggle />

          {loading ? (
            <div className="h-10 w-24 animate-pulse rounded-full bg-noir-700" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full border border-ivory-100/10 py-1.5 pl-1.5 pr-4 text-sm font-medium text-ivory-50 transition-all duration-200 hover:border-gilt-400/40 hover:bg-gilt-500/10"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gilt-500/15 text-xs font-semibold text-gilt-400">
                  {user.email?.charAt(0).toUpperCase() ?? "?"}
                </span>
                Dashboard
              </Link>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-full border border-gilt-500/40 bg-noir-800 px-4 py-2.5 text-sm font-medium text-gilt-400 transition-all duration-200 hover:border-gilt-400 hover:bg-gilt-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-full border border-gilt-500/40 bg-noir-800 px-5 py-2.5 text-sm font-medium text-gilt-400 transition-all duration-300 hover:border-gilt-400 hover:bg-gilt-500/10"
            >
              Sign In
            </Link>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1 lg:hidden">
          <Link
            href="/wishlist"
            aria-label={`Wishlist, ${count} saved item${count === 1 ? "" : "s"}`}
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-ivory-50 transition-colors hover:bg-noir-700"
          >
            <HeartIcon className="h-5 w-5" filled={count > 0} />
            {count > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gilt-500 px-1 text-[10px] font-semibold text-noir-950">
                {count}
              </span>
            )}
          </Link>
          <ThemeToggle className="text-ivory-50" />
          <button
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ivory-50 transition-colors hover:bg-noir-700"
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile search, always visible under 768px */}
      <div className="px-5 pb-4 md:hidden">
        <SearchBar />
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out lg:hidden ${
          menuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 border-t border-gilt-500/20 bg-noir-900 px-5 py-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-xl px-3 py-3 text-sm font-medium text-ivory-100 transition-colors hover:bg-noir-700 hover:text-ivory-50"
            >
              {link.label}
            </Link>
          ))}

          {loading ? (
            <div className="mt-2 h-11 animate-pulse rounded-full bg-noir-700" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMenuOpen(false)}
                className="mt-2 rounded-full bg-gilt-500/10 px-5 py-3 text-center text-sm font-medium text-gilt-400 transition-colors hover:bg-gilt-500/15"
              >
                Dashboard
              </Link>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleSignOut();
                }}
                disabled={signingOut}
                className="rounded-full bg-gilt-500 px-5 py-3 text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? "Logging out…" : "Log out"}
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              onClick={() => setMenuOpen(false)}
              className="mt-2 rounded-full bg-gilt-500 px-5 py-3 text-center text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
