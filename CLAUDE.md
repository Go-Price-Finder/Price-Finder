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
  changes happen through this repo via GitHub.
- **`claude/` in this repo is the single source of truth for project docs.**
  **This reverses the earlier rule** (2026-08-06 – 2026-08-16), which made the
  Claude Project canonical and treated `claude/*.md` as a periodically
  re-exported snapshot. It is the other way round now: a Claude Project
  knowledge base holds *uploads*, and an upload is a copy taken at a moment in
  time. It cannot pull, it does not know when the repo moves, and nothing
  signals that it has fallen behind. The repo can be diffed, has history, and
  every change arrives with a commit message explaining it.
  - If a Project copy and the repo copy disagree, **the repo wins** — reconcile
    by re-uploading from the repo, never by editing the repo to match an upload.
  - Docs are edited here and committed, like code. Same fix → verify → review →
    push rule.
  - Reconciled 2026-08-16 before an account move. The repo was ahead of the
    Project in five separate places in `post-import-verification-runbook.md`
    alone — an added step 8 assertion, an ISR→Static correction, two whole
    sections on the commit-on-device reversal, a category-collision recount and
    a never-paste-SQL note. Each divergence was deliberate and recorded at the
    time; none of that stopped the two copies drifting apart, which is the
    argument for having one authority rather than a convention about who
    remembers to sync.
  - **There were TWO Cowork Projects**, with overlapping but non-identical
    document sets — 14 unique docs across them, 8 shared (counts reported by
    the operator during the 2026-08-16 reconciliation; not independently
    verifiable from here, since a Claude Project cannot be read from a Claude
    Code session). That is why `price-finder-build-guide-2026-08-05.md` looked
    repo-only when checked against one Project: it was present in the other.
    **The repo is now the union of both, and the single authority.** Two
    partially-overlapping sources with no diff between them is the concrete
    argument for the rule above — nobody was wrong about their own copy, and
    the sets still disagreed.
  - Deliberately NOT in `claude/`, so nobody re-adds them "for completeness":
    `claude-team-cowork-and-code-setup-checklist-2026-08-06.md` (written
    mid-session before several things were known, superseded twice; stale setup
    instructions are worse than none). Conversely
    `price-finder-build-guide-2026-08-05.md` exists here and NOT in the Project
    — it defines the Step 10–16 numbering the migration plan depends on, so it
    must not be deleted to make the two sets match.

# Database rules

Everything in this section applies to Supabase/Postgres work specifically.
The general workflow rules above still apply on top of it.

- **`supabase/migrations/` CANNOT currently rebuild production, and the
  folder's convention implies a reproducibility it does not have.** Migrations
  `0001`-`0003` predate migration tracking and are absent from Supabase's
  recorded history (`supabase_migrations.schema_migrations` starts at
  `0004_add_real_partner_retailers`), so replaying the folder from scratch onto
  an empty database fails at the first foreign key to `public.users` or
  `public.products`. **Supabase branch creation is therefore unavailable** —
  `create_branch` replays recorded history, which is missing those three.
  Do not assume this folder is a disaster-recovery artifact; today it is a
  change log, not a rebuild script. Reconciling it means verifying that the
  `0001`-`0003` files match what was actually applied pre-tracking, which
  nobody has done. Until then a loud failure is the correct behaviour: it beats
  a branch that builds and silently differs.
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
- **Apply generated SQL via the Supabase MCP tools or a runner script — never
  by pasting it into the browser SQL Editor — whenever byte fidelity matters.**
  The browser silently normalizes U+00A0 (non-breaking space) to a plain
  U+0020 on paste. Measured 2026-08-11: 116 NBSP characters present in the
  AWIN source feed, in `lib/king-koil-data.ts`, and in the generated backfill
  SQL arrived in Postgres as ordinary spaces — every stage of the pipeline was
  faithful except the paste. Nothing errored; 29 rows just quietly differed
  from their source. **Treat any backfill that was applied by pasting as
  suspect for character-level fidelity**, including the 295-row completion run
  done that way. Only king-koil was hit because it is the only partner whose
  source feed contained NBSP at all — that is luck, not safety. Note the shape
  of the corruption: em-dashes, en-dashes, CJK brackets, emoji and `™` in the
  same rows all survived intact, so this is **not** a general encoding failure
  — it is specific to NBSP and plausibly other whitespace-class characters,
  which is exactly why it is invisible on screen and slips past review.
- **A hand-maintained array carries an ordering the schema does not. Any
  collection migrated out of one needs an explicit order column, and the
  verification must assert sequence, not just set membership.** The order in a
  TypeScript array literal is real, curated, and rendered — but it survives
  nowhere once the rows are in Postgres, which returns them in whatever order
  it likes. Nothing fails; the pages just quietly render in a different order,
  and only where something reads position (`.filter().slice(n)`, a non-total
  sort comparator, a "first N" list). Two collections in this project turned
  out to carry one: `partners` (fixed by 0009's `display_order`) and
  `catalog_products` (fixed by 0010's `sort_order`). Assume the next one does
  too until checked. **Set-equality checks cannot detect this** — comparing
  sorted ids passes with the order completely scrambled, which is exactly how
  the second instance stayed invisible through 25 green checks while 476 pages
  rendered the wrong related products. Full evidence in
  `claude/catalog-search-onboarding-migration-scope-2026-08-03.md`, Section 5.

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
