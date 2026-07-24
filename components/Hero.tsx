"use client";

import Image from "next/image";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import SearchBar from "./SearchBar";
import RetailerFilterBar from "./RetailerFilterBar";
import { StoreIcon, TagIcon, TrendingUpIcon } from "./icons";
import { useSectionScrollProgress } from "@/lib/useThreeScene";

// No real usage data exists yet — every one of these used to be a made-up
// number (stores tracked, prices compared, average savings). Rather than
// invent plausible-looking figures, each stat now says plainly that the
// data isn't in yet; swap in real numbers once there's real traffic to
// measure.
const STATS = [
  { icon: StoreIcon, label: "Stores tracked" },
  { icon: TagIcon, label: "Prices compared daily" },
  { icon: TrendingUpIcon, label: "Average savings" },
];

const POPULAR_TERMS = ["Air fryers", "Standing desks", "Sneakers", "Skincare sets"];

export default function Hero() {
  // scrollProgress is unused now that HeroScene's background is gone, but
  // sectionRef is kept wired up for whatever scroll-linked effect replaces
  // it — see the removal note below.
  const [sectionRef] = useSectionScrollProgress<HTMLElement>();
  const prefersReducedMotion = useReducedMotion();

  // Framer Motion fade-up for the overlay content — staggered via each
  // element's `custom` delay. Collapses to an instant, motion-free
  // transition when the user prefers reduced motion (Framer Motion's own
  // useReducedMotion hook, since the global CSS override in globals.css
  // only targets CSS animations/transitions, not JS-driven ones like this).
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 18 },
    visible: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] },
    }),
  };

  return (
    <section
      ref={sectionRef}
      id="hero"
      /* min-h-[90vh] rather than a full min-h-screen — with the large
         emblem now anchoring this section, the content comfortably fills
         most of the viewport on its own, so forcing a full extra screen's
         worth of height here just left an oversized, empty-feeling gap
         before LoyaltySection/TrendingNow (see the pt/pb tightening below
         too). */
      className="relative flex min-h-[90vh] scroll-mt-20 snap-start flex-col justify-center overflow-hidden"
    >
      {/* The old Three.js marketplace-photo background scene has been
          removed — this section is now a clean, transparent background
          (showing the global CinematicBackground through) ready for new,
          more subtle per-section animation. */}

      <div className="mx-auto max-w-6xl px-5 pb-14 pt-14 text-center sm:px-8 sm:pb-20 sm:pt-20">
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="mx-auto mb-6 flex justify-center"
        >
          {/* The full Price Finder emblem — large and detailed, distinct
              from the small icon-only mark used in the nav (see Logo.tsx).
              This is the first thing a visitor sees, sitting directly above
              the headline. logo-one.png is a higher-resolution source
              (1024x1024, up from the previous 512x512 logo.png) so it stays
              crisp at this size instead of upscaling and looking blurry. */}
          <Image
            src="/images/logo/logo-one.png"
            alt="Price Finder"
            width={1024}
            height={1024}
            priority
            className="h-24 w-24 drop-shadow-[0_8px_24px_rgba(184,147,95,0.35)] sm:h-32 sm:w-32 md:h-36 md:w-36"
          />
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={0.06}
          variants={fadeUp}
          className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-gilt-500/25 bg-noir-800/70 px-4 py-1.5 text-xs font-medium text-ivory-100 shadow-soft backdrop-blur-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gilt-500" />
          Data collection in progress
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={0.14}
          variants={fadeUp}
          className="text-balance font-display text-4xl font-medium leading-[1.1] tracking-tight text-ivory-50 sm:text-6xl md:text-[68px]"
        >
          Find better deals.
          <br />
          <span className="italic text-gilt-400">Shop smarter.</span>
        </motion.h1>

        <motion.p
          initial="hidden"
          animate="visible"
          custom={0.22}
          variants={fadeUp}
          className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-ivory-300 sm:text-lg"
        >
          Price Finder helps you compare prices across retailers, all in one
          place. Search once, compare easily.
        </motion.p>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={0.3}
          variants={fadeUp}
          className="relative z-20 mx-auto mt-9 max-w-2xl"
        >
          <SearchBar
            size="lg"
            placeholder="Try “wireless headphones” or “oak dining table”…"
          />

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <RetailerFilterBar />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-ivory-300">
            <span>Popular:</span>
            {POPULAR_TERMS.map((term) => (
              <button
                key={term}
                className="rounded-full border border-gilt-500/25 bg-noir-800 px-3 py-1 font-medium text-ivory-100 transition-all duration-200 hover:border-gilt-400/40 hover:bg-gilt-500/10 hover:text-gilt-400"
              >
                {term}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={0.38}
          variants={fadeUp}
          className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 sm:gap-8"
        >
          {STATS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-2 rounded-2xl border border-gilt-500/20 bg-noir-800/60 px-3 py-5 shadow-soft backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
            >
              <Icon className="h-6 w-6 text-gilt-400" />
              <span className="text-balance text-center text-xs font-medium text-ivory-200 sm:text-sm">
                Data collection in progress
              </span>
              <span className="text-center text-[11px] uppercase tracking-wide text-ivory-300 sm:text-xs">
                {label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
