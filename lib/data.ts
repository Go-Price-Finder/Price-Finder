import { Category, Product, Retailer, RetailerId, RetailerListing, Review } from "./types";

/**
 * Sanitized to generic "Store N" placeholders — the `id`s below (amazon,
 * walmart, etc.) are internal-only now: they still drive the retailer
 * filter's logic, outbound "View Deal" links, and which products group
 * together, but nothing about the real brand (name, color, logo) is shown
 * to a visitor anymore, since there's no real per-store data behind any of
 * it yet. Every retailer shares the same neutral badge/dot styling on
 * purpose — they're interchangeable placeholders, not distinct brands.
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

export function getRetailer(id: RetailerId): Retailer {
  return retailers.find((r) => r.id === id) ?? retailers[0];
}

/** Looks up a single product by id — used by the product detail page. */
export function getProductById(id: string): Product | undefined {
  return trendingProducts.find((p) => p.id === id);
}

/** Up to `limit` other products in the same category, for the detail
 * page's "Shop similar items" section. Falls back to other trending
 * products if the category doesn't have enough. */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const sameCategory = trendingProducts.filter(
    (p) => p.id !== product.id && p.category === product.category
  );
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const fallback = trendingProducts.filter(
    (p) => p.id !== product.id && !sameCategory.includes(p)
  );
  return [...sameCategory, ...fallback].slice(0, limit);
}

/** Turns a category display name into a URL-safe slug — "Kitchen & Dining"
 * -> "kitchen-dining" — used by /products/[slug] to match a category name
 * against the URL, and by PopularCategories to link each card. */
export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Every product in a category, matched via slug (case-insensitive, and
 * tolerant of "&"/spacing) so multi-word categories like "Kitchen & Dining"
 * work as clean URLs. */
export function getProductsByCategorySlug(slug: string): Product[] {
  return trendingProducts.filter((p) => slugifyCategory(p.category) === slug);
}

/** Every category slug that should resolve to a real page — the union of
 * every category actually used by a product and every category featured
 * on the homepage (`categories`, below), even if one of those currently
 * has zero products. /products/[slug] uses this to tell "a real category
 * that's just empty right now" (graceful empty state) apart from "not a
 * category at all" (404). */
export function getKnownCategorySlugs(): string[] {
  const fromProducts = trendingProducts.map((p) => slugifyCategory(p.category));
  const fromHomepage = categories.map((c) => slugifyCategory(c.name));
  return Array.from(new Set([...fromProducts, ...fromHomepage]));
}

/** The display name for a category slug — prefers the curated homepage
 * name (proper casing, "&" preserved) and falls back to whatever a
 * matching product's own `category` field says. */
export function getCategoryDisplayName(slug: string): string | undefined {
  const homepageMatch = categories.find((c) => slugifyCategory(c.name) === slug);
  if (homepageMatch) return homepageMatch.name;
  const productMatch = trendingProducts.find((p) => slugifyCategory(p.category) === slug);
  return productMatch?.category;
}

/** Retailer storefront domains, used to build the outbound "View Deal" link. */
const RETAILER_DOMAINS: Record<RetailerId, string> = {
  amazon: "https://www.amazon.com/s",
  walmart: "https://www.walmart.com/search",
  etsy: "https://www.etsy.com/search",
  target: "https://www.target.com/s",
  ebay: "https://www.ebay.com/sch/i.html",
};

const RETAILER_QUERY_PARAM: Record<RetailerId, string> = {
  amazon: "k",
  walmart: "q",
  etsy: "q",
  target: "searchTerm",
  ebay: "_nkw",
};

/**
 * Builds the outbound affiliate link for "View Deal" — a real product feed
 * would supply a per-listing URL; until then this points at the retailer's
 * own search for the product name, which is enough to demonstrate the
 * click-through + purchase-tracking flow end to end.
 */
export function getAffiliateUrl(product: Product): string {
  return buildRetailerSearchUrl(product.retailer, product.name);
}

/** Shared by getAffiliateUrl and buildRetailers so every outbound link —
 * whether it's the card's primary "View Deal" or one of the retailers
 * listed in RetailerModal — is built the exact same way. */
