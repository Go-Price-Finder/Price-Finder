import { Retailer, WishlistRetailerId } from "./types";
import { getPartner } from "./partners";

/**
 * Sanitized to generic "Store N" placeholders — the `id`s below (amazon,
 * walmart, etc.) are internal-only now: they were the mock catalog's 5
 * placeholder retailers. Kept only so old wishlist rows that reference one
 * of these ids (from before real-partner wishlisting existed) still
 * resolve to a displayable name instead of breaking.
 */
const GENERIC_RETAILER_STYLE = {
  badgeClass: "bg-noir-700 text-ivory-200 ring-1 ring-ivory-100/15",
  dotClass: "bg-ivory-400",
};

export const retailers: Retailer[] = [
  { id: "amazon", name: "Store 1", ...GENERIC_RETAILER_STYLE },
  { id: "walmart", name: "Store 2", ...GENERIC_RETAILER_STYLE },
  { id: "etsy", name: "Store 3", ...GENERIC_RETAILER_STYLE },
  { id: "target", name: "Store 4", ...GENERIC_RETAILER_STYLE },
  { id: "ebay", name: "Store 5", ...GENERIC_RETAILER_STYLE },
];

/**
 * Resolves both the legacy mock retailers (generic "Store N" placeholders,
 * kept for old wishlist rows) and real AWIN partner ids (lib/partners.ts)
 * to a displayable Retailer. Real partners get their actual name but the
 * same neutral badge styling as the mock stores, since there's no
 * per-partner brand color system.
 */
export function getRetailer(id: WishlistRetailerId): Retailer {
  const mockMatch = retailers.find((r) => r.id === id);
  if (mockMatch) return mockMatch;

  const partner = getPartner(id);
  if (partner) return { id, name: partner.name, ...GENERIC_RETAILER_STYLE };

  return retailers[0];
}

const PRICE_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * The single choke point every price display in the app renders through —
 * real wishlist/target-price data (Supabase) needs an actual dollar figure,
 * not a placeholder.
 */
export function formatPrice(value: number) {
  return PRICE_FORMATTER.format(value);
}

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(new Date(iso));
}

export function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}
