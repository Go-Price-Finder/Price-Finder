import { CheckIcon } from "./icons";

/**
 * New section from the approved visual-direction redesign — plainly
 * states the site's actual methodology rather than relying on visual
 * polish to imply trustworthiness. Distinct from WhyPriceFinder.tsx (value
 * props like savings/tracking), which is left as-is; this is specifically
 * about affiliate/pricing credibility, the thing a comparison site most
 * needs to state outright.
 */
const TRUST_POINTS = [
  {
    title: "Every affiliate link is disclosed.",
    body: "We earn a commission when you buy — disclosed in our site footer and full disclosure page.",
  },
  {
    title: "Prices are checked weekly,",
    body: "and each listing shows when it was last verified.",
  },
  {
    title: "Discounts are real markdowns only.",
    body: "If nothing's genuinely on sale, the deals page says so — it never invents one.",
  },
  {
    title: "Rankings aren't for sale.",
    body: "Partners don't pay for placement on this page.",
  },
];

export default function WhyTrustPrices() {
  return (
    <section
      id="why-trust-us"
      className="relative overflow-hidden py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Methodology
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Why trust our prices
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
          {TRUST_POINTS.map(({ title, body }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gilt-500 text-accent-ink">
                <CheckIcon className="h-3 w-3" />
              </span>
              <p className="text-sm leading-relaxed text-ivory-200">
                <span className="font-semibold text-ivory-50">{title}</span>{" "}
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
