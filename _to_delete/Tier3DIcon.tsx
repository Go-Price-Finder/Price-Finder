"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useThreeScene } from "@/lib/useThreeScene";
import type { TierId } from "@/lib/loyalty";

type TierPalette = { base: number; accent: number };

const TIER_COLOR: Record<TierId, TierPalette> = {
  member: { base: 0xc9c2b4, accent: 0xa39d94 },
  bronze: { base: 0xb06f3f, accent: 0xe3a876 },
  silver: { base: 0xb9c1c9, accent: 0xf2f4f6 },
  gold: { base: 0xd9a520, accent: 0xfde4a6 },
  diamond: { base: 0xb9e4f5, accent: 0xeaf7ff },
};

function buildStarShape(outer: number, inner: number, points: number) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Bronze / default coin: a disc with a beveled rim and a raised star. */
function buildCoin(color: TierPalette) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: color.base, metalness: 0.85, roughness: 0.28 });
  const rimMat = new THREE.MeshStandardMaterial({ color: color.accent, metalness: 0.9, roughness: 0.18 });

  group.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 40), bodyMat));

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 12, 40), rimMat);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(buildStarShape(0.5, 0.22, 5), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    }),
    rimMat
  );
  star.position.z = 0.1;
  group.add(star);

  return group;
}

/** Silver badge: an extruded shield outline with a raised star. */
function buildBadge(color: TierPalette) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: color.base, metalness: 0.8, roughness: 0.25 });
  const accentMat = new THREE.MeshStandardMaterial({ color: color.accent, metalness: 0.85, roughness: 0.16 });

  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.72, 0.85);
  shieldShape.lineTo(0.72, 0.85);
  shieldShape.lineTo(0.72, -0.1);
  shieldShape.quadraticCurveTo(0.72, -0.85, 0, -1.1);
  shieldShape.quadraticCurveTo(-0.72, -0.85, -0.72, -0.1);
  shieldShape.closePath();

  const shield = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 20,
    }),
    bodyMat
  );
  shield.position.z = -0.09;
  group.add(shield);

  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(buildStarShape(0.3, 0.13, 5), {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    }),
    accentMat
  );
  star.position.set(0, 0.05, 0.1);
  group.add(star);

  return group;
}

/** Gold crown: a band with alternating spikes and small gem finials. */
function buildCrown(color: TierPalette) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: color.base, metalness: 0.9, roughness: 0.22 });
  const gemMat = new THREE.MeshStandardMaterial({
    color: color.accent,
    metalness: 0.25,
    roughness: 0.12,
    emissive: color.accent,
    emissiveIntensity: 0.18,
  });

  group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.34, 32, 1, true), bodyMat));

  const spikeCount = 6;
  for (let i = 0; i < spikeCount; i++) {
    const angle = (i / spikeCount) * Math.PI * 2;
    const height = i % 2 === 0 ? 0.82 : 0.5;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.15, height, 8), bodyMat);
    spike.position.set(Math.cos(angle) * 0.85, 0.17 + height / 2, Math.sin(angle) * 0.85);
    group.add(spike);

    if (i % 2 === 0) {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), gemMat);
      gem.position.set(Math.cos(angle) * 0.85, 0.17 + height + 0.07, Math.sin(angle) * 0.85);
      group.add(gem);
    }
  }

  return group;
}

/**
 * Diamond tier: an elegant, abstract figure — sphere head, a flowing
 * conical "gown" for the torso, one raised arm holding a translucent gem.
 * Deliberately stylized rather than literal (this is a small ~100px
 * icon), in the same spirit as the flat SVG version it replaces.
 */
function buildStatue(color: TierPalette) {
  const group = new THREE.Group();
  const gownMat = new THREE.MeshStandardMaterial({ color: 0xe9edf2, metalness: 0.1, roughness: 0.42 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1e6da, metalness: 0.05, roughness: 0.5 });
  const gemMat = new THREE.MeshPhysicalMaterial({
    color: color.base,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.4,
    ior: 2.2,
    emissive: color.accent,
    emissiveIntensity: 0.12,
  });
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xaeb7c2, metalness: 0.15, roughness: 0.6 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 20), skinMat);
  head.position.y = 0.92;
  group.add(head);

  const gown = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.3, 24, 1, true), gownMat);
  gown.position.y = 0.12;
  group.add(gown);

  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 10), gownMat);
  arm.position.set(0.34, 0.82, 0);
  arm.rotation.z = -Math.PI / 3.2;
  group.add(arm);

  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), gemMat);
  gem.position.set(0.6, 1.15, 0);
  group.add(gem);

  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24), pedestalMat);
  pedestal.position.y = -0.58;
  group.add(pedestal);

  group.scale.setScalar(0.9);
  return group;
}

const BUILDERS: Record<TierId, (color: TierPalette) => THREE.Group> = {
  member: buildCoin,
  bronze: buildCoin,
  silver: buildBadge,
  gold: buildCrown,
  diamond: buildStatue,
};

/**
 * Realistic-finish 3D tier icon (metal/gem materials, key + rim lighting)
 * that levitates and tumbles continuously. Frustum culling is Three's
 * default per-object behavior (never disabled here); geometry segment
 * counts are kept modest (8–40) since these render at icon scale, so a
 * single small canvas per icon stays cheap without needing LOD — LOD
 * pays off for the many-object background scenes instead (see
 * ParallaxBackground3D.tsx).
 */
export default function Tier3DIcon({
  tier,
  className = "",
}: {
  tier: TierId;
  className?: string;
}) {
  const groupRef = useRef<THREE.Group | null>(null);

  const canvasRef = useThreeScene({
    alpha: true,
    cameraZ: 4.2,
    fov: 38,
    onInit: ({ scene }) => {
      scene.add(new THREE.AmbientLight(0xffffff, 0.6));

      const key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(2.2, 3, 4);
      scene.add(key);

      const rimLight = new THREE.DirectionalLight(0xbcd8ff, 0.5);
      rimLight.position.set(-3, -1.5, -2);
      scene.add(rimLight);

      const group = BUILDERS[tier](TIER_COLOR[tier]);
      group.rotation.x = 0.22;
      scene.add(group);
      groupRef.current = group;

      return () => {
        groupRef.current = null;
      };
    },
    onFrame: (_setup, { elapsed }) => {
      const group = groupRef.current;
      if (!group) return;
      group.rotation.y = elapsed * 0.55;
      group.position.y = Math.sin(elapsed * 1.3) * 0.16;
    },
  });

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full ${className}`}
      aria-hidden
    />
  );
}
