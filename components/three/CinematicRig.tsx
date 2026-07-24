"use client";

/**
 * The three-point lighting rig ("key / fill / rim") behind the cinematic
 * look every scene asked for — a strong key light for direction and
 * shadow, a soft fill to keep shadows from crushing to black, and a
 * cooler rim light behind/above to separate subjects from the
 * background. Color and intensity are themeable per section.
 */
export default function CinematicRig({
  keyColor = "#fff2d6",
  keyIntensity = 1.2,
  keyPosition = [4, 5, 6],
  fillColor = "#dfeee0",
  fillIntensity = 0.35,
  fillPosition = [-5, 1, 3],
  rimColor = "#bcd8ff",
  rimIntensity = 0.6,
  rimPosition = [-2, 4, -6],
  ambientColor = "#ffffff",
  ambientIntensity = 0.4,
}: {
  keyColor?: string;
  keyIntensity?: number;
  keyPosition?: [number, number, number];
  fillColor?: string;
  fillIntensity?: number;
  fillPosition?: [number, number, number];
  rimColor?: string;
  rimIntensity?: number;
  rimPosition?: [number, number, number];
  ambientColor?: string;
  ambientIntensity?: number;
}) {
  return (
    <>
      <ambientLight color={ambientColor} intensity={ambientIntensity} />
      <directionalLight
        color={keyColor}
        intensity={keyIntensity}
        position={keyPosition}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight color={fillColor} intensity={fillIntensity} position={fillPosition} />
      <directionalLight color={rimColor} intensity={rimIntensity} position={rimPosition} />
    </>
  );
}
