"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * App-wide smooth scroll via Lenis, driving a single requestAnimationFrame
 * loop that eases the browser's native scroll position. Every scroll-linked
 * effect in the app (Hero's forward camera dolly through the souk corridor,
 * every other section's parallax) reads plain `window` scroll through
 * useSectionScrollProgress — Lenis intercepts and smooths that underlying
 * scroll so those effects feel continuous instead of stepped, without any
 * of the consuming code needing to know Lenis exists.
 *
 * Skipped entirely for prefers-reduced-motion: smoothed/inertial scrolling
 * is itself a motion effect some users need off, so native instant scroll
 * is the correct fallback rather than a slowed-down version of the same
 * effect.
 */
export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [prefersReducedMotion]);

  return <>{children}</>;
}
