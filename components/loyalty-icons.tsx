import Image from "next/image";
import type { TierId } from "@/lib/loyalty";

/**
 * Static art for each loyalty tier icon (Kawsar's PNGs in
 * public/images/tiers/), replacing the previous WebGL models
 * (components/three/TierModels.tsx, now unused). "member" has no
 * dedicated artwork yet — same as the old CoinModel fallback, it reuses
 * the Bronze image until a Member icon exists.
 *
 * All four filenames on disk are lowercase (bronze/silver/gold/diamond
 * .png) — this previously referenced "Silver.png" (capitalized), which
 * matched nothing on Vercel's case-sensitive Linux filesystem and made
 * the silver icon 404 in production, even though it "worked" in local
 * dev on Windows/macOS's case-insensitive filesystems. Keep this casing
 * lowercase and matching disk exactly.
 */
const TIER_ICON_SRC: Record<TierId, string> = {
  member: "/images/tiers/bronze.png",
  bronze: "/images/tiers/bronze.png",
  silver: "/images/tiers/silver.png",
  gold: "/images/tiers/gold.png",
  diamond: "/images/tiers/diamond.png",
};

const TIER_LABEL: Record<TierId, string> = {
  member: "Member",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

/**
 * A single tier's icon: a gently levitating image (CSS `animate-levitate`
 * — translateY only, no rotation) that fills whatever fixed-size wrapper
 * it's given. Pure CSS keyframe animation, so it's already frozen by the
 * global `prefers-reduced-motion: reduce` override in app/globals.css —
 * no extra JS-level check needed, matching how the other simple CSS
 * keyframe animations in this app (e.g. `animate-marquee`) handle it.
 */
export function TierIcon({
  tier,
  className = "",
}: {
  tier: TierId;
  className?: string;
}) {
  return (
    <div className={`animate-levitate ${className}`}>
      <Image
        src={TIER_ICON_SRC[tier]}
        alt={`${TIER_LABEL[tier]} tier icon`}
        width={256}
        height={256}
        className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(28,26,23,0.18)]"
      />
    </div>
  );
}
