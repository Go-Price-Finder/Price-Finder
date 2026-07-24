"use client";

import { useState } from "react";
import { TIERS, TIER_PERKS, type TierId } from "@/lib/loyalty";
import TierIcon3D from "./TierIcon3D";

const DISPLAY_TIERS = TIERS.filter((t) => t.id !== "member");

const TIER_ACCENT: Record<TierId, string> = {
  member: "border-ivory-400/30",
  bronze: "border-[#b06f3f]",
  silver: "border-[#9aa3ad]",
  gold: "border-[#eab635]",
  diamond: "border-[#7fc3e0]",
};

export default function LoyaltySection() {
  const [activeTier, setActiveTier] = useState<TierId | null>(null);

  return (
    <section
      id="loyalty"
      className="relative flex min-h-[85vh] scroll-mt-20 snap-start flex-col justify-center overflow-hidden py-14 sm:py-20"
    >
      {/* The old Three.js "cave" background scene has been removed — this
          section is now a clean, transparent background (showing the
          global CinematicBackground through) ready for new, more subtle
          per-section animation. */}

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Loyalty rewards
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Earn your place at the top
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-lg text-balance text-ivory-300">
            Every purchase earns points. Climb through four tiers — hover to
            see what each one unlocks.
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-5 sm:grid-cols-4 sm:gap-6"
          onMouseLeave={() => setActiveTier(null)}
        >
          {DISPLAY_TIERS.map((tier) => {
            const active = activeTier === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onMouseEnter={() => setActiveTier(tier.id)}
                onFocus={() => setActiveTier(tier.id)}
                onBlur={() => setActiveTier((current) => (current === tier.id ? null : current))}
                className={`group flex flex-col items-center gap-2 rounded-3xl border bg-noir-800/75 p-5 text-center shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-soft-xl sm:p-6 ${
                  active ? TIER_ACCENT[tier.id] : "border-gilt-500/20"
                }`}
              >
                <TierIcon3D tier={tier.id} />
                <h3 className="mt-1 font-display text-lg font-medium text-ivory-50">
                  {tier.name}
                </h3>
                <p className="text-xs text-ivory-300">
                  {tier.threshold.toLocaleString()}+ points
                </p>
                <p
                  className={`overflow-hidden text-balance text-xs leading-relaxed text-ivory-300 transition-all duration-300 ease-out ${
                    active ? "max-h-24 opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  {TIER_PERKS[tier.id]}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
