import Link from "next/link";
import Header from "./Header";
import Footer from "./Footer";
import { ChevronRightIcon } from "./icons";

/**
 * Shared shell for simple, on-brand placeholder pages (nav destinations
 * that don't have full features built out yet) — keeps them visually
 * consistent instead of each page inventing its own layout.
 */
export default function PlaceholderPage({
  eyebrow,
  title,
  description,
  ctaHref = "/",
  ctaLabel = "Back to home",
}: {
  eyebrow: string;
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-24 text-center sm:px-8 sm:py-32">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            {eyebrow}
          </span>
          <h1 className="mt-3 text-balance font-display text-4xl font-medium tracking-tight text-ivory-50 sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-balance text-base leading-relaxed text-ivory-300">
            {description}
          </p>
          <Link
            href={ctaHref}
            className="group mt-8 inline-flex items-center gap-1 rounded-full bg-gilt-500 px-6 py-3 text-sm font-medium text-ivory-50 transition-colors hover:bg-gilt-400"
          >
            {ctaLabel}
            <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
