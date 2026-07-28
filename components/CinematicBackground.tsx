/**
 * A fixed, whole-site backdrop: a solid theme-token fill (`bg-noir-900`),
 * `position: fixed` + a negative z-index so it stays pinned behind
 * everything regardless of page scroll — applies to every page (hero,
 * category pages, product detail, etc.) since it's mounted once in
 * app/layout.tsx.
 *
 * Flat in both themes — the soft circular light-theme glow (three blurred
 * gilt/clay circles) that used to sit on top of this fill was removed per
 * the approved design direction, which calls for a clean flat background
 * matching the visual-direction mockup. Dark theme was already flat.
 */
export default function CinematicBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-noir-900" />
  );
}
