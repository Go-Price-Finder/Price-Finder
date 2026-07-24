"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import SceneCanvas from "./SceneCanvas";
import CinematicRig from "./CinematicRig";
import PostFX from "./PostFX";
import TierModel from "./TierModels";
import { usePrefersReducedMotion } from "@/lib/useThreeScene";
import type { TierId } from "@/lib/loyalty";

function LevitatingModel({ tier }: { tier: TierId }) {
  const ref = useRef<THREE.Group>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    const elapsed = prefersReducedMotion ? 0 : clock.getElapsedTime();
    group.rotation.y = elapsed * 0.55;
    group.position.y = Math.sin(elapsed * 1.3) * 0.16;
  });

  return (
    <group ref={ref} rotation={[0.22, 0, 0]}>
      <TierModel tier={tier} />
    </group>
  );
}

/**
 * A single tier's model, levitating and tumbling in its own small canvas
 * — used for the compact icon shown on the dashboard's LoyaltyTierCard
 * (and available anywhere else a standalone tier icon is useful). The
 * homepage's LoyaltyScene renders these same TierModel components at
 * larger scale directly inside its shared cave scene instead of one
 * canvas per tier.
 */
export default function TierIconScene({ tier }: { tier: TierId }) {
  return (
    <SceneCanvas cameraPosition={[0, 0, 4.2]} fov={38}>
      <CinematicRig
        keyColor="#fff2d6"
        keyIntensity={1.1}
        fillIntensity={0.3}
        rimColor="#bcd8ff"
        rimIntensity={0.5}
        ambientIntensity={0.55}
      />
      <LevitatingModel tier={tier} />
      <PostFX bloomIntensity={0.5} vignetteDarkness={0} />
    </SceneCanvas>
  );
}
