"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { TierId } from "@/lib/loyalty";
import type { JSX } from "react";

type TierPalette = { base: string; accent: string };

export const TIER_PALETTE: Record<TierId, TierPalette> = {
  member: { base: "#c9c2b4", accent: "#a39d94" },
  bronze: { base: "#b06f3f", accent: "#e3a876" },
  silver: { base: "#b9c1c9", accent: "#f2f4f6" },
  gold: { base: "#d9a520", accent: "#fde4a6" },
  diamond: { base: "#b9e4f5", accent: "#eaf7ff" },
};

function useStarGeometry(outer: number, inner: number, points: number, depth: number) {
  return useMemo(() => {
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
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: depth * 0.3,
      bevelSize: depth * 0.3,
      bevelSegments: 2,
    });
  }, [outer, inner, points, depth]);
}

type ModelProps = JSX.IntrinsicElements["group"] & { tier?: TierId };

/** Bronze coin (and the fallback "Member" model): a disc, beveled rim, raised star. */
export function CoinModel({ tier = "bronze", ...props }: ModelProps) {
  const { base, accent } = TIER_PALETTE[tier];
  const starGeo = useStarGeometry(0.5, 0.22, 5, 0.06);
  return (
    <group {...props}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1, 1, 0.16, 40]} />
        <meshStandardMaterial color={base} metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.98, 0.05, 12, 40]} />
        <meshStandardMaterial color={accent} metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh geometry={starGeo} position={[0, 0, 0.1]}>
        <meshStandardMaterial color={accent} metalness={0.9} roughness={0.18} emissive={accent} emissiveIntensity={0.08} />
      </mesh>
    </group>
  );
}

/** Silver badge: an extruded shield outline with a raised star. */
export function BadgeModel({ tier = "silver", ...props }: ModelProps) {
  const { base, accent } = TIER_PALETTE[tier];
  const shieldGeo = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.72, 0.85);
    shape.lineTo(0.72, 0.85);
    shape.lineTo(0.72, -0.1);
    shape.quadraticCurveTo(0.72, -0.85, 0, -1.1);
    shape.quadraticCurveTo(-0.72, -0.85, -0.72, -0.1);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 3,
      curveSegments: 20,
    });
  }, []);
  const starGeo = useStarGeometry(0.3, 0.13, 5, 0.08);

  return (
    <group {...props}>
      <mesh geometry={shieldGeo} position={[0, 0, -0.09]} castShadow receiveShadow>
        <meshStandardMaterial color={base} metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh geometry={starGeo} position={[0, 0.05, 0.1]}>
        <meshStandardMaterial color={accent} metalness={0.85} roughness={0.16} emissive={accent} emissiveIntensity={0.1} />
      </mesh>
    </group>
  );
}

/** Gold crown: a band with alternating spikes and small gem finials. */
export function CrownModel({ tier = "gold", ...props }: ModelProps) {
  const { base, accent } = TIER_PALETTE[tier];
  const spikeCount = 6;
  const spikes = useMemo(
    () =>
      Array.from({ length: spikeCount }, (_, i) => {
        const angle = (i / spikeCount) * Math.PI * 2;
        const height = i % 2 === 0 ? 0.82 : 0.5;
        return {
          key: i,
          position: [Math.cos(angle) * 0.85, 0.17 + height / 2, Math.sin(angle) * 0.85] as [number, number, number],
          height,
          gem: i % 2 === 0,
          gemPosition: [Math.cos(angle) * 0.85, 0.17 + height + 0.07, Math.sin(angle) * 0.85] as [number, number, number],
        };
      }),
    []
  );

  return (
    <group {...props}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.95, 0.34, 32, 1, true]} />
        <meshStandardMaterial color={base} metalness={0.9} roughness={0.22} side={THREE.DoubleSide} />
      </mesh>
      {spikes.map((spike) => (
        <mesh key={spike.key} position={spike.position} castShadow>
          <coneGeometry args={[0.15, spike.height, 8]} />
          <meshStandardMaterial color={base} metalness={0.9} roughness={0.22} />
        </mesh>
      ))}
      {spikes
        .filter((s) => s.gem)
        .map((spike) => (
          <mesh key={`gem-${spike.key}`} position={spike.gemPosition}>
            <octahedronGeometry args={[0.09]} />
            <meshStandardMaterial color={accent} metalness={0.25} roughness={0.12} emissive={accent} emissiveIntensity={0.35} />
          </mesh>
        ))}
    </group>
  );
}

/**
 * Diamond tier: an elegant, abstract figure — sphere head, a flowing
 * conical "gown" for the torso, one raised arm holding a translucent gem.
 * Deliberately stylized rather than literal.
 */
export function StatueModel({ tier = "diamond", ...props }: ModelProps) {
  const { base, accent } = TIER_PALETTE[tier];
  return (
    <group {...props}>
      <mesh position={[0, 0.92, 0]} castShadow>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color="#f1e6da" metalness={0.05} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.55, 1.3, 24, 1, true]} />
        <meshStandardMaterial color="#e9edf2" metalness={0.1} roughness={0.42} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.34, 0.82, 0]} rotation={[0, 0, -Math.PI / 3.2]} castShadow>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 10]} />
        <meshStandardMaterial color="#e9edf2" metalness={0.1} roughness={0.42} />
      </mesh>
      <mesh position={[0.6, 1.15, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshPhysicalMaterial
          color={base}
          metalness={0}
          roughness={0.05}
          transmission={0.85}
          thickness={0.4}
          ior={2.2}
          emissive={accent}
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, -0.58, 0]} receiveShadow>
        <cylinderGeometry args={[0.6, 0.6, 0.08, 24]} />
        <meshStandardMaterial color="#aeb7c2" metalness={0.15} roughness={0.6} />
      </mesh>
    </group>
  );
}

const MODEL_BY_TIER: Record<TierId, (props: ModelProps) => JSX.Element> = {
  member: CoinModel,
  bronze: CoinModel,
  silver: BadgeModel,
  gold: CrownModel,
  diamond: StatueModel,
};

export default function TierModel({ tier, ...props }: ModelProps & { tier: TierId }) {
  const Model = MODEL_BY_TIER[tier];
  return <Model tier={tier} {...props} />;
}
