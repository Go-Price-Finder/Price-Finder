# Step 14 — Call-Site Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut every application call site from the static `lib/partners.ts` catalog over to the Supabase-backed `lib/catalog.ts`, in reversible batches, without changing rendered output.

**Architecture:** Fully static rendering (Step 13 decision). One `unstable_cache`-wrapped catalog fetch serves the entire build — measured at 1 round trip vs 349 uncached. Call sites migrate partner-by-partner, smallest first; `lib/partners.ts` and the six static data files stay untouched and importable until the final batch, so any batch reverts with a single `git revert`.

**Tech Stack:** Next.js 15.5.20 (App Router), TypeScript, `@supabase/supabase-js`, `unstable_cache` from `next/cache`, Vercel, Node 24.

## Global Constraints

- **Rendering strategy is fully static.** Every product/category/listing route stays `●` (SSG) or `○` (Static). Do not add `revalidate` or `dynamic` exports to any migrated route.
- **`unstable_cache` only.** `"use cache"` is rejected — measured 17 round trips (per-worker) vs `unstable_cache`'s 1 (build-wide).
- **`unstable_cache` requires JSON-serializable returns.** `Map` does not survive it. Cached functions return arrays; `Map` is rebuilt outside the cache boundary.
- **No behavior change.** Rendered HTML, metadata, JSON-LD, and page counts must be byte-identical before and after each batch, except where a fix is explicitly called out.
- **Page count must stay 1043** after every batch (1018 from `generateStaticParams` + 25 static).
- **Never import `lib/partners.ts` from a client component.** A single named value import pulls all six data files (~1.47MB) — this caused the 2026-08-01 homepage LCP regression. Type-only imports (`import type`) are erased and safe.
- **`lib/partners.ts` and `lib/<partner>-data.ts` are read-only until Batch 7.** No deletions, no edits, no re-exports removed.
- **Credentials:** `next build` reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Locally Next loads `.env.local` automatically. Standalone scripts need `npx tsx --env-file=.env.local`.
- **Verification is non-negotiable per CLAUDE.md:** `tsc --noEmit` → `eslint` → `next build` → review → push, every batch, no exceptions.

---

## ⚠️ Contradictions found against the docs — read before starting

These were found while building the inventory for this plan. Each one invalidates part of the migration scope doc as written.

**1. "~30 call sites funnel through 9 functions" is right on count, wrong on shape.**
30 files import `lib/partners.ts` (27 app/lib + 3 scripts). But **four imported symbols are not among the 9 functions** `lib/catalog.ts` provides:

| Symbol | Kind | Files | `lib/catalog.ts` equivalent |
|---|---|---|---|
| `PARTNERS` | const array | `app/page.tsx`, `app/sitemap.ts`, `components/OurPartners.tsx` | **none** — only `getPartner(id)` |
| `getProductTitleSuffix` | function | 4 `[slug]` pages | **none** |
| `slugifyRealCategory` | function | 4 pages | **private duplicate**, not exported |
| `RealProduct`, `Partner`, `RealCategory`, `CategoryPathResult` | types | many + `lib/catalog.ts` itself | **none** — defined in `partners.ts` |

Task 1 closes all four gaps. Without it, batches 1–5 cannot compile.

**2. `lib/catalog.ts` imports its own types *from* `lib/partners.ts`** (`lib/catalog.ts:50-55`). The replacement module depends on the module it replaces. **`lib/partners.ts` can never be deleted** until these types move to a neutral home. The scope doc's "delete after one release cycle" is not achievable without this step; Task 1 handles it.

**3. Three partner landing pages import `*_CATEGORIES` from the data files** — a curated, *hand-ordered* category list (`app/brooklyn-delhi/page.tsx`, `app/evdance/page.tsx`, `app/king-koil/page.tsx`). `catalog_products` stores `category` per row but **preserves no ordering**. Deriving this from the DB changes on-page category order unless the order is reproduced. This is a genuine data gap the scope doc does not mention. Task 2 addresses it; if the order cannot be reproduced faithfully, **stop and escalate** rather than shipping a silent reordering.

**4. `getPopulatedCategoryPaths()` in `lib/catalog.ts` is unmemoized and costs ~960ms *per call*** (measured), versus `lib/partners.ts`'s 897ms cold / 0.73ms warm. `unstable_cache` on `fetchCatalog` alone does **not** fix this — the category mapping runs after the fetch. Task 3 memoizes it explicitly.

**5. THREE runtime (non-build) call sites exist and should NOT migrate — including one I initially planned to.** `lib/pricing/refreshPrices.ts` and `lib/pricing/getEffectivePrice.ts` call `getAllRealProducts()` from **cron handlers**. And `lib/search.ts` is consumed by `app/search/page.tsx`, which the build reports as **`ƒ /search` (Dynamic)** — it renders per request.

Migrating any of the three puts a 1610 KB catalog fetch on a request-time path. For `/search` that is *per user search*, which is the worst case of the three. This is the same coupling Step 13 identified for `getRealProduct`, applied to a route that is already dynamic today — the static-rendering premise never held for it. Batch 6 excludes all three.

**6. `components/SearchBar.tsx` is a client component importing from `lib/search.ts`** — currently `import type { searchRealProducts as SearchRealProducts }`, which is type-only and therefore erased at compile time and safe. It is one keystroke from unsafe: dropping the `type` keyword would pull the catalog into the browser bundle, reproducing the 2026-08-01 LCP regression. Batch 5 Step 6's bundle-size check is the guard.

**7. There is no Step 13 decision record document.** `grep -rl "Step 13"` matches only `claude/price-finder-build-guide-2026-08-05.md`. The Step 13 findings — including the ISR/`getRealProduct` coupling — currently live only in conversation. **This plan is not a substitute for that record.** Write it before Batch 1, or the 993× ISR regression condition is undocumented the moment this plan is closed.

---

## ✅ Checkpoint — 2026-08-11 (read this before resuming)

**Foundation complete. Tasks 1–5 all done; Batch 1 is unblocked.** State as of `7445ada`; `main` clean and in sync, CI green.

### Done and verified

| Item | Commit | Notes |
|---|---|---|
| **Task 1** — extract shared types | `85da16f` | `lib/catalog-types.ts`; `lib/catalog.ts` no longer imports `lib/partners.ts` at all. Unblocks the Batch 7 deletion gate. |
| **Task 2** — missing exports | `d84ef06` | `getProductTitleSuffix` (async — it was never pure), `getPartnerCategories`, `slugifyRealCategory`. `getPartners()` landed earlier in `cee0c17`. |
| **Task 3** — memoize category mapping | `940b69a` | ~960 ms → 0.8 ms on calls 2+. Caches the **promise**, not the array — the function is async, so an array cache would let concurrent callers both recompute, which is exactly what the build does. |
| **Task 4** — `unstable_cache` + snapshot fold | `55e906f` | **1394 build queries → 2**, measured at the HTTP layer. `getRealProduct` reads the snapshot; its comment carries the 993× ISR condition. |
| **Task 5** — query guard + CI credentials | `42bbe53` | `scripts/check-build-queries.mjs`; anon Supabase creds on the Build step only. **CI green.** |
| **Migration 0009** — `partners.display_order` | `cee0c17` | Applied. |
| **Migration 0010** — `catalog_products.sort_order` | `19958e8` | Applied. |
| Verify-script repair after Task 4 | `ae154b4` | `unstable_cache` broke the script outside a Next context; `scripts/_next-cache-shim.ts` restores it. |
| Full 16-field comparison | `dc2d762` | Caught the NBSP divergence. |
| NBSP data fix + paste rule | `7445ada` | See below. |

### The catalog now matches the static arrays byte-for-byte

**38 PASS / 0 FAIL** — all six partners, **954 products × 16 fields**, plus sequence and set assertions.

**Batch 1 is the first batch where "no behaviour change" can be proven rather than assumed.** Every earlier point in this migration had at least one unmeasured difference sitting underneath it.

### Three verification blind spots, each found the hard way

Each was discovered *by the bug it failed to catch*, not by review. The pattern is worth more than the individual fixes:

