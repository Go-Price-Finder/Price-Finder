"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import SceneCanvas from "./SceneCanvas";
import CinematicRig from "./CinematicRig";
import PostFX from "./PostFX";
import { usePrefersReducedMotion } from "@/lib/useThreeScene";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES = ["box", "sphere", "octahedron", "torus"] as const;
const COLORS = ["#d99a7c", "#c97f5c", "#bfe0c3", "#4c9459", "#f0ebe0"];

type Shape = {
  kind: (typeof SHAPES)[number];
  position: [number, number, number];
  scale: number;
  color: string;
  spin: [number, number, number];
  orbitRadius: number;
  orbitSpeed: number;
  orbitOffset: number;
  depth: number;
};

function TumblingShape({ shape }: { shape: Shape }) {
  const ref = useRef<THREE.Mesh>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { pointer } = useThree();

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const elapsed = prefersReducedMotion ? 0 : clock.getElapsedTime();

    mesh.rotation.x = elapsed * shape.spin[0];
    mesh.rotation.y = elapsed * shape.spin[1];
    mesh.rotation.z = elapsed * shape.spin[2];

    const orbitAngle = elapsed * shape.orbitSpeed + shape.orbitOffset;
    const baseX = shape.position[0] + Math.cos(orbitAngle) * shape.orbitRadius;
    const baseY = shape.position[1] + Math.sin(orbitAngle * 0.8) * shape.orbitRadius * 0.6;

    // "Gravitational" pull toward the cursor — nearer shapes (higher
    // depth value = closer to camera) feel it more strongly.
    const pull = (1 - shape.depth / 10) * 1.2;
    mesh.position.x = baseX + pointer.x * pull;
    mesh.position.y = baseY + pointer.y * pull;
    mesh.position.z = shape.position[2];
  });

  return (
    <mesh ref={ref} scale={shape.scale} castShadow receiveShadow>
      {shape.kind === "box" && <boxGeometry args={[1, 1, 1]} />}
      {shape.kind === "sphere" && <sphereGeometry args={[0.65, 24, 24]} />}
      {shape.kind === "octahedron" && <octahedronGeometry args={[0.75, 0]} />}
      {shape.kind === "torus" && <torusGeometry args={[0.55, 0.2, 12, 28]} />}
      <meshStandardMaterial color={shape.color} roughness={0.35} metalness={0.3} />
    </mesh>
  );
}

export default function TrendingScene() {
  const shapes = useMemo<Shape[]>(() => {
    const rand = mulberry32(99);
    return Array.from({ length: 16 }, (_, i) => {
      const depth = rand() * 10;
      return {
        kind: SHAPES[i % SHAPES.length],
        position: [(rand() - 0.5) * 12, (rand() - 0.5) * 7, -depth],
        scale: 0.5 + rand() * 0.9,
        color: COLORS[i % COLORS.length],
        spin: [0.15 + rand() * 0.3, 0.15 + rand() * 0.3, 0.1 + rand() * 0.2],
        orbitRadius: 0.4 + rand() * 0.8,
        orbitSpeed: 0.15 + rand() * 0.25,
        orbitOffset: rand() * Math.PI * 2,
        depth,
      };
    });
  }, []);

  return (
    <SceneCanvas cameraPosition={[0, 0, 6]} fov={55}>
      <fog attach="fog" args={["#2b2a3a", 4, 16]} />
      <CinematicRig
        keyColor="#ffe3c2"
        keyIntensity={0.9}
        keyPosition={[5, 4, 4]}
        fillColor="#bfe0c3"
        fillIntensity={0.4}
        rimColor="#d99a7c"
        rimIntensity={0.5}
        ambientColor="#3a3550"
        ambientIntensity={0.35}
      />
      {shapes.map((shape, i) => (
        <TumblingShape key={i} shape={shape} />
      ))}
      <PostFX bloomIntensity={0.5} vignetteDarkness={0.6} dof />
    </SceneCanvas>
  );
}
