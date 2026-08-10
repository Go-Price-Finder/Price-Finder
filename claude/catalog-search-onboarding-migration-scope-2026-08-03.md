# Catalog / Search / Onboarding Migration — Detailed Scope

**Prepared:** 2026-08-03
**Context:** Detailed follow-up to `claude/website-redesign-scale-architecture-plan-2026-08-03.md`, Section 3 (the three ranked infrastructure blockers). That doc identified *what* needs to move and roughly *why*; this doc is the *how* — schema design, migration steps, rollback plan, and effort estimate — grounded in a direct code audit of `/tmp/Price-Finder` on 2026-08-03. This is a scoping document only. Nothing in the repo has been changed.

Sequencing recap from the prior doc, unchanged: **catalog storage → search → onboarding pipeline**, in that dependency order, even though onboarding is the most *urgent* blocker (it breaks first as advertiser count grows). You can't automate onboarding into a system that doesn't exist yet, so storage has to move first regardless of urgency.

## 1. What exists today (the migration's starting point)

The catalog is not a black box — it's a clean, well-organized static system, which is good news for migration risk. `lib/partners.ts` (539 lines) statically imports six per-partner data files (`lib/<partner>-data.ts`, together ~9,939 lines / ~1.47MB), normalizes them at module-load time into a `RealProduct[]` per partner via one shared `normalizeProduct()` function, and exposes nine accessor functions (`getAllRealProducts`, `getPartner`, `getRealProduct`, `getRealCategories`, `getCategoryBySlug`, `getProductsByCategoryPath`, `getPopulatedCategoryPaths`, `getFeaturedDeals`, `getBestSellers`) plus a `getProductTitleSuffix` helper and the `PARTNERS` constant itself. Thirty files across the repo consume these, but almost all of them go through this same narrow set of nine functions — the surface area is large in file count but small in shape, which matters a lot for how mechanical the migration can be.

