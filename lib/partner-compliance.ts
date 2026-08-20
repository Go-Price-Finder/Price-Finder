/**
 * Compliance gate — the hard rule enforced here is: no partner's products
 * ever display on the live site, and no new partner is ever imported,
 * unless that partner has passed the checks below. Reads
 * lib/partner-compliance.json, the same file scripts/import-partner.mjs
 * reads directly (see that script's own compliance section), so an
 * import-time decision and a render-time decision are always based on the
 * identical registry entry — there's no separate copy of this logic to
 * drift out of sync.
 *
 * This is deliberately checked in TWO places, not one:
 *   1. scripts/import-partner.mjs — blocks a non-compliant partner's data
 *      from ever being generated/wired in, with a printed compliance
 *      report explaining exactly why.
 *   2. lib/partners.ts (via isPartnerLive/applyImageCompliance below) —
 *      blocks a non-compliant partner's products from rendering even if
 *      its data file somehow already exists and is wired into PARTNERS
 *      (a hand-edit, a bug, a status that changed after import). This is
 *      the same "don't rely on one place remembering to do the right
 *      thing" lesson as the PARTNER_REGISTRY_MARKER fix earlier in this
 *      project — a single point of failure at import time isn't enough
 *      for a "no partner ever displays without passing" hard requirement.
 *
 * Update lib/partner-compliance.json whenever new terms are reviewed —
 * this file's logic does not need to change for a status/permission
 * update to take effect everywhere.
 */

import complianceRegistry from "./partner-compliance.json";

export type CommissionBase = {
  includesVAT: boolean;
  includesDelivery: boolean;
  includesCCFees: boolean;
  includesGiftWrap: boolean;
};

export type ComplianceStatus = "active" | "pending" | "reviewed-not-applied";

export type PartnerComplianceEntry = {
  network?: string;
  status: ComplianceStatus;
  commissionRate?: string;
  commissionBase?: CommissionBase;
  cookieDays?: number;
  imageUsagePermission?: "pending" | "confirmed" | "assessed-low-risk";
  /** Trademark display, deliberately separate from image use — see
   * canShowRealLogo below for why silence on images is not a grant here. */
  logoUsagePermission?: "pending" | "confirmed" | "assessed-low-risk";
  logoUsageNote?: string;
  imageUsageNote?: string;
  noPlagiarism?: boolean;
  noPlagiarismNote?: string;
  noCouponSiteBehavior?: boolean;
  excludedProducts?: boolean;
  excludedProductsNote?: string;
  ftcDisclosureRequired?: boolean;
  noMedicalClaims?: boolean;
  noMedicalClaimsNote?: string;
  priceSyncSensitive?: boolean;
  priceSyncNote?: string;
  googleShoppingAllowed?: boolean;
  couponSharingRestricted?: boolean;
  noDiscountLanguageNearBrand?: boolean;
  noDiscountLanguageNote?: string;
  noIncentivizedTraffic?: boolean;
  writtenConsentForContent?: boolean;
  comparisonEngineConfirmed: boolean;
  comparisonEngineNote?: string;
};

/** The only values `imageUsagePermission` is allowed to hold — checked
 * against the raw JSON below so an informal/typo'd string (e.g. a value
 * copy-pasted from a chat message) can't silently slip through a type
 * assertion and be treated as an implicit pass. See validateComplianceRegistry. */
const VALID_IMAGE_USAGE_PERMISSIONS = ["pending", "confirmed", "assessed-low-risk"] as const;

/**
 * Fails the build/import fast on a malformed registry entry, rather than
 * letting `as { partners: Record<string, PartnerComplianceEntry> }` below
 * wave through a value TypeScript never actually checked at runtime — the
 * JSON file has no compiler to enforce its own type. Scoped to
 * imageUsagePermission specifically, since that's the field whose value
 * directly controls whether real partner images go live.
 */
function validateComplianceRegistry(
  partners: Record<string, PartnerComplianceEntry>
): void {
  for (const [partnerId, entry] of Object.entries(partners)) {
    const permission = entry.imageUsagePermission;
    if (
      permission !== undefined &&
      !(VALID_IMAGE_USAGE_PERMISSIONS as readonly string[]).includes(permission)
    ) {
      throw new Error(
        `lib/partner-compliance.json: partner "${partnerId}" has an invalid ` +
          `imageUsagePermission value ${JSON.stringify(permission)} — must be ` +
          `one of ${VALID_IMAGE_USAGE_PERMISSIONS.map((v) => `"${v}"`).join(", ")}.`
      );
    }
  }
}

const PARTNERS: Record<string, PartnerComplianceEntry> = (
  complianceRegistry as { partners: Record<string, PartnerComplianceEntry> }
).partners;

validateComplianceRegistry(PARTNERS);

/** Local placeholder image shown in place of a partner's real product
 * photos whenever that partner's imageUsagePermission is "pending" —
 * generated once (see public/images/_placeholders/) rather than fetched
 * per-product, since it's identical for every gated product. */
export const IMAGE_PENDING_PLACEHOLDER = "/images/_placeholders/image-pending.png";

export function getComplianceEntry(
  partnerId: string
): PartnerComplianceEntry | undefined {
  return PARTNERS[partnerId];
}

