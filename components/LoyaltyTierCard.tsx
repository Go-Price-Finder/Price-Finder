import { getLoyaltyStatus, type TierId } from "@/lib/loyalty";
import TierIcon3D from "./TierIcon3D";

const TIER_STYLES: Record<TierId, { badge: string; bar: string }> = {
  member: {
    badge: "bg-noir-700 text-ivory-200",
    bar: "bg-gilt-500",
  },
  bronze: {
    badge: "bg-[#b06f3f]/10 text-[#8a5230]",
    bar: "bg-gilt-500",
  },
  silver: {
    badge: "bg-[#8f98a3]/12 text-[#5c6570]",
    bar: "bg-gilt-500",
  },
  gold: {
    badge: "bg-[#eab635]/12 text-[#8f5e14]",
    bar: "bg-gilt-500",
  },
  diamond: {
    badge: "bg-[#7fc3e0]/15 text-[#2f7a9c]",
    bar: "bg-gilt-500",
  },
};

export default function LoyaltyTierCard({ totalSpent }: { totalSpent: number }) {
  const { points, tier, isUnranked, nextTier, pointsToNext, progressPct } =
    getLoyaltyStatus(totalSpent);
  const styles = TIER_STYLES[tier.id];

  return (
    <div className="mb-10 flex flex-col gap-6 rounded-3xl border border-gilt-500/20 bg-noir-800 p-6 shadow-soft sm:flex-row sm:items-center sm:p-8">
      {/* Below Bronze (0–499 points) is unranked — no tier icon to show
          yet, so this column is skipped entirely rather than falling back
          to another tier's art. */}
      {!isUnranked && (
        <div className="shrink-0 self-center">
          <TierIcon3D tier={tier.id} size="lg" />
        </div>
      )}

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles.badge}`}
          >
            {isUnranked ? "Unranked" : `${tier.name} Tier`}
          </span>
          <span className="text-xs text-ivory-300">Loyalty status</span>
        </div>

        <p className="mt-2 font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
          {points.toLocaleString()} points
        </p>

        <p className="mt-1 text-sm text-ivory-300">
          {nextTier
            ? `${pointsToNext.toLocaleString()} points to ${nextTier.name}`
            : "You've reached the highest tier — thank you for shopping with us."}
        </p>

        <div className="mt-4">
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-noir-700"
            role="progressbar"
            aria-valuenow={Math.round(progressPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={
              nextTier
                ? `Progress toward ${nextTier.name} tier`
                : "Highest loyalty tier reached"
            }
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ease-out ${styles.bar}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-ivory-300">
            <span>{isUnranked ? "Unranked" : tier.name}</span>
            <span>{nextTier ? nextTier.name : "Max tier"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
