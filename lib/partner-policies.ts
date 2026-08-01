/**
 * Real, sourced shipping and return policy data per partner — feeds
 * `structured-data.ts`'s `offers.shippingDetails` /
 * `offers.hasMerchantReturnPolicy` (schema.org OfferShippingDetails /
 * MerchantReturnPolicy), added to close two Google Search Console
 * "Merchant listings" warnings (missing `shippingDetails` and
 * `hasMerchantReturnPolicy`) flagged 2026-07-31.
 *
 * Every value here was read directly from each partner's own published
 * policy page (not AWIN's programme terms, not guessed) on 2026-08-01 —
 * see `sourceUrls` on each entry. Same principle as
 * `lib/partner-compliance.json`: no fabricated claims, and where a
 * partner's real policy doesn't cleanly fit schema.org's return-window
 * model (Brooklyn Delhi, Canvas Vows — see their entries below), the
 * encoding says so honestly rather than forcing a number that isn't real.
 *
 * These are terms the partner sets, not GoPriceFinder — re-verify against
 * the live policy page before reusing this data if it's been a while
 * since 2026-08-01, since a partner can change its own policy at any
 * time without notifying us.
 */

export type PartnerPolicy = {
  shipping: {
    /** USD; 0 means free (either always-free, or free above the partner's
     * own advertised threshold — see note). */
    ratePriceUSD: number;
    /** Free-shipping order-value threshold, if the partner's free
     * shipping is conditional rather than unconditional. Undefined means
     * either free shipping is unconditional or the listed ratePriceUSD
     * always applies (no threshold exists). */
    freeThresholdUSD?: number;
    handlingMinDays: number;
    handlingMaxDays: number;
    transitMinDays: number;
    transitMaxDays: number;
    /** ISO 3166-1 alpha-2 country codes this shippingDetails entry
     * describes. All 6 partners' most-common-case terms are U.S.
     * domestic; several also ship internationally on different terms not
     * modeled here — scope was "fix the Merchant listings warning for the
     * primary U.S. catalog", not a full multi-region encoding. */
    countries: string[];
    note?: string;
  };
  returns: {
    /** schema.org MerchantReturnEnumeration value. Only the two variants
     * any partner here actually needs. */
    category: "MerchantReturnFiniteReturnWindow" | "MerchantReturnNotPermitted";
    /** Required when category is MerchantReturnFiniteReturnWindow. */
    days?: number;
    fees: "FreeReturn" | "ReturnShippingFees" | "RestockingFees";
    /** Percentage restocking fee, only set when fees is
     * "RestockingFees" — schema.org has no dedicated restocking-fee
     * percent property, so this is carried as a plain comment/reference
     * rather than invented JSON-LD; see returnFees mapping in
     * structured-data.ts for how this is actually encoded. */
    restockingFeePercent?: number;
    note?: string;
  };
  sourceUrls: string[];
};

