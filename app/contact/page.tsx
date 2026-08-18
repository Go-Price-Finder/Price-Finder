import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";

// Text verbatim from the operator-delivered contact.md (Cowork-written,
// 2026-08-19). Do NOT paraphrase, condense, or improve the prose.

export const metadata: Metadata = {
  title: "Contact — Go Price Finder",
  description:
    "A small team that reads everything that comes in — no ticket queue, no chatbot. A message here reaches one of the two people who build the site.",
};

const H2 = "mt-4 font-display text-xl font-semibold text-ivory-50";
const EMAIL_LINK =
  "text-ivory-100 underline-offset-4 hover:text-gilt-400 hover:underline";

export default function ContactPage() {
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
            <span className="text-ivory-200">Contact</span>
          </nav>
        </div>

        <section className="mx-auto max-w-3xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Company
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Contact
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-ivory-300 sm:text-base">
            <p>
              We&rsquo;re a small team and we read everything that comes in.
              There&rsquo;s no ticket queue and no chatbot — a message here
              reaches one of the two people who build the site.
            </p>

            <h2 className={H2}>Email us</h2>
            <p>
              <a href="mailto:gpf@gopricefinder.com" className={EMAIL_LINK}>
                <strong>gpf@gopricefinder.com</strong>
              </a>{" "}
              — general. Anything at all; this one reaches both of us and is
              the best address if you&rsquo;re not sure.
            </p>
            <p>
              <a href="mailto:kai@gopricefinder.com" className={EMAIL_LINK}>
                <strong>kai@gopricefinder.com</strong>
              </a>{" "}
              — Kai, directly.
            </p>
            <p>
              <a href="mailto:shawn@gopricefinder.com" className={EMAIL_LINK}>
                <strong>shawn@gopricefinder.com</strong>
              </a>{" "}
              — Shawn, directly.
            </p>

            <h2 className={H2}>What to get in touch about</h2>
            <p>
              <strong>Something looks wrong.</strong> A price that
              doesn&rsquo;t match what the retailer is showing, a product
              that&rsquo;s no longer available, a link that goes nowhere, a
              page that won&rsquo;t load. These are the most useful messages
              we get — include the page address if you can.
            </p>
            <p>
              <strong>Your account.</strong> Sign-in problems, password
              resets that didn&rsquo;t arrive, or a request to delete your
              account and everything associated with it. We&rsquo;ll action
              deletion requests without asking you to justify them.
            </p>
            <p>
              <strong>Data and privacy requests.</strong> Ask us what we hold
              about you, correct it, or delete it. Use{" "}
              <a href="mailto:gpf@gopricefinder.com" className={EMAIL_LINK}>
                <strong>gpf@gopricefinder.com</strong>
              </a>{" "}
              so it doesn&rsquo;t sit in one person&rsquo;s inbox while
              they&rsquo;re away.
            </p>
            <p>
              <strong>Retailers and brands.</strong> If you run a retail
              programme and think your products belong here, we&rsquo;d like
              to hear from you — particularly in categories where prices
              genuinely move and shoppers benefit from knowing when to buy.
            </p>
            <p>
              <strong>Press and everything else.</strong> Same addresses.
            </p>

            <h2 className={H2}>Response times</h2>
            <p>
              We aim to reply within two working days. We&rsquo;re a team of
              two, so occasionally it&rsquo;s longer — but every message is
              read by a person.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
