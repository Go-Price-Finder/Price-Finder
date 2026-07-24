"use client";

import { Canvas } from "@react-three/fiber";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

/**
 * Shared <Canvas> setup for every section scene: capped device pixel
 * ratio (the cheapest perf knob on high-DPI screens), shadows on, and a
 * frameloop that's fully driven for normal users but switches to
 * "demand" for prefers-reduced-motion — R3F then renders once on mount
 * and never again unless something explicitly calls invalidate(), which
 * nothing in these scenes does, so reduced-motion users get a single
 * static frame instead of a continuous animation loop.
 */
export default function SceneCanvas({
  children,
  cameraPosition = [0, 0, 8],
  fov = 45,
}: {
  children: React.ReactNode;
  cameraPosition?: [number, number, number];
  fov?: number;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows
      frameloop={prefersReducedMotion ? "demand" : "always"}
      camera={{ position: cameraPosition, fov }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      {children}
    </Canvas>
  );
}
