/**
 * Homepage vision statement — sits right below Hero's stats. Distinct from
 * UnderConstruction.tsx (a compact "here's what's next" badge list further
 * down the page): this is a short narrative read, meant to set
 * expectations early, before a visitor scrolls past a still-small catalog.
 */
export default function FutureOfWebsite() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-14 text-center sm:px-8 sm:py-20">
      <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
        Where we&rsquo;re headed
      </span>
      <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
        The future of Go Price Finder
      </h2>
      <span aria-hidden className="mx-auto mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />

      <div className="mx-auto mt-6 flex flex-col gap-4 text-balance text-left text-base leading-relaxed text-ivory-300 sm:text-center">
        <p>
          Go Price Finder started with a simple idea: one place to compare real
          prices from real stores, without the sponsored rankings and
          fabricated discounts that make so much of online shopping feel
          untrustworthy. Right now that means a small, hand-picked group of
          partners — but every product you see is real, and every price is
          checked weekly.
        </p>
        <p>
          As we grow, expect more stores, a wider range of categories, and
          smarter search that gets better at understanding what you&rsquo;re
          actually looking for. We&rsquo;re also building toward real price
          history, so you can see whether now is genuinely a good time to
          buy.
        </p>
        <p>
          None of that changes what this site is for: helping you find a
          better deal, faster, from stores you can trust. Everything we add
          from here just makes that easier.
        </p>
      </div>
    </section>
  );
}
