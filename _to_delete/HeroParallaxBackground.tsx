"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

const PARALLAX_FACTOR = 0.12;
const MAX_OFFSET = 60;

export default function HeroParallaxBackground() {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    let raf = 0;
    function update() {
      const offset = Math.min(window.scrollY * PARALLAX_FACTOR, MAX_OFFSET);
      if (rootRef.current) {
        rootRef.current.style.transform = `translateY(${offset}px)`;
      }
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 -z-10 will-change-transform"
      aria-hidden
    >
      <div className="absolute -top-24 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-b from-sage-100 via-cream-100 to-transparent blur-3xl" />
      <div className="absolute right-[-120px] top-40 h-72 w-72 rounded-full bg-clay-400/10 blur-3xl" />
    </div>
  );
}