1. **Ordering not stored.** The static arrays carried a curated order the schema didn't. Products diverged for 3 of 6 partners, already changing related-product selection on 476 pages. Fixed by 0009/0010.
2. **Sequence not asserted.** Every check routed through a `sortedIds()` helper that sorted both sides first, so the suite was order-insensitive *by construction* and passed 25/25 with that divergence live. Fixed by adding `orderedIds()` plus flat and per-partner sequence checks.
3. **Field coverage accidental.** Check 3 compared 8 fields of 6 products; `description` was not among them. That hid the NBSP divergence. Fixed by full 16-field comparison of every product — 25 → 32 → 38 checks.

Common thread: **a check that compares a normalized or sampled view of the data cannot see differences the normalization or sampling removes.** Assert the thing you actually ship.

4. **Guard with no floor.** `check-build-queries.mjs` asserted a maximum only. On an incremental build Next reuses cached output and never re-runs data fetching, so the log has zero markers — and 0 passes a max of 2. Found on Batch 1: the first run reported 0, which reads as *the cache is working perfectly*. Fixed by asserting `1 <= hits <= max`, and by requiring `rm -rf .next` in the protocol.

5. **Guard measuring the wrong quantity.** The build-query guard capped catalog round trips at 2. At Batch 2 the real count was 3 — one per migrated route module, because Next runs each `generateStaticParams` in its own worker during "Collecting page data", before the shared cache is populated. All 1043 page renders made **zero** fetches, so the cache was working perfectly and the guard was about to fail every remaining batch. Fixed by splitting the assertion: render phase must be exactly 0, collect phase must equal the derived count of migrated param routes.

### The framing that covers all five

The first four instances **passed for the wrong reason**; the fifth would have **failed for the wrong reason**. Neither "too loose" nor "too strict" describes the family. What does: **the check was not measuring what its name claimed.** `sortedIds()` claimed to compare products but compared a normalized view; the field check claimed to compare products but compared 6 of 954; the query guard claimed to measure cache health but measured route-module count. Once stated that way the remedy is the same in every case — make the check's name and its measurement describe the same thing — and it applies whichever direction the check happens to be failing in.

### Two lessons from the fourth instance, both worth more than the fix

**Identifying a blind spot does not tell you which direction to tighten.** This is the first of the four where the diagnosis was right and the proposed fix would still have failed. Having seen the guard pass vacuously, the instinct was to tighten the *ceiling* — but **0 passes a max of 1 just as happily as a max of 2**, so the failure mode would have survived a fix aimed squarely at it. The gap was not that the bound was too loose; it was that the bound was on the wrong end. Before tightening a check that failed to fail, work out which direction the bad value actually escaped through — the answer is not always the one you were already looking at.

**A measurement can be defeated by the format of the thing measured, independently of whether the system under test is correct.** Counting products on the deployed landing page with `grep -c` returned **1**. The page was fine, the migration was fine, the count was wrong: `-c` counts matching *lines*, and minified HTML puts the whole document on one. The number was wrong in a way that looked plausible — a small integer where a small integer belonged — which is exactly the kind of wrong that gets believed and reported. `grep -o | sort -u | wc -l` gave the true 29.

**A test whose data source and comparison target are the same thing cannot fail.** Third instance, and it arrived one message after the previous lesson was written down. The proposal was to verify the repo's `supabase/migrations/*.sql` reproduce production by replaying them on a Supabase branch — but `create_branch` replays Supabase's own *recorded migration history*, not the repo files. The branch would have been built from production's history and then compared against production: green by construction, proving only that production equals itself, while the repo files it was meant to validate were never involved.

The tell was **structural, not empirical** — visible from the shape of the setup before running anything. No amount of care in executing that test would have surfaced it, because the flaw was in what the test was wired to, not how it was run. When designing a check, ask where each side of the comparison comes from: **if both sides trace back to the same source, the check is a tautology**, however elaborate the machinery in between. Same family as the query guard's missing floor and the `sortedIds()` normalization — a check that cannot distinguish the failure it exists to catch.

Note how it was caught: **by re-running it, not by any check.**

**Generalizing an unverified claim raises its apparent confidence without adding any support.** After the NBSP work I described numeric-over-the-wire as "a PostgREST property, not a column quirk" — upgrading a single reported observation into a general principle. I had never tested it. Measured later: PostgREST returns `numeric` as a JS **number** here, fractional values included, so the claim was false in both its specific and its general form. The generalization made it *sound* better established while the evidence behind it stayed at zero, and it was already propagating — into a code comment, a commit message, and the plan — before anyone checked. Promoting an observation to a rule is itself a claim, and it needs its own evidence rather than inheriting confidence from the instance that suggested it. Nothing in the suite covers the correctness of an ad-hoc measurement, and nothing can. The only defence is treating a surprising measurement as suspect until the measurement itself has been checked — the tool, the format, and the assumption connecting them — before concluding anything about the system.

### The NBSP episode (2026-08-11)

29 king-koil descriptions held U+0020 where the source had U+00A0. Traced rather than guessed:

```
AWIN source feed (_king-koil-feed-fresh.csv)   116 × U+00A0   (bytes c2 a0)
lib/king-koil-data.ts                          116 × U+00A0
scratch/backfill-catalog-products-*.sql        116 × U+00A0
public.catalog_products                          0 × U+00A0
```

Every stage faithful except the last — **the browser SQL Editor normalizes NBSP to a space on paste**. Not an encoding failure: em-dashes, en-dashes, CJK brackets, emoji and `™` in the same rows survived, which is why it was invisible.

**Resolution:** the DB was wrong and was fixed (one guarded `overlay()` via MCP, md5-gated, 29 rows). The static file was left alone — it matches the feed, and it is frozen until Batch 7. **Rule now in CLAUDE.md and the runbook: apply generated SQL via MCP or a runner script, never by pasting, when byte fidelity matters.** Any paste-applied backfill is suspect, including the 295-row completion run; king-koil was the only casualty because it was the only partner whose feed had NBSP at all.

### Decisions that must not be undone

1. **0010's backfill is a permutation + md5 fingerprint, not a `VALUES` list.** Safer, not just smaller: it `RAISE`s on a slug-set mismatch instead of silently misassigning.
2. **The JS re-sort by `displayOrder` in `fetchCatalog` is load-bearing.** The DB returns partner blocks alphabetically; the static array interleaves them in curated order. It lives inside the cached function so the ordering is baked into the snapshot.
3. **`getRealProduct` reads the snapshot only because rendering is static.** Flip any product route to ISR/dynamic and the single-row query must come back — 1.6 KB vs 1610 KB, 993×.
4. **The `unstable_cache` fallback was deliberately NOT added to `lib/catalog.ts`.** A library-level fallback would mean a real build silently doing 1394 queries if the cache went missing. Production fails loudly; scripts opt into `scripts/_next-cache-shim.ts`.

### Known residual risk

`mappedCatalogCache` (Task 3) sits **above** `unstable_cache` (Task 4), so once memoized a process never re-consults the cache. Demonstrated: after the stored snapshot changes, `getAllRealProducts()` sees it while `getPopulatedCategoryPaths()` does not. Unreachable today — `revalidate: false`, zero `revalidateTag`/`revalidatePath` call sites, every catalog route static so each build gets fresh processes. **Becomes live the moment a route is flipped to ISR** — third item on the ISR checklist.

### Next

Batch 1 (brooklyn-delhi, 29 pages). Per-batch protocol below applies in full; the suite is now 38 checks, not 25.

---

## Call-site inventory (verified against current HEAD `4a5b56f`)

### Group A — Product detail routes (6 files, 954 pages, 93% of all generated pages)
These import a per-partner data file **directly**, so they need rewiring, not an import swap.

| File | Pages | Imports from data file | Imports from `partners.ts` |
|---|---|---|---|
| `app/brooklyn-delhi/[slug]/page.tsx` | 29 | `BROOKLYN_DELHI_PRODUCTS` | `getAllRealProducts`, `getRealProduct` |
| `app/evdance/[slug]/page.tsx` | 72 | `EVDANCE_PRODUCTS` | `getAllRealProducts`, `getRealProduct` |
| `app/king-koil/[slug]/page.tsx` | 29 | `KING_KOIL_PRODUCTS` | `getAllRealProducts`, `getProductTitleSuffix`, `getRealProduct` |
| `app/canvas-vows/[slug]/page.tsx` | 204 | `CANVAS_VOWS_PRODUCTS` | `getAllRealProducts`, `getProductTitleSuffix`, `getRealProduct` |
| `app/tsar-bomba/[slug]/page.tsx` | 272 | `TSAR_BOMBA_PRODUCTS` | `getAllRealProducts`, `getProductTitleSuffix`, `getRealProduct` |
| `app/golden-maple/[slug]/page.tsx` | 348 | `GOLDEN_MAPLE_PRODUCTS` | `getAllRealProducts`, `getProductTitleSuffix`, `getRealProduct` |

