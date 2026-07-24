import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import LoyaltySection from "@/components/LoyaltySection";
import { SearchIcon, BellIcon, TrendingUpIcon } from "@/components/icons";
import { TIERS, TIER_PERKS } from "@/lib/loyalty";

export const metadata: Metadata = {
  title: "How It Works — Price Finder",
  description:
    "See how Price Finder is designed to help you find deals, track prices, and earn rewards as we grow our retailer coverage.",
};

const DISPLAY_TIERS = TIERS.filter((t) => t.id !== "member");

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-5 pb-2 pt-12 text-center sm:px-8 sm:pt-16">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            How It Works
          </span>
          <h1 className="mt-2 text-balance font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Everything Price Finder does for you, step by step
          </h1>
          <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-ivory-300">
            From finding the right deal to earning rewards on every purchase —
            here&apos;s exactly how the whole process works, start to finish.
          </p>
        </section>

        {/* 4-step overview — shared with the homepage teaser section so the
            two never drift out of sync (see components/HowItWorks.tsx). */}
        <HowItWorks />

        {/* Deep dive 1 — finding deals */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr]">
            <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gilt-500/10 text-gilt-400 shadow-soft lg:mx-0">
              <SearchIcon className="h-7 w-7" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
                Finding deals
              </span>
              <h2 className="mt-1 font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
                Search or browse — we scan the whole market at once
              </h2>
              <p className="mt-3 max-w-2xl text-balance leading-relaxed text-ivory-300">
                Type a product name into the search bar, or browse by
                category from the homepage. Price Finder is designed to
                search across the retailers we track and lay out matching
                listings side by side, so you can compare in one place
                instead of checking each store one by one.
              </p>
            </div>
          </div>
        </section>

        {/* Deep dive 2 — price tracking */}
        <section className="border-y border-noir-700/60 bg-noir-800/30">
          <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr]">
              <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gilt-500/10 text-gilt-400 shadow-soft lg:mx-0">
                <BellIcon className="h-7 w-7" />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
                  Price tracking
                </span>
                <h2 className="mt-1 font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
                  Price history tracking is coming soon
                </h2>
                <p className="mt-3 max-w-2xl text-balance leading-relaxed text-ivory-300">
                  We&apos;re building price history charts so you can see how
                  a product has moved over time and judge whether now is a
                  good time to buy. Save an item to your wishlist and set a
                  target price now, so you&apos;re ready to get notified as
                  soon as drop alerts go live.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Deep dive 3 — loyalty tiers, reusing the interactive homepage
            loyalty section rather than duplicating its markup. */}
        <div className="relative">
          <div className="mx-auto max-w-5xl px-5 pt-14 text-center sm:px-8 sm:pt-20">
            <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
              Loyalty points
            </span>
            <h2 className="mt-1 font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
              Earn 1 point for every $10 you spend
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-balance leading-relaxed text-ivory-300">
              Points accrue automatically on every purchase made through
              Price Finder — no separate sign-up. As your point total
              crosses each tier&apos;s threshold, you&apos;re upgraded
              instantly and unlock that tier&apos;s perks on top of everything
              below it.
            </p>
          </div>
          <LoyaltySection />
          <div className="mx-auto -mt-10 max-w-5xl px-5 pb-6 sm:px-8">
            <div className="grid gap-3 sm:grid-cols-2">
              {DISPLAY_TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-2xl border border-gilt-500/15 bg-noir-800/50 p-4 text-sm"
                >
                  <p className="font-display font-medium text-ivory-50">
                    {tier.name} · {tier.threshold.toLocaleString()}+ points
                  </p>
                  <p className="mt-1 text-ivory-300">{TIER_PERKS[tier.id]}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deep dive 4 — how users save money */}
        <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[auto_1fr]">
            <div className="mx-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gilt-500/10 text-gilt-400 shadow-soft lg:mx-0">
              <TrendingUpIcon className="h-7 w-7" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
                Saving money
              </span>
              <h2 className="mt-1 font-display text-2xl font-medium text-ivory-50 sm:text-3xl">
                Multi-retailer comparison helps you find a better price
              </h2>
              <p className="mt-3 max-w-2xl text-balance leading-relaxed text-ivory-300">
                Product pages list the retailers we track for that item,
                sorted cheapest first, with a &quot;Best Price&quot; badge
                marking the lowest of those. Comparing multiple stores
                instead of buying from the first one you find is where real
                savings tend to come from — Price Finder is built to make
                that comparison easy.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
