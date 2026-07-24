import { TierIcon } from "./loyalty-icons";
import type { TierId } from "@/lib/loyalty";

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-16 w-16",
  md: "h-24 w-24",
  lg: "h-32 w-32",
};

/**
 * A tier's icon — a levitating PNG (components/loyalty-icons.tsx),
 * replacing the previous WebGL model + SVG podium
 * (components/three/TierIconScene.tsx, components/Podium.tsx, both now
 * unused). Kept this component's name and props unchanged so
 * LoyaltyTierCard.tsx and LoyaltySection.tsx didn't need to change.
 */
export default function TierIcon3D({
  tier,
  size = "md",
}: {
  tier: TierId;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="flex items-center justify-center">
      <TierIcon tier={tier} className={SIZE_CLASSES[size]} />
    </div>
  );
}
