# Partner Data Import — Standard Workflow & Verification Runbook

**Status (2026-07-25, updated later same day):** Kawsar has consolidated
partner-data and site-verification responsibility into this chat going
forward — the separate import chats referenced below are retired. This
chat now owns the full workflow end-to-end for every future partner
import: parsing/wiring the data, verifying it's live, and fixing whatever
in the pipeline (code or deployment) is keeping it from showing up
correctly. Not something to ask about each time — just do it and report
back with a concrete pass/fail summary.

Whenever new partner product data shows up (a feed file, a sheet, a CSV —
whatever form), do all of the below end-to-end:

1. Parse the source data and generate `lib/<partner>-data.ts` following the
   existing per-partner pattern (see `lib/brooklyn-delhi-data.ts` as the
   reference shape: slug, name, description, price, optional real
   originalPrice, deepLink, image(s), category).
2. Download every product image into `public/images/<partner>/`.
3. **Wire the partner into `lib/partners.ts` (normalizer + `PARTNERS`
   entry) — this is the step that got skipped on the EVDANCE/Golden Maple
   import (see History below) and it's the single most important one.**
   Without it, `getPartner()`/`getAllRealProducts()` never see the new
   partner's products at all, so every section that reads from
   `lib/partners.ts` (Featured Deals, Best Sellers, Popular Categories,
   Our Partners, search, category pages) silently renders zero products
   for that partner — even though the data file, images, and dedicated
   partner pages all look complete and are sitting right there in the
   repo. **After adding a partner's data file, always grep
   `lib/partners.ts` for the new partner's id to confirm it's actually in
   the `PARTNERS` array before considering the import done** — don't just
   confirm the data file and page files exist.
4. Add `app/<partner>/page.tsx` (category-grouped listing) and
   `app/<partner>/[slug]/page.tsx` (detail page), mirroring
   `app/brooklyn-delhi/`.
5. Check for hardcoded single-partner references elsewhere in the
   codebase that the new partner might now make stale or wrong — e.g.
   `components/FeaturedDeals.tsx` had a hardcoded "View all Brooklyn Delhi
   products" link (now fixed, points at `/deals`) that would've sent
   traffic to the wrong partner the first time a non-Brooklyn-Delhi
   product had a real markdown. Grep for the previous partner's name
   across `components/` and `app/` and check each hit isn't assuming
   there's still only one partner.
6. Run the full verification pass below (data integrity, images, deep
   links, live-site rendering).
7. **Re-sync `public.products`** (see the "products table drift" note in
   the Appendix below) — any partner whose product IDs changed in this
   import needs a fresh upsert into Supabase's `public.products`, or its
   live prices will fail with a foreign-key error the next time
   refresh-prices runs. Don't skip this even though it's a separate
   system from the static catalog files.
8. Commit with a clear message and push.
9. Report back with a concrete pass/fail summary, not a generic "done."

**Production URL:** `gopricefinder.com`

**Repo:** `E:\Price Finder` (local, Windows machine `kawsar0990`), remote
`https://github.com/Go-Price-Finder/Price-Finder.git`

**Note (2026-08-06):** the GitHub repo now lives under the `Go-Price-Finder`
organization (transferred from the personal account `kawsar0990a` so a
second team member can be added as a collaborator without touching
Kawsar's other personal repos). Any older reference to
`kawsar0990a/Price-Finder` elsewhere is stale — old links still redirect
automatically per GitHub's transfer behavior, but new work, local clones,
and remotes should point at the `Go-Price-Finder` org URL going forward.

## Why this can't be fully automatic

The Cowork device sandbox that has `E:\Price Finder` mounted has no
outbound network access — no `git push`, no `git fetch` to a real remote,
no reaching vendor CDNs or GitHub. **The cloud container (where this chat
also runs code) does have real outbound network access, including to
`github.com` itself** — confirmed 2026-07-25: `git clone`/`git ls-remote`
against `https://github.com/Go-Price-Finder/Price-Finder.git` both work fine
from the cloud sandbox's Bash tool, and `curl`/WebFetch reach
`gopricefinder.com` and the Vercel API without issue. What the cloud
container does *not* have is push credentials — `git push` from the cloud
clone fails with `fatal: could not read Username for 'https://github.com':
terminal prompts disabled` (no stored credential helper there). The
device sandbox has the user's real git credentials but no network, so its
`git push` fails the opposite way, with `403 from proxy after CONNECT`,
every time. Net effect: **do the actual code work in a fresh clone in the
cloud container** (real `npm`/`tsc`/`eslint`/`next build`/Playwright, all
verified against the real GitHub source), then sync just the changed
files to the device (`SendUserFile` → `device_commit_files`) and commit
there so the commit exists locally with the device's git identity — then
either the user runs `git push` themselves from `E:\Price Finder`, or (if
granted) it's driven the same way as before.

- **Downloading vendor images**: still can't be done from either sandbox
  directly reaching vendor CDNs in bulk — same as before. Generate a
  manifest + `scripts/download-partner-images.mjs`, commit both, and have
  the user (or a granted desktop-automation session) actually run the
  download.
- **`git push`**: always fails from the device sandbox (`403 from proxy`)
  and from the cloud sandbox (no stored credentials). Prepare and commit
  everything from wherever's most convenient (cloud clone for code work,
  device for the final committed-and-ready-to-push state), but the actual
  push has to happen from a real terminal on the machine.
