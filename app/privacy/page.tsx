import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";

// Text verbatim from the operator-delivered privacy.md (Cowork-written,
// 2026-08-19). Legal document — do NOT paraphrase, condense, or improve
// the prose; entity escaping and mailto links are rendering, not
// rewording.

export const metadata: Metadata = {
  title: "Privacy Policy — Go Price Finder",
  description:
    "What Go Price Finder collects, why, and what you can do about it — written in plain language rather than legal boilerplate.",
};

const H2 = "mt-4 font-display text-xl font-semibold text-ivory-50";
const EMAIL_LINK =
  "text-ivory-100 underline-offset-4 hover:text-gilt-400 hover:underline";

export default function PrivacyPage() {
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
            <span className="text-ivory-200">Privacy Policy</span>
          </nav>
        </div>

        <section className="mx-auto max-w-3xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Legal
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Privacy Policy
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5 text-sm leading-relaxed text-ivory-300 sm:text-base">
            <p className="text-xs text-ivory-400">
              <strong>Last updated: 18 August 2026</strong>
            </p>
            <p>
              Go Price Finder (gopricefinder.com) is operated by Abudurexiti
              Kaiwushaer, a sole proprietor based in New York, United States
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what
              we collect, why, and what you can do about it. We&rsquo;ve
              written it in plain language rather than legal boilerplate.
            </p>

            <h2 className={H2}>What we collect</h2>
            <p>
              <strong>If you create an account:</strong> your email address
              and a password. Passwords are stored only as a cryptographic
              hash — we never store, see, or have any way to recover your
              actual password.
            </p>
            <p>
              <strong>If you use a wishlist or price alert:</strong> the
              products you save and any target price you set.
            </p>
            <p>
              <strong>When you visit:</strong> anonymous usage analytics —
              pages viewed, approximate country, device type, and referring
              site. This is aggregate, is not tied to your account, and is
              not used to build a profile of you.
            </p>
            <p>
              <strong>We do not collect payment information.</strong> We never
              process payments, because we never sell you anything. Purchases
              happen entirely on the retailer&rsquo;s own site, under their
              terms and their privacy policy.
            </p>

            <h2 className={H2}>Why we collect it</h2>
            <p>
              Your email lets you sign in and lets us send the price alerts
              you asked for. Wishlist and alert data is what makes those
              alerts work. Analytics tells us which pages are useful and
              which are broken.
            </p>
            <p>
              We do not sell your data. We do not share it with advertisers.
              We do not send marketing email you didn&rsquo;t ask for.
            </p>

            <h2 className={H2}>Affiliate links and tracking</h2>
            <p>
              Every product link on this site is an affiliate link. When you
              click one, you pass through an affiliate network — currently
              AWIN — before arriving at the retailer. That network sets its
              own tracking so the retailer knows the visit came from us and
              can pay commission if you buy.
            </p>
            <p>
              That tracking is theirs, not ours, and is governed by their
              privacy policy and the retailer&rsquo;s. We don&rsquo;t receive
              your name, address, payment details, or order contents from it
              — only aggregate reporting about whether a purchase occurred.
            </p>

            <h2 className={H2}>Who we share data with</h2>
            <p>
              We use a small number of service providers to run the site.
              They process data on our behalf and hold only what they need to
              do their job:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Supabase</strong> — database and authentication
              </li>
              <li>
                <strong>Vercel</strong> — hosting and anonymous analytics
              </li>
              <li>
                <strong>Resend</strong> — sending transactional email such as
                price alerts and password resets
              </li>
            </ul>
            <p>
              We don&rsquo;t share your data with anyone else except where
              we&rsquo;re legally required to.
            </p>

            <h2 className={H2}>Cookies</h2>
            <p>
              We use a session cookie to keep you signed in. That&rsquo;s the
              only cookie we set ourselves, and it is necessary for the site
              to work. Our analytics is cookieless. Affiliate networks set
              their own cookies when you click an outbound link, as described
              above.
            </p>

            <h2 className={H2}>How long we keep it</h2>
            <p>
              Account data is kept while your account is open. Delete your
              account and we delete it. Anonymous analytics is retained in
              aggregate and cannot be traced back to you.
            </p>

            <h2 className={H2}>Your rights</h2>
            <p>
              You can ask us to show you what we hold about you, correct it,
              or delete it entirely. Email{" "}
              <a href="mailto:gpf@gopricefinder.com" className={EMAIL_LINK}>
                <strong>gpf@gopricefinder.com</strong>
              </a>{" "}
              and we&rsquo;ll do it — we won&rsquo;t ask you to explain why.
            </p>
            <p>
              Depending on where you live, you may have additional statutory
              rights over your personal information. If you believe
              we&rsquo;re holding or using your data in a way you
              haven&rsquo;t agreed to, contact us and we&rsquo;ll put it
              right.
            </p>

            <h2 className={H2}>Children</h2>
            <p>
              This site is not directed at children under 13, and we
              don&rsquo;t knowingly collect personal information from them.
              If you believe a child has created an account, email us and
              we&rsquo;ll remove it.
            </p>

            <h2 className={H2}>Changes</h2>
            <p>
              If we change this policy we&rsquo;ll update the date at the
              top. If a change is significant we&rsquo;ll tell account
              holders by email rather than quietly editing the page.
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
              <Link href="/terms" className="underline-offset-4 hover:text-gilt-400 hover:underline">
                Terms of Service
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
