"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import SceneCanvas from "./SceneCanvas";
import CinematicRig from "./CinematicRig";
import PostFX from "./PostFX";

// ---------------------------------------------------------------------------
// The Hero background is the marketplace reference photo (public/images/
// marketplace.jpg), mapped onto a single large plane at the far end of the
// scene — sized every render to exactly cover the camera's frustum at that
// depth, so it fills the frame edge-to-edge with no stretching regardless of
// viewport size (see PhotoLayer/useBackgroundPlaneSize below).
//
// On top of that photo sit small, precisely-positioned glow/highlight
// sprites over the *actual* lanterns and grass already visible in the
// image (see LANTERN_SPOTS / GRASS_SPOTS below) — not free-floating 3D
// props. Everything animates on a single shared, mouse-reactive "wind"
// signal (WindController/useWind) so cursor movement subtly drives all of
// it consistently.
// ---------------------------------------------------------------------------

// ===========================================================================
// WIND — a shared, mouse-reactive sway signal. Cursor x/y (via R3F's
// normalized `pointer`) blends with a slow ambient sine so the scene still
// breathes gently even with no mouse movement. Stored in a mutable ref
// rather than React state so every animated item can read it inside its own
// useFrame without triggering a re-render each frame.
// ===========================================================================

type WindRef = { x: number; y: number; t: number };
const WindContext = createContext<{ current: WindRef }>({ current: { x: 0, y: 0, t: 0 } });
function useWind() {
  return useContext(WindContext);
}

function WindController() {
  const wind = useWind();
  useFrame((state, delta) => {
    const targetX = state.pointer.x;
    const targetY = state.pointer.y;
    // Ease toward the pointer so gusts feel springy, not snapped.
    wind.current.x += (targetX - wind.current.x) * Math.min(1, delta * 2.2);
    wind.current.y += (targetY - wind.current.y) * Math.min(1, delta * 2.2);
    wind.current.t += delta;
  });
  return null;
}

const CORRIDOR_NEAR_Z = 6;
const CORRIDOR_FAR_Z = -28;

// The photo backdrop's depth — well behind the camera's near plane, close
// to the old scene's far wall so the walk-through camera dolly still reads
// as moving toward it.
const BACKGROUND_Z = CORRIDOR_FAR_Z - 6;

// ===========================================================================
// PART 1 — BACKGROUND SHARPNESS
//
// Diagnosis (see the chat writeup for the full report): the background was
// reading as soft for two compounding reasons, not a single texture-setting
// bug:
//
//  1. `PostFX`'s depth-of-field pass (`dof` prop) was enabled with a focus
//     distance close to the camera, so anything at the corridor's far end —
//     exactly where this plane sits — got a heavy bokeh blur applied on
//     purpose. This was the dominant cause and is now off (see PostFX call
//     in HeroScene below); bloom/vignette stay on since neither blurs the
//     plane (bloom only glows bright/emissive pixels, vignette only darkens
//     the frame edges).
//  2. The source photo's native resolution (1024x1024 originally) was
//     smaller than the plane's actual on-screen pixel size on wide/high-DPI
//     viewports, forcing GPU upscaling. `marketplace.jpg` is a 2048x2048,
//     Lanczos-upscaled + lightly unsharp-masked export addressing this —
//     note per instructions this does NOT manufacture real detail, it only
//     reduces the upscale ratio and sharpens edges; a genuinely higher-
//     resolution source is the only way to raise the ceiling further (flag
//     stands if displaying beyond ~2048px on a single monitor).
//
// Texture filtering (minFilter/magFilter/generateMipmaps/colorSpace) and
// anisotropy are all set explicitly below regardless, since they're correct
// practice for an unlit, head-on background plane even though they were not
// themselves the primary cause. PlaneGeometry segment count was checked and
// intentionally left at the default 1x1 — segment count only affects vertex
// positions, not fragment-level texture sampling, so more segments on a
// flat, non-displaced plane cannot change texture sharpness. CSS/DOM check:
// `Hero.tsx` uses Tailwind's `backdrop-blur-sm` on two small UI elements
// (the "Now tracking..." pill and the three stat cards) — that's an
// intentional frosted-glass effect scoped to just those elements' own
// backgrounds, not a filter on the canvas or a wrapping container, so it
// does not affect the photo's sharpness.
// ===========================================================================

/**
 * Loads `/images/marketplace.jpg` with a plain `THREE.TextureLoader` (not
 * R3F's `useLoader`) so no <Suspense> boundary is required anywhere in the
 * tree — the plane just renders nothing until the texture resolves, which
 * is effectively instant for a same-origin asset served from `public/`.
 */
