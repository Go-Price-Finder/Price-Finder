# Guides route proposal — 2026-08-19 (PROPOSAL ONLY, nothing built)

For the first buying guide ("Should You Buy PC Parts Now or Wait?",
slug should-you-buy-pc-parts-now-or-wait, delivered 2026-08-19 as
markdown with frontmatter: slug/title/description/category/published/
lastReviewed).

## Current state
There is NO route pattern for editorial content. The four trust pages
(/about /contact /privacy /terms) plus /affiliate-disclosure are
hand-built JSX under app/<name>/page.tsx — operator-delivered text
converted to JSX per page, no markdown pipeline, no index. Fine for
five documents that change rarely; wrong shape for a growing guide
library (per-guide JSX conversion invites transcription drift from the
delivered text, and drift in editorial copy is a §23-class risk).

## Proposed routes
- content/guides/<slug>.md — the delivered files, VERBATIM, frontmatter
  as delivered. The .md file is the source of truth; no JSX rewriting
  of prose. Repo-committed (unlike the terms PDF: these are published
  content, not an external archive — the repo copy IS the publication).
- app/guides/page.tsx — index: title, description, category, published/
  lastReviewed dates, newest first. Static.
- app/guides/[slug]/page.tsx — generateStaticParams from the content
  dir; render markdown at build time.

Markdown rendering needs a dependency; two honest options:
- RECOMMENDED: `marked` (small, build-time only, HTML out) + render
  into the trust-page layout shell. No client JS added.
- Alternative: react-markdown (heavier, React-native rendering,
  per-page client cost unless RSC-only). Not preferred.
Either way: no remote fetching, no MDX (executable content in prose
files is a new attack/complexity surface we don't need).

## Metadata shape
- <title>: frontmatter title — Go Price Finder
- description: frontmatter description
- canonical /guides/<slug>
- Article JSON-LD: headline, description, datePublished (frontmatter
  published), dateModified (lastReviewed), author = Organization
  Go Price Finder, publisher likewise. NO author-person fabrication,
  NO star/review markup.
- og:type article.

## Sitemap
Two entries per guide plus /guides, lastmod = lastReviewed. Same
pattern as the trust pages' entries in app/sitemap.ts.

## Claims tripwire — YES, site-owned (agreeing with the operator)
Guide prose is the site speaking in its own voice; the closing
"What GoPriceFinder shows you today" section makes exactly the /about
class of claims and must sit under the same banned-phrase list.
Mechanics: scripts/check-rendered-claims.mjs scans TOP-LEVEL
.next/server/app/*.html only; guides render into a guides/ SUBDIR, so
the check must be extended to include .next/server/app/guides/**.html
when the route ships (one-line change; noted here so it ships WITH the
route, not after — a §19b-class gap otherwise). Route-scoped allowlist
covers guide-specific legitimate uses; the delivered guide deliberately
QUOTES urgency language ("limited stock" as an example of noise) — if
that phrase is ever banned, guides/<slug>.html gets an allowlist entry
with the quote-context reason.

## Claim check of the delivered guide (§23 method, pre-build)
- Closing section mirrors /about's corrected text (recording daily,
  charts not live, "rather tell you that") — PASSES, by construction.
- "We track prices daily across the merchants in our catalogue" — the
  standing brooklyn-delhi caveat applies (29 products feedless, never
  re-checked); same formulation already accepted on the homepage where
  the per-listing as-of label carries the exception. Acceptable.
- Market claims (60% Q2 rise; 13–18% / 10–15% Q3 forecasts) are sourced
  to Tom's Hardware/TrendForce with links and dated "as reported
  August 2026", with an explicit honest-limits section. Attribution is
  the right shape; the numbers are the sources' claims, not ours.

## Not built pending operator approval of: route shape, `marked`
dependency, and the tripwire extension shipping in the same change.
