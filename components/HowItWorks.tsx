"use client";

import { SearchIcon, BellIcon, StarIcon, TrendingUpIcon } from "./icons";

const STEPS = [
  {
    icon: SearchIcon,
    title: "Search or browse",
    description:
      "Type in what you're looking for — a brand, a model, or just a description — or browse by category. We're steadily growing our retailer coverage so you can compare listings in one place.",
  },
  {
    icon: BellIcon,
    title: "Track prices & get alerts",
    description:
      "Price history and drop alerts are in development. Save an item to your wishlist and set a target price now, so you're ready the moment tracking goes live.",
  },
  {
    icon: StarIcon,
    title: "Earn points, climb tiers",
    description:
      "Loyalty points are coming soon. Climb from Bronze to Diamond to unlock priority alerts, price-history reports, and a deals concierge once purchases go live.",
  },
  {
    icon: TrendingUpIcon,
    title: "Compare before you buy",
    description:
      "We lay retailer prices side by side, shipping and fees included where available, and flag the lowest one we're tracking — so you can make a more informed choice.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative flex scroll-mt-20 snap-start flex-col justify-center overflow-hidden py-16 sm:py-24"
    >
      {/* The old Three.js background scene has been removed — this section
          is now a clean, transparent background (showing the global
          CinematicBackground through) ready for new, more subtle
          per-section animation. */}

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-14 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Simple &amp; fast
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            How Go Price Finder works
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </div>

        <div className="relative grid gap-8 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          <div
            className="pointer-events-none absolute left-0 right-0 top-9 hidden h-px bg-gradient-to-r from-transparent via-noir-700 to-transparent lg:block"
            aria-hidden
          />

          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="group relative flex h-full flex-col items-center rounded-3xl border border-transparent px-6 py-8 text-center transition-all duration-300 hover:border-gilt-500/25 hover:bg-noir-800 hover:shadow-soft-lg"
            >
              <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-gilt-500/10 text-gilt-400 shadow-soft transition-all duration-300 group-hover:scale-105 group-hover:bg-gilt-500 group-hover:text-noir-950">
                <step.icon className="h-7 w-7" />
                <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-noir-950 text-[11px] font-semibold text-gilt-400">
                  {index + 1}
                </span>
              </div>

              {/* min-h-14 = two lines of text-xl (28px line-height each) —
                  keeps every title's own text vertically centered in the
                  same amount of space, whether it wraps to one line or two,
                  so every card's description starts at the exact same Y
                  position instead of drifting based on title length. */}
              <h3 className="mt-5 flex min-h-14 w-full items-center justify-center text-balance font-display text-xl font-medium leading-snug text-ivory-50">
                {step.title}
              </h3>
              <p className="mt-2 text-balance text-sm leading-relaxed text-ivory-300">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
