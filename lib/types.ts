export type RetailerId = "amazon" | "walmart" | "etsy" | "target" | "ebay";

export type Retailer = {
  id: RetailerId;
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

/** One retailer's current listing for a product, shown in RetailerModal. */
export type RetailerListing = {
  name: RetailerId;
  price: number;
  url: string;
};

/** One customer review, shown on the product detail page. */
export type Review = {
  id: string;
  author: string;
  rating: number;
  title: string;
  text: string;
  /** ISO date string, e.g. "2026-06-02" */
  date: string;
  helpfulCount: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  /** Short marketing blurb shown on the product detail page. Sanitized
   * mock catalog — every product currently carries the same placeholder
   * string ("Product Description") until real copy is written. */
  description: string;
  image: string;
  /** All product images (product detail page carousel) — `image` above is
   * always `images[0]`, kept as its own field so every existing card/rail
   * usage that only needs one image doesn't have to reach into the array. */
  images: string[];
  store: string;
  storeLogo?: string;
  retailer: RetailerId;
  currentPrice: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  isBestPrice?: boolean;
  /** e.g. "In Stock", "Only 3 left", "Pre-order" — shown on the product
   * detail page's info section. */
  availability: string;
  /** Every retailer currently listing this product — powers the "at Amazon
   * X stores" click-through in ProductCard and the RetailerModal it opens,
   * and the full pricing table on the product detail page. */
  retailers: RetailerListing[];
  reviews: Review[];
  priceHistory: PricePoint[];
};

export type Category = {
  id: string;
  name: string;
  image: string;
  itemCount: string;
};
