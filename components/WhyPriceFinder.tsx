import { TagIcon, BellIcon, StoreIcon } from "./icons";

// History of this section, because each generation failed differently:
// v1 showed made-up figures ($47, 100+, 6,200+) — fabricated. v2 said
// "Data collection in progress" — which became its own false claim: no
// per-user savings collection was in progress (there were no users), and
// one card described "stores compared side by side on every search", a
// capability that does not exist yet (findings §23). v3 (this one) makes
// only claims the code keeps: real markdowns come from the feed's own
// price fields (import-partner.mjs never fabricates originalPrice),
// alerts are live (checkPriceDrops + daily 13:00Z cron + Resend), and
// every price is re-checked daily by the 11:00Z refresh with a per-
// listing verification stamp (PriceAsOfLabel).
const VALUE_PROPS = [
  {
    icon: TagIcon,
    stat: "Real markdowns only",
    label:
      "A discount only shows when the store's own feed shows one — we never invent a strike-through price.",
  },
  {
    icon: BellIcon,
    stat: "Price-drop alerts, live today",
    label:
      "Save an item, set a target price, and we email you when the price falls to it.",
  },
  {
    icon: StoreIcon,
    stat: "Checked every day",
    label:
      // 'checked', not 'refreshed' (findings §27): the daily job verifies
      // displayed prices against each store's live feed; the displayed
      // price itself only changes at re-import. 'Refreshed' claimed the
      // former updated the latter — the same claim-vs-data gap as the
      // sparkline, in copy written the same night the standard was set.
      "Prices are checked daily against each store's live feed, and every listing shows when it was last verified.",
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {VALUE_PROPS.map(({ icon: Icon, stat, label }) => (
            <div
              key={label}
              className="flex flex-col gap-3 rounded-2xl border border-gilt-500/20 bg-noir-800/70 p-6 shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-soft"
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
