"use client";

import { useTransition } from "react";
import { useAuth } from "@/lib/auth-context";
// TODO(purchase-recording): unused while recordPurchaseAction is disabled
// below — restore this import when it's re-enabled.
// import { recordPurchaseAction } from "@/lib/supabase/actions";
import { getAffiliateUrl } from "@/lib/data";
import { ExternalLinkIcon } from "./icons";
import type { Product } from "@/lib/types";

/**
 * The "affiliate link" click — opens the retailer's listing in a new tab.
 *
 * Purchase recording (logging the click as a purchase in the `purchases`
 * table, and the loyalty points that come with it) is temporarily
 * disabled — see the TODO(purchase-recording) comment below for why.
 */
export default function BuyButton({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const url = getAffiliateUrl(product);
    window.open(url, "_blank", "noopener,noreferrer");

    if (user) {
      startTransition(async () => {
        // TODO(purchase-recording): temporarily disabled — clicking "View
        // Deal" was recording a purchase (and awarding loyalty points) on
        // every click, with no confirmation an actual sale happened. That
        // let anyone spam the button for free points while the app earned
        // no affiliate commission. Re-enable this once real affiliate
        // conversion feeds (ShareASale, Rakuten, CJ Affiliate, Amazon,
        // etc.) are wired up and can confirm actual sales — and switch it
        // to firing off a real conversion webhook/event instead of a
        // button click. Kawsar will confirm when that's ready.
        // await recordPurchaseAction(product.id, product.retailer, product.currentPrice);
      });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={`group/buy inline-flex items-center gap-1.5 rounded-full bg-gilt-500 px-4 py-2 text-xs font-semibold text-ivory-50 transition-all duration-200 hover:bg-gilt-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
    >
      {isPending ? "Opening…" : "View Deal"}
      <ExternalLinkIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover/buy:translate-x-0.5 group-hover/buy:-translate-y-0.5" />
    </button>
  );
}