A compliance gate (`lib/partner-compliance.ts` + `lib/partner-compliance.json`) sits in front of the catalog and is deliberately enforced twice — once at import time (`scripts/import-partner.mjs` reads the same JSON directly) and once at render time (`lib/partners.ts` filters `ALL_WIRED_PARTNERS` through `isPartnerLive()` to produce the `PARTNERS` array actually served). This dual-enforcement design is intentional (the file's own header comment explains it protects against a partner going non-compliant without a code change slipping through), and it currently has **zero representation in Supabase** — compliance today lives entirely in a checked-in JSON file. Any migration plan has to either keep that JSON file as the source of truth for compliance (simplest, least risky) or build a real `partner_compliance` table with the same dual-enforcement property (more consistent with "everything lives in the database" but real new work, including deciding whether RLS alone can replace the "two independent code paths" protection the current design deliberately has). Recommend keeping the JSON file for now — it's not the bottleneck, and moving it is optional work this migration doesn't need to take on.

Partner onboarding today (`scripts/import-partner.mjs`, 793 lines) is a real pipeline already — column-mapping against Awin-style CSV headers, per-row validation, slug generation with collision handling, image download/resize/re-encode via `sharp`, and self-verification via `tsc`/`eslint` — it just ends by generating and string-patching TypeScript source files instead of writing database rows. That's the one step this migration actually needs to replace; the rest of the pipeline's logic (compliance gate, column mapping, validation, image processing) carries over largely unchanged.

Search (`lib/search.ts` + `components/SearchBar.tsx`) is client-side Fuse.js over the full catalog, already identified in the prior LCP investigation as a ~1.47MB payload problem, currently mitigated (not solved) by deferring the import until first search interaction. The Fuse config has been hand-tuned twice against real false positives in the current catalog (documented in the file's own comments) — this tuning does not transfer to Postgres full-text search, which is lexeme/stemming-based rather than edit-distance-based, and won't reproduce Fuse's typo-tolerance the same way. This is flagged in the risk section below; it is not just a mechanical swap.

Supabase already has 7 migrations and a working pattern for service-role cron jobs overlaying live data on the static catalog (`current_prices`, `price_history`) via `lib/pricing/getEffectivePrice.ts`. But there's no existing precedent anywhere in the codebase for *rendering* a product or category page by querying Supabase — every page-level consumer reads the static in-memory array. Moving product/category pages to be database-backed is a genuinely new rendering pattern here, not an extension of an existing one. The good news: `next.config.ts` has no `output: "export"` and no page currently uses `revalidate`, so both SSR and ISR are fully available without any Next.js config change — the rendering-strategy choice is open, not blocked.

## 2. Target schema

Two new core tables, plus one optional table for the compliance question above.

**`public.partners`** — one row per partner (currently 6, encodes what's hardcoded across `ALL_WIRED_PARTNERS` today):
```
id            text primary key        -- e.g. 'tsar-bomba', matches today's partnerId
name          text not null
tagline       text not null
href          text not null
logo_url      text
created_at    timestamptz not null default now()
```

**`public.catalog_products`** — one row per product (replaces the six static arrays):
```
id                text primary key      -- '{partner_id}:{slug}', matches today's RealProduct.id
partner_id        text not null references public.partners(id)
slug              text not null
name              text not null
description       text not null
price             numeric(10,2) not null
original_price    numeric(10,2)
image             text not null
images            text[] not null default '{}'
category          text not null          -- partner's own raw subcategory string
parent_category   text not null          -- Walmart-taxonomy department, precomputed at write time
badge             text
rating_stars      numeric(2,1)
rating_count      integer
deep_link         text not null
variant_label     text
search_vector     tsvector generated always as (
                    setweight(to_tsvector('english', name), 'A') ||
                    setweight(to_tsvector('english', category), 'B') ||
                    setweight(to_tsvector('english', description), 'C')
                  ) stored
created_at        timestamptz not null default now()
updated_at        timestamptz not null default now()

unique (partner_id, slug)
index on (parent_category)
index using gin (search_vector)
```

Two design decisions worth calling out explicitly:

`parent_category` is stored as a plain column, computed once at write time (import or admin edit), rather than recomputed per request. Today `category-mapper.ts`'s `matchScore()` runs against 388 taxonomy leaves at normalize time and was itself the subject of a real performance bug (13-18 second blocking task) before it got memoized — that logic belongs in the write path (import script or a Postgres trigger/function), never in a per-request read path.

`search_vector` is a Postgres generated column, not something the application computes — this is what makes `to_tsquery`/`websearch_to_tsquery` search fast without a separate indexing step, and it's the direct replacement for Fuse's in-memory index. The three-tier weighting (name > category > description) mirrors Fuse's current 0.8/0.15/0.05 weight split as a starting point, not a guarantee of identical ranking behavior — see the search section below.

**`public.partner_compliance`** (optional, not recommended for this phase — listed for completeness): would mirror today's JSON file's ~20 fields per partner. Skip this initially; keep compliance in the JSON file and have the import path and any admin write-path both consult it, same dual-enforcement property as today, just against the file instead of a table. Revisit only if compliance data itself needs to change without a code deploy (it doesn't today — partners go active/inactive rarely enough that a deploy-gated JSON file is fine).

`current_prices` and `price_history` (migrations 0006/0005) don't change shape, but `current_prices`' purpose shifts: today it's an override layer on top of a static file's price; once `catalog_products.price` is itself live in the database, the refresh job can write directly to `catalog_products.price` (with `price_history` still recording the daily snapshot) and `current_prices` as a separate override table becomes redundant. That's a nice simplification this migration unlocks but isn't required to unlock it — safe to defer collapsing the two tables into a follow-up cleanup after the migration itself is stable.

## 3. Migration steps

Recommend an incremental, reversible sequence rather than a big-bang cutover — the existing static-array system keeps working at every step until the last one, so a bad step can be paused without an outage.

**Step 1 — Backfill, read-only.** Write a one-time script (extending the existing but partial `scripts/sync-products-to-supabase.ts`, which already proves `public.products`-shaped rows can be written — it just needs to target the new schema and cover all 6 partners instead of 2) that reads `getAllRealProducts()` from the *current* static system and inserts every row into `catalog_products`/`partners`, computing `parent_category` via the existing `category-mapper.ts` logic at write time. Nothing in the app reads from these new tables yet. This step is purely additive and carries no user-facing risk.

**Step 2 — Build a Supabase-backed replacement module with the same nine function signatures.** Write `lib/catalog.ts` (or similar) exporting `getAllRealProducts`, `getPartner`, `getRealProduct`, etc. — same names, same shapes, now `async` and backed by Supabase queries instead of the in-memory array. Because 30 call sites already funnel through these nine functions, most call sites become a mechanical `const x = getAllRealProducts()` → `const x = await getAllRealProducts()` change. The one non-mechanical part: every `generateStaticParams` call site (11 of them, per the audit) is today synchronous over an in-memory array; Next.js supports `async function generateStaticParams()`, but each one becomes a real DB round trip at build time instead of an array read, which is a genuine behavior and performance change worth load-testing before cutover, not just a type change.

### Step 3 — Rendering strategy — **DECIDED AND COMPLETE 2026-08-09**

**Decision: keep pages fully static (SSG), with `unstable_cache` wrapping the
catalog fetch. No ISR.**

**~~Recommendation: move to ISR (`export const revalidate`), adopted
per-route-group, starting with product detail pages.~~ — SUPERSEDED by
measurement.** Recorded rather than deleted: the reasoning was sound given what
was known; the *premise* was wrong, not the logic.

---

#### ⚠ Condition on this decision — read before flipping any route to ISR or dynamic

**This decision and `getRealProduct()`'s query shape are coupled. Changing one
without the other causes a severe regression.**

As part of Step 4, `getRealProduct()` changes from issuing its own queries to
reading from the cached `fetchCatalog()` snapshot. That is the right call **only
because the static-rendering decision makes every `getRealProduct` call happen at
build time**, where one shared snapshot serves all 954 products.

**The original single-row query is CORRECT for request-time rendering, and was
never a mistake.** Measured, per product page:

| | Payload | Latency |
|---|---|---|
| Single-row query | **1.6 KB** | **71 ms** |
| Full catalog snapshot | 1610 KB | 499 ms |

At request time, fetching the whole catalog to render one product is a **993×
payload regression**. The single-row query only looks wasteful under the
static-rendering decision, because static generation turns "one small query per
request" into "1392 small queries per build" — and the snapshot amortises across
all of them.

**Therefore: if any product route is ever switched to ISR or dynamic rendering,
the single-row query must be restored for that route, or it regresses 993× on
payload and ~7× on latency.** This is not a detail to rediscover from a code
comment after the fact — it is a condition attached to the rendering strategy
itself, which is why it sits here in the decision record.

**A live instance already exists — this is not a hypothetical.** Three routes are
already `ƒ` (Dynamic) today, `/search` among them. For those the static-rendering
premise never held, so they must **never** be migrated to read from the snapshot:
doing so would put a 1610 KB catalog fetch on a request-time path, and for
`/search` that is *per user search* — the worst case of the three. The Step 14
plan (`docs/superpowers/plans/2026-08-09-step-14-call-site-cutover.md`) excludes
all three from migration at Batch 6 for exactly this reason. So read the
condition above as a rule that already has an exception set, not as a future
risk: the question "does this route render at request time?" has to be asked of
every call site *before* it is cut over, not only when someone later proposes
flipping one to ISR.

**On the code comment:** the original comment on `getRealProduct()` explaining
why it issues a targeted single-row query **was correct for the world it was
written in** and should be *rewritten, not deleted*. The new comment should state
the condition — that reading from the snapshot is correct *because* this route is
statically generated, and that request-time rendering requires the single-row
query back. Deleting it would erase the reasoning and invite someone to "fix" the
snapshot read into a request-time path.

---

#### Measured evidence

Instrumented round-trip counts on `/golden-maple/[slug]` — 348 pages, with both
`generateStaticParams` and the page body converted to the Supabase path:

| Variant | Catalog round trips | Build time |
|---|---|---|
| No cache | 349 | 38.6s |
| **`unstable_cache`** | **1** | **38.6s** |
| `"use cache"` | 17 | 39.0s |

`"use cache"` caches per worker process, and the build fans out across 12
workers — hence 17 rather than 1. Not broken, just a worse fit here.

These counts are **catalog fetches only**, not the build's total query count.

#### Correction 1 — the build-speed premise was wrong

**The earlier ~99s build-regression projection was wrong, and the error is worth
naming precisely: it assumed sequential execution.** Next.js fans page generation
out across 12 worker processes, so 349 round trips cost approximately **zero**
wall-clock time. Build time is identical — 38.6s — with and without the cache.

**So: caching here is a database-load and snapshot-consistency win, NOT a
build-speed win.** Stated explicitly because the wrong premise invites the wrong
fix: someone will eventually benchmark the cache wrapper, see no build-time
difference, and remove it as dead weight. It is not dead weight. What it buys:

- **Database load:** see the query-count table below.
- **Snapshot consistency:** every page in a build renders from *one* read of the
  catalog, so a daily `refresh-prices` run landing mid-build cannot produce a
  deployment with pre-refresh prices on some pages and post-refresh on others.

If anyone proposes removing the cache on build-speed grounds, the answer is that
build speed was never the argument.

#### Correction 2 — `getRealProduct()`, measured and resolved

`getRealProduct()` does not call `fetchCatalog`. **Measured: it issues two
queries per call** — one against `catalog_products`, then one against `partners`
for the partner name — **and is called twice per page** (`generateMetadata` and
the page body). For Golden Maple: **348 × 2 × 2 = 1392 queries**, entirely
uncached in all three variants above, dominating the build's query count. It was
missing from the original analysis altogether.

**The earlier "696, possibly halvable with React `cache()`" open question is
resolved and moot.** The count was 1392, not 696 — and `React.cache()` is not the
answer, because **Step 4 removes these queries rather than deduplicating them**.
Deduping two calls into one still leaves a per-page query; reading from the
snapshot leaves none.

#### Build query totals — state the shipped number, not the interim one

| State | Queries per build | Ships? |
|---|---|---|
| No caching | ~1741 (349 + 1392) | no |
| `fetchCatalog` wrapped only | **1394** (2 + 1392) | **no — interim** |
| `fetchCatalog` wrapped **+ `getRealProduct` reading the snapshot** | **2** | **yes** |

**Only the last row is the shipped state.** Step 4 folds both changes in
together, so "`fetchCatalog` wrapped only" is a state this codebase passes
through during development and never deploys. Quote the **2**, and mention 1394
only to explain why the intermediate benchmark looked underwhelming.

**~~"~697 queries per build with `unstable_cache`."~~ — SUPERSEDED.** That figure
was derived from the earlier estimate of 696 `getRealProduct` queries. The
measurement in Correction 2 replaced 696 with 1392, so the same correction moves
this total to **1394**. Recorded because ~697 appeared in earlier versions of
this doc and the build guide, and someone comparing notes will otherwise think
two measurements disagree — they don't; one is superseded.

**Folding `getRealProduct` in also fixes a latent correctness bug.** Today
`generateMetadata` and the page body issue *independent* queries for the same
product. If a catalog write lands between them, a page can ship with metadata
describing one version of a product and a body rendering another — the same class
of mid-build inconsistency the snapshot cache prevents at catalog level, but
per-page and currently unguarded. Reading both from one snapshot closes it.

#### Implementation note — `unstable_cache` requires JSON-serializable returns

`fetchCatalog` returns a `Map`, which does not survive `unstable_cache`'s
serialization. Split it: **cache the array fetch, rebuild the `Map` outside the
cached function.** The cache boundary sits at the plain data, with the derived
structure reconstructed on the near side. Small change, but it will look
arbitrary to a future reader without this note.

#### Accepted tradeoff

Fully static means catalog changes still require a redeploy — the limitation ISR
was meant to solve. Accepted deliberately: the daily `refresh-prices` cron
already writes to Supabase, and a daily deploy is a tolerable cadence for a
catalog changing at that frequency. Revisit only if freshness requirements
tighten (e.g. real-time stock), not on general principle — and if you do, read
the condition at the top of this section first.

**Step 4 — Cut over call sites in small batches, verify, then remove the old path.** Swap `lib/partners.ts` imports for the new `lib/catalog.ts` module a few files at a time (e.g. one partner's product pages first, verify in production, then the rest), rather than all 30 files in one commit — this matches the incremental-fix-verify-bundle-review-push workflow already established for the pricing pipeline work. Once every call site is migrated and verified, `lib/partners.ts` and the six static data files can be deleted (or kept read-only as a historical fallback for one release cycle before deletion — recommend keeping them one cycle, given how much of the site's rendering depends on this data being correct).

**Step 5 — Rebuild search on Postgres full-text.** Once `catalog_products.search_vector` exists and is populated (from step 1's backfill onward, since it's a generated column), replace `lib/search.ts`'s Fuse index with a query against `search_vector` using `websearch_to_tsquery` and `ts_rank`, exposed via a Supabase RPC or a Next.js route handler. This step depends on step 1 (data has to exist in the table) but not on steps 2-4 (search can be rebuilt against the new table while product/category pages still read the old static array, since they're independent read paths) — meaning search can actually be tackled in parallel with steps 2-4 rather than strictly after them, which shortens the critical path if useful.

  **`/search` is a request-time route — do not migrate `lib/search.ts` to the catalog module the way steps 2-4 migrate the page call sites** (measured 2026-08-09). `next build` reports `ƒ /search` (Dynamic): its only consumer, `app/search/page.tsx`, renders per request rather than at build. Step 3's whole premise — that a catalog read is free because it happens once at build time — does not hold here. A full-catalog fetch costs **1610 KB / 499 ms** versus **1.6 KB / 71 ms** for a single-row query, so routing `/search` through `getAllRealProducts()` would put 1.6 MB on *every user search*. Whatever replaces the Fuse index must be a narrow query (`websearch_to_tsquery` against `search_vector`, returning only matched rows), never a fetch-everything-then-filter. Note also that `components/SearchBar.tsx` is a client component whose `lib/search.ts` import is deliberately `import type` — dropping that `type` keyword would pull the catalog into the browser bundle and reproduce the 2026-08-01 LCP regression.

**Step 6 — Rebuild partner onboarding to write into Supabase.** Modify `scripts/import-partner.mjs`'s step 5/6 (today: generate a TS file, string-patch `lib/partners.ts`) to instead insert/upsert rows into `catalog_products`/`partners`. Everything upstream of that in the script (compliance gate, column mapping, per-row validation, image download/resize) carries over unchanged. This is deliberately last because it depends on the schema and the read path both being proven correct first — writing new partners into an unproven table is a worse place to discover a schema problem than writing into an already-validated one.

## 4. Rollback plan

Because steps 1-3 are additive (new tables, new module, no deletions), rollback at any point through step 3 is simply "stop using the new module, keep reading `lib/partners.ts`" — no data loss, no schema changes to undo. From step 4 onward (call sites actually cut over), rollback per-batch is a revert of that batch's commit, since `lib/partners.ts` and the static files are deliberately kept intact until step 4 fully completes. The only step with real rollback cost is step 6 (onboarding writing into Supabase) if it ships before the read path (steps 2-4) is fully cut over — recommend not doing that; the sequencing above already avoids it by putting step 6 last. Search (step 5) is naturally low-risk to roll back since it's an independent read path — reverting to Fuse is just re-enabling the old `lib/search.ts` import in `SearchBar.tsx`.

## 5. Risks worth flagging explicitly

**Search relevance regression.** Fuse's typo-tolerance and the two rounds of hand-tuning against real false positives in this specific catalog do not transfer to Postgres FTS automatically. Budget real time for re-tuning `ts_rank` weights and testing against the same known problem cases (e.g. the documented "achar" vs "Charging Adapter" collision) before treating step 5 as done — this is a functional-parity risk, not just a performance one.

**Build-time cost of async `generateStaticParams`.** Moving 11 `generateStaticParams` functions from in-memory array reads to DB round trips at build time changes build performance in a way that needs to be measured, not assumed — especially `getPopulatedCategoryPaths()`, already flagged in the existing code comments as expensive under the current architecture.

  *Measured 2026-08-09, and the answer was not the expected one.* Converting a partner's product route to read from the catalog produced **349 build round trips** and a clean build of **38.6s** — statistically identical to the 38.7s baseline, because Next fans prerendering out across 12 worker processes and the per-call latency overlaps. **Build time is not the risk this bullet anticipated.** The real costs are DB load and snapshot consistency: without caching, `generateMetadata` and the page body issue independent queries for the same product and can disagree if a catalog write lands mid-build. `unstable_cache` collapses it to **1 round trip** build-wide; `"use cache"` only reaches 17 (it caches per worker, not across them). Separately, `getPopulatedCategoryPaths()` is genuinely expensive — ~960 ms *per call* in `lib/catalog.ts` versus 897 ms cold / 0.73 ms warm in `lib/partners.ts`, which memoizes it — and **`unstable_cache` on the fetch does not fix that**, because the category mapping runs after the fetch returns. It needs its own module-level memo.

**Compliance gate has no DB representation.** Explicitly deferred in this plan (Section 2) rather than solved — flagging again here so it isn't silently forgotten if a future revision of this plan decides to move compliance into the database too.

**Catalog size/product-count discrepancy.** The audit found two different in-repo comments disagreeing on current product count (449 vs 956) — worth reconciling with a fresh count before backfill, mostly as a sanity check that the backfill script's row count matches expectations.

## 6. Effort estimate

Rough, not a commitment — sequencing matters more than the exact number here since steps 1-3 and step 5 can run in parallel with product-page-redesign-style work already underway.

| Step | Estimate |
|---|---|
| 1. Backfill script + schema migration | 0.5-1 day |
| 2. `lib/catalog.ts` replacement module (9 functions, async) | 1-2 days |
| 3. Rendering-strategy decision + implementation (start with product pages) | 1-2 days |
| 4. Call-site cutover in batches + verification | 2-4 days (spread across multiple review cycles, not continuous) |
| 5. Postgres FTS rebuild + relevance re-tuning | 1-2 days, plus real testing time against known false-positive cases |
| 6. Onboarding script rewrite (write path only) | 0.5-1 day |
| **Total** | **~6-12 working days of engineering time**, plus review/verification cycles between each step per the established workflow |

This does not include the compliance-table decision (deferred), collapsing `current_prices` into `catalog_products.price` (deferred cleanup), or building any admin UI for editing catalog rows directly in Supabase (not requested, not scoped here — today's only write path is the import script, and this plan preserves that).

## 7. Recommended next action

This is scoping, not a go-ahead to build. Suggest picking a starting point once ready: either step 1 (backfill, fully safe, zero app-facing change) as a low-risk way to start building confidence in the new schema, or step 5 (search rebuild) in parallel if search pain is felt sooner than storage pain. Both can start without touching any of the 30 call sites identified in Section 1's audit.

---

**Status update (as of 2026-08-05):** Step 1 (schema + backfill) is underway — the schema is shipped and confirmed correct on the live Supabase project; data backfill is roughly 60% complete (brooklyn-delhi, evdance, king-koil fully loaded; canvas-vows, golden-maple, tsar-bomba partial). Steps 2-6 have not been started. See `claude/awin-advertiser-research-notes.md` and the "Price Finder — Step-by-Step Build Guide (Complete)" doc for the fuller current-status picture.