- **Verifying Vercel deployment status directly** (build success/failure,
  which commit is actually live, build logs) — use the Vercel MCP tools
  (`mcp__Vercel__get_deployment`, `get_deployment_build_logs`,
  `get_runtime_errors`) against team `team_9sGnDaeqTnElP5ul8g6pGxYr` /
  project `pricefinder` rather than guessing from site behavior alone.
  This is the fastest way to rule in/out "deployment pipeline is broken"
  vs. "deployment is fine, the code itself has a bug" — see History below,
  where the deployment was confirmed healthy and live within ~20 minutes
  of push, and the actual problem was 100% in the code.

## Steps

1. **Confirm there's something new to verify.** From the device bridge,
   `cd` into `E:\Price Finder` and run `git log origin/main --oneline -5`
   plus `git status`. If local is ahead of `origin/main`, the push hasn't
   happened yet — that's expected mid-import, but don't report the import
   as "live" until it's confirmed pushed. Cross-check with
   `mcp__Vercel__get_deployment` (idOrUrl: `gopricefinder.com`) — its
   `meta.githubCommitSha` tells you exactly which commit is actually
   deployed to production, independent of what's on `origin/main`.

2. **Identify what was imported.** Read the latest commit(s) touching
   `lib/*-data.ts` and `lib/partners.ts` to get the partner name(s) and
   expected product count(s). **Explicitly confirm the partner actually
   appears in `lib/partners.ts`'s `PARTNERS` array** — a commit that only
   touches `lib/<partner>-data.ts` and `app/<partner>/*` without also
   touching `lib/partners.ts` is an incomplete import, full stop.

3. **Verify data integrity locally** (fast, catches issues before hitting
   the live site) — for every `lib/<partner>-data.ts`:
   - No duplicate slugs.
   - Every product has a non-empty `name`, `category`, `image` (file
     exists on disk — check with `public/` prepended to the `/images/...`
     path, e.g. `public/images/<partner>/<file>`, not the bare
     `/images/...` path), positive `price`, and a well-formed `https://`
     `deepLink`.
   - **Description quality check** — flag any description that's missing,
     empty, or suspiciously short (< 10 chars). This caught a real issue
     on the EVDANCE/Golden Maple import: one Golden Maple product's
     description in the *source feed itself* was a stray `"\"` character
     (confirmed against the raw CSV — a vendor data gap, not a parsing
     bug). Fixed by backfilling by hand from the same product line's other
     feed entries rather than fabricating text or leaving it broken. Don't
     assume "field is populated" from a generic non-null check alone —
     check length/plausibility too.
   - Run the site's actual `searchRealProducts` substring logic against a
     handful of representative keywords per partner and sanity-check hit
     counts. Note: this is a plain substring match across name/description
     /category/partnerName, so short/common queries (e.g. "ev") return
     very broad, loosely-relevant result sets once the catalog is large —
     that's expected behavior, not a bug, but worth knowing before it
     looks alarming during verification.