### Group B — Partner landing pages (6 files, 6 pages)

| File | Imports |
|---|---|
| `app/brooklyn-delhi/page.tsx` | `getPartner`, `slugifyRealCategory` + `BROOKLYN_DELHI_CATEGORIES` |
| `app/evdance/page.tsx` | `getPartner`, `slugifyRealCategory` + `EVDANCE_CATEGORIES` |
| `app/king-koil/page.tsx` | `getPartner`, `slugifyRealCategory` + `KING_KOIL_CATEGORIES` |
| `app/canvas-vows/page.tsx` | `getPartner` |
| `app/golden-maple/page.tsx` | `getPartner` |
| `app/tsar-bomba/page.tsx` | `getPartner` |

### Group C — Paginated listing routes (3 files, 21 pages)
`app/canvas-vows/page/[page]/page.tsx` (5) · `app/golden-maple/page/[page]/page.tsx` (9) · `app/tsar-bomba/page/[page]/page.tsx` (7) — all import `getPartner`.

### Group D — Cross-partner routes (7 files, 68 pages)

| File | Pages | Imports |
|---|---|---|
| `app/category/[slug]/page.tsx` | 6 | `getCategoryBySlug`, `getRealCategories` |
| `app/category/[slug]/[...path]/page.tsx` | 37 | `getProductsByCategoryPath`, `getPopulatedCategoryPaths` |
| `app/categories/page.tsx` | 1 | `getAllRealProducts`, `slugifyRealCategory` |
| `app/page.tsx` | 1 | `getAllRealProducts`, `PARTNERS` |
| `app/deals/page.tsx` | 1 | `getFeaturedDeals` |
| `app/trending/page.tsx` | 1 | `getBestSellers` |
| `app/sitemap.ts` | n/a | `PARTNERS`, `getAllRealProducts`, `getRealCategories`, `getPopulatedCategoryPaths` |

### Group E — Components & shared lib (5 files)
`components/OurPartners.tsx` (`PARTNERS`) · `components/RealProductCard.tsx` (**type-only — safe, no change**) · `lib/structured-data.ts` (**type-only — safe**) · `lib/data.ts` (`getPartner`) · `lib/search.ts` (`getAllRealProducts`)

### Group F — Runtime/cron (2 files) — migration NOT recommended
`lib/pricing/refreshPrices.ts` · `lib/pricing/getEffectivePrice.ts` — both `getAllRealProducts`, both request-time.

### Group G — Scripts (3 files) — out of scope
`scripts/backfill-catalog-products.ts` · `scripts/sync-products-to-supabase.ts` · `scripts/verify-catalog-migration.ts` (must keep importing both modules — that is its entire purpose).

---

## File structure

**Created:**
- `lib/catalog-types.ts` — neutral home for `RealProduct`, `Partner`, `RealCategory`, `CategoryPathResult`. Breaks the `catalog.ts → partners.ts` dependency. Pure types, zero runtime imports.
- `scripts/check-build-queries.mjs` — asserts build-time DB round-trip count from a build log.

**Modified:**
- `lib/catalog.ts` — split `fetchCatalog`, add `unstable_cache`, fold `getRealProduct` into the snapshot, memoize category mapping, add `PARTNERS_LIST`/`getProductTitleSuffix`/`slugifyRealCategory` exports.
- `lib/partners.ts` — re-export types from `lib/catalog-types.ts` (source of truth moves; `partners.ts` keeps working unchanged for consumers).
- 24 call-site files across Batches 1–6.
- `.github/workflows/verify.yml` — add the two `NEXT_PUBLIC_SUPABASE_*` env vars.

**Untouched until Batch 7:** all six `lib/<partner>-data.ts`, and `lib/partners.ts`'s runtime functions.

---

## Order of operations — foundation before Batch 1 (decided)

**Argument for folding foundation into Batch 1:** nothing imports `lib/catalog.ts` today, so a foundation-only commit ships code that production never executes. Dead code in production is unverified code, and the cache wrapper's real behavior only manifests when a page uses it.

**Argument for landing foundation first:** it is *provably* zero-risk precisely because nothing imports it — a foundation-only deploy cannot change a single rendered byte. It also keeps Batch 1's diff to pure call-site swaps, so if Batch 1 regresses, the cause is unambiguous. And the cache behavior is not actually unverified: Step 13 measured it directly (349 → 1), and Task 5 re-asserts it in CI.

**Decision: foundation lands first, as Tasks 1–5, before Batch 1.** The attribution benefit is concrete and the "unverified" objection is answered by Task 5's query-count assertion, which exercises the cache without needing a production call site. A regression in a 6-file batch that also changes caching semantics is materially harder to bisect than one in a batch that only swaps imports.

---

## Per-batch verification protocol

Run **all** of these before starting the next batch. A batch is not done until every line passes.

**Local:**
1. `npx tsc --noEmit` → exit 0
2. `npm run lint` → exit 0
3. `npm run build` → exit 0, and **`Generating static pages (1043/1043)`**
4. **`rm -rf .next` first**, then `CATALOG_TRACE=1 npm run build > <log> 2>&1`, then `node scripts/check-build-queries.mjs <log> 2` → round trips ≤ 2.
   The clean step is not optional: on an incremental build Next reuses cached
   output and never re-runs data fetching, so the guard counts **zero** and
   passes vacuously. Observed on Batch 1 — reported 0, real count 1.

**Cross-module equivalence:**
5. `npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts` → 25/25 PASS

**What `verify-catalog-migration.ts` covers:** total product count, id-set equality, per-partner counts (all 6), per-field product equality (6 spot checks), category count + per-category itemCounts, featured deals count, best sellers count, populated category path count, one category-path query.

**What it does NOT cover — these need the checks below:** rendered HTML, `<title>`/meta description, JSON-LD blocks, image URLs resolving, pagination boundaries (page 2 vs last page), sitemap contents, client bundle size, build-time query count, category *ordering* on partner landing pages.

**Production (after deploy reaches READY):**
6. Confirm deployed SHA matches the pushed commit via `mcp__Vercel__get_deployment`.
7. Fetch the migrated partner's landing page — product count matches the table above **only for unpaginated partners**.

   Measured at Batch 3: `PRODUCTS_PER_PAGE = 36` (`lib/pagination.ts`), so a paginated partner's landing page is page 1 and lists **36**, not its full catalog. canvas-vows: 36 + 36 + 36 + 36 + 36 + 24 = 204 across six pages, union verified as exactly 204. **Expect 36 on the landing page for canvas-vows, tsar-bomba and golden-maple** — treating that as a failure would be reading the wrong number, not finding a bug. brooklyn-delhi (29), evdance (72) and king-koil (29) are unpaginated and do list every product.
   To check the full set for a paginated partner, take the union across the landing page and every `/page/N`.
8. Fetch 3 product detail pages — name, price, description, and `<title>` render; compare against the same URLs captured pre-deploy.
9. Fetch one image URL from a migrated page → HTTP 200, image content-type.
10. For paginated partners: fetch `/page/2` **and** the last page — both render, no empty grid.

> Do not poll the site rapidly after deploy — that can trigger Vercel bot mitigation and read as a false regression. Space checks out, and prefer the Vercel API for deploy state.

## Per-batch rollback

Every batch is exactly one commit. Rollback is:

```bash
git revert --no-edit <batch-sha>
git push origin main
```

This works for every batch **because `lib/partners.ts` and all six `lib/<partner>-data.ts` files remain present and fully functional through Batch 6.** Reverting a call-site batch restores static imports that were never removed. No database state changes, no migration to undo, no data loss — the catalog rows stay in Supabase either way.

**Verify after any revert:** `npm run build` → 1043 pages, then confirm the Vercel deploy reaches READY and spot-check one page from the reverted partner.

---

