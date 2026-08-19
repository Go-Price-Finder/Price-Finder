import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";

// Text verbatim from the operator-delivered about.md (Cowork-written,
// 2026-08-19). Do NOT paraphrase, condense, or improve the prose.

export const metadata: Metadata = {
  title: "About — Go Price Finder",
  description:
    "Go Price Finder exists to answer one question: is this a good price right now, or should you wait?",
};

const H2 = "mt-4 font-display text-xl font-semibold text-ivory-50";

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ivory-400">
            <Link href="/" className="transition-colors hover:text-gilt-400">
              Home
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="text-ivory-200">About</span>
          </nav>
        </div>

        <section className="mx-auto max-w-3xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Company
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            About Go Price Finder
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-ivory-300 sm:text-base">
            <p>
              Go Price Finder exists to answer one question:{" "}
              <strong>
                is this a good price right now, or should you wait?
              </strong>
            </p>
            <p>
              Most shopping sites tell you what something costs today.
              That&rsquo;s the easy part — the retailer&rsquo;s own page
              already does it. The harder and more useful question is whether
              today&rsquo;s price is actually good, or whether the same item
              was cheaper three weeks ago and will be again next month.
              That&rsquo;s the question we&rsquo;re built around.
            </p>

            <h2 className={H2}>How it works</h2>
            <p>
              We track products from retail partners and record what they
              cost over time. When you look at a product here, you see what
              it costs today, when we last checked it, and whether the store
              has marked it down from its own list price. We&rsquo;re
              recording those prices daily so that we can eventually show
              you how they&rsquo;ve moved over time — that history is being
              collected now, and the charts aren&rsquo;t live yet.
              We&rsquo;d rather tell you that than imply we already have it.
            </p>
            <p>
              Every price on this site comes directly from a retailer&rsquo;s
              own product feed. We don&rsquo;t estimate, we don&rsquo;t
              extrapolate, and we don&rsquo;t invent discounts. Where we show
              a date next to a price, that&rsquo;s the date the price was
              last verified, not the date you happened to load the page.
            </p>

            <h2 className={H2}>What we don&rsquo;t do</h2>
            <p>
              <strong>We&rsquo;re not a coupon site.</strong> We don&rsquo;t
              publish discount codes and we don&rsquo;t ask you to hunt for
              one before checking out.
            </p>
            <p>
              <strong>We&rsquo;re not a cashback site.</strong> We don&rsquo;t
              run a wallet, a points balance, or a rewards programme.
            </p>
            <p>
              <strong>We don&rsquo;t fabricate markdowns.</strong> If a
              product isn&rsquo;t genuinely below a price it previously sold
              at, we don&rsquo;t dress it up as a deal. Our deals page shows
              only real markdowns, which sometimes means it&rsquo;s close to
              empty — we&rsquo;d rather show you three honest ones than three
              hundred invented ones.
            </p>

            <h2 className={H2}>How we make money</h2>
            <p>
              When you click through to a retailer from Go Price Finder and
              buy something, we may earn a commission from that retailer. It
              costs you nothing — the price you pay is the same as it would
              be if you&rsquo;d gone to the retailer directly.
            </p>
            <p>
              That commission is our only source of revenue. We think
              it&rsquo;s worth saying plainly, because it explains our
              incentives: we&rsquo;re paid when you buy, which means we have
              every reason to be useful and no reason to make the price look
              better than it is. A site that misleads you into a bad purchase
              gets one commission and loses a visitor.
            </p>
            <p>
              Every outbound product link on this site is an affiliate link.
              There&rsquo;s a disclosure on the site and in these terms, and
              we&rsquo;d rather over-explain it than have you find out later.
            </p>

            <h2 className={H2}>Who&rsquo;s behind it</h2>
            <p>
              Go Price Finder is run by a small team of two — not a company
              with a marketing department. It launched in July 2026 and is
              still early. We&rsquo;re adding retailers, building out price
              history, and improving the site continuously.
            </p>
            <p>
              If something looks wrong, tell us. A price that doesn&rsquo;t
              match the retailer, a product that&rsquo;s no longer available,
              a page that&rsquo;s broken — we want to know, and on a site
              this size a message actually reaches the people who can fix it.
            </p>
            <p>
              <a
                href="mailto:gpf@gopricefinder.com"
                className="text-ivory-100 underline-offset-4 hover:text-gilt-400 hover:underline"
              >
                <strong>gpf@gopricefinder.com</strong>
              </a>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
