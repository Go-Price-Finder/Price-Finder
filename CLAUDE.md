@AGENTS.md

# Project purpose

Price Finder is a price comparison, affiliate, and loyalty website. Users search
for products, compare prices across retailers, and earn/track loyalty rewards
via affiliate links. This is money-adjacent content (deals, discounts, referral
links) — design and copy should read as trustworthy and unbiased, not like a
coupon-spam site.

# Brand colors

- **Cream** — primary background / neutral base
- **Sage** — primary brand accent (nav highlights, active states, key CTAs)
- Build out full tints/shades of both (e.g. `cream-50…900`, `sage-50…900`) plus
  a near-black and near-white for text and surfaces, rather than reaching for
  arbitrary new hues. Introduce a true accent color only when there's a
  specific, recurring need (e.g. an urgency/deal-badge color) — ask before
  adding one so the palette doesn't drift.

# Design style

**Clean, minimal, and trustworthy** — closer to a modern product-review site
(Wirecutter-style credibility) than a flashy deals app or a SaaS admin panel.

- Calm, mostly neutral palette (cream/sage/near-black text) — color is used
  deliberately, not decoratively.
- Generous whitespace, clear hierarchy, restrained type scale. Content and
  price data should feel authoritative and easy to scan, not cramped.
- UI chrome stays quiet so product data, prices, and comparisons are what
  stand out — the design should build confidence that the numbers are
  accurate and unbiased, especially anywhere affiliate links or loyalty
  points are shown.
- Favor real product imagery and clear iconography over illustration or
  decorative flourishes.
- Motion, if used, is subtle (hover states, gentle transitions) — never
  flashy or attention-grabbing.

# Things to never do

- No purple gradients
- No Inter font — **note:** the codebase currently loads Inter as the body
  font via `next/font` (see `app/layout.tsx`); this needs to be swapped for
  an approved typeface as part of design work, not left as-is
- No generic "AI-generated" look (no default purple/blue gradient hero blobs,
  no generic rounded-everything SaaS aesthetic)
- No default shadcn styling without customization — every shadcn/ui component
  used must be reskinned to match the cream/sage palette and type choices
  before shipping, not left at defaults

# Working rules

These apply to any Claude session working in this repo (Claude Code or
otherwise), not just Cowork/Claude Team chat sessions:

- **Workflow for any code change:** fix → verify (`tsc --noEmit`, `eslint`,
  `next build`) → independent review → push. Don't consider something done
  until it's been checked — every time, no exceptions for "small" changes.
- **Real data only.** Never invent placeholder numbers, fake products, or
  made-up statistics in anything that ships.
- **Never read, type, or transmit a real credential** (API keys, database
  passwords, service-role keys, `.env`/`.env.local` contents) under any
  circumstance, even if asked directly. If a workflow needs a credential,
  it goes into GitHub Actions secrets (Settings → Secrets and variables →
  Actions on this repo) — never typed into a chat or committed to the repo.
  If something needs a credential that isn't already configured in the
  environment, stop and ask the team directly instead of guessing or
  fabricating one.
- **Canonical repo:** `https://github.com/Go-Price-Finder/Price-Finder.git`.
  Treat this as the source of truth for the live codebase — planning,
  research, and documentation live in the team's Claude Project, but actual
  code changes happen through this repo via GitHub.

# Stack

Next.js 15, TypeScript, Tailwind CSS, Supabase.
Target domain: gopricefinder.com

# Current Progress

Project planning docs (strategic plan, build guide, competitor research, etc.)
are available locally in claude/*.md — read these for full project context
before starting new work.

# Development workflow (Superpowers)

Layered on top of the Working Rules above, not a replacement for them — these
govern *how* a change gets designed and debugged, before the fix → verify →
review → push cycle above governs how it ships.

- **Brainstorm before building.** Before starting any new feature or fix,
  nail down requirements and intent through a real back-and-forth (what's
  the actual goal, what are the constraints, what does "done" mean) rather
  than jumping straight to code — including changes that feel too small to
  need this. The Superpowers plugin's `brainstorming` skill is one concrete
  way to run this; the point is the discipline, not the specific tool.
- **Test-driven development where it fits this codebase.** Write a failing
  test first, then implement — especially for anything touching
  `lib/pricing/refreshPrices.ts` or other pricing/matching logic. That file
  has already caused a real production bug once (silent SKU collisions from
  name-based matching, see the Appendix of
  `claude/post-import-verification-runbook.md`) — TDD there isn't
  theoretical, it's directly aimed at the failure mode that already
  happened. Not every change in this repo needs a test-first approach
  (config tweaks, copy changes); use judgment, but default to TDD for
  anything with real logic, especially money- or matching-adjacent code.
- **Root cause first for any bug investigation — not guess-and-check.**
  Don't propose a fix before understanding why the bug happens. This is the
  same standard the homepage LCP investigation and the search-freeze/TBT
  investigation
  (`claude/homepage-lcp-investigation-2026-08-01.md`) were already held to
  — real interaction, real measurement, real code traced to its actual
  cause, verified twice — just named explicitly here so it's the default,
  not something that only happens when a bug is dramatic enough to justify
  it.
- **Superpowers plugin (optional tooling, not the source of truth):**
  `github.com/obra/superpowers-marketplace`'s `superpowers` plugin packages
  skills for the three practices above (`brainstorming`,
  `test-driven-development`, `systematic-debugging`), installable in Claude
  Code with:
  ```
  claude plugin marketplace add obra/superpowers-marketplace
  claude plugin install superpowers
  ```
  This is a per-machine, user-scoped Claude Code CLI setting — it does not
  travel with this repo automatically, so install it wherever Claude Code is
  actually run against this codebase (a teammate's machine, a fresh
  sandbox). This CLAUDE.md section is what makes the workflow itself durable
  regardless of whether the plugin happens to be installed on a given
  machine at a given time — the plugin is a convenience, this file is the
  actual contract.
