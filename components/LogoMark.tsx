/**
 * The Go Price Finder mark, redrawn flat for the editorial redesign — same
 * concept as the original glossy/dimensional icon (an 8-point compass star
 * with a magnifying glass over it), but as a two-tone vector instead of a
 * shaded raster illustration, so it actually fits the flat design direction
 * and stays crisp at every size instead of relying on 4-5 separately
 * exported PNGs (logo.png, logo-icon.png, logo-one.png, "logo 1.png", ...).
 * One component, sized via `size`, used in both Header (small) and Hero
 * (large) — see Logo.tsx and Hero.tsx.
 *
 * Colors come from the existing gilt/noir tokens, not new hex values, so
 * this automatically carries the new light-theme palette and the
 * unchanged dark-theme palette the same way every other themed element on
 * the site already does.
 */
export default function LogoMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <circle cx="50" cy="50" r="48" className="fill-gilt-500" />
      <path
        d="M50,12 L54.97,37.99 L76.87,23.13 L62.01,45.03 L88,50 L62.01,54.97 L76.87,76.87 L54.97,62.01 L50,88 L45.03,62.01 L23.13,76.87 L37.99,54.97 L12,50 L37.99,45.03 L23.13,23.13 L45.03,37.99 Z"
        className="fill-noir-950"
      />
      <circle
        cx="45"
        cy="45"
        r="13"
        className="fill-gilt-500 stroke-noir-950"
        strokeWidth="5"
      />
      <line
        x1="54.2"
        y1="54.2"
        x2="66"
        y2="66"
        className="stroke-noir-950"
        strokeWidth="6.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