4. **Verify products are live on `gopricefinder.com`:**
   - Check the actual deployed commit first (`mcp__Vercel__get_deployment`)
     — if it doesn't match the latest pushed commit, that's a deployment
     problem to chase; if it matches and products still aren't showing,
     it's a code problem (check `PARTNERS` registration first).
   - Fetch the partner's category/listing page (e.g.
     `gopricefinder.com/evdance`) and confirm it lists products and the
     count roughly matches.
   - Fetch 2-3 individual product detail pages across different
     categories and confirm name/price/description render.
   - Fetch `gopricefinder.com` itself and confirm the new partner shows
     up in "Our Partners" / Popular Categories / search-driven sections.
     Note the homepage is fully **static**, not ISR: `next build` reports
     it as `○ (Static)` in the route table, and `app/page.tsx` exports
     neither `revalidate` nor `dynamic`. Its HTML is baked at build time
     and changes only when a new deployment goes live — there is no
     revalidation window to wait out. (Earlier versions of this runbook
     said "ISR, 300s stale time"; that was wrong, and it led to waiting
     out stale-time windows that never existed.) Practical consequence:
     if the new partner is missing, don't wait and re-check. Confirm via
     `mcp__Vercel__get_deployment` that the commit you expect is the one
     actually deployed — if it is, the HTML was baked without the partner
     and it's a code problem (check `PARTNERS` registration first).
     Query-string cache-busting won't force a refresh for a static route
     either.

5. **Verify images display correctly:**
   - Fetch a sample image URL directly (`gopricefinder.com/images/<partner>/<slug>.jpg`)
     and confirm HTTP 200 + image content-type, not a 404.
   - Cross-check file count in `public/images/<partner>/` against product
     count — a mismatch means some images never got downloaded/committed.

6. **Verify affiliate deep links are functional:**
   - The Awin `awin1.com/cread.php?...` tracking wrapper itself is blocked
     from automated fetching by its own `robots.txt`/permission prompts —
     expected, not a bug. Decode the `ued=` query param to get the real
     merchant destination URL and fetch *that* directly for a sample
     across partners, confirming it resolves to a live product page.
   - Structural check (covered in step 3): every deep link matches
     `https://www.awin1.com/cread.php?awinmid=<id>&awinaffid=<id>&ued=...`.

