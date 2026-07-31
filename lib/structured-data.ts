import type { RealProduct } from "./partners";

export const SITE_URL = "https://gopricefinder.com";
export const SITE_NAME = "Go Price Finder";

/**
 * schema.org/Product JSON-LD for a real product detail page. Every field
 * comes straight from the same RealProduct data every page already
 * renders — no field here is invented.
 *
 * `availability` is the one inferred value: there's no live inventory
 * feed backing per-product stock status anywhere in the data model
 * (checked — no partner's raw feed data survives into RealProduct as a
 * stock field), so this reflects the site's own existing display
 * semantics instead of a fabricated claim: every product shown on
 * gopricefinder.com is presented with a live, real "View on <Partner>"
 * purchase link, so InStock is what the page already implies to a human
 * visitor. If a partner's feed goes stale/delisted, re-running the import
 * removes the product entirely rather than marking it out of stock — so
 * "every product on the site is InStock" is actually true for as long as
 * the product is listed at all.
 */
export function buildProductJsonLd(product: RealProduct) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: `${SITE_URL}${product.image}`,
    url: `${SITE_URL}${product.href}`,
    brand: {
      "@type": "Brand",
      name: product.partnerName,
    },
    offers: {
      "@type": "Offer",
      url: product.deepLink,
      priceCurrency: "USD",
      price: product.price,
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: product.partnerName,
      },
    },
  };
  if (product.rating) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.stars,
      reviewCount: product.rating.count,
    };
  }
  return data;
}

export type BreadcrumbItem = {
  name: string;
  /** Omitted for breadcrumb entries that aren't links on the page itself
   * (e.g. the Category/ProductTypeGroup levels on the leaf category page,
   * which render as plain text, not <Link>s) — matching the visible
   * breadcrumb exactly rather than inventing a URL that doesn't exist. */
  url?: string;
};

/** schema.org/BreadcrumbList JSON-LD, built from the exact same trail a
 * page's visible breadcrumb nav renders — same names, same order, and the
 * same presence/absence of a link for each crumb. */
export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url } : {}),
    })),
  };
}

/** schema.org/Organization JSON-LD for the homepage. `logo` points at
 * app/favicon.ico — the only real image asset the site has (the header's
 * own logo is an inline SVG React component, not a static file); it does
 * contain a 256x256 frame, which meets Google's minimum logo dimensions,
 * but a dedicated PNG would be a more robust choice than reusing a
 * favicon long-term. */
export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.ico`,
  };
}
