/**
 * Loyalty tier system — points are derived from total spend
 * (`user_spending_summary.total_spent`), not stored anywhere themselves,
 * so there's nothing to keep in sync: spend more, points update
 * automatically next time the dashboard renders.
 */

export type TierId = "member" | "bronze" | "silver" | "gold" | "diamond";

export type Tier = {
  id: TierId;
  name: string;
  /** Points required to *reach* this tier. */
  threshold: number;
};

/**
 * "Member" is the implicit, unranked starting point below Bronze —
 * everyone begins here, so the UI always has *something* to compute even
 * at 0 points. It's not a real, displayed tier: no badge icon is shown
 * for it (see LoyaltyTierCard.tsx), and it's excluded from the four-tier
 * grid on the homepage's loyalty section (LoyaltySection.tsx).
 *
 * Tier ranges (points, matching each threshold below up to the next
 * tier's threshold):
 *   0–499     → unranked (member)
 *   500–1499  → Bronze
 *   1500–2999 → Silver
 *   3000–12999 → Gold
 *   13000+    → Diamond
 */
export const TIERS: Tier[] = [
  { id: "member", name: "Member", threshold: 0 },
  { id: "bronze", name: "Bronze", threshold: 500 },
  { id: "silver", name: "Silver", threshold: 1500 },
  { id: "gold", name: "Gold", threshold: 3000 },
  { id: "diamond", name: "Diamond", threshold: 13000 },
];

/** 10 loyalty points per $100 spent, i.e. 1 point per $10. */
export function getLoyaltyPoints(totalSpent: number): number {
  if (!Number.isFinite(totalSpent) || totalSpent <= 0) return 0;
  return Math.floor((totalSpent / 100) * 10);
}

/** Short, marketing-facing blurb per tier — shown on the homepage's loyalty section. */
export const TIER_PERKS: Record<TierId, string> = {
  member: "Start earning points on every purchase, from day one.",
  bronze: "Priority price-drop alerts and early access to select deals.",
  silver: "Everything in Bronze, plus free price-history reports on saved items.",
  gold: "Everything in Silver, plus a deals concierge and bonus point days.",
  diamond: "Everything in Gold, plus first access to limited releases and a personal savings review.",
};

export type LoyaltyStatus = {
  points: number;
  tier: Tier;
  /** True for the "member" tier (0–499 points) — unranked, no badge/icon shown. */
  isUnranked: boolean;
  /** null once the highest tier (Diamond) is reached — there's no "next". */
  nextTier: Tier | null;
  /** Points still needed to reach nextTier; 0 if there is no next tier. */
  pointsToNext: number;
  /** 0–100, how far through the current tier's range towards the next tier. */
  progressPct: number;
};

export function getLoyaltyStatus(totalSpent: number): LoyaltyStatus {
  const points = getLoyaltyPoints(totalSpent);

  // Highest tier whose threshold the user has met — e.g. 27 points meets
  // only "member"'s threshold (0), so tier stays "member" (unranked) and
  // never reaches "bronze" (500) until points actually cross it.
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (points >= t.threshold) tier = t;
  }

  const isUnranked = tier.id === "member";

  const tierIndex = TIERS.findIndex((t) => t.id === tier.id);
  const nextTier = tierIndex < TIERS.length - 1 ? TIERS[tierIndex + 1] : null;

  const pointsToNext = nextTier ? Math.max(0, nextTier.threshold - points) : 0;

  const progressPct = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          ((points - tier.threshold) / (nextTier.threshold - tier.threshold)) * 100
        )
      )
    : 100;

  return { points, tier, isUnranked, nextTier, pointsToNext, progressPct };
}
