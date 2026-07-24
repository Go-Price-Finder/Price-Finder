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

const COLORS = ["#e6dfd0", "#d99a7c", "#bfe0c3", "#f4efe6", "#c97f5c", "#6fae7a"];

type Cell = {
  position: [number, number, number];
  color: string;
  speedA: number;
  speedB: number;
};

const COLS = 4;
const ROWS = 2;
const SPACING = 2.1;

function HexCell({ cell }: { cell: Cell }) {
  const ref = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { pointer, viewport } = useThree();

  useFrame(({ clock }) => {
    const mesh = ref.current;
    const material = materialRef.current;
    if (!mesh || !material) return;
    const elapsed = prefersReducedMotion ? 0 : clock.getElapsedTime();

    // Distance from this cell to the cursor's projected world position,
    // in the same units as the grid — drives both a speed boost and a
    // subtle emissive glow for whichever cells are nearest the cursor.
    const cursorWorldX = pointer.x * (viewport.width / 2);
    const cursorWorldY = pointer.y * (viewport.height / 2);
    const dx = cell.position[0] - cursorWorldX;
    const dy = cell.position[1] - cursorWorldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const proximity = Math.max(0, 1 - dist / 3.5);

    const speedMultiplier = 1 + proximity * 2.5;
    mesh.rotation.x = elapsed * cell.speedA * speedMultiplier;
    mesh.rotation.y = elapsed * cell.speedB * speedMultiplier;

    material.emissiveIntensity += (proximity * 0.6 - material.emissiveIntensity) * 0.08;
  });

  return (
    <mesh ref={ref} position={cell.position} castShadow receiveShadow>
      <cylinderGeometry args={[0.85, 0.85, 0.6, 6]} />
      <meshStandardMaterial
        ref={materialRef}
        color={cell.color}
        roughness={0.6}
        metalness={0.08}
        emissive={cell.color}
        emissiveIntensity={0}
      />
    </mesh>
  );
}

export default function CategoriesScene() {
  const cells = useMemo<Cell[]>(() => {
    const rand = mulberry32(44);
    const cellsArr: Cell[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const offsetX = row % 2 === 0 ? 0 : SPACING / 2;
        cellsArr.push({
          position: [
            (col - (COLS - 1) / 2) * SPACING + offsetX,
            (row - (ROWS - 1) / 2) * SPACING * 0.9,
            -(rand() * 1.5),
          ],
          color: COLORS[(row * COLS + col) % COLORS.length],
          speedA: 0.15 + rand() * 0.25,
          speedB: 0.1 + rand() * 0.2,
        });
      }
    }
    return cellsArr;
  }, []);

  return (
    <SceneCanvas cameraPosition={[0, 0, 8]} fov={45}>
      <CinematicRig
        keyColor="#ffe6c2"
        keyIntensity={1.1}
        keyPosition={[4, 5, 5]}
        fillColor="#d99a7c"
        fillIntensity={0.3}
        rimColor="#bfe0c3"
        rimIntensity={0.4}
        ambientIntensity={0.55}
      />
      {cells.map((cell, i) => (
        <HexCell key={i} cell={cell} />
      ))}
      <PostFX bloomIntensity={0.35} vignetteDarkness={0.4} />
    </SceneCanvas>
  );
}
