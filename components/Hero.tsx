"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import SearchBar from "./SearchBar";
import LogoMark from "./LogoMark";
import { useSectionScrollProgress } from "@/lib/useThreeScene";

type HeroStats = {
  /** getAllRealProducts().length, computed by the caller (a Server
   * Component) — Hero itself must not import lib/partners.ts. That module
   * pulls in ~1.5MB of raw partner data plus category-mapper/compliance
   * helpers; importing it here (a "use client" component) would bundle
   * that entire graph into client-side JS just to compute this number. */
  products: number;
  /** PARTNERS.length, same reasoning. */
  partners: number;
};

export default function Hero({ stats }: { stats: HeroStats }) {
  // Real numbers from the live catalog (lib/partners.ts), passed down from
  // app/page.tsx (a Server Component) rather than computed here — replaces
  // the old "Data collection in progress" placeholders, which undercut
  // trust once the site actually had real data behind it.
  const STATS = [
    { value: String(stats.products), label: "Products tracked" },
    { value: String(stats.partners), label: "Partner stores" },
    { value: "Weekly", label: "Price checks" },
  ];

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

  // Same fade-up timing, but for the two elements most likely to be the
  // page's LCP candidate (the logo emblem and the H1 headline — the
  // largest above-the-fold content). Framer Motion applies `initial` as
  // inline styles even during SSR to avoid a flash of unanimated content,
  // which means a variant with `opacity: 0` server-renders those elements
  // invisible and holds up LCP until JS hydrates and runs the animation.
  // Keeping opacity at 1 throughout — and only animating the `y` slide —
  // preserves the visual effect while letting the real content paint
  // immediately.
  const fadeUpVisible: Variants = {
    hidden: { opacity: 1, y: prefersReducedMotion ? 0 : 18 },
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
          variants={fadeUpVisible}
          className="mx-auto mb-6 flex justify-center"
        >
          {/* Same flat vector mark as the nav (LogoMark), just larger — one
              source instead of a separate high-res raster export, so the
              emblem stays crisp at any size and never drifts out of sync
              with the small nav icon. */}
          <LogoMark
            size={112}
            className="h-24 w-24 drop-shadow-[0_8px_24px_rgba(184,147,95,0.25)] sm:h-32 sm:w-32 md:h-36 md:w-36"
          />
        </motion.div>

        <motion.h1
          initial="hidden"
          animate="visible"
          custom={0.14}
          variants={fadeUpVisible}
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
          Real listings from real stores — no sponsored rankings, no
          fabricated discounts, checked every week.
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
            placeholder="Try “achaar” or “chutney”…"
          />
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          custom={0.38}
          variants={fadeUp}
          className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 sm:gap-8"
        >
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-2xl border border-gilt-500/20 bg-noir-800/60 px-3 py-5 shadow-soft backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="font-display text-2xl font-semibold tabular-nums text-ivory-50 sm:text-3xl">
                {value}
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
