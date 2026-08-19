import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { marked } from "marked";

/**
 * Editorial guides loader (route proposal approved 2026-08-19, findings
 * §30). content/guides/<slug>.md is the SOURCE OF TRUTH — the delivered
 * markdown files, verbatim (hash-verified against delivery at commit
 * time), never rewritten into JSX. Per-guide JSX conversion invites
 * transcription drift from the delivered text, and drift in editorial
 * copy is a §23-class risk.
 *
 * Markdown is rendered with `marked` at BUILD time (all guide routes are
 * statically generated). Deliberately NOT MDX: executable prose is an
 * attack/complexity surface this site does not need. The rendered HTML is
 * injected with dangerouslySetInnerHTML, which is acceptable here for one
 * reason only: the input is our own repo-committed files, written by the
 * operator, never user- or feed-supplied. If guides ever come from
 * anywhere else, that reasoning dies with the source change.
 *
 * Frontmatter is parsed by the tiny block below rather than a YAML
 * dependency — the format is six known keys, and a full YAML parser is
 * more machinery (and more parsing ambiguity) than six keys are worth.
 */

export type Guide = {
  slug: string;
  title: string;
  description: string;
  category: string;
  /** ISO date the guide was first published (frontmatter `published`). */
  published: string;
  /** ISO date the content was last reviewed (frontmatter `lastReviewed`) —
   * feeds sitemap lastmod and Article dateModified. */
  lastReviewed: string;
  /** Rendered HTML of the markdown body (everything after frontmatter). */
  html: string;
};

const GUIDES_DIR = join(process.cwd(), "content", "guides");

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) throw new Error("guide is missing a frontmatter block");
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    meta[key] = value;
  }
  return { meta, body: raw.slice(m[0].length) };
}

function loadGuide(filename: string): Guide {
  const raw = readFileSync(join(GUIDES_DIR, filename), "utf-8");
  const { meta, body } = parseFrontmatter(raw);
  for (const key of ["slug", "title", "description", "category", "published", "lastReviewed"]) {
    if (!meta[key]) throw new Error(`guide ${filename}: frontmatter is missing "${key}"`);
  }
  // The markdown's own leading `# Title` is the page's H1 — the file is
  // rendered as delivered, so the page must NOT add a second H1 from
  // frontmatter (frontmatter title feeds <title>/JSON-LD/index instead).
  const html = marked.parse(body, { async: false });
  return {
    slug: meta.slug,
    title: meta.title,
    description: meta.description,
    category: meta.category,
    published: meta.published,
    lastReviewed: meta.lastReviewed,
    html,
  };
}

export function getAllGuides(): Guide[] {
  return readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(loadGuide)
    .sort((a, b) => (a.published < b.published ? 1 : -1));
}

export function getGuide(slug: string): Guide | undefined {
  return getAllGuides().find((g) => g.slug === slug);
}
