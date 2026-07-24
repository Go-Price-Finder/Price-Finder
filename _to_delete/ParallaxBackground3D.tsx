"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useThreeScene } from "@/lib/useThreeScene";

export type ParallaxShape = "icosahedron" | "octahedron" | "torus" | "sphere";

export type ParallaxTheme = {
  /** Hex colors, cycled across the field's shapes. Can change over time
   *  (e.g. on hover) — see the color-lerp in onFrame below. */
  colors: number[];
  shape: ParallaxShape;
  count?: number;
};

function makeGeometry(shape: ParallaxShape, detail: 0 | 1) {
  switch (shape) {
    case "icosahedron":
      return new THREE.IcosahedronGeometry(1, detail);
    case "octahedron":
      return new THREE.OctahedronGeometry(1, detail);
    case "torus":
      return new THREE.TorusGeometry(0.8, 0.28, detail === 1 ? 12 : 6, detail === 1 ? 24 : 8);
    case "sphere":
      return new THREE.SphereGeometry(1, detail === 1 ? 20 : 8, detail === 1 ? 20 : 8);
  }
}

type ShapeUserData = { depth: number; baseAngle: number; radius: number; baseY: number };

/**
 * A field of floating low-poly shapes, drifting with the cursor and
 * shifting with scroll depth — the "premium 3D parallax background" used
 * behind each homepage section. Each shape is a THREE.LOD with a
 * higher-detail geometry up close and a coarser one further back
 * (LOD.update() is called every frame, driven by actual camera
 * distance), and the shape count is kept modest (12–18) so total
 * triangle count stays cheap even without instancing.
 */
export default function ParallaxBackground3D({
  theme,
  className = "",
}: {
  theme: ParallaxTheme;
  className?: string;
}) {
  const groupRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  // Read fresh every frame without re-running the mount effect — lets the
  // theme (e.g. which tier is hovered) change smoothly via color lerp
  // instead of tearing down and rebuilding the whole scene.
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const canvasRef = useThreeScene({
    alpha: true,
    cameraZ: 9,
    fov: 50,
    onInit: ({ scene }) => {
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const key = new THREE.DirectionalLight(0xffffff, 0.85);
      key.position.set(3, 4, 5);
      scene.add(key);

      const group = new THREE.Group();
      const count = theme.count ?? 16;
      const materials: THREE.MeshStandardMaterial[] = [];

      for (let i = 0; i < count; i++) {
        const depth = i / count; // 0 = near/large, 1 = far/small
        const color = theme.colors[i % theme.colors.length];
        const mat = new THREE.MeshStandardMaterial({
          color,
          roughness: 0.35,
          metalness: 0.4,
          transparent: true,
          opacity: 0.85,
        });
        materials.push(mat);

        const lod = new THREE.LOD();
        lod.addLevel(new THREE.Mesh(makeGeometry(theme.shape, 1), mat), 0);
        lod.addLevel(new THREE.Mesh(makeGeometry(theme.shape, 0), mat), 7);

        const radius = 3 + depth * 6;
        const angle = (i / count) * Math.PI * 2 + depth;
        const baseY = Math.sin(angle * 0.6) * radius * 0.4;
        const scale = 0.25 + (1 - depth) * 0.55;

        lod.position.set(Math.cos(angle) * radius, baseY, -depth * 8);
        lod.scale.setScalar(scale);
        lod.userData = { depth, baseAngle: angle, radius, baseY } satisfies ShapeUserData;

        group.add(lod);
      }

      scene.add(group);
      groupRef.current = group;
      materialsRef.current = materials;

      return () => {
        groupRef.current = null;
        materialsRef.current = [];
      };
    },
    onFrame: ({ camera }, { elapsed, pointer, scrollProgress }) => {
      const group = groupRef.current;
      if (!group) return;

      // Whole-field cursor tilt + slow autonomous drift, plus a
      // scroll-depth offset so the background shifts as the section
      // scrolls through the viewport.
      group.rotation.y = pointer.x * 0.25 + elapsed * 0.03;
      group.rotation.x = pointer.y * 0.12;
      group.position.y = scrollProgress * -1.2;

      const currentTheme = themeRef.current;
      materialsRef.current.forEach((mat, i) => {
        mat.color.lerp(new THREE.Color(currentTheme.colors[i % currentTheme.colors.length]), 0.04);
      });

      group.children.forEach((child) => {
        const lod = child as THREE.LOD;
        const { depth, baseAngle, radius, baseY } = lod.userData as ShapeUserData;

        lod.rotation.y = elapsed * (0.15 + depth * 0.1);
        lod.rotation.x = elapsed * 0.08;

        // Nearer shapes (low depth) drift further with the cursor —
        // the actual "parallax" (near things appear to move more).
        const parallaxStrength = (1 - depth) * 1.6;
        lod.position.x = Math.cos(baseAngle) * radius + pointer.x * parallaxStrength;
        lod.position.y = baseY + Math.sin(elapsed * 0.6 + depth * 6) * 0.25 + pointer.y * parallaxStrength * 0.4;

        lod.update(camera);
      });
    },
  });

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      aria-hidden
    />
  );
}