## Task 1: Break the type dependency

**Files:**
- Create: `lib/catalog-types.ts`
- Modify: `lib/partners.ts` (type definitions → re-exports), `lib/catalog.ts:50-55` (import from new module)

**Interfaces:**
- Produces: `RealProduct`, `Partner`, `RealCategory`, `CategoryPathResult` exported from `lib/catalog-types.ts`. Every later task imports types from here.

- [ ] **Step 1: Confirm the type definitions are where this plan expects**

```bash
grep -nE "^export type (RealProduct|Partner|RealCategory|CategoryPathResult)" lib/partners.ts
```
Expected (verified at HEAD `4a5b56f`): `RealProduct` at line 98, `Partner` at 132, `RealCategory` at 334, `CategoryPathResult` at 451. If the lines have moved that is fine; if a type is missing, stop — the plan's premise has changed.

- [ ] **Step 2: Create `lib/catalog-types.ts`**

Move the four type definitions verbatim from `lib/partners.ts`. Header:

```typescript
/**
 * Shared catalog types — the neutral home for the shapes both
 * lib/partners.ts (static) and lib/catalog.ts (Supabase-backed) speak.
 *
 * Extracted during Step 14 because lib/catalog.ts imported these FROM
 * lib/partners.ts, meaning the replacement module depended on the module
 * it replaces — which made deleting lib/partners.ts impossible. This file
 * has no runtime imports and no side effects, so importing it from a
 * client component is safe (unlike lib/partners.ts, which pulls ~1.47MB
 * of static data files; see the 2026-08-01 homepage LCP regression).
 */
```

- [ ] **Step 3: Re-export from `lib/partners.ts` so nothing breaks**

A bare `export type { … } from "./catalog-types"` will **not** compile here. `lib/partners.ts` uses all four types internally (`RealProduct` ~28 times, `ALL_WIRED_PARTNERS: Partner[]`, `getRealCategories(): RealCategory[]`, `getProductsByCategoryPath(): CategoryPathResult | undefined`), and a re-export does not bring names into local scope. You need both:

```typescript
import type {
  RealProduct,
  Partner,
  RealCategory,
  CategoryPathResult,
} from "./catalog-types";

export type { RealProduct, Partner, RealCategory, CategoryPathResult };
```

Also update any doc comment that cross-references a symbol staying behind in `partners.ts` — e.g. `RealProduct.variantLabel`'s `/** See RawPartnerProduct.variantLabel. */` should become `/** See RawPartnerProduct.variantLabel in lib/partners.ts. */`, since `RawPartnerProduct` does not move.

- [ ] **Step 4: Point `lib/catalog.ts` at the new module**

Replace the `} from "./partners";` import block with:

```typescript
import type {
  RealProduct,
  Partner,
  RealCategory,
  CategoryPathResult,
} from "./catalog-types";
```

- [ ] **Step 5: Verify no runtime dependency remains**

Match **import/export statements only** — a plain substring grep gives a false positive on the pre-existing comment at `lib/catalog.ts:57` ("Deliberately NOT `import { slugifyRealCategory } from "./partners"`"), which Task 2 Step 1 deliberately keeps:

```bash
grep -nE "^\s*(import|export)[^/]*from ['\"]\./partners['\"]" lib/catalog.ts
```
Expected: **no output.** If anything prints, `lib/catalog.ts` still depends on `lib/partners.ts` and Batch 7 stays blocked. Use this same tightened pattern as the Batch 7 deletion gate — the loose version can never return empty.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: all exit 0, `Generating static pages (1043/1043)`.

- [ ] **Step 7: Commit**

```bash
git add lib/catalog-types.ts lib/partners.ts lib/catalog.ts
git commit -m "refactor(catalog): extract shared types so catalog.ts no longer imports partners.ts"
```

---

## Task 2: Add the four missing exports to `lib/catalog.ts`

**Files:**
- Modify: `lib/catalog.ts`

**Interfaces:**
- Consumes: `lib/catalog-types.ts` from Task 1.
- Produces: `getPartners(): Promise<Partner[]>`, `getProductTitleSuffix(product: RealProduct): Promise<string>` (**async — see Step 2**), `slugifyRealCategory(name: string): string` (now exported), `getPartnerCategories(partnerId: string): Promise<string[]>`.

- [ ] **Step 1: Export the existing private `slugifyRealCategory`**

In `lib/catalog.ts`, change `function slugifyRealCategory` to `export function slugifyRealCategory`. Keep the existing comment explaining why it is duplicated rather than imported.

- [ ] **Step 2: Port `getProductTitleSuffix` — as `async`, NOT verbatim**

```bash
sed -n '/^export function getProductTitleSuffix/,/^}/p' lib/partners.ts
```

**Correction (2026-08-09): an earlier version of this plan claimed this function
was pure — "takes a `RealProduct`, returns a string, no async, no DB". That was
wrong, asserted without reading the body.** It calls
`getPartner(product.partnerId)` to find sibling products for
duplicate-name disambiguation. That call is synchronous in `lib/partners.ts`
but **`async` in `lib/catalog.ts`**, so a verbatim copy does not compile —
verified: `Property 'products' does not exist on type 'Promise<Partner | undefined>'`.

Port it as async, awaiting the sibling lookup:

```typescript
export async function getProductTitleSuffix(product: RealProduct): Promise<string> {
  const priceLabel = `$${product.price.toLocaleString()}`;
  const siblings = (await getPartner(product.partnerId))?.products ?? [];
  const colliding = siblings.filter(
    (p) => p.name === product.name && p.price === product.price
  );
  if (colliding.length <= 1) return priceLabel;
  if (product.variantLabel) return `${priceLabel} — ${product.variantLabel}`;
  const index = colliding.findIndex((p) => p.slug === product.slug) + 1;
  return `${priceLabel} — ${index} of ${colliding.length}`;
}
```

All four call sites are already inside `export async function generateMetadata`,
so they become `${await getProductTitleSuffix(product)}` — no call site needs
restructuring. The extra `fetchCatalog()` await costs nothing once Task 4's
`unstable_cache` lands.

- [x] **Step 3: Add `getPartners()` as the `PARTNERS` replacement — DONE, landed early in `cee0c17`**

**The alphabetical-sort snippet this step originally carried was wrong and has
been removed rather than left to be re-applied.** Step 4's check proved that
sorting by id does not reproduce the static `PARTNERS` order — that order is
*curated*, and matches neither id-alphabetical nor Postgres row order. Migration
`0009_add_partner_display_order.sql` added `partners.display_order` (backfilled
1-6 from the static array, `NOT NULL` with no default, unique constraint
`DEFERRABLE INITIALLY DEFERRED` so two partners can swap slots without a temp
value). The shipped `getPartners()` in `lib/catalog.ts` sorts by
`meta.displayOrder`, and `fetchCatalog`'s partners query carries a matching
`.order("display_order")`.

Do not re-add a sort by id. If you are reading this while writing a new
migration, note CLAUDE.md's rule that every migration needs a matching hand-edit
to `lib/supabase/database.types.ts` — 0009 broke `tsc` until `display_order` was
added to `Row`/`Insert`/`Update`.

- [x] **Step 4: Confirm the `PARTNERS` ordering actually matches — DONE, PASS**

```
static  : brooklyn-delhi, evdance, golden-maple, canvas-vows, king-koil, tsar-bomba
catalog : brooklyn-delhi, evdance, golden-maple, canvas-vows, king-koil, tsar-bomba
ORDER: MATCH   FIELDS: MATCH (id/name/tagline/href/logo + per-partner product counts)
```

Compared field-by-field, not just by id sequence — the right ordering with wrong
contents would otherwise pass.

- [ ] **Step 5: Add `getPartnerCategories()` for the `*_CATEGORIES` gap**

```typescript
/** The per-partner category list that lib/<partner>-data.ts exports as
 * <PARTNER>_CATEGORIES. Those are hand-ordered; catalog_products stores
 * no ordering, so this returns first-appearance order from the catalog.
 * Task 2 Step 6 verifies that matches the curated order per partner —
 * if it ever does not, the landing page's category order changes. */
export async function getPartnerCategories(partnerId: string): Promise<string[]> {
  const { products } = await fetchCatalog();
  const seen: string[] = [];
  for (const p of products) {
    if (p.partnerId === partnerId && !seen.includes(p.category)) seen.push(p.category);
  }
  return seen;
}
```

