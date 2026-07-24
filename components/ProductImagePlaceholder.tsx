/**
 * Generic placeholder graphic standing in for every product/category photo
 * in the sanitized mock catalog (see lib/data.ts) — a plain gray box with a
 * simple picture glyph and an explicit "Product Image" label, so nothing on
 * the live site looks like a real (but fake) product photo. Deliberately
 * not an <Image> — there's no real photo URL to fetch.
 */
export default function ProductImagePlaceholder({
  className = "",
  label = "Product Image",
  /** Icon-only, no text — for small thumbnails (e.g. a 56px modal avatar)
   * where the label text can't fit. `label` still drives the aria-label. */
  compact = false,
}: {
  className?: string;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-noir-700 ${className}`}
      role="img"
      aria-label={label}
    >
      <div className={`flex flex-col items-center text-center ${compact ? "" : "gap-2 px-4"}`}>
        <svg
          width={compact ? 20 : 32}
          height={compact ? 20 : 32}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-ivory-400/70"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M4 17l5-5 3 3 3-3.5 5 5.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {!compact && (
          <span className="text-[11px] font-medium uppercase tracking-wide text-ivory-400/80">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
