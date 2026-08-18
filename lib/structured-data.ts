import type { RealProduct } from "./partners";
import { getPartnerPolicy } from "./partner-policies";
import { isDiscontinuedAtRetailer } from "./discontinued";

export const SITE_URL = "https://gopricefinder.com";
export const SITE_NAME = "Go Price Finder";

/** Maps partner-policies.ts's `fees` union to schema.org's
 * ReturnFeesEnumeration values. */
const RETURN_FEES_SCHEMA_VALUE: Record<string, string> = {
  FreeReturn: "https://schema.org/FreeReturn",
  ReturnShippingFees: "https://schema.org/ReturnShippingFees",
  RestockingFees: "https://schema.org/RestockingFees",
};

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
  // Carve-out to the InStock rationale above: products confirmed gone at
  // the retailer (lib/discontinued.ts — merchant-site 404, verified) say
  // so in the schema too, and stop pointing the offer URL at a dead
  // merchant page. The visible page makes the same claim (no outbound
  // link, "no longer stocks this item"), so schema and display stay in
  // agreement — the §3/§9k rule.
  const discontinued = isDiscontinuedAtRetailer(product.id);
  const offers: Record<string, unknown> = {
    "@type": "Offer",
    ...(discontinued ? {} : { url: product.deepLink }),
    priceCurrency: "USD",
    price: product.price,
    availability: discontinued
      ? "https://schema.org/Discontinued"
      : "https://schema.org/InStock",
    seller: {
      "@type": "Organization",
      name: product.partnerName,
    },
  };

  // Real, partner-sourced shipping/return terms — see
  // lib/partner-policies.ts for citations. Only added when a policy
  // entry actually exists for this partner (every currently-active
  // partner has one; this guard just avoids ever emitting an invented
  // value for a future partner whose policy hasn't been researched yet).
  const policy = getPartnerPolicy(product.partnerId);
  if (policy) {
    offers.shippingDetails = {
      "@type": "OfferShippingDetails",
      shippingRate: {
        "@type": "MonetaryAmount",
        value: policy.shipping.ratePriceUSD,
        currency: "USD",
      },
      shippingDestination: policy.shipping.countries.map((countryCode) => ({
        "@type": "DefinedRegion",
        addressCountry: countryCode,
      })),
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: policy.shipping.handlingMinDays,
          maxValue: policy.shipping.handlingMaxDays,
          unitCode: "DAY",
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: policy.shipping.transitMinDays,
          maxValue: policy.shipping.transitMaxDays,
          unitCode: "DAY",
        },
      },
    };

    offers.hasMerchantReturnPolicy = {
      "@type": "MerchantReturnPolicy",
      returnPolicyCategory: `https://schema.org/${policy.returns.category}`,
      ...(policy.returns.category === "MerchantReturnFiniteReturnWindow"
        ? { merchantReturnDays: policy.returns.days }
        : {}),
      returnFees: RETURN_FEES_SCHEMA_VALUE[policy.returns.fees],
      returnMethod: "https://schema.org/ReturnByMail",
      applicableCountry: policy.shipping.countries,
    };
  }

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
    offers,
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
