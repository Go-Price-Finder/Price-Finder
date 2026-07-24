"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import SceneCanvas from "./SceneCanvas";
import CinematicRig from "./CinematicRig";
import PostFX from "./PostFX";
import TierModel, { TIER_PALETTE } from "./TierModels";
import { usePrefersReducedMotion } from "@/lib/useThreeScene";
import { TIERS, type TierId } from "@/lib/loyalty";

const DISPLAY_TIERS = TIERS.filter((t) => t.id !== "member");

// Seeded RNG so the cave wall's "rocky" displacement and the pile's
// scatter are stable across renders (no reshuffling on re-render, and no
// server/client mismatch risk either, since this whole component only
// ever runs client-side via next/dynamic(..., { ssr: false })).
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Irregular rock wall enclosing the scene — a displaced, back-facing sphere. */
function CaveWall() {
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(15, 3);
    const rand = mulberry32(7);
    const position = geo.attributes.position as THREE.BufferAttribute;
    const vertex = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      const bump = 1 + (rand() - 0.5) * 0.18;
      vertex.multiplyScalar(bump);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#231f33" roughness={0.95} metalness={0.05} side={THREE.BackSide} />
    </mesh>
  );
}

type Clutter = { position: [number, number, number]; scale: number; color: string; rotation: [number, number, number] };

/** The scattered "background" pile — small gem-like shapes in one instanced draw call. */
function TreasureClutter({ dim }: { dim: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 42;

  const items = useMemo<Clutter[]>(() => {
    const rand = mulberry32(21);
    const palette = Object.values(TIER_PALETTE).flatMap((p) => [p.base, p.accent]);
    return Array.from({ length: count }, () => {
      const angle = rand() * Math.PI * 2;
      const radius = rand() * 2.6;
      const heightAtRadius = 1.1 - radius * 0.28 + rand() * 0.25;
      return {
        position: [Math.cos(angle) * radius, heightAtRadius - 1.6, Math.sin(angle) * radius * 0.75] as [number, number, number],
        scale: 0.12 + rand() * 0.16,
        color: palette[Math.floor(rand() * palette.length)],
        rotation: [rand() * Math.PI, rand() * Math.PI, rand() * Math.PI] as [number, number, number],
      };
    });
  }, []);

  const material = useRef<THREE.MeshStandardMaterial>(null);
  const placed = useRef(false);

  // The pile itself is static, so its per-instance matrices/colors only
  // need to be written once — re-setting all 42 every frame would be
  // pure waste. Only the material's opacity (the "dim while a tier is
  // active" effect) needs a per-frame lerp.
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    if (!placed.current) {
      const dummy = new THREE.Object3D();
      items.forEach((item, i) => {
        dummy.position.set(...item.position);
        dummy.rotation.set(...item.rotation);
        dummy.scale.setScalar(item.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, new THREE.Color(item.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      placed.current = true;
    }

    if (material.current) {
      const targetOpacity = dim ? 0.5 : 0.95;
      material.current.opacity += (targetOpacity - material.current.opacity) * 0.06;
    }
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} castShadow receiveShadow>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial ref={material} metalness={0.7} roughness={0.35} transparent opacity={0.95} />
    </instancedMesh>
  );
}

/** One tier's "hero" model — buried in the pile at rest, rises and spins when active. */
function RisingTier({
  tier,
  index,
  active,
  anyActive,
}: {
  tier: TierId;
  index: number;
  active: boolean;
  anyActive: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const angle = (index / 4) * Math.PI * 2;
  const baseX = Math.cos(angle) * 1.7;
  const baseZ = Math.sin(angle) * 1.7 * 0.7;
  const { accent } = TIER_PALETTE[tier];

  useFrame(({ clock }) => {
    const group = groupRef.current;
    const light = lightRef.current;
    if (!group || !light) return;

    const elapsed = prefersReducedMotion ? 0 : clock.getElapsedTime();
    const targetY = active ? 0.9 : -1.55;
    const targetScale = active ? 1 : 0.55;
    const targetGlow = active ? 2.2 : anyActive ? 0.15 : 0.5;

    group.position.y += (targetY - group.position.y) * 0.06;
    group.scale.x += (targetScale - group.scale.x) * 0.06;
    group.scale.y = group.scale.z = group.scale.x;
    if (!prefersReducedMotion) group.rotation.y = elapsed * (active ? 0.7 : 0.15);

    light.intensity += (targetGlow - light.intensity) * 0.08;
  });

  return (
    <group ref={groupRef} position={[baseX, -1.55, baseZ]} scale={0.55}>
      <TierModel tier={tier} />
      <pointLight ref={lightRef} color={accent} intensity={0.5} distance={4} />
    </group>
  );
}

function CursorTilt() {
  const { pointer } = useThree();
  const prefersReducedMotion = usePrefersReducedMotion();
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (prefersReducedMotion || !groupRef.current) return;
    groupRef.current.rotation.y += (pointer.x * 0.2 - groupRef.current.rotation.y) * 0.04;
  });
  return null;
}

export default function LoyaltyScene({ activeTier }: { activeTier: TierId | null }) {
  return (
    <SceneCanvas cameraPosition={[0, 0.4, 8]} fov={48}>
      <fog attach="fog" args={["#171425", 6, 18]} />
      <CinematicRig
        keyColor="#e8b563"
        keyIntensity={0.9}
        keyPosition={[3, 4, 5]}
        fillColor="#5b6fd6"
        fillIntensity={0.35}
        rimColor="#8f7fe0"
        rimIntensity={0.5}
        ambientColor="#3b3660"
        ambientIntensity={0.4}
      />
      <pointLight color="#e8b563" position={[0, 1, 2]} intensity={0.7} distance={7} />
      <pointLight color="#5b6fd6" position={[-3, 2, -3]} intensity={0.5} distance={9} />
      <CursorTilt />
      <CaveWall />
      <TreasureClutter dim={activeTier !== null} />
      {DISPLAY_TIERS.map((tier, i) => (
        <RisingTier
          key={tier.id}
          tier={tier.id}
          index={i}
          active={activeTier === tier.id}
          anyActive={activeTier !== null}
        />
      ))}
      <PostFX bloomIntensity={0.8} vignetteDarkness={0.75} dof />
    </SceneCanvas>
  );
}
