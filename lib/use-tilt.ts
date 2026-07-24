"use client";

import { useCallback, useRef } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

const MAX_TILT_DEG = 8;
const HOVER_SCALE = 1.03;
const LIFT_PX = 6;

/**
 * A gentle, mouse-position-based 3D tilt for cards. Rotation is driven
 * directly via ref (no re-renders on every pointer move) and reset on
 * pointer leave, letting the element's own CSS transition animate the
 * return smoothly. Skips entirely for touch input and reduced-motion users.
 */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (prefersReducedMotion || e.pointerType !== "mouse") return;
      const el = ref.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * MAX_TILT_DEG * 2;
      const rotateX = (0.5 - py) * MAX_TILT_DEG * 2;

      el.style.transform = `perspective(900px) rotateX(${rotateX.toFixed(
        2
      )}deg) rotateY(${rotateY.toFixed(
        2
      )}deg) scale3d(${HOVER_SCALE}, ${HOVER_SCALE}, ${HOVER_SCALE}) translateY(-${LIFT_PX}px)`;
    },
    [prefersReducedMotion]
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "";
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
