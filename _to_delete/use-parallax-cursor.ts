"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Cursor-reactive parallax, section-scoped. Rather than requiring a ref on
 * the whole section (awkward to wire through several unrelated
 * components), this listens on `window` and, on every move, checks the
 * returned ref's own bounding rect — so it can be attached directly to a
 * background layer div that already spans its section (`absolute
 * inset-0`), no prop drilling needed. Writes normalized offsets as CSS
 * custom properties (`--px`, `--py`, roughly -0.5..0.5) instead of
 * triggering a re-render on every pointer move.
 */
export function useParallaxCursor<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    let raf = 0;
    function onMove(e: PointerEvent) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Only react while the cursor is vertically within this section —
        // keeps each section's background responding to its own patch of
        // the page rather than every section reacting to one global move.
        if (e.clientY < rect.top || e.clientY > rect.bottom) return;
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty("--px", px.toFixed(3));
        el.style.setProperty("--py", py.toFixed(3));
      });
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [prefersReducedMotion]);

  return ref;
}