function useMarketplaceTexture() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const { gl } = useThree();

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.load("/images/marketplace.jpg", (loaded) => {
      if (cancelled) return;
      // Correct color decoding — a colorSpace mismatch can itself read as
      // "soft" (washed-out contrast reads as blur at a glance).
      loaded.colorSpace = THREE.SRGBColorSpace;
      // The plane is viewed head-on and is never minified below its native
      // resolution, so mipmaps buy nothing here and just soften edges.
      loaded.generateMipmaps = false;
      loaded.minFilter = THREE.LinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      loaded.anisotropy = gl.capabilities.getMaxAnisotropy();
      loaded.needsUpdate = true;
      setTexture(loaded);

      if (process.env.NODE_ENV !== "production") {
        // Diagnostic per Part 1 step 2 — confirms the renderer's actual
        // applied pixel ratio (SceneCanvas passes `dpr={[1, 1.75]}` to
        // R3F's <Canvas>, which calls gl.setPixelRatio internally; this
        // logs what that resolved to on the current display).
        console.log(
          `[HeroScene] devicePixelRatio=${window.devicePixelRatio} rendererPixelRatio=${gl.getPixelRatio()} maxAnisotropy=${loaded.anisotropy} textureSize=${(loaded.image as HTMLImageElement).width}x${(loaded.image as HTMLImageElement).height}`
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gl]);

  return texture;
}

/** Computes the plane size (world units) that exactly covers the camera's frustum at BACKGROUND_Z — CSS `background-size: cover`, but in 3D. */
function useBackgroundPlaneSize(texture: THREE.Texture | null) {
  const { camera, viewport } = useThree();
  return useMemo(() => {
    if (!texture || !texture.image) return null;
    const image = texture.image as HTMLImageElement;
    const textureAspect = image.width / image.height;
    const v = viewport.getCurrentViewport(camera, [0, 4, BACKGROUND_Z]);
    const height = Math.max(v.height, v.width / textureAspect);
    const width = height * textureAspect;
    return { width, height };
  }, [texture, camera, viewport]);
}

type PlaneSize = { width: number; height: number };

/**
 * Converts a fractional image-space coordinate (fx/fy, 0..1, origin
 * top-left — standard image-pixel convention) into a 3D world position on
 * the background plane, `zOffset` in front of it to avoid z-fighting with
 * the photo itself. Because it's derived from the same `size` the photo
 * plane uses, overlay sprites built from this stay pinned to the correct
 * spot in the image at any viewport size/aspect ratio.
 */
function imageFractionToWorld(fx: number, fy: number, size: PlaneSize, zOffset = 0.08): [number, number, number] {
  const x = (fx - 0.5) * size.width;
  const y = 4 + (0.5 - fy) * size.height;
  return [x, y, BACKGROUND_Z + zOffset];
}

// ===========================================================================
// PART 2 — REAL LANTERN & GRASS COORDINATES
//
// Fractional (fx, fy) positions, 0..1, origin top-left, read directly off
// public/images/marketplace.jpg. Adjust these if a future source image
// shifts anything.
//
// Note: the photo's lit lanterns are concentrated top-center (a 3-lamp
// strand hanging above the archway) and along the right-hand stall (an
// upper pair plus a colorful cluster near the bottom-right corner) — there
// is no clearly separate hanging lantern on the *left* side of this
// particular image (that side shows textiles/saddlery/jars instead), so
// left-side glow spots were not invented just for symmetry.
// ===========================================================================

const LANTERN_SPOTS: { fx: number; fy: number; radius: number; freqA: number; freqB: number; seed: number }[] = [
  // Top-center strand, hanging above the archway (left → right along the wire).
  { fx: 0.445, fy: 0.065, radius: 0.028, freqA: 1.7, freqB: 0.53, seed: 0.4 },
  { fx: 0.505, fy: 0.1, radius: 0.036, freqA: 1.4, freqB: 0.61, seed: 1.9 },
  { fx: 0.565, fy: 0.075, radius: 0.026, freqA: 1.9, freqB: 0.47, seed: 3.2 },
  // Right-side upper pair, hanging glass lanterns by the copper-plate stall.
  { fx: 0.895, fy: 0.335, radius: 0.03, freqA: 1.6, freqB: 0.58, seed: 4.7 },
  { fx: 0.925, fy: 0.4, radius: 0.034, freqA: 1.3, freqB: 0.44, seed: 6.1 },
  // Right-side lower cluster, colorful lit lanterns near the bottom-right corner.
  { fx: 0.935, fy: 0.835, radius: 0.024, freqA: 2.1, freqB: 0.65, seed: 7.5 },
  { fx: 0.955, fy: 0.875, radius: 0.026, freqA: 1.5, freqB: 0.52, seed: 8.8 },
  { fx: 0.975, fy: 0.92, radius: 0.022, freqA: 1.8, freqB: 0.6, seed: 10.2 },
];

const GRASS_SPOTS: { fx: number; fy: number; radius: number; seed: number }[] = [
  // Grassy hillside glimpsed through the archway, beneath the mountain.
  { fx: 0.49, fy: 0.365, radius: 0.05, seed: 0.9 },
  { fx: 0.53, fy: 0.355, radius: 0.045, seed: 2.3 },
  // Moss/grass sprouting between the cobblestones along the path.
  { fx: 0.4, fy: 0.63, radius: 0.02, seed: 3.7 },
  { fx: 0.6, fy: 0.655, radius: 0.018, seed: 4.4 },
  { fx: 0.36, fy: 0.755, radius: 0.02, seed: 5.6 },
  { fx: 0.65, fy: 0.78, radius: 0.019, seed: 6.8 },
  { fx: 0.46, fy: 0.865, radius: 0.021, seed: 7.9 },
  { fx: 0.56, fy: 0.905, radius: 0.018, seed: 9.1 },
];

/**
 * A small radial-gradient alpha texture, generated once on a `<canvas>` and
 * reused (tinted per-material via `color`) for every lantern glow and grass
 * highlight sprite — one shared GPU texture instead of per-spot geometry.
 */
function useRadialGlowTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.45, "rgba(255,255,255,0.55)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);
}

