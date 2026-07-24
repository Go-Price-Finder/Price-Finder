"use client";

import { useEffect, useRef, useState } from "react";
import { retailers } from "@/lib/data";
import { useRetailerFilter } from "@/lib/retailer-filter-context";
import { CheckIcon, ChevronDownIcon } from "./icons";

export default function RetailerFilterBar({
  className = "",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const {
    selected,
    isSelected,
    toggle,
    selectAll,
    clearAll,
    allSelected,
    noneSelected,
  } = useRetailerFilter();

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const label = allSelected
    ? "All retailers"
    : noneSelected
      ? "No retailers selected"
      : `${selected.length} retailer${selected.length === 1 ? "" : "s"}`;

  return (
    <div
      ref={rootRef}
      className={`relative z-40 inline-block text-left ${className}`}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 rounded-full border bg-noir-800 px-4 py-2.5 text-sm font-medium shadow-soft transition-all duration-200 hover:shadow-soft-lg ${
          open
            ? "border-gilt-500 ring-4 ring-gilt-500/20 text-gilt-400"
            : "border-gilt-500/25 text-ivory-200"
        }`}
      >
        <span className="flex -space-x-1.5">
          {retailers.map((r) => (
            <span
              key={r.id}
              className={`h-2.5 w-2.5 rounded-full ring-2 ring-noir-800 transition-opacity ${
                isSelected(r.id) ? "opacity-100" : "opacity-25"
              } ${r.dotClass}`}
              aria-hidden
            />
          ))}
        </span>
        {label}
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        role="listbox"
        aria-multiselectable
        className={`absolute left-0 z-50 mt-2 w-64 origin-top-left rounded-2xl border border-gilt-500/25 bg-noir-800 p-3 shadow-soft-xl ${
          open
            ? "translate-y-0 scale-100 opacity-100 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            : "pointer-events-none -translate-y-2 scale-95 opacity-0 transition-[transform,opacity] duration-150 ease-in"
        }`}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-ivory-400">
            Filter by retailer
          </span>
          <div className="flex items-center gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={selectAll}
              className="text-gilt-400 transition-colors hover:text-gilt-300 disabled:cursor-not-allowed disabled:text-ivory-400"
              disabled={allSelected}
            >
              Select all
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-ivory-300 transition-colors hover:text-ivory-50 disabled:cursor-not-allowed disabled:text-ivory-400"
              disabled={noneSelected}
            >
              Clear all
            </button>
          </div>
        </div>

        <ul className="flex flex-col gap-0.5">
          {retailers.map((retailer) => {
            const checked = isSelected(retailer.id);
            return (
              <li key={retailer.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-noir-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(retailer.id)}
                    className="peer sr-only"
                  />
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150 ${
                      checked
                        ? "border-gilt-500 bg-gilt-500 text-noir-950"
                        : "border-gilt-500/25 bg-noir-800 text-transparent"
                    }`}
                  >
                    <CheckIcon className="h-3 w-3" />
                  </span>
                  <span className="text-sm font-medium text-ivory-100">
                    {retailer.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