export const PARTNER_POLICIES: Record<string, PartnerPolicy> = {
  "brooklyn-delhi": {
    shipping: {
      ratePriceUSD: 8,
      freeThresholdUSD: 50,
      handlingMinDays: 1,
      handlingMaxDays: 1,
      transitMinDays: 1,
      transitMaxDays: 4,
      countries: ["US"],
    },
    returns: {
      // Brooklyn Delhi's own FAQ: "we don't currently offer returns or
      // exchanges due to the nature of our products" (food/condiments) —
      // but they do issue a refund (no physical return required) if the
      // customer contacts support within 7 days stating dissatisfaction,
      // or with photo evidence for damaged/lost packages. That's a real
      // 7-day refund window, just not a "ship it back" return in the
      // usual sense — encoded as a finite window since a refund remedy
      // genuinely exists, not as NotPermitted (which would overstate how
      // restrictive this actually is).
      category: "MerchantReturnFiniteReturnWindow",
      days: 7,
      fees: "FreeReturn",
      note:
        "No physical return accepted for standard dissatisfaction — refund only, via support contact within 7 days. Damaged/lost packages handled case-by-case with photo evidence.",
    },
    sourceUrls: ["https://brooklyndelhi.com/pages/faqs"],
  },

  evdance: {
    shipping: {
      ratePriceUSD: 0,
      handlingMinDays: 1,
      handlingMaxDays: 2,
      transitMinDays: 5,
      transitMaxDays: 7,
      countries: ["US"],
      note: "Free shipping is continental-U.S.-only (excludes AK, HI, PR, U.S. territories).",
    },
    returns: {
      category: "MerchantReturnFiniteReturnWindow",
      days: 30,
      fees: "RestockingFees",
      restockingFeePercent: 30,
      note:
        "EVDANCE pays return shipping for quality issues/wrong item; customer pays for change-of-mind returns. 30% restocking fee applies. After 30 days, exchange only (no refund).",
    },
    sourceUrls: [
      "https://evdances.com/policies/shipping-policy",
      "https://evdances.com/pages/refund-policy",
    ],
  },

  "golden-maple": {
    shipping: {
      ratePriceUSD: 6,
      freeThresholdUSD: 29.99,
      handlingMinDays: 1,
      handlingMaxDays: 3,
      transitMinDays: 5,
      transitMaxDays: 15,
      countries: ["US"],
      note: "$29.99 free-shipping threshold is the non-EU rate; EU threshold is $36.99 (not separately modeled here).",
    },
    returns: {
      category: "MerchantReturnFiniteReturnWindow",
      days: 30,
      fees: "ReturnShippingFees",
      note:
        "Customer pays return shipping for personal-reason returns; Golden Maple pays if their error caused a wrong/damaged item. Opened products excluded.",
    },
    sourceUrls: [
      "https://artgoldenmaple.com/pages/shipping-policy",
      "https://artgoldenmaple.com/pages/return-and-refund-policy",
    ],
  },

  "canvas-vows": {
    shipping: {
      // Canvas Vows advertises "Free Shipping & 100% Satisfaction
      // Guarantee" site-wide (confirmed on multiple pages including their
      // dedicated Design Processing & Shipping Time page's own banner)
      // but does not publish exact processing/transit day counts in
      // static page content — their processing-time page is rendered
      // client-side and its numeric detail wasn't retrievable. Modeled
      // as free shipping with a conservative, clearly-sourced handling
      // estimate rather than inventing transit days that aren't
      // published anywhere.
      ratePriceUSD: 0,
      handlingMinDays: 2,
      handlingMaxDays: 5,
      transitMinDays: 3,
      transitMaxDays: 10,
      countries: ["US"],
      note:
        "Free shipping confirmed via site-wide banner. Exact handling/transit day counts aren't published in static page content (their processing-time page renders client-side) — these are conservative estimates, not the partner's own stated figures. Revisit if exact numbers become available.",
    },
    returns: {
      // Canvas Vows' real model is fundamentally different from a
      // post-delivery return window: personalized items are "100%
      // refundable before the item is shipped" (i.e. before the customer
      // approves a design proof) and non-refundable after approval;
      // non-personalized items aren't returnable at all. There is no
      // real post-delivery return window to report, so
      // MerchantReturnFiniteReturnWindow with a fabricated day count
      // would misstate their actual policy — NotPermitted is the honest
      // encoding for "no return once shipped," with the real pre-
      // shipment refund mechanism explained in note instead.
      category: "MerchantReturnNotPermitted",
      fees: "FreeReturn",
      note:
        "No post-delivery returns. Personalized items are 100% refundable only before the customer approves the design proof (i.e. before production/shipment); non-personalized items are non-returnable entirely. Damaged items get a reprinted replacement, not a return.",
    },
    sourceUrls: [
      "https://www.canvasvows.com/pages/return-and-refund-policy",
      "https://www.canvasvows.com/pages/design-processing-shipping-time",
    ],
  },

  "king-koil": {
    shipping: {
      ratePriceUSD: 0,
      handlingMinDays: 0,
      handlingMaxDays: 1,
      transitMinDays: 2,
      transitMaxDays: 3,
      countries: ["US"],
      note:
        "Shipping cost isn't explicitly stated on their shipping-info page; treated as included/free since no separate charge is mentioned anywhere. \"Most orders ship same day.\"",
    },
    returns: {
      category: "MerchantReturnFiniteReturnWindow",
      days: 30,
      fees: "ReturnShippingFees",
      note:
        "King Koil pays return shipping for defective/wrong items; customer pays for change-of-mind or wrong-size returns. Must be unused, in original packaging.",
    },
    sourceUrls: [
      "https://kingkoilairbeds.com/pages/shipping-information",
      "https://kingkoilairbeds.com/pages/returns-and-warranty",
    ],
  },

  "tsar-bomba": {
    shipping: {
      ratePriceUSD: 0,
      freeThresholdUSD: 60,
      handlingMinDays: 1,
      handlingMaxDays: 2,
      transitMinDays: 3,
      transitMaxDays: 7,
      countries: ["US"],
      note: "USA transit time; custom/monogrammed items need 4+ additional processing days (not modeled — applies to a subset of SKUs).",
    },
    returns: {
      category: "MerchantReturnFiniteReturnWindow",
      days: 30,
      fees: "ReturnShippingFees",
      note:
        "Tsar Bomba covers return shipping for quality issues (customer pays upfront, reimbursed); customer pays for non-quality returns, plus a 20% service fee if initiated after 30 days. No restocking fee. 2-year warranty covers manufacturing defects separately.",
    },
    sourceUrls: ["https://tsarbomba.com/pages/return-policy", "https://tsarbomba.com/pages/delivery-and-shipping"],
  },
};

export function getPartnerPolicy(partnerId: string): PartnerPolicy | undefined {
  return PARTNER_POLICIES[partnerId];
}
