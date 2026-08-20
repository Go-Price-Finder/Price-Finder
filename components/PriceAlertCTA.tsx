"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWishlist } from "@/lib/wishlist-context";
import { useAuth } from "@/lib/auth-context";
import { formatPrice } from "@/lib/format-price";
import { BellIcon, CheckIcon } from "./icons";
import type { WishlistRetailerId } from "@/lib/types";

/**
 * "Set a price alert" call-to-action for a product detail page — the
 * on-page entry point TargetPriceCell.tsx's own comment notes was missing
 * (that component only lives on the wishlist page today). Reuses the same
 * underlying data: alerts are just a wishlist row's target_price column
 * (supabase/migrations/0003_add_target_price.sql), evaluated daily by
 * lib/alerts/checkPriceDrops.ts — no new backend needed here, only a UI
 * entry point that doesn't require visiting the wishlist page first.
 *
 * Two states:
 *  - Not yet saved to the wishlist: a single button that saves the item
 *    and opens the target-price input in one action (skips the two-step
 *    "save, then go find the input on another page" flow).
 *  - Already saved: the same "notify below $___" input as the wishlist
 *    page, so a returning visitor's existing alert is visible/editable
 *    right on the product page too.
 */
export default function PriceAlertCTA({
  productId,
  retailer,
  currentPrice,
}: {
  productId: string;
  retailer: WishlistRetailerId;
  currentPrice: number;
}) {
  const { items, isSaved, toggle, setTargetPrice } = useWishlist();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);

  const saved = isSaved(productId);
  const item = items.find((i) => i.productId === productId);
  const [value, setValue] = useState(item?.targetPrice != null ? String(item.targetPrice) : "");

  function requireAuth(): boolean {
    if (user) return true;
    router.push(`/auth/login?redirectedFrom=${encodeURIComponent(pathname)}`);
    return false;
  }

  function commit() {
    const trimmed = value.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setValue(item?.targetPrice != null ? String(item.targetPrice) : "");
      return;
    }
    if (parsed === (item?.targetPrice ?? null)) return;

    startTransition(async () => {
      await setTargetPrice({ id: productId, retailer }, parsed);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    });
  }

  if (!saved) {
    return (
      <button
        type="button"
        onClick={() => {
          if (!requireAuth()) return;
          startTransition(async () => {
            await toggle({ id: productId, retailer, currentPrice });
          });
        }}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 rounded-full border border-gilt-500/30 bg-noir-800 px-4 py-2.5 text-sm font-semibold text-ivory-100 transition-colors hover:border-gilt-400 hover:text-gilt-400 disabled:opacity-60"
      >
        <BellIcon className="h-4 w-4" />
        {isPending ? "Saving…" : "Get notified when the price drops"}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-gilt-500/25 bg-noir-800 px-4 py-3">
      <label className="flex items-center gap-1.5 text-sm font-medium text-ivory-100">
        <BellIcon className="h-4 w-4 shrink-0 text-gilt-400" />
        <span>Notify me when this drops below</span>
        <span className="relative ml-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ivory-300">
            $
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="price"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label="Notify me when this item drops below"
            className="w-24 rounded-full border border-gilt-500/25 bg-noir-700 py-1 pl-5 pr-2.5 text-sm text-ivory-50 shadow-soft outline-none transition-colors focus:border-gilt-400"
          />
        </span>
      </label>

      <div className="h-4 pl-6 text-xs">
        {isPending ? (
          <span className="text-ivory-300">Saving…</span>
        ) : justSaved ? (
          <span className="inline-flex items-center gap-1 text-gilt-400">
            <CheckIcon className="h-3 w-3" /> Saved
          </span>
        ) : item?.targetPrice != null && item.alertSent ? (
          <span className="inline-flex items-center rounded-full bg-gilt-500/10 px-2 py-0.5 font-medium text-gilt-400">
            Alert sent at {formatPrice(item.targetPrice)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