7. **Verify category and retailer page completeness:**
   - Confirm the partner's own retailer page lists every product from that
     partner's data file (spot-check the count).
   - Note: `getRealCategories()`/`getCategoryBySlug()` in `lib/partners.ts`
     intentionally group by category *name* across every partner (not
     partner-scoped) — a category tile aggregates real products from any
     partner using that exact category name. **Re-verified 2026-08-09
     across all six partners: 26 distinct category names, 0 shared by more
     than one partner** (Brooklyn Delhi 5, EVDANCE 6, Golden Maple 11,
     Canvas Vows 1, King Koil 1, Tsar Bomba 2 — which sum to 26, so the
     per-partner counts independently confirm the zero). So this doesn't
     currently produce any visibly wrong result, but it's by design
     (matches `getCategoryBySlug`'s own doc comment), and a future
     partner's category naming *can* collide with an existing one and make
     a tile show products from two unrelated partners together. **Don't
     trust the count above on faith — it went stale once already** (it read
     "22 across Brooklyn Delhi/EVDANCE/Golden Maple", correct when written
     at three partners). Re-derive it in one query per import:

     ```sql
     SELECT count(DISTINCT category) AS distinct_categories,
            (SELECT count(*) FROM (
               SELECT category FROM catalog_products
               GROUP BY category HAVING count(DISTINCT partner_id) > 1
             ) x) AS colliding_names
     FROM catalog_products;   -- colliding_names must be 0
     ```

8. **Assert the `public.products` re-sync actually worked.** Step 7 of
   the import workflow at the top of this doc tells you to re-sync
   `public.products`; this is the check that proves it landed. Doing the
   re-sync and confirming it worked are two different things, and until
   2026-08-09 only the first had a written procedure.
   `current_prices.product_id` references `products.id`, so any catalog
   ID with no matching `products` row makes refresh-prices fail at the
   database level for that product — the exact bug chain in the Appendix
   below (2026-08-02), where king-koil's IDs changed, the new IDs were
   absent from `products`, and every price write was rejected.
   tsar-bomba escaped only by luck.
   - `scripts/sync-products-to-supabase.ts` emits SQL for every partner in
     `PARTNERS` (as of 2026-08-09 — it previously filtered to a hardcoded
     `golden-maple`/`tsar-bomba` pair and silently emitted nothing for
     anyone else, which is the failure mode this assertion was written to
     catch). Confirm the file count and per-partner totals it prints match
     the partners you actually imported.
   - Assert coverage:

   ```sql
   SELECT COUNT(*) FROM catalog_products cp
   WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = cp.id);
   -- must be 0; non-zero means refresh-prices will hit FK violations
   -- writing current_prices for those IDs
   ```

   **Comparing raw row counts between the two tables is NOT this check,
   and must not be substituted for it.** The relationship is
   one-directional: `current_prices`, `price_history`, `wishlists`,
   `purchases`, and `cashback_claims` all reference `products`, and
   nothing references `products` *from* `catalog_products`. So extra rows
   in `products` are inert — stale leftovers that cannot break a write.
   Only a catalog row with no `products` row can reject one. A count
   comparison conflates those two directions and false-alarms on the
   harmless one: on 2026-08-09 it reported 974-vs-954 as drift, when all
   20 extras were orphaned king-koil variants plus a seed row and nothing
   was actually at risk. Assert the anti-join above; do not compare
   counts.

9. **Report status.** Once every check above passes AND the push is
   confirmed on `origin/main` *and* confirmed as the actually-deployed
   commit via Vercel, explicitly confirm: "Import of [partner(s)] is live
   on gopricefinder.com — N products verified across search, images, deep
   links, and category/retailer pages." If anything fails or is still
   pending (e.g. push not done yet), report exactly what's outstanding
   rather than a generic pass/fail.

## History (for context on future imports)

- **2026-07-25:** Brooklyn Delhi (29 products) — first real-partner
  integration.
- **2026-07-25:** EVDANCE (72) + Golden Maple (348) imported from Awin feed
  `awinfeed-3002879.csv`. Commits: `14dc4cf` (data + pages), `6a40a58`
  (420 images), `d0e8516` (fixed one Golden Maple product's placeholder
  `"\"` description). All three confirmed pushed to `origin/main` and
  confirmed as the live Vercel production deployment (`dpl_8VPbWeoZ...`,
  READY, aliased to `gopricefinder.com`) — **the Vercel pipeline itself
  was never broken.**
- **2026-07-25 (later same day):** Root-caused why the site still showed
  0 EVDANCE/Golden Maple products despite a healthy deployment: step 3 of
  this workflow (wiring the partner into `lib/partners.ts`'s `PARTNERS`
  array) was skipped during the `14dc4cf` import — the data files and
  `app/evdance/`, `app/golden-maple/` pages were all correctly built and
  already calling `getPartner("evdance")` / `getPartner("golden-maple")`,
  but the registry those calls look up never got the two new entries, so
  every one of those calls returned `undefined` and every section
  rendered zero products for both partners. Fixed in commit `d5d674d`
  (cloud clone) / `9ea754e` (device repo, same diff) by adding
  `normalizeEvdance`/`normalizeGoldenMaple` and their `PARTNERS` entries,
  plus fixing two now-stale hardcoded Brooklyn-Delhi-only references
  (`FeaturedDeals.tsx`'s "View all Brooklyn Delhi products" link, and
  `/trending`'s copy). Verified via `tsc`/`eslint` (clean), a full
  production `next build` (all 420+29 static product pages + 22 category
  pages generated), and Playwright screenshots of the homepage, both new
  partner pages, an EVDANCE product page, a `tesla` search (55 real
  results), and `/category/model-making`. Committed and staged for push;
  **user needs to run `git push` themselves from `E:\Price Finder`** —
  same limitation as every prior pass, see "Why this can't be fully
  automatic" above.

## Appendix: live price-refresh matching bug chain (2026-08-02)

Separate from partner *import* (this doc's main subject), the daily
AWIN price-*refresh* pipeline (`lib/pricing/refreshPrices.ts`,
`app/api/cron/refresh-prices/route.ts`) had its own multi-round
data-correctness bug, found and fixed via live production testing the
same day env vars were first configured. Recorded here since the root
cause — static catalogs going stale relative to the live AWIN feed —
is directly relevant to when/why a partner needs re-import, not just
initial import.

**What happened, in order:**

1. First live run matched feed rows to static products by normalized
   product **name**. Looked successful by row count, but silently
   collapsed distinct SKUs that share a name (color/size variants) onto
   one arbitrary price — e.g. king-koil's 29 real products share only
   ~3 distinct names, so only 1 of 29 ended up with any price at all
   (an arbitrary one); canvas-vows wrote correct-looking-but-wrong
   prices for the majority of its 204 products. **Real wrong data was
   written to production** `current_prices` before this was caught —
   corrected immediately via a direct `DELETE` against Supabase for the
   two affected partners, ahead of the code fix shipping.
2. Fix #1 (`0c69e6d`): match by the AWIN merchant product ID embedded
   in each product's deep link (`pclick.php?p=<id>&a=..&m=..`) instead
   of name — unique per SKU, falling back to name only when no ID could
   be extracted.
3. Fix #2 (`c394c5e`): king-koil still degraded to name-matching for
   20/29 rows. Root cause: this file only checked `aw_deep_link`/
   `merchant_deep_link` feed columns, but `scripts/import-partner.mjs`
   (which built the static catalogs) has a wider, independently-written
   candidate list (`deep_link`, `merchant_deep_link`, `affiliate_url`,
   `product_url`, `url`) — the two scripts had never agreed on one
   column name. Widened to the union of both.
4. Fix #3 (`1bb68bb`, final matching-logic fix): live diagnostics after
   fix #2 showed the column detection was fine — the real cause was
   that king-koil's (and, it turned out, tsar-bomba's long-unexplained
   26/189 match rate's) live feed IDs simply aren't in the static
   catalog snapshot taken at import time — new/renumbered SKUs added
   upstream since. The code was still falling back to name-matching
   whenever an extracted ID wasn't found in the catalog, which is
   exactly the unsafe behavior fix #1 was meant to eliminate. Changed
   so name-matching only triggers when **no ID could be extracted at
   all** (genuine feed-format problem); an extracted-but-unrecognized
   ID is now left unmatched and logged in a new
   `idNotInCatalogExamples` diagnostic field instead of guessed at.

**Interim verified state (2026-08-02, after fix #3):** zero
`duplicateKeyCollisions` and zero `matchedByName` across every active
partner — every feed row from every partner carries a real, extractable
ID, so the name-matching fallback path never fires in practice.
canvas-vows: 204/204 matched by ID. king-koil: 9/29 matched by ID (20
correctly left unmatched, logged). tsar-bomba: 26/189 matched by ID
(163 correctly left unmatched, logged) — this resolved the open
question from earlier in the day about why tsar-bomba's match rate was
so low: it was never a name-formatting problem, it's the same
stale-catalog cause as king-koil.

**Catalog refresh (commit `87877a2`, same day):** re-ran
`scripts/import-partner.mjs` for king-koil and tsar-bomba against fresh
AWIN feed exports, per the workflow above — king-koil 31→29 products,
tsar-bomba 272→272 (composition shifted; GB Feed deliberately excluded
from the tsar-bomba merge due to mixed GBP/USD pricing risk, not part
of the original import). Live re-verification immediately surfaced a
new, previously-invisible bug (see next item).

**products-table drift bug (fixed same session, no code change
needed):** after the catalog refresh, king-koil's refresh-prices run
matched 29/29 by ID but **failed every single upsert** with `insert or
update on table "current_prices" violates foreign key constraint
"current_prices_product_id_fkey"`. Root cause: `public.products` is a
*separate*, manually-synced table (see
`scripts/sync-products-to-supabase.ts`) — it is not derived live from
the static catalog files, and nothing re-syncs it automatically when a
partner's catalog is re-imported. `current_prices.product_id`
references `products.id`, so when king-koil's product IDs changed
during the catalog refresh, every new ID was simply absent from
`products` and every price write was rejected at the database level.
tsar-bomba was unaffected only because its 26 currently-matched IDs
happened to be unchanged from before the refresh — this was luck, not
correctness, and the same bug would have hit it too for any ID that
changed.

Fixed by generating the same upsert SQL `sync-products-to-supabase.ts`
would produce (id, name, category, image_url from the current static
catalog, `on conflict (id) do update`) and applying it directly against
production Supabase for all 301 current king-koil + tsar-bomba
products. Verified all 29 current king-koil IDs present in `products`
before re-testing; re-ran refresh-prices live and confirmed king-koil
now upserts 29/29 with zero errors. This is why **step 7 was added to
the main import workflow above** — re-syncing `public.products` needs
to be a standard part of every future partner import/re-import, not a
one-off fix.

**Final verified live state (2026-08-02):** canvas-vows 204/204
upserted, king-koil 29/29 upserted, tsar-bomba 26/272 upserted (272 is
now the correct up-to-date catalog size; the remaining 246 unmatched
are legitimately not yet in the live feed sample pulled during
testing or are still stale-catalog gaps — no longer investigated
tonight). Every partner's `duplicateKeyCollisions` and `matchedByName`
are 0. Nothing in `current_prices` can currently be wrong — only
present-and-correct or absent.

**Follow-up (not urgent, not yet done):** re-verify tsar-bomba's
coverage now that its catalog is refreshed — its 26/272 in the final
run above may still be undercounting now that IDs have changed again;
worth a fresh check next time refresh-prices is run, but not
investigated further tonight since nothing is unsafe in the meantime.