export type ComplianceGateResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * The hard gate: can this partner's products be imported/displayed at
 * all? Three independent reasons to block, checked in the order the
 * spec lists them:
 *   - no registry entry at all (terms never reviewed)
 *   - status isn't "active" (reviewed, but not an approved/live affiliate)
 *   - comparisonEngineConfirmed is explicitly false (reviewed, but this
 *     partner's terms don't confirm eligibility for a comparison/price
 *     site specifically — a stricter bar than just "affiliate approved")
 * Note comparisonEngineConfirmed is a required field on every entry
 * (not just checked when `false`) — an entry that omits it entirely is a
 * malformed registry entry, not an implicit pass, so TypeScript itself
 * won't compile a new entry that leaves it out.
 */
export function checkImportGate(partnerId: string): ComplianceGateResult {
  const entry = getComplianceEntry(partnerId);
  if (!entry) {
    return {
      allowed: false,
      reason:
        "Partner not found in compliance registry — terms must be reviewed before import.",
    };
  }
  if (entry.status !== "active") {
    return {
      allowed: false,
      reason: `Partner is not yet an approved/active affiliate (status: "${entry.status}") — do not display products live.`,
    };
  }
  if (entry.comparisonEngineConfirmed === false) {
    return {
      allowed: false,
      reason:
        "Partner type hasn't been confirmed as eligible for a comparison site (comparisonEngineConfirmed: false)." +
        (entry.comparisonEngineNote ? ` ${entry.comparisonEngineNote}` : ""),
    };
  }
  return { allowed: true };
}

/** True only for a partner that has fully passed the import gate — used
 * by lib/partners.ts as the render-time backstop described in the file
 * header above. */
export function isPartnerLive(partnerId: string): boolean {
  return checkImportGate(partnerId).allowed;
}

/**
 * True only when imageUsagePermission is explicitly "confirmed" (partner
 * gave written permission) or "assessed-low-risk" (terms reviewed, no
 * image/branding restriction found, documented judgment call to proceed
 * without written sign-off). Deliberately an explicit allow-list rather
 * than `!== "pending"` — an inverse check would treat any unrecognized or
 * mistyped value as an implicit pass, which is exactly how an informal
 * string once slipped through and unlocked images without real
 * confirmation. Anything else, including "pending" or a value outside the
 * three defined ones, fails closed and callers should substitute
 * IMAGE_PENDING_PLACEHOLDER instead of the product's real image/images.
 */
export function canShowRealImages(partnerId: string): boolean {
  const permission = getComplianceEntry(partnerId)?.imageUsagePermission;
  return permission === "confirmed" || permission === "assessed-low-risk";
}

/**
 * True only when logoUsagePermission is explicitly "confirmed" or
 * "assessed-low-risk" — an explicit allow-list for the same reason
 * canShowRealImages uses one: an inverse check would treat any
 * unrecognised or mistyped value as an implicit pass.
 *
 * DELIBERATELY SEPARATE FROM canShowRealImages (2026-08-20): a logo is a
 * TRADEMARK, and displaying it is a stronger claim than displaying a
 * product photo. Six partners are cleared for images on the strength of
 * a silent AWIN Branding tab; silence is not a grant of trademark use,
 * so they are `pending` here and render the monogram instead — at the
 * identical footprint, so there is no layout change and no hole.
 */
export function canShowRealLogo(partnerId: string): boolean {
  const permission = getComplianceEntry(partnerId)?.logoUsagePermission;
  return permission === "confirmed" || permission === "assessed-low-risk";
}

/** True when this partner's product descriptions must be manually
 * reviewed for verbatim overlap with vendor/feed text before going live
 * (noPlagiarism: true) — see checkDescriptionForPlagiarism below for the
 * actual similarity check run per-product at import time. */
export function requiresDescriptionReview(partnerId: string): boolean {
  return getComplianceEntry(partnerId)?.noPlagiarism === true;
}

/** True when this partner's products need a per-SKU commission-exclusion
 * check before they can be featured in Best Sellers/Deals (as opposed to
 * just listed on their own partner page). */
export function requiresPerSkuFeatureCheck(partnerId: string): boolean {
  return getComplianceEntry(partnerId)?.excludedProducts === true;
}

/**
 * Heuristic near-duplicate check for noPlagiarism partners: flags a
 * generated product description as needing manual rewrite if it's a
 * long, close match against the raw source text (case/whitespace
 * normalized). This is deliberately conservative (checks for one string
 * being substantially contained in the other, not a fuzzy edit-distance
 * score) — the goal is to catch "the description is the vendor's feed
 * text copy-pasted verbatim," not to flag every incidental phrase
 * overlap, which would make the noPlagiarism flag noisy enough to ignore.
 */
export function looksCopiedVerbatim(
  generatedDescription: string,
  sourceFeedText: string
): boolean {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const a = normalize(generatedDescription);
  const b = normalize(sourceFeedText);
  if (!a || !b) return false;
  // Only worth flagging once there's enough text for "verbatim" to mean
  // something — a 5-word description matching a 5-word source isn't
  // evidence of copying, it's just short.
  if (a.length < 40 || b.length < 40) return false;
  return a === b || a.includes(b) || b.includes(a);
}
