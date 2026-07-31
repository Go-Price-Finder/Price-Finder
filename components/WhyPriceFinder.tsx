import { TagIcon, BellIcon, StarIcon, StoreIcon } from "./icons";

// The first three used to show a made-up figure ($47, 100+, 6,200+) — with
// no real usage or retailer data behind Go Price Finder yet, those numbers
// said plainly "data collection in progress" instead. "4 tiers" is left
// alone: it's not a usage statistic, it's just how many loyalty tiers the
// program actually has (see lib/loyalty.ts).
const VALUE_PROPS = [
  {
    icon: TagIcon,
    stat: "Data collection in progress",
    label: "Saved on average, per user, per month",
  },
  {
    icon: BellIcon,
    stat: "Data collection in progress",
    label: "Products you can track at once, with price-drop alerts",
  },
  {
    icon: StoreIcon,
    stat: "Data collection in progress",
    label: "Stores compared side by side on every search",
  },
  {
    icon: StarIcon,
    stat: "4 tiers",
    label: "Of loyalty rewards, earned automatically on every purchase",
  },
];

/**
 * "Why Go Price Finder" — value-prop cards rather than fabricated customer
 * quotes. Keeps the same social-proof role a testimonials section would
 * play, without inventing fake reviewer names/photos on top of the
 * already-sanitized product catalog (see lib/data.ts).
 */
export default function WhyPriceFinder() {
  return (
    <section
      id="why-price-finder"
      className="relative overflow-hidden py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Why Go Price Finder
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Built to help you shop smarter
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUE_PROPS.map(({ icon: Icon, stat, label }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-3xl border border-gilt-500/20 bg-noir-800/70 p-6 shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gilt-500/10 text-gilt-400">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-balance font-display text-lg font-medium text-ivory-50 sm:text-xl">
                {stat}
              </span>
              <p className="text-sm leading-relaxed text-ivory-300">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
