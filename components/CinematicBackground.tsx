/**
 * A fixed, whole-site backdrop: a solid theme-token fill (`bg-noir-900`),
 * `position: fixed` + a negative z-index so it stays pinned behind
 * everything regardless of page scroll — applies to every page (hero,
 * category pages, product detail, etc.) since it's mounted once in
 * app/layout.tsx.
 *
 * Two soft circular glows sit on top of that fill, but only render in the
 * light theme (see the `.light-theme-glow` rule in app/globals.css, which
 * drives their opacity from `data-theme` on <html> — no JS/prop-drilling
 * needed here). This restores the gentle sage-tinted radiance from the
 * original cream/sage design direction. The dark theme intentionally keeps
 * a flat, glow-free background — the heavier Three.js scenes and gradient
 * wash that used to live here were removed for that "Brew Haven" direction
 * and stay retired; this is a lightweight CSS-only glow scoped specifically
 * to the light palette, not a revival of that old effect.
 */
export default function CinematicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-noir-900">
      <div className="light-theme-glow absolute left-1/2 top-[-18%] h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-gilt-500/25 blur-[130px]" />
      <div className="light-theme-glow absolute bottom-[-20%] right-[-12%] h-[520px] w-[520px] rounded-full bg-gilt-400/20 blur-[140px]" />
      <div className="light-theme-glow absolute left-[-10%] top-[40%] h-[420px] w-[420px] rounded-full bg-clay-400/10 blur-[130px]" />
    </div>
  );
}
