import Link from "next/link";
import Logo from "./Logo";
import SearchBar from "./SearchBar";

const CONTACT_EMAIL = "gpf@gopricefinder.com";

// Every link goes somewhere real. The old placeholder "#" entries
// (Careers, Press, Help Center, Price Alerts) are gone rather than
// pointing nowhere — a footer of dead links reads as a feed dump to the
// affiliate-network reviewers who open this site (2026-08-19, trust-pages
// work; the FlexOffers rejection is the precedent).
const FOOTER_LINKS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Shop",
    links: [
      { label: "Trending", href: "/trending" },
      { label: "Categories", href: "/categories" },
      { label: "Deals", href: "/deals" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Affiliate Disclosure", href: "/affiliate-disclosure" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t-2 border-gilt-500/50 bg-espresso-800">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ivory-300">
              Go Price Finder helps you find better deals. Data collection in
              progress.
            </p>

            <div className="mt-6 max-w-sm">
              <p className="mb-2 text-sm font-medium text-ivory-100">
                Get price drop alerts
              </p>
              <SearchBar
                placeholder="Enter your email"
                buttonLabel="Subscribe"
                showIcon={false}
                disableSearchNav
              />
            </div>
          </div>

          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h4 className="text-sm font-semibold text-ivory-50">
                {group.title}
              </h4>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-ivory-300 underline-offset-4 transition-colors hover:text-gilt-400 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Affiliate disclosure — short, standard, always visible rather
            than only reachable via the Support-column link above (see
            /affiliate-disclosure for the full version). */}
        <p className="mt-10 max-w-3xl text-xs leading-relaxed text-ivory-400">
          Go Price Finder participates in affiliate programs, including AWIN.
          We may earn a commission when you buy through a link on this site,
          at no additional cost to you. This never affects which products we
          show or how they&rsquo;re ranked.{" "}
          <Link
            href="/affiliate-disclosure"
            className="underline-offset-4 hover:text-gilt-400 hover:underline"
          >
            Full disclosure
          </Link>
          .
        </p>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-gilt-500/25 pt-8 sm:flex-row">
          <p className="text-xs text-ivory-400">
            © {new Date().getFullYear()} Go Price Finder. All rights reserved.
            {" · "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline-offset-4 hover:text-gilt-400 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          {/* Social links deliberately absent until real profiles exist —
              dead "#" anchors are worse than nothing (same rationale as the
              placeholder link removal above). */}
        </div>
      </div>
    </footer>
  );
}
