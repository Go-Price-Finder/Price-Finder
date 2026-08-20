import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChevronRightIcon } from "@/components/icons";
import { getAllGuides } from "@/lib/guides";

export const metadata: Metadata = {
  title: "Buying Guides — Go Price Finder",
  description:
    "Editorial buying guides from Go Price Finder — sourced, dated, and reviewed, covering when and how to buy at a good price.",
};

/**
 * Guides index (route approved 2026-08-19, findings §30). Every guide is
 * a markdown file in content/guides/, rendered verbatim — see
 * lib/guides.ts for why there is deliberately no MDX and no JSX
 * transcription of editorial prose.
 */
export default function GuidesIndexPage() {
  const guides = getAllGuides();

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
            <span className="text-ivory-200">Guides</span>
          </nav>
        </div>

        <section className="mx-auto max-w-3xl px-5 pb-2 pt-6 sm:px-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            Editorial
          </span>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-ivory-50 sm:text-4xl">
            Buying guides
          </h1>
          <span aria-hidden className="mt-4 block h-[3px] w-16 rounded-full bg-gilt-500" />
          <p className="mt-3 max-w-2xl text-ivory-300">
            Sourced and dated. Each guide says when it was published, when it
            was last reviewed, and what we can&rsquo;t know — in that order
            of importance.
          </p>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-5">
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="group rounded-2xl border border-gilt-500/20 bg-noir-800/70 p-6 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-gilt-400/40 hover:shadow-soft"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-gilt-400">
                  {guide.category}
                </span>
                <h2 className="mt-2 font-display text-xl font-medium text-ivory-50 group-hover:text-gilt-400 sm:text-2xl">
                  {guide.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ivory-300">
                  {guide.description}
                </p>
                <p className="mt-3 text-xs text-ivory-400">
                  Published {guide.published} · Last reviewed {guide.lastReviewed}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