function buildRetailerSearchUrl(retailerId: RetailerId, productName: string): string {
  const base = RETAILER_DOMAINS[retailerId];
  const param = RETAILER_QUERY_PARAM[retailerId];
  const url = new URL(base);
  url.searchParams.set(param, productName);
  return url.toString();
}

/**
 * Percentage step-up applied to each additional retailer's price, so the
 * mock catalog has a believable spread of prices across stores without
 * hand-typing every figure. The primary retailer always keeps `basePrice`
 * (matching the product's displayed currentPrice) and is listed first;
 * everything else is strictly more expensive, so sorting the RetailerModal
 * by price ascending always puts the primary/cheapest listing on top.
 */
const EXTRA_RETAILER_DELTA_PCTS = [0.03, 0.06, 0.1, 0.16];

/**
 * Builds a product's `retailers` array: the primary retailer at
 * `basePrice`, plus up to `count - 1` of the other retailers at a modest
 * markup. `count` is clamped to the number of retailers that exist.
 */
function buildRetailers(
  productName: string,
  primary: RetailerId,
  basePrice: number,
  count: number
): RetailerListing[] {
  const others = retailers.map((r) => r.id).filter((id) => id !== primary);
  const chosen = others.slice(0, Math.min(count, others.length + 1) - 1);

  return [
    { name: primary, price: basePrice, url: buildRetailerSearchUrl(primary, productName) },
    ...chosen.map((id, i) => ({
      name: id,
      price: Math.round(basePrice * (1 + EXTRA_RETAILER_DELTA_PCTS[i])),
      url: buildRetailerSearchUrl(id, productName),
    })),
  ];
}

/** Builds a 6-month price history that lands on `endPrice`, with a gentle wobble. */
function history(endPrice: number, points: number[]): { date: string; price: number }[] {
  const months = [
    "2026-02-01",
    "2026-03-01",
    "2026-04-01",
    "2026-05-01",
    "2026-06-01",
    "2026-07-01",
  ];
  const series = points.length === months.length ? points : points.concat(endPrice);
  return months.map((date, i) => ({ date, price: series[i] }));
}

/**
 * Placeholder catalog — no real product photography exists yet, so every
 * product/category image slot is filled with a generic "Product Image"
 * graphic (see components/ProductImagePlaceholder.tsx) rather than a real
 * photo URL. `image`/`images` still carry distinct string values (not just
 * one repeated literal) purely so the product-detail image carousel keeps
 * its "N of M" navigation, thumbnail strip, and swipe functionality intact
 * with a believable multi-image count — the values themselves are never
 * rendered as an actual <img src>.
 */
function buildImageSet(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `placeholder-${i + 1}`);
}

/** Reviewer name pool — sanitized to a single obvious placeholder. Kept as
 * an array (rather than one bare string) so buildReviews' cycling logic
 * stays untouched; every entry just happens to be the same placeholder. */
const REVIEWER_NAMES = ["Reviewer Name"];

/**
 * Review content templates — sanitized to generic placeholder copy. The
 * rating spread (via `ratingOffset`) is kept intact so each product's
 * reviews still sort/cluster the same way internally (the numbers are
 * simply no longer displayed — see ReviewCard.tsx), and `daysAgo` stays
 * deterministic so the mock catalog doesn't depend on Date.now() or
 * Math.random(). `helpfulCount` starts at 0 for every placeholder review
 * rather than a fabricated pre-seeded count — the "Helpful" button still
 * increments it normally from there.
 */
