import Link from "next/link";
import Logo from "./Logo";
import SearchBar from "./SearchBar";

const FOOTER_LINKS: { title: string; links: string[] }[] = [
  {
    title: "Shop",
    links: ["Trending", "Categories", "Deals", "Price Alerts"],
  },
  {
    title: "Company",
    links: ["About Us", "How It Works", "Careers", "Press"],
  },
  {
    title: "Support",
    links: ["Help Center", "Contact Us", "Privacy Policy", "Terms of Service"],
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
              Price Finder helps you find better deals. Data collection in
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
                  <li key={link}>
                    <Link
                      href="#"
                      className="text-sm text-ivory-300 underline-offset-4 transition-colors hover:text-gilt-400 hover:underline"
                    >
                      {link}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-gilt-500/25 pt-8 sm:flex-row">
          <p className="text-xs text-ivory-400">
            © {new Date().getFullYear()} Price Finder. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {["Twitter", "Instagram", "LinkedIn"].map((social) => (
              <a
                key={social}
                href="#"
                className="text-xs font-medium text-ivory-300 underline-offset-4 transition-colors hover:text-gilt-400 hover:underline"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