- [ ] **Step 6: Verify category order against all three curated lists**

```bash
npx tsx --env-file=.env.local -e "
import('@/lib/catalog').then(async (c) => {
  const d = {
    'brooklyn-delhi': (await import('@/lib/brooklyn-delhi-data')).BROOKLYN_DELHI_CATEGORIES,
    'evdance':        (await import('@/lib/evdance-data')).EVDANCE_CATEGORIES,
    'king-koil':      (await import('@/lib/king-koil-data')).KING_KOIL_CATEGORIES,
  };
  for (const [id, curated] of Object.entries(d)) {
    const derived = await c.getPartnerCategories(id);
    const same = JSON.stringify(curated) === JSON.stringify(derived);
    console.log(id, same ? 'MATCH' : 'DIFFERS');
    if (!same) { console.log('  curated:', curated.join(' | ')); console.log('  derived:', derived.join(' | ')); }
  }
});"
```

**If any partner reports DIFFERS: stop and escalate.** Shipping it silently reorders that partner's landing page. Options are to store an explicit `sort_order` column, or to keep importing `*_CATEGORIES` for that partner and defer its removal past Batch 7.

- [ ] **Step 7: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add lib/catalog.ts
git commit -m "feat(catalog): add getPartners, getPartnerCategories, getProductTitleSuffix, export slugifyRealCategory"
```

---

## Task 3: Memoize the category mapping

> **Premise changed since this task was written (2026-08-11).** When drafted, the
> product order this memo caches over was unstable and — for three of six
> partners — wrong. Migrations 0009/0010 fixed that: `fetchCatalog` now returns
> products in a stable, curated order matching `lib/partners.ts` exactly. So the
> memo now caches a *correct* ordering rather than freezing an arbitrary one,
> which is a meaningfully better position than the task originally assumed.
> Nothing in the steps below changes; the risk they carried is gone.


**Files:**
- Modify: `lib/catalog.ts` (the `mapAllCatalogProductsToCategory` region)

**Interfaces:**
- Produces: no signature change. `getPopulatedCategoryPaths()` and `getProductsByCategoryPath()` become ~0ms after first call within a process.

- [ ] **Step 1: Record the current cost**

```bash
cat > scratch/cat-cost.ts <<'EOF'
import { getPopulatedCategoryPaths } from "@/lib/catalog";
async function main() {
  for (const label of ["call 1", "call 2", "call 3"]) {
    const t = process.hrtime.bigint();
    const r = await getPopulatedCategoryPaths();
    console.log(label, (Number(process.hrtime.bigint() - t) / 1e6).toFixed(1) + "ms", r.length, "paths");
  }
}
main();
EOF
npx tsx --env-file=.env.local scratch/cat-cost.ts
```
Expected before the fix: roughly `960ms / 955ms / 955ms` — every call pays full cost.

- [ ] **Step 2: Add the module-level memo**

Mirror `lib/partners.ts`'s `mappedProductsCache` pattern:

```typescript
// Memoized per process, same as lib/partners.ts's mappedProductsCache.
// mapProductToCategory() scores all 954 products (~900ms measured); the
// unstable_cache wrapper on fetchCatalog does NOT cover this because the
// mapping runs after the fetch returns.
let mappedCatalogCache: { product: RealProduct; mapping: CategoryMapping }[] | null = null;
```

Guard the mapping function's body with it: return the cache if set, otherwise compute, assign, return.

- [ ] **Step 3: Re-run the probe**

```bash
npx tsx --env-file=.env.local scratch/cat-cost.ts
```
Expected after: call 1 near ~960ms, calls 2 and 3 **under 5ms**. If calls 2/3 are still ~950ms the memo is not wired in.

- [ ] **Step 4: Clean up and verify**

```bash
rm -f scratch/cat-cost.ts
npx tsc --noEmit && npm run lint && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add lib/catalog.ts
git commit -m "perf(catalog): memoize category mapping per process (~960ms -> ~0ms after first call)"
```

---

## Task 4: `unstable_cache` wrapper + `getRealProduct` snapshot fold

**Files:**
- Modify: `lib/catalog.ts`

**Interfaces:**
- Produces: `fetchCatalog()` unchanged externally (still returns `{ products, partnersById: Map }`), internally backed by a cached array fetch. `getRealProduct()` unchanged externally.

- [ ] **Step 1: Split the fetch so the cached part is serializable**

Rename the existing `fetchCatalog` body to `fetchCatalogRaw` and change its return type to arrays:

```typescript
async function fetchCatalogRaw(): Promise<{
  products: RealProduct[];
  partnerEntries: [string, PartnerMeta][];
}> {
  // ...existing body unchanged...
  return { products, partnerEntries: [...partnersById.entries()] };
}
```

- [ ] **Step 2: Wrap it and rebuild the Map outside**

```typescript
import { unstable_cache } from "next/cache";

// unstable_cache requires a JSON-serializable return value — a Map does not
// survive it, so the Map is rebuilt outside the cache boundary. Measured
// build-wide: 1 round trip with this wrapper vs 349 without. "use cache" was
// rejected: it caches per worker process (17 round trips across 12 workers).
const fetchCatalogCached = unstable_cache(fetchCatalogRaw, ["catalog-v1"], {
  revalidate: false,
  tags: ["catalog"],
});

async function fetchCatalog(): Promise<{
  products: RealProduct[];
  partnersById: Map<string, PartnerMeta>;
}> {
  const { products, partnerEntries } = await fetchCatalogCached();
  return { products, partnersById: new Map(partnerEntries) };
}
```

> The cache key `"catalog-v1"` must be bumped whenever `fetchCatalogRaw`'s return shape changes, or a stale-shaped entry can be served.

- [ ] **Step 3: Fold `getRealProduct` into the snapshot**

Replace the two-query body with a snapshot lookup. **Rewrite the existing comment rather than deleting it** — its reasoning becomes true again under ISR:

```typescript
export async function getRealProduct(
  partnerId: string,
  slug: string
): Promise<RealProduct | undefined> {
  // Reads from the cached full-catalog snapshot rather than issuing its own
  // single-row query. This is correct ONLY because Step 13 chose fully static
  // rendering: every call happens at build time, where the full catalog is
  // already fetched once and in memory, so the lookup is free.
  //
  // The original single-row query was correct for the world it was written
  // in, and is correct again for REQUEST-time rendering: 1.6 KB vs 1610 KB
  // payload, 71ms vs 499ms (measured 2026-08-09). If any product route is
  // ever switched to ISR or dynamic, RESTORE the single-row query for that
  // path or it regresses 993x on payload per request.
  const { products } = await fetchCatalog();
  return products.find((p) => p.partnerId === partnerId && p.slug === slug);
}
```

- [ ] **Step 4: Verify equivalence still holds**

```bash
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
```
Expected: **All checks passed.** (25/25). This is the check that proves the snapshot lookup returns the same product objects the single-row query did.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add lib/catalog.ts
git commit -m "perf(catalog): cache fetchCatalog build-wide via unstable_cache, fold getRealProduct into the snapshot"
```

---

## Task 5: Query-count guard + CI credentials

**Files:**
- Create: `scripts/check-build-queries.mjs`
- Modify: `.github/workflows/verify.yml`

**Interfaces:**
- Produces: `node scripts/check-build-queries.mjs <logfile> [max]` — exits 1 if the log shows more round trips than `max` (default 2).

- [ ] **Step 1: Write the guard**

```javascript
#!/usr/bin/env node
/** Fails if a build made more catalog round trips than expected. Guards the
 * Step 13 decision: unstable_cache must dedupe fetchCatalog build-wide. A
 * regression here (a call site bypassing the cache, or the cache key going
 * stale) shows up as a query-count jump long before it shows up as a
 * slowdown — build time is unchanged by this, so timing cannot catch it. */
import { readFileSync } from "node:fs";

const [, , logPath, maxArg] = process.argv;
if (!logPath) {
  console.error("usage: check-build-queries.mjs <build.log> [max]");
  process.exit(2);
}
const max = Number(maxArg ?? 2);
const hits = (readFileSync(logPath, "utf8").match(/__FETCH_CATALOG_HIT__/g) ?? []).length;
console.log(`catalog round trips: ${hits} (max ${max})`);
if (hits > max) {
  console.error(`FAIL: ${hits} round trips exceeds ${max} — unstable_cache is not deduping.`);
  process.exit(1);
}
console.log("PASS");
```

