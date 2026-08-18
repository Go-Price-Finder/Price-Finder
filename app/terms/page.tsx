import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";

// Text verbatim from the operator-delivered terms.md (Cowork-written,
// 2026-08-19). Legal document naming a real jurisdiction — do NOT
// paraphrase, condense, or improve the prose; entity escaping and mailto
// links are rendering, not rewording.

export const metadata: Metadata = {
  title: "Terms of Service — Go Price Finder",
  description:
    "The terms covering your use of gopricefinder.com — an information service showing retailer prices, operated as a sole proprietorship in New York, United States.",
};

const H2 = "mt-4 font-display text-xl font-semibold text-ivory-50";
const EMAIL_LINK =
  "text-ivory-100 underline-offset-4 hover:text-gilt-400 hover:underline";

export default function TermsPage() {
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
            <span className="text-ivory-200">Terms of Service</span>
          </nav>
        </div>

        <section className="mx-auto max-w-3xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Legal
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Terms of Service
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-ivory-300 sm:text-base">
            <p className="text-xs text-ivory-400">
              <strong>Last updated: 18 August 2026</strong>
            </p>
            <p>
              These terms cover your use of gopricefinder.com, operated by
              Abudurexiti Kaiwushaer, a sole proprietor based in New York,
              United States (&ldquo;we&rdquo;, &ldquo;us&rdquo;). By using the
              site you agree to them.
            </p>

            <h2 className={H2}>What this service is</h2>
            <p>
              Go Price Finder is an information service. We show product
              prices collected from retailers&rsquo; own product feeds, track
              how those prices change over time, and link you to the retailer
              if you want to buy.
            </p>
            <p>
              <strong>We are not a retailer.</strong> We don&rsquo;t sell
              anything, hold stock, process payments, ship orders, or handle
              returns. Any purchase you make is a contract between you and
              that retailer, under their terms.
            </p>

            <h2 className={H2}>About prices</h2>
            <p>
              We take price accuracy seriously and it&rsquo;s the core of what
              we do. We also need to be honest about its limits.
            </p>
            <p>
              Prices come from retailer feeds and are refreshed on a schedule.
              A retailer can change a price at any moment, and there will
              always be a window between their change and our next update.
              Where we display the date a price was last verified, that is
              exactly what it means.
            </p>
            <p>
              <strong>
                Always check the price on the retailer&rsquo;s own site before
                buying.
              </strong>{" "}
              The retailer&rsquo;s price at the moment of purchase is the real
              one. We don&rsquo;t guarantee that a price shown here is
              currently available, and we&rsquo;re not liable for a difference
              between the two.
            </p>
            <p>
              The same applies to availability. A product listed here may be
              out of stock or discontinued at the retailer.
            </p>

            <h2 className={H2}>Affiliate relationships</h2>
            <p>
              Every outbound product link is an affiliate link. If you buy
              after clicking one, we may earn a commission from the retailer
              at no additional cost to you. This is our only revenue.
            </p>
            <p>
              Commission does not determine what we show you or how we rank
              it. A price is a price regardless of what we earn on it.
            </p>

            <h2 className={H2}>Your account</h2>
            <p>
              You&rsquo;re responsible for keeping your password secure and
              for activity under your account. Don&rsquo;t create accounts for
              other people without their consent, and don&rsquo;t use the site
              for anything unlawful.
            </p>
            <p>
              You can delete your account at any time by emailing{" "}
              <a href="mailto:gpf@gopricefinder.com" className={EMAIL_LINK}>
                <strong>gpf@gopricefinder.com</strong>
              </a>
              .
            </p>
            <p>
              We may suspend accounts that abuse the service — automated
              scraping, attempts to disrupt the site, or fraudulent activity.
            </p>

            <h2 className={H2}>Our content</h2>
            <p>
              The price data, page content and design on this site are ours.
              You&rsquo;re welcome to link to us. Please don&rsquo;t scrape
              the site or republish our data wholesale.
            </p>
            <p>
              Product names, images and descriptions belong to their
              respective retailers and manufacturers, and are used here to
              describe the products they refer to.
            </p>

            <h2 className={H2}>No warranty</h2>
            <p>
              The site is provided as it is. We work hard to keep it accurate
              and available, but we don&rsquo;t guarantee it will be
              uninterrupted, error-free, or that every price is current at the
              moment you read it.
            </p>

            <h2 className={H2}>Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, we&rsquo;re not liable
              for losses arising from your use of the site, including losses
              connected to a purchase you made from a retailer after clicking
              through from here. Nothing in these terms limits any liability
              that cannot legally be limited.
            </p>

            <h2 className={H2}>Changes</h2>
            <p>
              We may update these terms. The date at the top shows when they
              last changed. Continuing to use the site after a change means
              you accept the updated terms.
            </p>

            <h2 className={H2}>Governing law</h2>
            <p>
              These terms are governed by the laws of the State of New York,
              United States, without regard to its conflict of law provisions.
              Any dispute arising from them will be subject to the courts of
              the State of New York.
            </p>

            <h2 className={H2}>Contact</h2>
            <p>
              <a href="mailto:gpf@gopricefinder.com" className={EMAIL_LINK}>
                <strong>Email: gpf@gopricefinder.com</strong>
              </a>
            </p>
            <p>
              Abudurexiti Kaiwushaer, sole proprietor
              <br />
              New York, United States
            </p>

            <p className="mt-4 border-t border-gilt-500/20 pt-6 text-xs text-ivory-400">
              Related:{" "}
              <Link href="/privacy" className="underline-offset-4 hover:text-gilt-400 hover:underline">
                Privacy Policy
              </Link>
              {" · "}
              <Link href="/affiliate-disclosure" className="underline-offset-4 hover:text-gilt-400 hover:underline">
                Affiliate Disclosure
              </Link>
              {" · "}
              <Link href="/contact" className="underline-offset-4 hover:text-gilt-400 hover:underline">
                Contact
              </Link>
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
