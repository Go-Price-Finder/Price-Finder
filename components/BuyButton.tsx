"use client";

import type { Product } from "@/lib/types";

/**
 * Was an "affiliate link" click that opened the retailer's listing in a
 * new tab — disabled for now. There's no real affiliate/retailer
 * integration behind these listings yet (see lib/data.ts), so letting
 * people click through to a fabricated URL was misleading. This now
 * renders as an inert, clearly-disabled "Coming Soon" button instead.
 * Re-enable the real affiliate-link behavior (getAffiliateUrl from
 * lib/data.ts, purchase recording via lib/supabase/actions) once actual
 * retailer/affiliate integrations are wired up.
 */
export default function BuyButton({
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Buying isn't available yet — coming soon"
      className={`inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-noir-700 px-4 py-2 text-xs font-semibold text-ivory-300 opacity-70 ${className}`}
    >
      Coming Soon
    </button>
  );
}