/**
 * A soft warm glow anchored exactly over one of the photo's real lanterns
 * (see LANTERN_SPOTS). Flickers via two layered, differently-seeded sine
 * waves per lantern (irregular, not a mechanical blink, and never in sync
 * with its neighbors), and bobs a couple of pixels' worth on the shared
 * mouse-driven wind — same wind signal the old fabric/lantern sway used,
 * just applied as a small position offset instead of a rotation.
 */
function LanternGlow({
  spot,
  size,
  glowTexture,
}: {
  spot: (typeof LANTERN_SPOTS)[number];
  size: PlaneSize;
  glowTexture: THREE.Texture;
}) {
  const wind = useWind();
  const ref = useRef<THREE.Mesh>(null);
  const [baseX, baseY, baseZ] = useMemo(() => imageFractionToWorld(spot.fx, spot.fy, size), [spot, size]);
  const worldRadius = spot.radius * size.height;
  // Warm amber → orange range, picked per-lantern from its seed so the
  // cluster doesn't read as one flat color.
  const color = useMemo(() => new THREE.Color("#FFD700").lerp(new THREE.Color("#FF8C42"), (spot.seed % 3) / 3), [spot.seed]);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { x: windX, t } = wind.current;
    const flicker = 0.7 + 0.18 * Math.sin(t * spot.freqA + spot.seed * 3.1) + 0.12 * Math.sin(t * spot.freqB + spot.seed * 7.7);
    const scale = worldRadius * (0.9 + 0.16 * flicker);
    mesh.scale.setScalar(scale);
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.5 + 0.3 * flicker;
    // Subtle bob (a couple of world-units-worth of pixels at this scale),
    // nudged by cursor position exactly like the fabric/lantern sway.
    const bob = Math.sin(t * 1.1 + spot.seed * 4.2) * worldRadius * 0.08 + windX * worldRadius * 0.06;
    mesh.position.set(baseX + windX * worldRadius * 0.04, baseY + bob, baseZ);
  });

  return (
    <mesh ref={ref} position={[baseX, baseY, baseZ]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={glowTexture}
        color={color}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/**
 * A very subtle green brightness pulse over one of the photo's real grass/
 * moss patches (see GRASS_SPOTS) — a low-opacity additive highlight rather
 * than any geometry, simulating light rippling through grass without
 * adding a foreign-looking object on top of the photo. Chosen over a
 * per-blade sprite layer or a color-detection fragment shader because: the
 * grass regions are small and already precisely located by eye, so hand-
 * placed sprites are simpler and more predictable than a shader that scans
 * for green-hued pixels (which risks false positives elsewhere in the
 * image and would need new shader-material infrastructure this codebase
 * doesn't otherwise have); and a handful of small transparent planes is
 * negligible GPU cost next to a full-screen fragment pass.
 */
function GrassHighlight({
  spot,
  size,
  glowTexture,
}: {
  spot: (typeof GRASS_SPOTS)[number];
  size: PlaneSize;
  glowTexture: THREE.Texture;
}) {
  const wind = useWind();
  const ref = useRef<THREE.Mesh>(null);
  const [baseX, baseY, baseZ] = useMemo(() => imageFractionToWorld(spot.fx, spot.fy, size, 0.06), [spot, size]);
  const worldRadius = spot.radius * size.height;

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const { x: windX, t } = wind.current;
    // 2-4% brightness/opacity variance, plus a faint mouse-driven ripple —
    // deliberately understated so it reads as ambient life, not motion.
    const ripple = Math.sin(t * 0.8 + spot.seed * 2.6) * 0.03 + windX * 0.015;
    const material = mesh.material as THREE.MeshBasicMaterial;
    material.opacity = 0.08 + Math.abs(ripple);
    mesh.scale.setScalar(worldRadius * (1 + ripple * 0.5));
  });

  return (
    <mesh ref={ref} position={[baseX, baseY, baseZ]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={glowTexture}
        color="#8fbf5a"
        transparent
        opacity={0.08}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}

/**
 * The marketplace photo plane plus its lantern/grass highlight overlays,
 * all computed from one shared `size` so the overlays stay pinned to the
 * correct spot in the image regardless of viewport size — this is why
 * they're grouped in one component rather than three siblings each
 * re-deriving `size` independently.
 */
function PhotoLayer() {
  const texture = useMarketplaceTexture();
  const size = useBackgroundPlaneSize(texture);
  const glowTexture = useRadialGlowTexture();

  if (!texture || !size) return null;

  return (
    <group>
      <mesh position={[0, 4, BACKGROUND_Z]}>
        <planeGeometry args={[size.width, size.height]} />
        <meshBasicMaterial map={texture} toneMapped={false} fog={false} />
      </mesh>
      {LANTERN_SPOTS.map((spot, i) => (
        <LanternGlow key={`lantern-${i}`} spot={spot} size={size} glowTexture={glowTexture} />
      ))}
      {GRASS_SPOTS.map((spot, i) => (
        <GrassHighlight key={`grass-${i}`} spot={spot} size={size} glowTexture={glowTexture} />
      ))}
    </group>
  );
}

// ===========================================================================
// CAMERA — eye-level framing down the corridor, dollying toward the photo
// backdrop as the user scrolls (subtle parallax against the flat plane).
// ===========================================================================

function CorridorCamera({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const { camera } = useThree();

  useFrame(() => {
    // Defensive guards: `camera` is always provided by R3F's Canvas context
    // for a component rendered inside <Canvas> (which this always is, via
    // SceneCanvas below), but a stale/duplicated @react-three/fiber install
    // can hand back a context whose values don't line up, so bail out
    // rather than dereference anything that isn't there. Same for
    // scrollProgress: Hero.tsx always supplies a number, but a defensive
    // fallback costs nothing here.
    if (!camera) return;
    const safeProgress = typeof scrollProgress === "number" && Number.isFinite(scrollProgress) ? scrollProgress : 0;
    const t = Math.max(0, Math.min(1, safeProgress));
    const targetZ = CORRIDOR_NEAR_Z - t * 15;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(0, 1.4, camera.position.z - 10);
  });

  return null;
}

export default function HeroScene({ scrollProgress = 0 }: { scrollProgress?: number }) {
  const windRef = useRef<WindRef>({ x: 0, y: 0, t: 0 });
  return (
    <SceneCanvas cameraPosition={[0, 2.1, CORRIDOR_NEAR_Z]} fov={52}>
      <WindContext.Provider value={windRef}>
        {/* Safety net so any un-covered pixel shows warm haze rather than
            the alpha-transparent canvas showing the page background
            through, in case the background photo hasn't finished loading
            yet or a resize briefly leaves a sliver uncovered. */}
        <color attach="background" args={["#caa062"]} />
        <fogExp2 attach="fog" args={["#d7a86b", 0.045]} />
        <CinematicRig
          keyColor="#ffb366"
          keyIntensity={1.6}
          keyPosition={[5, 7, 3]}
          fillColor="#5a4a6a"
          fillIntensity={0.35}
          fillPosition={[-4, 2, 4]}
          rimColor="#ffd9a0"
          rimIntensity={0.55}
          rimPosition={[0, 5, -14]}
          ambientColor="#caa878"
          ambientIntensity={0.45}
        />
        <pointLight color="#ffb35c" position={[0, 3.8, 2]} intensity={1.1} distance={7} />
        <pointLight color="#ff9d4d" position={[0, 3.8, -8]} intensity={0.8} distance={8} />
        <CorridorCamera scrollProgress={scrollProgress} />
        <WindController />
        <PhotoLayer />
        {/* dof stays off — see the Part 1 writeup above; it was the main
            cause of the background photo reading as blurry. Bloom/vignette
            don't blur the background, so both stay on. */}
        <PostFX bloomIntensity={0.5} vignetteDarkness={0.55} />
      </WindContext.Provider>
    </SceneCanvas>
  );
}