const REVIEW_TEMPLATES: {
  ratingOffset: number;
  daysAgo: number;
  helpfulCount: number;
  title: string;
  text: (name: string) => string;
}[] = [
  { ratingOffset: 0.3, daysAgo: 4, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: 0.1, daysAgo: 11, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: 0, daysAgo: 18, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: 0.4, daysAgo: 26, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: -0.4, daysAgo: 34, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: -0.8, daysAgo: 47, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: -1.5, daysAgo: 58, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
  { ratingOffset: -0.6, daysAgo: 71, helpfulCount: 0, title: "Review Title", text: () => "Placeholder review text." },
];

function reviewDate(daysAgo: number): string {
  // Anchored to the same "today" as the price-history/mock catalog dates
  // above (2026-07-01) rather than a live clock, so review dates stay
  // deterministic across builds.
  const anchor = new Date("2026-07-20T00:00:00Z");
  anchor.setUTCDate(anchor.getUTCDate() - daysAgo);
  return anchor.toISOString().slice(0, 10);
}

/**
 * Builds `count` mock reviews for a product, clustered around its real
 * `avgRating`. `nameOffset` staggers which slice of REVIEWER_NAMES each
 * product draws from, purely so two products' review lists don't look
 * identical.
 */
function buildReviews(
  productId: string,
  productName: string,
  avgRating: number,
  count: number,
  nameOffset: number
): Review[] {
  return REVIEW_TEMPLATES.slice(0, count).map((template, i) => {
    const rawRating = avgRating + template.ratingOffset;
    const rating = Math.min(5, Math.max(1, Math.round(rawRating * 2) / 2));
    return {
      id: `${productId}-r${i + 1}`,
      author: REVIEWER_NAMES[(i + nameOffset) % REVIEWER_NAMES.length],
      rating,
      title: template.title,
      text: template.text(productName),
      date: reviewDate(template.daysAgo),
      helpfulCount: template.helpfulCount,
    };
  });
}

/** A product's review count reflects everyone who ever left a review, not
 * everyone who bought it — most buyers don't review. This derives a
 * believable "N people bought this" figure from reviewCount using a fixed
 * multiplier, rather than hand-picking a purchase count per product. */
export function estimatedPurchaseCount(product: Product): number {
  return Math.round(product.reviewCount * 6.3);
}

/**
 * Every product in this mock catalog is sanitized for pre-deployment
 * review: `name` is the obvious placeholder "Product Name" rather than an
 * invented brand/model, and `description` is likewise a placeholder. The
 * ids, categories, retailers, and price/rating/review numbers are kept
 * real-shaped so every downstream feature (sorting, filtering, discount
 * badges, price-history charts, the loyalty/review UI) keeps working
 * exactly as before — only the human-facing copy that looked like a real
 * product is now unmistakably a placeholder.
 */
const coreProducts: Product[] = [
  {
    id: "p1",
    name: "Product Name",
    category: "Furniture",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(5),
    store: "Amazon",
    retailer: "amazon",
    currentPrice: 1249,
    originalPrice: 1599,
    rating: 4.8,
    reviewCount: 342,
    isBestPrice: true,
    availability: "In Stock",
    retailers: buildRetailers("Product Name", "amazon", 1249, 5),
    reviews: buildReviews("p1", "Product Name", 4.8, 8, 0),
    priceHistory: history(1249, [1599, 1549, 1499, 1399, 1329, 1249]),
  },
  {
    id: "p2",
    name: "Product Name",
    category: "Furniture",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(4),
    store: "Walmart",
    retailer: "walmart",
    currentPrice: 389,
    originalPrice: 459,
    rating: 4.6,
    reviewCount: 128,
    availability: "In Stock",
    retailers: buildRetailers("Product Name", "walmart", 389, 3),
    reviews: buildReviews("p2", "Product Name", 4.6, 5, 3),
    priceHistory: history(389, [429, 429, 459, 419, 399, 389]),
  },
  {
    id: "p3",
    name: "Product Name",
    category: "Electronics",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(5),
    store: "Amazon",
    retailer: "amazon",
    currentPrice: 279,
    originalPrice: 349,
    rating: 4.7,
    reviewCount: 2140,
    isBestPrice: true,
    availability: "Only 3 left",
    retailers: buildRetailers("Product Name", "amazon", 279, 5),
    reviews: buildReviews("p3", "Product Name", 4.7, 8, 6),
    priceHistory: history(279, [349, 329, 299, 309, 289, 279]),
  },
  {
    id: "p4",
    name: "Product Name",
    category: "Home Decor",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(3),
    store: "Etsy",
    retailer: "etsy",
    currentPrice: 89,
    rating: 4.9,
    reviewCount: 76,
    availability: "In Stock",
    retailers: buildRetailers("Product Name", "etsy", 89, 2),
    reviews: buildReviews("p4", "Product Name", 4.9, 5, 9),
    priceHistory: history(89, [82, 84, 86, 85, 87, 89]),
  },
  {
    id: "p5",
    name: "Product Name",
    category: "Fashion",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(4),
    store: "Etsy",
    retailer: "etsy",
    currentPrice: 168,
    originalPrice: 210,
    rating: 4.5,
    reviewCount: 512,
    isBestPrice: true,
    availability: "Only 5 left",
    retailers: buildRetailers("Product Name", "etsy", 168, 4),
    reviews: buildReviews("p5", "Product Name", 4.5, 7, 1),
    priceHistory: history(168, [210, 199, 189, 179, 175, 168]),
  },
  {
    id: "p6",
    name: "Product Name",
    category: "Kitchen & Dining",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(3),
    store: "Target",
    retailer: "target",
    currentPrice: 64,
    originalPrice: 82,
    rating: 4.8,
    reviewCount: 903,
    availability: "In Stock",
    retailers: buildRetailers("Product Name", "target", 64, 3),
    reviews: buildReviews("p6", "Product Name", 4.8, 6, 4),
    priceHistory: history(64, [82, 79, 74, 69, 68, 64]),
  },
  {
    id: "p7",
    name: "Product Name",
    category: "Sportswear",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(5),
    store: "eBay",
    retailer: "ebay",
    currentPrice: 112,
    originalPrice: 140,
    rating: 4.6,
    reviewCount: 1284,
    isBestPrice: true,
    availability: "Only 2 left",
    retailers: buildRetailers("Product Name", "ebay", 112, 5),
    reviews: buildReviews("p7", "Product Name", 4.6, 8, 7),
    priceHistory: history(112, [140, 135, 129, 119, 118, 112]),
  },
  {
    id: "p8",
    name: "Product Name",
    category: "Home Decor",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(3),
    store: "Target",
    retailer: "target",
    currentPrice: 74,
    rating: 4.9,
    reviewCount: 210,
    availability: "In Stock",
    retailers: buildRetailers("Product Name", "target", 74, 2),
    reviews: buildReviews("p8", "Product Name", 4.9, 5, 10),
    priceHistory: history(74, [69, 71, 73, 72, 73, 74]),
  },
  {
    id: "p9",
    name: "Product Name",
    category: "Electronics",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(4),
    store: "Walmart",
    retailer: "walmart",
    currentPrice: 129,
    originalPrice: 159,
    rating: 4.7,
    reviewCount: 664,
    availability: "Pre-order",
    retailers: buildRetailers("Product Name", "walmart", 129, 4),
    reviews: buildReviews("p9", "Product Name", 4.7, 7, 2),
    priceHistory: history(129, [159, 149, 145, 139, 135, 129]),
  },
  {
    id: "p10",
    name: "Product Name",
    category: "Home Decor",
    description: "Product Description",
    image: "placeholder",
    images: buildImageSet(3),
    store: "eBay",
    retailer: "ebay",
    currentPrice: 56,
    originalPrice: 68,
    rating: 4.8,
    reviewCount: 94,
    availability: "In Stock",
    retailers: buildRetailers("Product Name", "ebay", 56, 3),
    reviews: buildReviews("p10", "Product Name", 4.8, 6, 5),
    priceHistory: history(56, [68, 64, 62, 59, 58, 56]),
  },
];

/**
 * Seed data for the catalog's "long tail" — products that exist mainly so
 * every category has at least 3 items for /products/[category] to show a
 * real grid, rather than hand-authoring 11 more full product literals the
 * way the first 10 products above were written. Reuses the same
 * buildRetailers/buildImageSet/buildReviews/history helpers so these
 * products are indistinguishable in shape from the hand-authored ones.
 * `name` is sanitized to "Product Name" for every seed (see extraProducts
 * below) — the seed's own `name` field only feeds category grouping in
 * comments/ids during authoring and isn't rendered.
 */
const EXTRA_PRODUCT_SEEDS: {
  id: string;
  category: string;
  retailer: RetailerId;
  store: string;
  currentPrice: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  availability: string;
  retailerCount: number;
  imageCount: number;
  reviewSeedCount: number;
  nameOffset: number;
  historyPoints: number[];
}[] = [
  {
    id: "p11",
    category: "Furniture",
    retailer: "etsy",
    store: "Etsy",
    currentPrice: 219,
    originalPrice: 269,
    rating: 4.7,
    reviewCount: 158,
    availability: "In Stock",
    retailerCount: 3,
    imageCount: 3,
    reviewSeedCount: 6,
    nameOffset: 8,
    historyPoints: [269, 259, 249, 239, 229, 219],
  },
  {
    id: "p12",
    category: "Electronics",
    retailer: "amazon",
    store: "Amazon",
    currentPrice: 89,
    originalPrice: 119,
    rating: 4.5,
    reviewCount: 940,
    availability: "Only 4 left",
    retailerCount: 4,
    imageCount: 4,
    reviewSeedCount: 7,
    nameOffset: 11,
    historyPoints: [119, 112, 105, 99, 94, 89],
  },
  {
    id: "p13",
    category: "Fashion",
    retailer: "walmart",
    store: "Walmart",
    currentPrice: 58,
    originalPrice: 72,
    rating: 4.4,
    reviewCount: 233,
    availability: "In Stock",
    retailerCount: 3,
    imageCount: 3,
    reviewSeedCount: 5,
    nameOffset: 2,
    historyPoints: [72, 68, 66, 61, 60, 58],
  },
  {
    id: "p14",
    category: "Fashion",
    retailer: "etsy",
    store: "Etsy",
    currentPrice: 42,
    rating: 4.8,
    reviewCount: 87,
    availability: "In Stock",
    retailerCount: 2,
    imageCount: 3,
    reviewSeedCount: 5,
    nameOffset: 5,
    historyPoints: [39, 40, 41, 42, 41, 42],
  },
  {
    id: "p15",
    category: "Kitchen & Dining",
    retailer: "target",
    store: "Target",
    currentPrice: 74,
    originalPrice: 96,
    rating: 4.9,
    reviewCount: 512,
    availability: "In Stock",
    retailerCount: 4,
    imageCount: 3,
    reviewSeedCount: 7,
    nameOffset: 4,
    historyPoints: [96, 91, 86, 80, 77, 74],
  },
  {
    id: "p16",
    category: "Kitchen & Dining",
    retailer: "amazon",
    store: "Amazon",
    currentPrice: 29,
    originalPrice: 38,
    rating: 4.6,
    reviewCount: 301,
    availability: "In Stock",
    retailerCount: 3,
    imageCount: 3,
    reviewSeedCount: 6,
    nameOffset: 7,
    historyPoints: [38, 36, 33, 31, 30, 29],
  },
  {
    id: "p17",
    category: "Beauty & Wellness",
    retailer: "amazon",
    store: "Amazon",
    currentPrice: 24,
    originalPrice: 32,
    rating: 4.7,
    reviewCount: 1204,
    availability: "In Stock",
    retailerCount: 5,
    imageCount: 3,
    reviewSeedCount: 8,
    nameOffset: 1,
    historyPoints: [32, 30, 28, 26, 25, 24],
  },
  {
    id: "p18",
    category: "Beauty & Wellness",
    retailer: "etsy",
    store: "Etsy",
    currentPrice: 19,
    rating: 4.5,
    reviewCount: 176,
    availability: "In Stock",
    retailerCount: 2,
    imageCount: 3,
    reviewSeedCount: 5,
    nameOffset: 9,
    historyPoints: [18, 19, 18, 19, 20, 19],
  },
  {
    id: "p19",
    category: "Beauty & Wellness",
    retailer: "target",
    store: "Target",
    currentPrice: 16,
    originalPrice: 22,
    rating: 4.8,
    reviewCount: 264,
    availability: "In Stock",
    retailerCount: 3,
    imageCount: 3,
    reviewSeedCount: 6,
    nameOffset: 3,
    historyPoints: [22, 21, 19, 18, 17, 16],
  },
  {
    id: "p20",
    category: "Sportswear",
    retailer: "walmart",
    store: "Walmart",
    currentPrice: 149,
    originalPrice: 189,
    rating: 4.6,
    reviewCount: 402,
    availability: "Only 2 left",
    retailerCount: 4,
    imageCount: 3,
    reviewSeedCount: 7,
    nameOffset: 6,
    historyPoints: [189, 179, 169, 159, 154, 149],
  },
  {
    id: "p21",
    category: "Sportswear",
    retailer: "amazon",
    store: "Amazon",
    currentPrice: 34,
    originalPrice: 45,
    rating: 4.7,
    reviewCount: 890,
    availability: "In Stock",
    retailerCount: 5,
    imageCount: 3,
    reviewSeedCount: 6,
    nameOffset: 10,
    historyPoints: [45, 42, 39, 37, 35, 34],
  },
];

const extraProducts: Product[] = EXTRA_PRODUCT_SEEDS.map((seed) => ({
  id: seed.id,
  name: "Product Name",
  category: seed.category,
  description: "Product Description",
  image: "placeholder",
  images: buildImageSet(seed.imageCount),
  store: seed.store,
  retailer: seed.retailer,
  currentPrice: seed.currentPrice,
  originalPrice: seed.originalPrice,
  rating: seed.rating,
  reviewCount: seed.reviewCount,
  availability: seed.availability,
  retailers: buildRetailers("Product Name", seed.retailer, seed.currentPrice, seed.retailerCount),
  reviews: buildReviews(seed.id, "Product Name", seed.rating, seed.reviewSeedCount, seed.nameOffset),
  priceHistory: history(seed.currentPrice, seed.historyPoints),
}));

export const trendingProducts: Product[] = [...coreProducts, ...extraProducts];

/**
 * Homepage/category taxonomy. `image` is a placeholder marker (rendered as
 * a generic "Category Image" graphic — see components/ProductImagePlaceholder.tsx)
 * rather than a real photo, matching the sanitized product catalog above.
 * Expanded to 12 tiles so PopularCategories can render a full interactive
 * grid rather than a short row.
 */
export const categories: Category[] = [
  { id: "c1", name: "Furniture", image: "placeholder", itemCount: "12,400+ items" },
  { id: "c2", name: "Home Decor", image: "placeholder", itemCount: "8,900+ items" },
  { id: "c3", name: "Electronics", image: "placeholder", itemCount: "21,300+ items" },
  { id: "c4", name: "Fashion", image: "placeholder", itemCount: "34,600+ items" },
  { id: "c5", name: "Kitchen & Dining", image: "placeholder", itemCount: "9,750+ items" },
  { id: "c6", name: "Beauty & Wellness", image: "placeholder", itemCount: "15,200+ items" },
  { id: "c7", name: "Sportswear", image: "placeholder", itemCount: "11,050+ items" },
  { id: "c8", name: "Toys & Games", image: "placeholder", itemCount: "6,300+ items" },
  { id: "c9", name: "Outdoor & Garden", image: "placeholder", itemCount: "7,850+ items" },
  { id: "c10", name: "Pet Supplies", image: "placeholder", itemCount: "5,400+ items" },
  { id: "c11", name: "Office & Stationery", image: "placeholder", itemCount: "4,200+ items" },
  { id: "c12", name: "Baby & Kids", image: "placeholder", itemCount: "9,100+ items" },
];

/**
 * Sanitized for pre-deployment review: every product's `currentPrice` /
 * `originalPrice` stays a real number under the hood (sorting, filtering,
 * discount badges, and the price-history chart's shape all still depend on
 * real numeric deltas), but the text actually shown to a visitor is always
 * the obvious placeholder "Price TBA" rather than a fabricated dollar
 * figure. This is the single choke point every price display in the app
 * renders through, so flipping it back to real formatting later (once real
 * pricing data exists) is a one-line change.
 */
export function formatPrice(_value: number) {
  void _value;
  return "Price TBA";
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

/**
 * Percentage a product's price has dropped from originalPrice to
 * currentPrice — 0 if there's no originalPrice, or if the "original"
 * price isn't actually higher than the current one. Shared by the
 * category pages' "Best Deals" sort (CategoryPageTemplate.tsx) and the
 * /deals page's price_drop > 15% filter, so both use the exact same
 * definition of a "deal".
 */
export function getDiscountPct(product: Product): number {
  if (!product.originalPrice || product.originalPrice <= product.currentPrice) return 0;
  return ((product.originalPrice - product.currentPrice) / product.originalPrice) * 100;
}

export function analyzePriceHistory(history: Product["priceHistory"]) {
  const prices = history.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const first = history[0]?.price ?? 0;
  const last = history[history.length - 1]?.price ?? 0;
  const changeAbs = last - first;
  const changePct = first === 0 ? 0 : (changeAbs / first) * 100;
  return {
    min,
    max,
    first,
    last,
    changeAbs,
    changePct,
    isDown: changeAbs < 0,
    isFlat: changeAbs === 0,
  };
}