- [ ] **Step 2: Add the temporary instrumentation used by the guard**

The guard needs a marker. Add to `fetchCatalogRaw`'s first line, behind an env flag so it never logs in normal builds:

```typescript
if (process.env.CATALOG_TRACE) console.log("__FETCH_CATALOG_HIT__");
```

- [ ] **Step 3: Prove the guard fails when it should**

```bash
CATALOG_TRACE=1 npm run build > /tmp/trace.log 2>&1
node scripts/check-build-queries.mjs /tmp/trace.log 0
```
Expected: **FAIL** ("1 round trips exceeds 0") — this proves the guard can detect a regression rather than passing vacuously.

- [ ] **Step 4: Prove it passes at the real threshold**

```bash
node scripts/check-build-queries.mjs /tmp/trace.log 2
```
Expected: `catalog round trips: 1 (max 2)` → **PASS**.

- [ ] **Step 5: Add credentials to CI**

In `.github/workflows/verify.yml`, add to the Build step only:

```yaml
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

Add a comment recording why this is safe:

```yaml
      # anon key only. Verified 2026-08-09: RLS is enabled on catalog_products
      # and partners with SELECT-only policies (USING true, role public);
      # UPDATE/DELETE as anon affect 0 rows and INSERT raises an RLS error.
      # Both vars are NEXT_PUBLIC_* and are already inlined into the client
      # bundle, so CI gains nothing a browser visitor does not already have.
      # NEVER add SUPABASE_SERVICE_ROLE_KEY here — it bypasses RLS entirely.
```

- [ ] **Step 6: The human must add both repo secrets before this lands**

Settings → Secrets and variables → Actions. **Claude must not handle these values.** If the secrets are absent, the Build step fails once the first call site migrates.

- [ ] **Step 7: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && npm run build
git add scripts/check-build-queries.mjs lib/catalog.ts .github/workflows/verify.yml
git commit -m "ci: add build-query guard and anon Supabase credentials for build-time catalog reads"
```

- [ ] **Step 8: Confirm CI is green before Batch 1**

Watch the run; do not start Batch 1 until it succeeds.

---

## Batch 1: `brooklyn-delhi` (29 pages) — proves the whole pattern

Smallest partner, no pagination, and it exercises every distinct shape at once: `generateStaticParams` from a direct data import, `getRealProduct` in both metadata and body, `getAllRealProducts` for related products, `getPartner` + `slugifyRealCategory` on the landing page, and the `*_CATEGORIES` gap. If this batch is clean, every remaining partner is the same work with different names.

**Files:**
- Modify: `app/brooklyn-delhi/[slug]/page.tsx`, `app/brooklyn-delhi/page.tsx`

- [ ] **Step 1: Capture pre-migration output for comparison**

```bash
curl -s https://gopricefinder.com/brooklyn-delhi/tomato-achaar-1-5-oz-packet-1 -o /tmp/bd-before.html
grep -oE "<title>[^<]*</title>" /tmp/bd-before.html
```

- [ ] **Step 2: Migrate the detail route**

In `app/brooklyn-delhi/[slug]/page.tsx`, replace the two imports:

```typescript
import { getAllRealProducts, getPartner, getRealProduct } from "@/lib/catalog";
```

Delete the `BROOKLYN_DELHI_PRODUCTS` import. Then:

```typescript
export async function generateStaticParams() {
  const partner = await getPartner("brooklyn-delhi");
  return (partner?.products ?? []).map((product) => ({ slug: product.slug }));
}
```

Add `await` at all three call sites — both `getRealProduct` calls and the `getAllRealProducts` call:

```typescript
const product = await getRealProduct("brooklyn-delhi", slug);
```

```typescript
const related = (await getAllRealProducts())
  .filter((p) => p.partnerId === "brooklyn-delhi" && p.category === product.category && p.slug !== product.slug)
  .slice(0, 4);
```

- [ ] **Step 3: Migrate the landing page**

In `app/brooklyn-delhi/page.tsx`:

```typescript
import { getPartner, getPartnerCategories, slugifyRealCategory } from "@/lib/catalog";
```

Delete the `BROOKLYN_DELHI_CATEGORIES` import and replace its use with:

```typescript
const categories = await getPartnerCategories("brooklyn-delhi");
```

Ensure the component is `async` and every `getPartner` call is awaited.

- [ ] **Step 4: Verify locally**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: exit 0, **`Generating static pages (1043/1043)`**. A count of 1042 or lower means `generateStaticParams` lost a page — stop and diff the slug list.

- [ ] **Step 5: Assert the query count did not regress**

```bash
CATALOG_TRACE=1 npm run build > /tmp/b1.log 2>&1
node scripts/check-build-queries.mjs /tmp/b1.log 2
```
Expected: PASS.

- [ ] **Step 6: Assert cross-module equivalence**

```bash
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
```
Expected: All checks passed (25/25).

- [ ] **Step 7: Commit and push**

```bash
git add "app/brooklyn-delhi/[slug]/page.tsx" app/brooklyn-delhi/page.tsx
git commit -m "refactor(brooklyn-delhi): read catalog from lib/catalog.ts (Step 14 batch 1)"
git push origin main
```

- [ ] **Step 8: Production verification**

Wait for the Vercel deploy to reach READY (check via the API, do not poll the site), then:

```bash
curl -s https://gopricefinder.com/brooklyn-delhi/tomato-achaar-1-5-oz-packet-1 -o /tmp/bd-after.html
diff <(grep -oE "<title>[^<]*</title>" /tmp/bd-before.html) <(grep -oE "<title>[^<]*</title>" /tmp/bd-after.html)
```
Expected: **no diff.** Also confirm the landing page lists 29 products, the category order matches what shipped before, and one image URL returns HTTP 200.

- [ ] **Step 9: Stop and review before Batch 2**

Do not start Batch 2 until Batch 1 is verified in production. This is the gate the whole batch strategy exists for.

---

## Batch 2: `evdance` (72) + `king-koil` (29)

Two partners at once, because Batch 1 proved the pattern. Still no pagination. `king-koil` adds `getProductTitleSuffix`; both add `*_CATEGORIES` + `slugifyRealCategory` on their landing pages.

**Files:** `app/evdance/[slug]/page.tsx`, `app/evdance/page.tsx`, `app/king-koil/[slug]/page.tsx`, `app/king-koil/page.tsx`

- [ ] **Step 1: Capture pre-migration titles for one page per partner**

```bash
curl -s https://gopricefinder.com/evdance/evdance-j1772-ev-extension-cord-40a-21-30-40-ft-21ft -o /tmp/ev-before.html
curl -s https://gopricefinder.com/king-koil/king-koil-luxury-air-mattress-with-high-speed-built-in-pump -o /tmp/kk-before.html
```

- [ ] **Step 2: Migrate both detail routes**

For each of `app/evdance/[slug]/page.tsx` and `app/king-koil/[slug]/page.tsx`, replace the data-file import and the `partners` import with:

```typescript
import { getAllRealProducts, getPartner, getRealProduct } from "@/lib/catalog";
import { getProductTitleSuffix } from "@/lib/catalog";
```

(`getProductTitleSuffix` only applies to `king-koil`; `evdance` does not import it.) **It is async** — its call site inside `generateMetadata` becomes `${await getProductTitleSuffix(product)}`. Then, in each file:

```typescript
export async function generateStaticParams() {
  const partner = await getPartner("<partner-id>");
  return (partner?.products ?? []).map((product) => ({ slug: product.slug }));
}
```

```typescript
const product = await getRealProduct("<partner-id>", slug);
```

```typescript
const related = (await getAllRealProducts())
  .filter((p) => p.partnerId === "<partner-id>" && p.category === product.category && p.slug !== product.slug)
  .slice(0, 4);
```

- [ ] **Step 3: Migrate both landing pages**

For each of `app/evdance/page.tsx` and `app/king-koil/page.tsx`:

```typescript
import { getPartner, getPartnerCategories, slugifyRealCategory } from "@/lib/catalog";
```

