import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";

const CONTACT_EMAIL = "gopricefinder@gmail.com";

export const metadata: Metadata = {
  title: "Affiliate Disclosure — Go Price Finder",
  description:
    "Go Price Finder participates in affiliate programs, including AWIN, and may earn a commission on qualifying purchases.",
};

export default function AffiliateDisclosurePage() {
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
            <span className="text-ivory-200">Affiliate Disclosure</span>
          </nav>
        </div>

        <section className="mx-auto max-w-3xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Legal
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Affiliate Disclosure
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-ivory-300 sm:text-base">
            <p>
              Go Price Finder is a participant in affiliate marketing programs,
              including the AWIN affiliate network. This means that when you
              click a link to a retailer on this site and make a purchase,
              Go Price Finder may earn a commission — at no additional cost to
              you. The price you pay is the same whether you use our link or
              go directly to the retailer.
            </p>
            <p>
              Every &ldquo;View on [Retailer]&rdquo; button and outbound
              product link on Go Price Finder is an affiliate link. We don&rsquo;t
              use any other kind of outbound link to a partner store.
            </p>
            <p>
              This never affects which products we show, how they&rsquo;re
              ranked, or what price we display. Partners don&rsquo;t pay for
              placement, and a product being from a paying affiliate partner
              is never a factor in whether or how prominently it&rsquo;s
              shown. Prices are checked directly against each retailer and
              shown as-is.
            </p>
            <p>
              This disclosure is provided in accordance with the Federal
              Trade Commission&rsquo;s guidelines on affiliate marketing and
              endorsements.
            </p>
            <p>
              Questions about this disclosure or how Go Price Finder works?
              Email us at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-ivory-100 underline-offset-4 hover:text-gilt-400 hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
            <p className="text-xs text-ivory-400">Last updated July 2026.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
