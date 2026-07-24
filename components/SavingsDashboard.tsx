import { StoreIcon, TagIcon, TrendingUpIcon, BellIcon } from "./icons";

// No real usage data exists yet — every one of these used to be a made-up
// aggregate figure (deals found, average savings, stores tracked, alerts
// sent). Rather than invent plausible-looking numbers, each card now says
// plainly that the data isn't in yet; swap in real numbers once there's
// real traffic to measure.
const DASHBOARD_STATS = [
  { icon: TagIcon, label: "Deals found" },
  { icon: TrendingUpIcon, label: "Average monthly savings per user" },
  { icon: StoreIcon, label: "Stores tracked" },
  { icon: BellIcon, label: "Price-drop alerts sent" },
];

export default function SavingsDashboard() {
  return (
    <section
      id="savings-dashboard"
      className="relative overflow-hidden py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="mb-10 text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            By the numbers
          </span>
          <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Your savings dashboard
          </h2>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {DASHBOARD_STATS.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-3 rounded-3xl border border-gilt-500/20 bg-noir-800/60 px-4 py-8 text-center shadow-soft backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gilt-500/10 text-gilt-400">
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-balance font-display text-base font-semibold text-ivory-200 sm:text-lg">
                Data collection in progress
              </span>
              <span className="text-balance text-xs uppercase tracking-wide text-ivory-300 sm:text-sm">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