```typescript
const categories = await getPartnerCategories("<partner-id>");
```

- [ ] **Step 4: Verify locally**

```bash
npx tsc --noEmit && npm run lint && npm run build
```
Expected: exit 0, `Generating static pages (1043/1043)`.

- [ ] **Step 5: Query-count and equivalence checks**

```bash
CATALOG_TRACE=1 npm run build > /tmp/b2.log 2>&1
node scripts/check-build-queries.mjs /tmp/b2.log 2
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
```

- [ ] **Step 6: Commit, push, verify in production**

```bash
git add "app/evdance/[slug]/page.tsx" app/evdance/page.tsx "app/king-koil/[slug]/page.tsx" app/king-koil/page.tsx
git commit -m "refactor(evdance,king-koil): read catalog from lib/catalog.ts (Step 14 batch 2)"
git push origin main
```

After READY: diff the two captured `<title>` values, confirm evdance lists 72 products and king-koil 29, and confirm both landing pages' category order is unchanged.

---

## Batch 3: `canvas-vows` (204 + 5 paginated pages)

First batch with a paginated route. Isolated deliberately — pagination has boundary conditions (page 2, last page, `totalPages - 1` arithmetic) that no earlier batch exercised.

**Files:** `app/canvas-vows/[slug]/page.tsx`, `app/canvas-vows/page.tsx`, `app/canvas-vows/page/[page]/page.tsx`

- [ ] **Step 1: Record the current pagination shape**

```bash
grep -c "" /dev/null; npx tsx --env-file=.env.local -e "
import('@/lib/partners').then(async (s) => {
  const { paginate } = await import('@/lib/pagination');
  const p = s.getPartner('canvas-vows');
  console.log('products:', p.products.length, 'totalPages:', paginate(p.products, 1).totalPages);
});"
```
Record both numbers. The migrated route must produce identical values.

- [ ] **Step 2: Migrate the detail route**

```typescript
import { getAllRealProducts, getPartner, getProductTitleSuffix, getRealProduct } from "@/lib/catalog";
```

```typescript
export async function generateStaticParams() {
  const partner = await getPartner("canvas-vows");
  return (partner?.products ?? []).map((product) => ({ slug: product.slug }));
}
```

```typescript
const product = await getRealProduct("canvas-vows", slug);
```

```typescript
const related = (await getAllRealProducts())
  .filter((p) => p.partnerId === "canvas-vows" && p.category === product.category && p.slug !== product.slug)
  .slice(0, 4);
```

- [ ] **Step 3: Migrate the paginated route**

In `app/canvas-vows/page/[page]/page.tsx`, swap the import to `@/lib/catalog` and await:

```typescript
export async function generateStaticParams() {
  const partner = await getPartner("canvas-vows");
  const { totalPages } = paginate(partner?.products ?? [], 1);
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    page: String(i + 2),
  }));
}
```

Await the `getPartner` call in the page body too.

- [ ] **Step 4: Migrate the landing page**

`app/canvas-vows/page.tsx` imports only `getPartner` — swap the import to `@/lib/catalog` and await it. There is no `*_CATEGORIES` import in this file.

- [ ] **Step 5: Verify locally, with attention to the paginated count**

```bash
npx tsc --noEmit && npm run lint && npm run build
grep -A6 "canvas-vows/page/\[page\]" /tmp/b3.log
```
Expected: 1043 total pages, and the `/canvas-vows/page/[page]` route still generating **5** pages.

- [ ] **Step 6: Query-count and equivalence checks**

```bash
CATALOG_TRACE=1 npm run build > /tmp/b3.log 2>&1
node scripts/check-build-queries.mjs /tmp/b3.log 2
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
```

- [ ] **Step 7: Commit, push, verify in production**

```bash
git add "app/canvas-vows/[slug]/page.tsx" app/canvas-vows/page.tsx "app/canvas-vows/page/[page]/page.tsx"
git commit -m "refactor(canvas-vows): read catalog from lib/catalog.ts, incl. paginated route (Step 14 batch 3)"
git push origin main
```

After READY, fetch **both** `/canvas-vows/page/2` and `/canvas-vows/page/6` (the last page) and confirm each renders a populated grid. An off-by-one in `totalPages` shows up only at the boundary.

---

## Batch 4: `tsar-bomba` (272 + 7) + `golden-maple` (348 + 9)

The bulk — 620 product pages, 73% of Group A. Runs last among partners because by now the pattern has been proven three times, including pagination.

**Files:** `app/tsar-bomba/[slug]/page.tsx`, `app/tsar-bomba/page.tsx`, `app/tsar-bomba/page/[page]/page.tsx`, `app/golden-maple/[slug]/page.tsx`, `app/golden-maple/page.tsx`, `app/golden-maple/page/[page]/page.tsx`

- [ ] **Step 1: Migrate both detail routes**

For each, replace the data-file and partners imports with:

```typescript
import { getAllRealProducts, getPartner, getProductTitleSuffix, getRealProduct } from "@/lib/catalog";
```

```typescript
export async function generateStaticParams() {
  const partner = await getPartner("<partner-id>");
  return (partner?.products ?? []).map((product) => ({ slug: product.slug }));
}
```

```typescript
const product = await getRealProduct("<partner-id>", slug);
```

```typescript
const related = (await getAllRealProducts())
  .filter((p) => p.partnerId === "<partner-id>" && p.category === product.category && p.slug !== product.slug)
  .slice(0, 4);
```

- [ ] **Step 2: Migrate both paginated routes**

```typescript
export async function generateStaticParams() {
  const partner = await getPartner("<partner-id>");
  const { totalPages } = paginate(partner?.products ?? [], 1);
  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => ({
    page: String(i + 2),
  }));
}
```

Keep `golden-maple`'s existing "Page 1 lives at /golden-maple itself, not here — starts at 2" comment.

- [ ] **Step 3: Migrate both landing pages**

Both import only `getPartner` — swap to `@/lib/catalog` and await.

- [ ] **Step 4: Verify locally**

```bash
npx tsc --noEmit && npm run lint && CATALOG_TRACE=1 npm run build > /tmp/b4.log 2>&1
node scripts/check-build-queries.mjs /tmp/b4.log 2
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
```
Expected: 1043 pages; `/tsar-bomba/page/[page]` = 7, `/golden-maple/page/[page]` = 9.

- [ ] **Step 5: Commit, push, verify in production**

```bash
git add "app/tsar-bomba/[slug]/page.tsx" app/tsar-bomba/page.tsx "app/tsar-bomba/page/[page]/page.tsx" "app/golden-maple/[slug]/page.tsx" app/golden-maple/page.tsx "app/golden-maple/page/[page]/page.tsx"
git commit -m "refactor(tsar-bomba,golden-maple): read catalog from lib/catalog.ts (Step 14 batch 4)"
git push origin main
```

After READY: spot-check 3 product pages per partner, plus `/tsar-bomba/page/8` and `/golden-maple/page/10` (last pages).

**At this point all 954 product pages read from Supabase and no `app/` file imports a `lib/<partner>-data.ts` file.** Confirm:

```bash
grep -rn "from \"@/lib/[a-z-]*-data\"" app/ | grep -v structured-data
```
Expected: **no output.**

---

## Batch 5: Cross-partner routes (7 files, 68 pages)

Highest blast radius — the homepage, sitemap, and every category page. Runs after all partners because these aggregate across all of them, so a partner-level bug would surface here as a confusing cross-cutting failure rather than a localized one.

**Files:** `app/page.tsx`, `app/categories/page.tsx`, `app/category/[slug]/page.tsx`, `app/category/[slug]/[...path]/page.tsx`, `app/deals/page.tsx`, `app/trending/page.tsx`, `app/sitemap.ts`, `components/OurPartners.tsx`

- [ ] **Step 1: Capture the current sitemap for comparison**

```bash
curl -s https://gopricefinder.com/sitemap.xml -o /tmp/sitemap-before.xml
grep -c "<url>" /tmp/sitemap-before.xml
```

- [ ] **Step 2: Migrate the simple single-function pages**

