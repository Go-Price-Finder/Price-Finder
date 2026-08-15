# Price Finder — Step-by-Step Build Guide (Complete)

## A real-data price comparison platform, built with Claude Code

*Last updated: August 5, 2026*

## Before You Start — Read This First

This guide replaces a generic template with the real, as-built history of Price Finder (gopricefinder.com), plus concrete, copy-paste-ready build steps for everything still ahead. It exists so a new teammate can pick up exactly where the project stands — what's shipped, what's in progress, and what to build next, in what order.

A few working habits that have shaped this project, worth carrying forward:

- Every code change goes through a fix → verify (tsc --noEmit, eslint, next build) → independent review → push workflow before it reaches production.
- Real data only. No placeholder descriptions, no fabricated review scores, no guessed policy terms — if something isn't confirmed, it's flagged as unconfirmed rather than filled in.
- Credentials are never typed, read, or transmitted by an AI assistant working on this project, under any circumstance. If a tool needs a credential it doesn't already have configured, the AI stops and asks a human directly.
- "Trust but verify" applies to AI-reported results too — every fix claimed to be shipped gets independently re-diffed against the live commit, not just trusted from a summary.
- Every partner import follows a standard runbook (data integrity checks, live-site verification, image checks, deep-link checks) before being reported as done — see claude/post-import-verification-runbook.md.

---

## PART 0 — Accounts & Tools

### Step 1 — Service accounts (already created)

Core infrastructure:
- GitHub — github.com (repo: kawsar0990a/Price-Finder)
- Vercel — vercel.com (hosting, cron jobs, analytics; team "Price Finder", project "pricefinder")
- Supabase — supabase.com (Postgres database, auth-ready, row-level security)

Partner data:
- AWIN — awin.com (affiliate network powering all 6 live partner catalogs and the daily price-refresh pipeline)
- Rakuten Advertising — rakutenadvertising.com (researched, not yet joined — see the To-Do sheet)

Business/collaboration:
- Google Workspace — recently created, domain verification with Vercel in progress
- Anthropic / Claude — Claude Code for local work, Claude in Cowork for cloud-based work

Not yet connected, needed before the cashback build-out (Part 3 below):
- Resend — resend.com (transactional email: price alerts, cash-back notifications)
- Gmail/Calendar connectors — for managing partner-outreach correspondence

See the "Price Finder — Accounts & Passwords" sheet for the full list with links (passwords intentionally left blank — never stored by the AI).

### Step 2 — Local tools

The repo is developed both from a local Windows machine (E:\Price Finder) and from cloud Claude Code sandboxes. Standard setup on any new machine:

```
# Node.js 20+
nvm install 20 && nvm use 20

# Claude Code
npm install -g @anthropic-ai/claude-code

# Verify
node --version
claude --version
git --version
```

### Step 3 — Clone the repository

```
git clone https://github.com/kawsar0990a/Price-Finder.git
cd Price-Finder
npm install
```

Note: pushing to origin/main currently only works from Kawsar's local machine's stored git credentials — a cloud sandbox can clone and read but not push without credentials being supplied directly by a human (never typed/read by the AI). See the "How We Work Together" section at the end of this guide.

---

## PART 1 — Foundation (built, July 2026)

### Step 4 — Core site + first partner integration

The site started as a working Next.js 15 (App Router) + TypeScript + Tailwind CSS price-comparison site, with the first real partner (Brooklyn Delhi, 29 products) fully wired: static per-partner data files, category pages, product detail pages, and a working search.

### Step 5 — Partner compliance gate (July 26)

Before any partner's products can be imported or shown, they now pass a two-stage compliance check:

- Import time (scripts/import-partner.mjs) — refuses to write any files for a partner that hasn't passed AWIN terms review.
- Render time (lib/partners.ts) — the list every page reads from is filtered through isPartnerLive(), so even if a partner's data somehow ended up in the codebase without compliance, the site still won't display it.

Partner-specific restrictions (image usage permission, no-plagiarism requirements, excluded SKUs) live in one registry file (lib/partner-compliance.json) and are picked up automatically by both enforcement points.

### Step 6 — Scale up partner catalog (through early August)

Five more partners onboarded and verified live: EVDANCE (72), Golden Maple (348), Canvas Vows (204), King Koil (29), Tsar Bomba (272) — 954 products total across 6 partners. A standard import-and-verification runbook was written (claude/post-import-verification-runbook.md) after a real incident where a partner's products were fully built but never actually wired into the site's product registry — now a checklist item every import explicitly confirms.

### Step 7 — Live daily pricing pipeline (August 2)

A Vercel scheduled job refreshes partner prices daily from AWIN's live feed and records price history, powering the price-history charts and price-alert features. Getting this right took three rounds of fixes to correctly match live feed rows to catalog products by AWIN's merchant product ID rather than by name (name-matching silently collapsed distinct product variants onto one price — caught and fixed before it affected many products).

