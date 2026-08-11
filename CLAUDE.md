@AGENTS.md

# Context and continuity

**The conversation is disposable. The repo is the memory.** Anything a future
session would need has to be in a committed file — a plan, a `claude/*.md` doc,
a code comment, a commit message. If it only exists in chat, treat it as already
lost, because from the next session's point of view it is.

- **Checkpoint at ~75–80% context, before taking on anything new.** Don't wait
  for auto-compaction to force it. By the time compaction runs, the specifics
  worth preserving — exact numbers, the thing that was tried and failed, the
  half-finished state — are precisely what gets summarized away.

- **Checkpoint format:** update the active plan file under
  `docs/superpowers/plans/` with:
  1. **Done and verified**, with commit SHAs.
  2. **In flight**, and its exact state — which branch, what's uncommitted,
     which checks have run and which haven't.
  3. **Open decisions waiting on the user**, stated so they can be answered
     without rereading the conversation.
  4. **Anything measured this session that isn't written down anywhere else.**
  Then commit it. An uncommitted checkpoint is not a checkpoint.

- **Write findings down when they're established, not at session end.**
  Measurements, corrections to earlier claims, and "we tried X and it didn't
  work" go into the docs immediately. This is not a tidiness preference — several
  findings this project now depends on came within one context window of dying in
  a chat log, including the `unstable_cache` vs `"use cache"` round-trip counts
  and the payload numbers behind the ISR coupling condition in
  `claude/catalog-search-onboarding-migration-scope-2026-08-03.md`.

- **Starting a fresh session: read before acting.** Read this file, the active
  plan under `docs/superpowers/plans/`, and the relevant `claude/*.md` docs.
  Then **verify current state against the repo and the database rather than
  trusting the last summary** — including a summary written by a previous
  Claude session, and including this one. Run `git log`, `git status`, and
  `git branch` (branch, not just SHA — matching HEAD to a known commit is not
  the same as knowing which branch you're on). Query Supabase for real counts.
  In this project, reported state and actual state have diverged repeatedly:
  referenced files that never existed, dangling doc references, a workflow that
  had never run, and a commit that landed on the wrong branch. Checking costs a
  minute; not checking has cost hours.

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
- No Inter font — the codebase loads Schibsted Grotesk (body) and Fraunces
  (display) via `next/font/google` (see `app/layout.tsx`), exposed as the
  `--font-schibsted` and `--font-fraunces` CSS variables. Keep it that way;
  don't reintroduce Inter or add a third family without discussing it first.
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
- **Every database migration needs a matching hand-edit to
  `lib/supabase/database.types.ts`, in the same commit.** That file is
  *hand-maintained* — it carries explanatory comments tying each table back to
  the migration that created it and warning about wire-type traps (e.g. that
  Postgres `numeric` columns arrive as strings, not numbers). **Do not
  regenerate it**; `supabase gen types` would overwrite those comments with a
  machine dump and silently delete the reasoning. Add the new column by hand
  to `Row`, `Insert`, and `Update`, matching the column's nullability and
  default: a `NOT NULL` column with no default is required on `Insert` and
  optional on `Update`. Skipping this fails at **compile time**, not runtime —
  the typed PostgREST client resolves the whole `select` to `SelectQueryError`
  and `tsc` rejects every field access on it. That's the good outcome; it
  cannot reach production. Precedent: migration 0009 (`partners.display_order`)
  broke `tsc` immediately until the type was added.
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
  Treat this as the source of truth for the live codebase — actual code
  changes happen through this repo via GitHub. Planning, research, and
  documentation are maintained in the team's Claude Project as the
  live/canonical source. A point-in-time snapshot is also mirrored locally
  in claude/*.md (added 2026-08-06) so Claude Code can reference them
  offline without a Drive/Project connection — if these ever diverge, the
  Claude Project is authoritative, and this local copy should be
  periodically refreshed by re-exporting.

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