`app/deals/page.tsx`: `import { getFeaturedDeals } from "@/lib/catalog";` and `await` it.
`app/trending/page.tsx`: `import { getBestSellers } from "@/lib/catalog";` and `await` it.
`app/category/[slug]/page.tsx`: `import { getCategoryBySlug, getRealCategories } from "@/lib/catalog";`, make `generateStaticParams` async and await both call sites.
`app/category/[slug]/[...path]/page.tsx`: `import { getProductsByCategoryPath, getPopulatedCategoryPaths } from "@/lib/catalog";`, make `generateStaticParams` async and await both.
`app/categories/page.tsx`: `import { getAllRealProducts, slugifyRealCategory } from "@/lib/catalog";` and await `getAllRealProducts`.

- [ ] **Step 3: Migrate the `PARTNERS` consumers**

`app/page.tsx`:

```typescript
import { getAllRealProducts, getPartners } from "@/lib/catalog";
```
Replace `PARTNERS` with `await getPartners()` and await `getAllRealProducts()`.

`components/OurPartners.tsx` — verified at HEAD `4a5b56f` to be a **server component** (no `"use client"` directive), so it can await directly:

```typescript
import { getPartners } from "@/lib/catalog";
```
Make the component `async` and replace `PARTNERS` with `await getPartners()`. Re-confirm with `head -1 components/OurPartners.tsx` before editing — if a `"use client"` directive has since been added, it cannot await, and it must instead take `partners` as a prop from its server-component parent.

`app/sitemap.ts`:

```typescript
import { getPartners, getAllRealProducts, getRealCategories, getPopulatedCategoryPaths } from "@/lib/catalog";
```
`sitemap.ts` already exports an async default — await all four.

- [ ] **Step 4: Verify locally**

```bash
npx tsc --noEmit && npm run lint && CATALOG_TRACE=1 npm run build > /tmp/b5.log 2>&1
node scripts/check-build-queries.mjs /tmp/b5.log 2
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
```
Expected: 1043 pages, round trips ≤ 2.

- [ ] **Step 5: Commit, push, verify in production**

```bash
git add app/page.tsx app/categories/page.tsx "app/category/[slug]/page.tsx" "app/category/[slug]/[...path]/page.tsx" app/deals/page.tsx app/trending/page.tsx app/sitemap.ts components/OurPartners.tsx
git commit -m "refactor(shared): read catalog from lib/catalog.ts across homepage, categories, sitemap (Step 14 batch 5)"
git push origin main
```

After READY:

```bash
curl -s https://gopricefinder.com/sitemap.xml -o /tmp/sitemap-after.xml
diff <(grep -oE "<loc>[^<]*</loc>" /tmp/sitemap-before.xml | sort) <(grep -oE "<loc>[^<]*</loc>" /tmp/sitemap-after.xml | sort)
```
Expected: **no diff.** Also confirm the homepage renders Featured Deals, Best Sellers, Popular Categories, and Our Partners with the same partner ordering as before.

- [ ] **Step 6: Check the client bundle did not grow**

```bash
grep -A3 "First Load JS shared by all" /tmp/b5.log
```
Compare against the 103 kB baseline. A jump means a client component started pulling the catalog — the exact failure mode of the 2026-08-01 LCP regression.

---

## Batch 6: Shared lib — and an explicit decision on the cron paths

**Files:** `lib/data.ts` only. **Deliberately excluded:** `lib/search.ts`, `lib/pricing/refreshPrices.ts`, `lib/pricing/getEffectivePrice.ts`.

- [ ] **Step 1: Do NOT migrate `lib/search.ts` — record why**

`lib/search.ts` is consumed by `app/search/page.tsx`, which the build reports as **`ƒ /search` (Dynamic)**. It renders per request, so Step 13's "every read happens at build" premise has never applied to it. Migrating it would put a 1610 KB catalog fetch on **every user search** — the worst request-time case in the codebase.

Add to `lib/search.ts`:

```typescript
// Deliberately still reads lib/partners.ts, not lib/catalog.ts. Its only
// consumer, app/search/page.tsx, is a DYNAMIC route (ƒ /search) that renders
// per request — Step 13's "all reads happen at build" premise does not hold
// here. A catalog fetch would cost 1610 KB per search (measured 2026-08-09)
// versus a free static import. If this ever migrates, it needs its own
// narrow query, not getAllRealProducts().
```

Also verify the client-side import stays type-only:

```bash
grep -n "from \"@/lib/search\"" components/SearchBar.tsx
```
Expected: `import type { searchRealProducts as SearchRealProducts }`. The `type` keyword is load-bearing — without it, the catalog enters the browser bundle.

- [ ] **Step 2: Migrate `lib/data.ts`**

```typescript
import { getPartner } from "./catalog";
```
`getRetailer()` becomes async; update its callers the same way.

- [ ] **Step 3: Leave the cron paths on `lib/partners.ts` — record why**

`lib/pricing/refreshPrices.ts` and `lib/pricing/getEffectivePrice.ts` run inside cron handlers at request time, where the Step 13 static-rendering premise **does not hold**. Migrating them means each cron run fetches 1610 KB instead of reading a static import.

Recommendation: **leave both on `lib/partners.ts`.** Record the reason in each file:

```typescript
// Deliberately still reads lib/partners.ts, not lib/catalog.ts. This runs in
// a cron handler at request time, where Step 13's "every read happens at
// build" premise does not hold — a catalog fetch here costs 1610 KB per run
// versus a free static import. Revisit only if lib/partners.ts is deleted,
// which requires giving this path its own narrow query instead.
```

This means **`lib/partners.ts` cannot be deleted in Batch 7** unless all three request-time consumers (`search`, `refreshPrices`, `getEffectivePrice`) are given narrow queries first. Surface that now rather than discovering it at deletion time.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && CATALOG_TRACE=1 npm run build > /tmp/b6.log 2>&1
node scripts/check-build-queries.mjs /tmp/b6.log 2
npx tsx --env-file=.env.local scripts/verify-catalog-migration.ts
git add lib/data.ts lib/search.ts lib/pricing/refreshPrices.ts lib/pricing/getEffectivePrice.ts
git commit -m "refactor(lib): migrate data.ts to lib/catalog.ts; document why search and cron paths stay static (Step 14 batch 6)"
git push origin main
```

---

## Step 14 complete — definition of done

Step 14 is complete when **all** of the following are true:

1. `grep -rn "from \"@/lib/[a-z-]*-data\"" app/ components/ | grep -v structured-data` returns **no output** — no app code imports a static data file.
2. The only remaining `lib/partners.ts` importers are: `lib/pricing/refreshPrices.ts`, `lib/pricing/getEffectivePrice.ts`, the three `scripts/`, and type-only importers.
3. `npm run build` produces **1043 pages**, exit 0.
4. `check-build-queries.mjs` reports **≤ 2** round trips.
5. `verify-catalog-migration.ts` passes **25/25**.
6. Every batch has been deployed and verified in production individually.
7. Client First Load JS is unchanged from the 103 kB baseline.
8. The Step 13 decision record exists and documents the ISR/`getRealProduct` coupling.

## Deletion gate — what must be true before `lib/partners.ts` and the six data files can go

The migration doc recommends keeping them one release cycle. That is necessary but **not sufficient** — these are hard blockers found while writing this plan:

1. **One full release cycle has passed** since Batch 6, with no rollback.
2. **`lib/catalog.ts` no longer imports from `lib/partners.ts`** — done in Task 1, verify it stayed true.
3. **The two cron paths have narrow queries** replacing `getAllRealProducts()`, or they are migrated with the payload cost accepted explicitly. **This is the blocker most likely to be missed.**
4. **`scripts/verify-catalog-migration.ts` is retired or rewritten** — it exists to diff the two modules and becomes meaningless when one is gone. Do not delete the comparison without replacing it with a catalog-only invariant check.
5. **`scripts/backfill-catalog-products.ts` and `scripts/sync-products-to-supabase.ts` are addressed** — both read `PARTNERS` from the static files as their source of truth. Deleting the data files breaks the ability to re-backfill from a known-good source. Decide whether the DB becomes authoritative or these scripts are retired.
6. **`getPartnerCategories()` ordering verified in production** for all three partners that used `*_CATEGORIES`.
7. **A full rebuild from a clean clone succeeds** with the data files deleted — proving nothing implicitly depended on them.

Only when 1–7 hold should the deletion PR be opened, and it should be its own commit, reverted as easily as any batch.
