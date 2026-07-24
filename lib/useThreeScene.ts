"use client";

import { useEffect, useRef, useState } from "react";

export { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Scroll-linked progress for a DOM section: roughly -1 (section below the
 * viewport) .. 0 (centered) .. 1 (section above the viewport). This is
 * intentionally a plain DOM/scroll hook rather than something living
 * inside the Three.js scene graph — React Three Fiber's <Canvas> has no
 * direct line of sight to page scroll, so the *page* section computes
 * this and passes it down to its Scene component as a plain number prop.
 *
 * Camera/renderer setup itself is declarative in R3F (see
 * components/three/SceneCanvas.tsx) rather than imperative hook code;
 * shared lighting and post-processing are components too
 * (CinematicRig.tsx, PostFX.tsx) since they render JSX. This hook is the
 * cross-cutting, non-JSX piece every scene needs.
 */
export function useSectionScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    function update() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      setProgress(Math.max(-1, Math.min(1, 1 - center / (vh / 2))));
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return [ref, progress] as const;
}
