export type RetailerId = "amazon" | "walmart" | "etsy" | "target" | "ebay";

/** The 7 real AWIN partner ids (lib/partners.ts) — wishlists can reference
 * either a legacy mock RetailerId or a real partner id, matching the
 * broadened `retailer` Postgres enum (see
 * supabase/migrations/0004_add_real_partner_retailers.sql; "aaawave"
 * added by 0019). */
export type RealPartnerRetailerId =
  | "brooklyn-delhi"
  | "evdance"
  | "golden-maple"
  | "canvas-vows"
  | "king-koil"
  | "tsar-bomba"
  | "aaawave";

export type WishlistRetailerId = RetailerId | RealPartnerRetailerId;

export type Retailer = {
  id: WishlistRetailerId;
  name: string;
  /** Tailwind classes for the small retailer tag shown on product cards */
  badgeClass: string;
  /** Solid-fill Tailwind class used for the small identity dot in the filter dropdown */
  dotClass: string;
};

export type PricePoint = {
  /** ISO date string, e.g. "2026-02-01" */
  date: string;
  price: number;
};
