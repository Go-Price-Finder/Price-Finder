/**
 * Loyalty tier constants. The points/tiers program itself was retired along
 * with purchase-tracking (no live checkout flow exists to derive real spend
 * from) — the marketing copy that used to describe it on the homepage and
 * how-it-works page (LoyaltySection.tsx, TIER_PERKS, getLoyaltyPoints) was
 * removed for no longer matching reality. What's left here (TierId, Tier,
 * TIERS) is kept only because the unused-but-not-deleted decorative 3D tier
 * icon scenes (components/three/LoyaltyScene.tsx, TierIconScene.tsx,
 * TierModels.tsx) still reference these types.
 */

export type TierId = "member" | "bronze" | "silver" | "gold" | "diamond";

export type Tier = {
  id: TierId;
  name: string;
  /** Points required to *reach* this tier. */
  threshold: number;
};

export const TIERS: Tier[] = [
  { id: "member", name: "Member", threshold: 0 },
  { id: "bronze", name: "Bronze", threshold: 500 },
  { id: "silver", name: "Silver", threshold: 1500 },
  { id: "gold", name: "Gold", threshold: 3000 },
  { id: "diamond", name: "Diamond", threshold: 13000 },
];

