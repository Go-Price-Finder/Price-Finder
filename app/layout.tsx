import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";

import "./globals.css";
import Providers from "./providers";
import CinematicBackground from "@/components/CinematicBackground";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: "Price Finder — Compare Prices, Shop Smarter",
  description:
    "Price Finder helps you compare prices across stores, so you can shop smarter and find better deals.",
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
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-noir-900 text-ivory-50">
        <CinematicBackground />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
