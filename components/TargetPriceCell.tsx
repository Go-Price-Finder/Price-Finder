"use client";

import { useEffect, useState, useTransition } from "react";
import { useWishlist, type WishlistItem } from "@/lib/wishlist-context";
import { formatPrice } from "@/lib/data";
import { BellIcon, CheckIcon } from "./icons";

/**
 * "Notify me when price drops below $___" — the per-item control on the
 * wishlist page for setting a price-drop alert threshold
 * (supabase/migrations/0003_add_target_price.sql's target_price column).
 * Saves on blur/Enter rather than needing an explicit submit button, and
 * shows a small "Alert sent" badge once the daily check
 * (lib/alerts/checkPriceDrops.ts) has actually emailed the user for the
 * current dip.
 */
export default function TargetPriceCell({ item }: { item: WishlistItem }) {
  const { setTargetPrice } = useWishlist();
  const [value, setValue] = useState(item.targetPrice != null ? String(item.targetPrice) : "");
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  // Keep the input in sync if the item's target price changes from outside
  // this component (e.g. refresh() after another tab edits it).
  useEffect(() => {
    setValue(item.targetPrice != null ? String(item.targetPrice) : "");
  }, [item.targetPrice]);

  function commit() {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      // Invalid input — revert rather than saving garbage.
      setValue(item.targetPrice != null ? String(item.targetPrice) : "");
      return;
    }
    if (parsed === item.targetPrice) return; // nothing changed

    startTransition(async () => {
      await setTargetPrice({ id: item.productId, retailer: item.retailer }, parsed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1.5 text-xs text-ivory-300">
        <BellIcon className="h-3.5 w-3.5 shrink-0 text-ivory-400" />
        <span className="whitespace-nowrap">Notify below</span>
        <span className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ivory-300">
            $
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label={`Notify me when ${item.product?.name ?? "this item"} drops below`}
            className="w-20 rounded-full border border-gilt-500/25 bg-noir-800 py-1 pl-5 pr-2.5 text-xs text-ivory-50 shadow-soft outline-none transition-colors focus:border-gilt-400"
          />
        </span>
      </label>

      <div className="h-4 pl-5 text-[11px]">
        {isPending ? (
          <span className="text-ivory-300">Saving…</span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1 text-gilt-400">
            <CheckIcon className="h-3 w-3" /> Saved
          </span>
        ) : item.targetPrice != null && item.alertSent ? (
          <span className="inline-flex items-center rounded-full bg-gilt-500/10 px-2 py-0.5 font-medium text-gilt-400">
            Alert sent at {formatPrice(item.targetPrice)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