### Step 8 — Homepage performance investigation (August 1)

Real visitors reported the site felt slow to load. Real field data (Vercel Speed Insights) traced the cause to a homepage component pulling in the entire 1.5MB product catalog just to compute two small numbers, plus animation code leaving the headline invisible until that bundle loaded. Fixed by computing those numbers server-side — homepage First Load JS dropped from 369KB to 221KB, Lighthouse LCP from ~14.7s to ~3.5s locally. A related bug (a category-matching function redoing ~1,940 units of expensive text analysis per product) caused a 13+ second frozen tab on first search click — fixed with a 22x speedup.

### Step 9 — Product-page redesign + price history/alerts (early August)

Product pages now show a price-history chart and a "get notified of price drops" call-to-action. Shipped alongside a bundle-size fix (product pages had grown from 119KB to 260KB — isolated the price-formatting function into its own module, back to ~121KB).

---

## PART 2 — In Progress: Moving the Catalog to a Real Database

### Why

Product data currently lives in static files bundled into the site's code — any catalog change requires a full redeploy. This doesn't scale as more partners are added, and it blocks better search (the current in-browser search, Fuse.js, is a ~1.5MB payload with hand-tuned-but-imperfect typo tolerance). Full detail, schema, rollback plan, and effort estimate: claude/catalog-search-onboarding-migration-scope-2026-08-03.md.

### Step 10 — Schema (done)

Two new Supabase tables shipped: partners and catalog_products, the latter with a generated full-text-search column (search_vector) as the eventual replacement for Fuse.js. Verified end-to-end against a disposable local Postgres instance before touching production.

### Step 11 — Backfill live data (in progress)

Applying the new schema to the live Supabase project and loading all 954 products into it. Schema confirmed correct; roughly 60% of the product data loaded, rest in progress. Every insert is idempotent, and nothing on the live site reads from these tables yet — zero risk to what shoppers see today.

### Step 12 — Build the Supabase-backed data layer (not started)

Claude Code prompt to use when starting this step:

```
Create lib/catalog.ts exporting async versions of the same 9 functions
lib/partners.ts currently exports (getAllRealProducts, getPartner,
getRealProduct, getRealCategories, getCategoryBySlug,
getProductsByCategoryPath, getPopulatedCategoryPaths, getFeaturedDeals,
getBestSellers), backed by Supabase queries against public.catalog_products
and public.partners instead of the in-memory array. Same function names,
same return shapes, now async. Do not touch any call sites yet — this
step only builds the new module and verifies it against a handful of
manual test queries compared to the old lib/partners.ts output for the
same inputs.
```

### Step 13 — Decide and implement the rendering strategy (not started)

Recommendation from the migration scope doc: start with ISR (export const revalidate = <seconds>) on product detail pages, since that's the highest-value case for freshness (catches daily price-refresh writes without a redeploy). Category/listing pages can stay SSG initially and move to ISR later if needed.

### Step 14 — Cut over call sites (not started)

