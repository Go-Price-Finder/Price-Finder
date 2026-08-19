import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import { ChevronRightIcon } from "@/components/icons";
import { getAllGuides, getGuide } from "@/lib/guides";
import { buildArticleJsonLd } from "@/lib/structured-data";

export function generateStaticParams() {
  return getAllGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return { title: "Not found — Go Price Finder" };
  return {
    title: `${guide.title} — Go Price Finder`,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      type: "article",
      title: guide.title,
      description: guide.description,
      publishedTime: guide.published,
      modifiedTime: guide.lastReviewed,
    },
  };
}

/**
 * Guide detail page (route approved 2026-08-19, findings §30). The
 * markdown body renders AS DELIVERED — its own leading `# Title` is the
 * page's H1, so this template deliberately adds no second H1 (frontmatter
 * title feeds <title>/OG/JSON-LD and the index card instead). See
 * lib/guides.ts for the dangerouslySetInnerHTML justification: our own
 * repo-committed files only.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  return (
    <>
      <Header />
      <JsonLd data={buildArticleJsonLd(guide)} />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-5 pt-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-ivory-400">
            <Link href="/" className="transition-colors hover:text-gilt-400">
              Home
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <Link href="/guides" className="transition-colors hover:text-gilt-400">
              Guides
            </Link>
            <ChevronRightIcon className="h-3 w-3" />
            <span className="text-ivory-200">{guide.title}</span>
          </nav>
        </div>

        <article className="mx-auto max-w-3xl px-5 pb-16 pt-6 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-gilt-400">
            {guide.category}
          </p>
          <p className="mt-2 text-xs text-ivory-400">
            Published {guide.published} · Last reviewed {guide.lastReviewed}
          </p>
          <div
            className="guide-prose mt-6"
            dangerouslySetInnerHTML={{ __html: guide.html }}
          />
        </article>
      </main>
      <Footer />
    </>
  );
}
