"use client";

import { useParallaxCursor } from "@/lib/use-parallax-cursor";

export type ParallaxBlob = {
  /** Positioning, size, color, and blur — everything but the transform. */
  className: string;
  /** How far this layer drifts (in px) at the cursor's extremes — larger
   *  values read as "closer" to the viewer, smaller as "further back". */
  depth: number;
};

/**
 * Drop-in cursor-reactive background for any `relative` section. Self
 * contained — it tracks the cursor itself (see useParallaxCursor), so
 * callers just supply a themed set of blobs and don't need to wire up any
 * refs. Colors transition smoothly when the `blobs` prop changes (used by
 * the loyalty section to shift theme on hover).
 */
export default function ParallaxBlobs({
  blobs,
  className = "",
}: {
  blobs: ParallaxBlob[];
  className?: string;
}) {
  const ref = useParallaxCursor<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`}
      aria-hidden
    >
      {blobs.map((blob, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-3xl transition-colors duration-700 will-change-transform ${blob.className}`}
          style={{
            transform: `translate(calc(var(--px, 0) * ${blob.depth}px), calc(var(--py, 0) * ${blob.depth}px))`,
          }}
        />
      ))}
    </div>
  );
}
