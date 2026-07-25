const COMING_NEXT = [
  "More real partners and product catalogs beyond Brooklyn Delhi",
  "Real price history and price-drop alerts once there's data to track",
  "Verified customer reviews for every real product",
  "Search across every category, not just our first partner's",
];

/**
 * Sets expectations before visitors hit the (currently Brooklyn-Delhi-only)
 * real catalog — explains plainly that Price Finder is early and still
 * onboarding partners, rather than letting a mostly-empty site speak for
 * itself. Sits between Our Partners and Featured Deals on the homepage.
 */
export default function UnderConstruction() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-gilt-500/30 bg-noir-800/60 px-6 py-8 text-center shadow-soft sm:px-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-gilt-500/25 bg-noir-800 px-4 py-1.5 text-xs font-medium text-ivory-100">
          <span className="h-1.5 w-1.5 rounded-full bg-gilt-500" />
          Under Construction
        </span>
        <p className="max-w-2xl text-balance text-sm leading-relaxed text-ivory-300 sm:text-base">
          We&rsquo;re actively working on bringing more retail partners on
          board. More coming soon, thank you for your patience as we grow!
        </p>
        <ul className="mt-1 flex flex-wrap justify-center gap-2">
          {COMING_NEXT.map((item) => (
            <li
              key={item}
              className="rounded-full border border-gilt-500/20 bg-noir-800 px-3 py-1.5 text-xs font-medium text-ivory-200"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
