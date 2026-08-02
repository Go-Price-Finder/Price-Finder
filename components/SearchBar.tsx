"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchIcon } from "./icons";
import type { searchRealProducts as SearchRealProducts } from "@/lib/search";

type SearchBarProps = {
  size?: "md" | "lg";
  placeholder?: string;
  className?: string;
  buttonLabel?: string;
  showIcon?: boolean;
  /** When true, this bar isn't a product search at all (e.g. Footer's
   * "Get price drop alerts" email field reuses this component's styling)
   * — submitting it won't navigate to /search, and no results dropdown
   * renders. */
  disableSearchNav?: boolean;
};

const MAX_GROUPS = 3;
const MAX_PER_GROUP = 3;

export default function SearchBar({
  size = "md",
  placeholder = "Search for any product, brand, or store…",
  className = "",
  buttonLabel = "Search",
  showIcon = true,
  disableSearchNav = false,
}: SearchBarProps) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [searchReady, setSearchReady] = useState(false);
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  // Fuse.js + the full product catalog (lib/search.ts, ~1.5MB via
  // lib/partners.ts) is loaded lazily on first interaction rather than
  // imported statically — a static import would ship that whole graph in
  // the initial bundle for every page that renders a SearchBar (the
  // homepage Hero and every page's Header), even for users who never
  // search. The resolved function is cached here so subsequent
  // keystrokes/searches don't re-import.
  const searchFnRef = useRef<typeof SearchRealProducts | null>(null);

  const isLarge = size === "lg";

  // Kicks off the dynamic import the first time the user shows intent to
  // search (focusing the input, or typing directly into it). Idempotent —
  // safe to call from multiple handlers.
  const loadSearch = useCallback(() => {
    if (disableSearchNav || searchFnRef.current) return;
    import("@/lib/search").then((mod) => {
      searchFnRef.current = mod.searchRealProducts;
      setSearchReady(true);
    });
  }, [disableSearchNav]);

  // Debounce so every keystroke doesn't re-run the fuzzy search — 150ms is
  // short enough to still feel instant, long enough to skip intermediate
  // keystrokes during normal typing speed.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 150);
    return () => clearTimeout(t);
  }, [value]);

  // Close the dropdown on an outside click, not just on blur — blur alone
  // would fire before a result's onClick/navigation gets to run.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const results = useMemo(() => {
    // searchReady is only in the deps array to force a recompute once the
    // dynamic import resolves — the ref itself isn't reactive on its own.
    if (disableSearchNav || !debounced || !searchFnRef.current) return [];
    return searchFnRef.current(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, disableSearchNav, searchReady]);

  const grouped = useMemo(() => {
    const byCategory = new Map<string, typeof results>();
    for (const product of results) {
      const list = byCategory.get(product.parentCategory) ?? [];
      list.push(product);
      byCategory.set(product.parentCategory, list);
    }
    return Array.from(byCategory.entries()).slice(0, MAX_GROUPS);
  }, [results]);

  const showDropdown = !disableSearchNav && focused && debounced.length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disableSearchNav) return;
    const q = value.trim();
    if (q) {
      setFocused(false);
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <form
        role="search"
        onSubmit={handleSubmit}
        className={`group relative flex w-full items-center gap-2 rounded-full border bg-noir-800 transition-all duration-300 ${
          isLarge ? "px-3 py-2.5 sm:px-4" : "px-2 py-1.5"
        } ${
          focused
            ? "border-gilt-400 shadow-soft-lg ring-4 ring-gilt-500/20"
            : "border-gilt-500/25 shadow-soft hover:shadow-soft-lg"
        } ${className}`}
      >
        {showIcon && (
          <span
            className={`flex shrink-0 items-center justify-center rounded-full text-ivory-300 transition-colors ${
              focused ? "text-gilt-400" : ""
            } ${isLarge ? "h-9 w-9" : "h-7 w-7"}`}
          >
            <SearchIcon className={isLarge ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            loadSearch();
          }}
          onFocus={() => {
            setFocused(true);
            loadSearch();
          }}
          placeholder={placeholder}
          role={disableSearchNav ? undefined : "combobox"}
          aria-expanded={showDropdown}
          aria-autocomplete={disableSearchNav ? undefined : "list"}
          className={`w-full min-w-0 flex-1 bg-transparent text-ivory-50 placeholder:text-ivory-400 focus:outline-none ${
            isLarge ? "text-base sm:text-lg" : "text-sm"
          }`}
        />
        <button
          type="submit"
          className={`shrink-0 rounded-full bg-gilt-500 font-medium text-accent-ink transition-all duration-300 hover:bg-gilt-400 active:scale-95 ${
            isLarge
              ? "px-5 py-2.5 text-sm sm:px-6 sm:text-base"
              : "px-4 py-1.5 text-xs"
          }`}
        >
          {buttonLabel}
        </button>
      </form>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-gilt-500/25 bg-noir-800 py-2 shadow-soft-xl">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ivory-300">
              No products match &ldquo;{debounced}&rdquo; yet.
            </p>
          ) : (
            <>
              {grouped.map(([category, items]) => (
                <div key={category}>
                  <p className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wide text-gilt-400">
                    {category}
                  </p>
                  {items.slice(0, MAX_PER_GROUP).map((product) => (
                    <Link
                      key={product.id}
                      href={product.href}
                      onClick={() => setFocused(false)}
                      className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-ivory-100 transition-colors hover:bg-noir-700"
                    >
                      <span className="line-clamp-1">{product.name}</span>
                      <span className="shrink-0 tabular-nums text-ivory-400">
                        ${product.price.toLocaleString()}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}
              <button
                type="button"
                onClick={handleSubmit}
                className="mt-1 w-full border-t border-gilt-500/15 px-4 py-2.5 text-left text-xs font-semibold text-gilt-400 transition-colors hover:bg-noir-700"
              >
                See all results for &ldquo;{debounced}&rdquo; →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
