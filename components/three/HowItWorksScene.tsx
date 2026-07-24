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

const NODE_COUNT = 22;
const CONNECT_DISTANCE = 3.2;

/** Glowing circuit nodes (points) with connecting lines drawn between nearby pairs. */
function Circuit() {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { pointer, viewport } = useThree();

  const nodes = useMemo(() => {
    const rand = mulberry32(13);
    return Array.from({ length: NODE_COUNT }, () => ({
      base: new THREE.Vector3((rand() - 0.5) * 10, (rand() - 0.5) * 6, (rand() - 0.5) * 4),
      phase: rand() * Math.PI * 2,
      speed: 0.2 + rand() * 0.3,
    }));
  }, []);

  const positions = useMemo(() => new Float32Array(NODE_COUNT * 3), []);
  const linePositions = useMemo(
    () => new Float32Array(NODE_COUNT * NODE_COUNT * 2 * 3),
    []
  );

  useFrame(({ clock }) => {
    const points = pointsRef.current;
    const lines = linesRef.current;
    if (!points || !lines) return;

    const elapsed = prefersReducedMotion ? 0 : clock.getElapsedTime();
    const cursorWorld = new THREE.Vector3(
      pointer.x * (viewport.width / 2),
      pointer.y * (viewport.height / 2),
      0
    );

    const current: THREE.Vector3[] = [];
    nodes.forEach((node, i) => {
      const drift = new THREE.Vector3(
        Math.sin(elapsed * node.speed + node.phase) * 0.3,
        Math.cos(elapsed * node.speed * 0.8 + node.phase) * 0.3,
        0
      );
      const pos = node.base.clone().add(drift);

      // Gentle repulsion from the cursor — nodes drift away from it,
      // creating an interactive "ripple" through the field.
      const toNode = pos.clone().sub(cursorWorld);
      const dist = toNode.length();
      if (dist < 3) {
        toNode.normalize().multiplyScalar((3 - dist) * 0.4);
        pos.add(toNode);
      }

      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      current.push(pos);
    });
    points.geometry.attributes.position.needsUpdate = true;

    // Rebuild the connection lines between nodes currently close enough
    // to "wire together" — cheap at this node count (22 → ≤231 pairs).
    let lineIndex = 0;
    for (let i = 0; i < current.length; i++) {
      for (let j = i + 1; j < current.length; j++) {
        const dist = current[i].distanceTo(current[j]);
        if (dist < CONNECT_DISTANCE) {
          linePositions[lineIndex++] = current[i].x;
          linePositions[lineIndex++] = current[i].y;
          linePositions[lineIndex++] = current[i].z;
          linePositions[lineIndex++] = current[j].x;
          linePositions[lineIndex++] = current[j].y;
          linePositions[lineIndex++] = current[j].z;
        }
      }
    }
    const lineAttr = lines.geometry.attributes.position as THREE.BufferAttribute;
    lineAttr.array.fill(0, lineIndex);
    lineAttr.needsUpdate = true;
    lines.geometry.setDrawRange(0, lineIndex / 3);
  });

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#4c9459" size={0.14} sizeAttenuation transparent opacity={0.9} />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#9fc7f0" transparent opacity={0.35} />
      </lineSegments>
    </group>
  );
}

export default function HowItWorksScene() {
  return (
    <SceneCanvas cameraPosition={[0, 0, 9]} fov={50}>
      <CinematicRig
        keyColor="#e8f4ff"
        keyIntensity={0.8}
        keyPosition={[3, 4, 5]}
        fillColor="#dfeee0"
        fillIntensity={0.3}
        rimColor="#bcd8ff"
        rimIntensity={0.4}
        ambientIntensity={0.7}
      />
      <Circuit />
      <PostFX bloomIntensity={0.55} vignetteDarkness={0.3} />
    </SceneCanvas>
  );
}