Move the ~30 call sites currently importing from lib/partners.ts to lib/catalog.ts, a few files at a time (e.g. one partner's product pages first), verifying in production before the next batch — matching the established fix-verify-review-push workflow. Keep lib/partners.ts and the static data files intact for one full release cycle after the last cutover, as a rollback path.

### Step 15 — Rebuild search on Postgres full-text search (not started)

Can run in parallel with Steps 12-14 since it's an independent read path. Claude Code prompt:

```
Replace lib/search.ts's Fuse.js index with a query against
catalog_products.search_vector using websearch_to_tsquery and ts_rank,
exposed via a Supabase RPC or a Next.js route handler. Budget real time
to compare ranking against Fuse's current behavior on the known
false-positive cases documented in lib/search.ts's comments (e.g. the
"achar" vs "Charging Adapter" collision) — Postgres FTS is stemming-based,
not edit-distance-based, so typo tolerance will differ and needs
re-tuning, not just a mechanical swap.
```

### Step 16 — Rewrite partner onboarding to write into Supabase (not started)

Deliberately last — writing new partners into an unproven table is a worse place to discover a schema problem than writing into an already-validated one. Modify scripts/import-partner.mjs's final step (today: generate a TS file, string-patch lib/partners.ts) to instead upsert rows into catalog_products/partners. Everything upstream (compliance gate, column mapping, validation, image download/resize) carries over unchanged.

---

## PART 3 — Building the Cashback Platform (business roadmap, not started)

Per the Strategic Growth Plan, this is the next major chapter after the catalog migration: turning Price Finder from a price-comparison site into a trustworthy cash-back/coupon platform, targeting three verticals (General Products — live, Gift Cards, Hotels). Full detail: claude/strategic-growth-plan-2026-08-02.md.

### Step 17 — Wallet & ledger schema

```
Design and migrate an append-only wallet/ledger system in Supabase:
a `wallet_transactions` table (user_id, amount, status: pending |
available | redeemed, source_vertical, related_click_id, created_at) —
never a mutable balance field. Balances are always computed by summing
transactions, never stored directly, so a bug can't silently corrupt a
balance. Include RLS so users only see their own transactions. This can
be built and migrated now, dormant (no activation flow calling it yet),
so Phase 2 doesn't start from zero.
```

### Step 18 — Click-tracking & redirect layer

```
Build an internal redirect route (e.g. /go/[offerId]) that records
which authenticated (or anonymous, cookie-tracked) user clicked which
partner offer, with a timestamp, before 302-redirecting to the real
affiliate deep link. This replaces today's direct-to-partner links.
Needed before any cash back can function, since it's the only way to
later match a conversion back to a specific user.
```

### Step 19 — Gift card cash back (Phase 2, part 1)

Join a standard gift-card affiliate program (self-serve, no special negotiation required per the strategic plan). Recommended model: flat cash back on face-value purchases (matching Price.com), not discount-resale arbitrage. Requires Steps 17-18 to exist first.

### Step 20 — Hotel cash back (Phase 2, part 2)

Join Booking.com and/or Expedia's self-serve affiliate programs. This is flagged in the strategic plan as the vertical with the clearest opportunity to out-build Price.com, since their own investment here looked thin.

### Step 21 — Conversion tracking & payout automation

```
Build polling or webhook-based ingestion of confirmed transactions from
each affiliate network (AWIN + whichever gift-card/hotel networks were
joined in Steps 19-20), transitioning wallet_transactions from pending
to available automatically, and an automated payout path (gift-card
disbursement API and/or direct cash payout API) rather than manual
processing. This is the direct fix for Price.com's most common
complaint (slow/missing payouts) — build it to be faster and more
transparent than the industry norm.
```

### Step 22 — Fraud detection & appeals

```
Add rules-based fraud checks (velocity limits, duplicate-account
detection, self-referral abuse) to the click-tracking/payout pipeline,
built alongside a real, visible appeals flow from day one — a user
should always be able to see why an action was flagged and contest it.
Price.com's worst reviews describe accounts silently deleted with no
explanation; this design must not repeat that.
```

### Step 23 — Local Store directory MVP

Lightweight "stores near you that carry this category" listing, no live inventory data. Deliberately simple — only build the real-time-inventory version later if the MVP proves users actually want it.

### Step 24 — Referral program + public trust/SLA page

Activate referral bonus payouts (structure TBD — see the To-Do sheet's open decisions) and launch a public-facing cash-back status/SLA page, the concrete embodiment of "win on trust" from the strategic plan's differentiation thesis.

### Step 25 — Coupons (conditional, last)

Only for compliance-cleared verticals/partners — some existing partners (e.g. Canvas Vows) explicitly restrict coupon-style behavior. Scheduled last because it adds scope, not because it's architecturally blocked.

---

## Quick Reference — Where Things Live

- Partner data (current, static): lib/partners.ts, lib/<partner>-data.ts
- Partner compliance registry: lib/partner-compliance.json, lib/partner-compliance.ts
- Price pipeline: lib/pricing/refreshPrices.ts, app/api/cron/refresh-prices/route.ts
- Search (current): lib/search.ts, components/SearchBar.tsx
- New catalog schema: supabase/migrations/0008_add_catalog_products.sql
- Backfill script: scripts/backfill-catalog-products.ts
- Partner import pipeline: scripts/import-partner.mjs
- Import verification steps: claude/post-import-verification-runbook.md
- Full migration plan: claude/catalog-search-onboarding-migration-scope-2026-08-03.md
- Business roadmap: claude/strategic-growth-plan-2026-08-02.md
- Competitor research: claude/price-com-competitor-research-2026-08-02.md

## Timeline Summary

| Stretch | Status |
|---|---|
| Foundation (Steps 4-9) | Done |
| Catalog migration schema + backfill (Steps 10-11) | In progress |
| Catalog migration data layer + cutover + search (Steps 12-16) | Not started |
| Cashback platform infrastructure (Steps 17-18) | Not started |
| Cashback v1: Gift Cards + Hotels (Steps 19-22) | Not started, ~6 months once started (per strategic plan Phase 2) |
| Local Store + Referral + Trust page (Steps 23-24) | Not started |
| Coupons (Step 25) | Not started, conditional |

---

## How We Work Together

- Verification workflow: every fix is built and tested in an isolated environment, verified (type-check, lint, production build), then independently re-verified by a second pass before it's pushed to origin/main.
- Credential handling: neither AI assistant working on this project will ever read, type, or transmit an actual password, API secret, or service-role key — if one is needed, the human provides it directly.
- Documentation: significant findings, decisions, and completed work get written up in the Price Finder Claude Project docs, so context isn't lost between sessions. This build guide and the accompanying To-Do and Accounts sheets are the partner-facing summary of that deeper documentation.

Questions on anything above — just ask; there's a much more detailed doc behind almost every section here.
