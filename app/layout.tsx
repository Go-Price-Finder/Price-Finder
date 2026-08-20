import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "./globals.css";
import Providers from "./providers";
import CinematicBackground from "@/components/CinematicBackground";

// Plus Jakarta Sans — typography-and-contrast-spec.md §1, weights
// 400/500/600/700/800, display: "swap", system fallback stack.
// DELIBERATELY NOT Inter (the spec's reasoning: Inter has become the
// "generic modern web app" tell); this is the specified typeface, not a
// safer default substituted for it.
//
// ONE DEVIATION FROM THE SPEC, stated rather than silent: the spec says
// next/font/google, but findings §9q records that a build-time fetch
// from fonts.gstatic.com FAILED a production deploy, which is why both
// previous families are vendored. The same latin-subset variable woff2
// Google serves is committed to app/fonts/ and loaded with
// next/font/local — identical typeface and axes, no third-party network
// call between a deploy and production.
const jakarta = localFont({
  src: "./fonts/plus-jakarta-sans-variable-latin.woff2",
  variable: "--font-jakarta",
  display: "swap",
  weight: "400 800",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Go Price Finder — Compare Prices, Shop Smarter",
  description:
    "Go Price Finder helps you compare prices across stores, so you can shop smarter and find better deals.",
  verification: {
    // Renders as <meta name="google-site-verification" content="..." />
    // for Google Search Console site-ownership verification.
    google: "OgfmyT1havQ_7c2aaVAa0hWqIjoVeHZ2CATa2th_Fjc",
  },
  other: {
    // Site-ownership verification for the FlexOffers affiliate network —
    // renders as <meta name="fo-verify" content="..." /> in <head> via
    // Next's metadata API rather than a hand-written tag, so it stays in
    // sync with the rest of the metadata object.
    "fo-verify": "9860d354-fac3-465c-805d-28f2c89bf837",
  },
};

/**
 * Sets `data-theme` on <html> from localStorage before the page paints.
 * Light is the site default, so a first-time visitor (no stored value)
 * gets the default light theme with zero flash — this script only matters
 * for *returning* visitors who previously switched to dark, so their next
 * visit doesn't flash light-then-dark while React hydrates. Runs
 * synchronously and inline (not a deferred/module script) specifically so
 * it executes before first paint; see lib/theme-context.tsx for the
 * matching storage key and the React side of theme state.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=window.localStorage.getItem('price-finder-theme');document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${jakarta.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-noir-900 text-ivory-50">
        <CinematicBackground />
        <Providers>{children}</Providers>
        {/* Vercel Analytics — page-view tracking site-wide. A no-op outside
            a Vercel deployment (no env vars needed), so it's safe to render
            unconditionally including in local dev. */}
        <Analytics />
        {/* Vercel Speed Insights — real Core Web Vitals (LCP/CLS/INP/TTFB)
            per page, visible in the Vercel dashboard's Speed Insights tab.
            Same no-op-outside-Vercel behavior as Analytics above. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
