"use client";

import { Bloom, DepthOfField, EffectComposer, Vignette } from "@react-three/postprocessing";

/**
 * Shared cinematic post-processing chain: bloom (the glow on bright/
 * emissive surfaces — coins, gems, node lights), an optional depth of
 * field for scenes with real z-depth (Hero's terrain, the Loyalty cave,
 * Trending's tumbling field), and a vignette to pull focus inward. This
 * is a static visual filter, not an animation, so it's applied the same
 * way regardless of prefers-reduced-motion — only the *continuous* motion
 * (SceneCanvas's frameloop, each scene's useFrame code) is gated for
 * that preference.
 */
export default function PostFX({
  bloomIntensity = 0.6,
  vignetteDarkness = 0.65,
  dof = false,
}: {
  bloomIntensity?: number;
  vignetteDarkness?: number;
  dof?: boolean;
}) {
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.35}
        luminanceSmoothing={0.2}
        mipmapBlur
      />
      {dof ? <DepthOfField focusDistance={0.015} focalLength={0.05} bokehScale={2.2} /> : <></>}
      <Vignette eskil={false} offset={0.25} darkness={vignetteDarkness} />
    </EffectComposer>
  );
}
