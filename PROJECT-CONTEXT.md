# Price Finder — Project Context

Business model, current state, and roadmap for GoPriceFinder.com.

## The Core Concept

GoPriceFinder.com is a price comparison and affiliate discovery website. The
idea: users come to find good deals across multiple retailers/brands in one
place, click through to buy, and the site earns a commission on the sale via
affiliate networks (AWIN, Rakuten, and eventually others).

The site isn't selling anything directly — it's the middleman that helps
people discover products and points them to where they can buy, earning a
cut of each sale.

## How It Makes Money

1. User visits gopricefinder.com
2. Browses/searches for a product (e.g., "EV charger" or "paintbrush")
3. Sees product cards with images, prices, ratings from various partner brands
4. Clicks "Shop Now" / "View Deal" → goes to the partner's actual website via
   a tracked affiliate link
5. If they buy, the site earns commission (ranges from 2.5% to 20%+ depending
   on partner)

## Current State (as of now)

**Live partners (3):**

- Brooklyn Delhi (Food — chutneys, achaar) — 29 products, 15% commission
- EVDANCE (EV chargers/accessories) — 72 products
- Golden Maple (art supplies) — 348 products

Total catalog: ~449 products

**Tech stack:**

- Next.js website
- Supabase (database)
- Vercel (hosting)
- GitHub (code repo)
- AWIN + Rakuten (affiliate networks)

**Site sections currently built:**

- Homepage with hero, retailer dropdown, "Our Partners," Best Sellers,
  Popular Categories
- Search bar (functional but not fuzzy/smart yet)
- Category pages (currently need better isolation/organization)
- Product detail pages
- User signup/login with profanity filter

## What's Not Working Yet (the honest gap list)

1. Search isn't smart — no fuzzy matching, typos don't return results, not
   "Google-like"
2. Categories are messy — too many generic categories for too few partners;
   needs restructuring into clean, logical groups
3. Product card design isn't finalized — inconsistent sizing, styling needs
   a real design pass
4. No clear visual identity — the site doesn't yet have a distinctive,
   polished look
5. Deployment reliability — had issues where code was pushed but not
   reflecting live (Vercel sync issues)
6. No compliance automation yet — partner terms/rules aren't yet enforced
   automatically before data goes live (in progress)

## Where You're Headed (the vision)

**Phase 1: Nail the design & UX (where you are now)**

- Decide on a clear visual identity — colors, typography, layout style
- Perfect the search experience (Google-like: instant, fuzzy, relevant)
- Finalize product card design (consistent, clean, scannable)
- Build a clean, simple category structure (8-10 max, not 20+)
- Make sure it's fully mobile responsive

**Phase 2: Build bulletproof automation**

- One general-purpose import script that takes any partner's data (CSV or
  API) and automatically places it correctly — no manual fixes
- Compliance gate that checks every partner's terms before anything goes
  live (no plagiarism, no unauthorized images, right commission
  calculations, etc.)
- Fuzzy search built in from the start
- Auto-categorization logic

**Phase 3: Scale up partners**

- Once the design and automation are solid, apply to bigger retailers
  (Newegg, IKEA, Dyson, Anker, etc. via Rakuten)
- Import strategically — not entire catalogs, but curated/filtered
  selections (e.g., top 500-1,000 products per big retailer, not all 50,000)
- Add live API syncing for price freshness where available (vs. static CSV
  re-imports)

**Phase 4: Growth & optimization**

- FTC affiliate disclosure (still pending)
- Analytics to see what people actually search for/click (informs future
  partner priorities better than guesswork)
- "Stores" directory page — all partners with logos, linking out
- Automated daily/weekly feed refresh (cron jobs) so prices stay current
  without manual work
- Expand to more affiliate networks (CJ Affiliate, Impact Radius) to catch
  retailers not on AWIN/Rakuten (Best Buy, Walmart, Target, Wayfair)

---

## Session log — 2026-07-28 (Phase 1 redesign + Phase 2 groundwork)

Everything below is current as of this session. The "gap list" and "phases"
above are now partly outdated (search IS fuzzy, categories ARE
restructured) — this section is the accurate up-to-date status; treat the
sections above as historical framing, not current fact.

### Live on gopricefinder.com (committed and pushed)

- **Full visual redesign**: Fraunces + Schibsted Grotesk (Inter fully
  retired), cream/sage/gold light theme, dark theme unchanged
  (noir/gilt/ivory), flat vector logo (`components/LogoMark.tsx`) replacing
  5 old raster exports. Homepage streamlined: Featured Deals and Best
  Sellers removed (still live at `/deals` and `/trending`, which read
  `lib/partners.ts` data functions directly), Hero's "Popular:" pill row
  removed, new `FutureOfWebsite` vision section added below the stats.
  Live fuzzy-search dropdown in the header/hero search bar.
- **`RealProductCard`**: single "View" button (no retailer name on the
  card) → links to the product's own detail page, where "View on
  [Partner]" already lives as the explicit next step.
- **Compliance registry** (`lib/partner-compliance.json`): Brooklyn Delhi
  is `imageUsagePermission: "assessed-low-risk"` (real photos live).
  Reviewed and entered accurate terms for AlorairCrawlspace, Canvas Vows,
  Giftlab, King Koil, Tsarbomba from their real AWIN terms PDFs — commission
  rates, cookie windows, commission-base inclusions, trademark-bidding/
  coupon restrictions. Golden Maple's commission base was corrected (was
  wrongly `false` on all four inclusion flags; real terms say `true` on
  all four). **None of these 5 new partners are imported/live yet** — terms
  reviewed only.
- **Known real gap, not yet resolved**: EVDANCE and Golden Maple have no
  `imageUsagePermission` value at all (never actually reviewed for image
  rights specifically, unlike Brooklyn Delhi) — currently their images
  still show because the *live* `canShowRealImages()` still uses the old
  `!== "pending"` check. A stricter fail-closed rewrite of that function
  exists in the working tree (`lib/partner-compliance.ts`, uncommitted)
  but deploying it would hide both partners' images until this gap is
  resolved — deliberately held back pending your decision.

### Built this session, NOT yet committed (working tree only)

- `config/walmart-taxonomy.json` — 11 departments / 55 categories / 93
  product-type groups / ~335 product types. Manually constructed
  (not scraped from Walmart), built to be the target taxonomy all future
  partners map into.
- `lib/category-mapper.ts` — rule-based classifier (keyword + brand +
  price + partner-bias, confidence 0-100). Two real bugs found and fixed
  during testing: a false substring match ("vas" inside "canvas") and
  generic-word false positives ("gift" matching "Gift Wrap" for anything
  merely marketed as a gift). Verified against real Brooklyn Delhi/
  EVDANCE/Golden Maple products and all 4 new-partner AWIN feeds.
- **Decisions confirmed on the mapper's output**: keep EVDANCE→Automotive
  > EV Charging and Golden Maple→Toys & Games > Arts & Crafts as correct
  (they don't match your original stated expectations of "Electronics"
  and "Home/Kitchen/Food," but they're factually right for what those
  partners actually sell). If/when Tsarbomba is imported, use its "US
  Feed" (246 products) instead of the "Default" feed (189 products) —
  richer schema. Canvas Vows and Giftlab are explicitly on hold — their
  feed data quality (empty categories, generic novelty-gift titles) isn't
  good enough to auto-categorize confidently yet (nearly their whole
  catalogs scored under 70 confidence).
- `app/categories/page.tsx` — new taxonomy browser page, product counts
  computed live against the current 449-product catalog via the mapper.
  Nav "Categories" link now points here instead of the old homepage
  `#categories` anchor. **This is a preview/scaffolding page, not yet
  reconciled with the real product-browsing system** — see next section.
- `scripts/awin-status-report.ts`, `scripts/test-category-mapper.ts`,
  `scripts/test-new-partner-feeds.ts` — manual, read-only diagnostic
  scripts (AWIN account/feed status, mapper testing). None are scheduled;
  run manually with `node --env-file=.env --import tsx scripts/....ts`.
- `.env` (gitignored, never committed) holds `AWIN_API_TOKEN`,
  `AWIN_PUBLISHER_ID`, `AWIN_FEED_LIST_URL` — needed to run the AWIN
  scripts above. `.gitattributes` also sits uncommitted (line-ending
  normalization fix from earlier in the project).

### Two category systems currently coexist — reconciliation plan agreed, not yet executed

- **Old, live**: `lib/category-map.ts` + `config/category-rules.json` — 1
  level, 5 parent categories, drives the real `/category/[slug]` pages.
- **New, preview-only**: the Walmart taxonomy + mapper above — 4 levels,
  drives only `/categories`.
- **Agreed staged migration** (none of it executed yet):
  1. Stage 1 (in progress as of this log entry) — run the mapper against
     all 449 *live* products, review the confidence distribution.
  2. Stage 2 — persist validated mappings onto each product at *import
     time* (extend `RealProduct`, compute once via
     `scripts/import-partner.mjs`, same pattern as the existing
     `parentCategory` field), not recomputed live on every render.
  3. Stage 3 — decide which taxonomy depth `/category/[slug]` should key
     off (likely Walmart *department*, not full depth) — blocked on
     Stage 1's real numbers, explicitly not decided yet.
  4. Stage 4 — redirects from old category slugs, then retire
     `lib/category-map.ts`/`config/category-rules.json`.
  5. Stage 5 — merge `/categories` and `/category/[slug]` into one
     connected experience.
  **Explicit instruction: only Stage 1 is approved to run right now.**

### Confirmed needing no work

- Homepage "Our Partners" and Hero's stats (449/3/Daily) are **already
  fully dynamic** — both read from `lib/partners.ts`'s `PARTNERS` export,
  which is itself `ALL_WIRED_PARTNERS` filtered live through the
  compliance gate (`isPartnerLive`). No hardcoded values anywhere. The
  only manual step that will ever remain is wiring a new partner's data
  file into `ALL_WIRED_PARTNERS` in the first place — that's the import
  step itself, not a display-layer gap.

### Superseded — see "Session log — 2026-07-29" below

Everything in this "2026-07-28" section (Stage 1 status, the two-
category-system coexistence, the "nothing committed" note) has been
overtaken by the next session's work: the full 5-stage migration ran to
completion, the fail-closed image gate is live, and eight commits landed
and were pushed. Kept here for historical framing only — do not treat
anything below this point as still-pending.

---

## Session log — 2026-07-29 (taxonomy migration completed, compliance gate activated, Canvas Vows imported)

Continuation of the previous session. Everything below is current as of
this log entry. Commits are listed oldest→newest; all are pushed to
`origin/main` unless noted.

### Taxonomy migration — Stages 1 through 5, all complete and live

- **`2040243`** — Built the taxonomy mapper and fixed real bugs found via
  testing against the live 449-product catalog: substring false matches
  ("vas" inside "canvas", later also "water" inside "watercolor" in a
  second pass), a generic-word false-positive ("gift" matching "Gift
  Wrap" for anything merely gift-marketed), and a scoring-completeness
  bug where partial keyword matches were credited a flat amount
  regardless of how many phrase words actually matched, letting weaker
  generic candidates systematically outscore better specific ones.
  Confidence ≥70 rose from 21.6% to 74.6% across the fixes. Added hard
  partner overrides (bypass the generic scorer, return a fixed leaf at
  confidence 95) for Brooklyn Delhi (all 29 products, classified by
  title keyword since the feed's partnerCategory is just "Food") and
  Golden Maple (partial, 220/348 — matched against the *real* categories
  from artgoldenmaple.com itself, not guessed).
- **`9bd2d62`** (Stage 4) — Switched the live `/category/[slug]` from the
  old 5-parent-category system to the Walmart-taxonomy department level.
  Old system (`lib/category-map.ts`, `config/category-rules.json`)
  retired to `_to_delete/`, confirmed nothing else referenced it (found
  and fixed two dependencies a narrow search would've missed:
  `scripts/awin-status-report.ts` and `scripts/import-partner.mjs`, the
  latter's category-classification step removed entirely since it only
  ever fed a console printout, never the generated data file).
  Redirects added for the 3 old URLs that changed.
- **`832cb3d`** (Stage 5) — Connected `/categories` (the taxonomy
  browser) to `/category/[slug]` — a populated department gets a "View
  all products" link, generated via the same `slugifyRealCategory()`
  both pages share so they can't drift.
- **`cf8ea30`** — Two `/categories` UX fixes: accordion sections load
  closed by default (were auto-opening); Arts & Crafts promoted from a
  category nested under Toys & Games to its own top-level department,
  since 100% of Toys & Games' real volume (Golden Maple's 348 products)
  was Arts & Crafts. Toys & Games kept in the taxonomy, now fully empty/
  "Coming soon" — ready for a real toy partner later, not deleted.
  `/category/toys-games` and the older `/category/art-craft-supplies`
  both redirect to `/category/arts-crafts` in one hop.
- **`e5b2b63`** — Fixed a real bug: `/categories`' product-type/ptg
  counts were keyed by leaf name alone, so names that repeat across the
  taxonomy ("T-Shirts" under 4 categories, "Wet Palettes" twice within
  the *same* Arts & Crafts category) showed the same count under every
  branch sharing that name, whether or not that branch had real
  products. Now keyed by full path. Added a leaf-level drill-down:
  `/category/[slug]/[...path]` (path = `[categorySlug, ptgSlug,
  productTypeSlug]`) so a populated product-type pill shows only that
  leaf's products, not its whole parent department — scoped
  deliberately to leaf-only, category/ptg levels stay display-only, no
  intermediate pages. **Caught a real build regression during
  verification**: the new leaf pages recomputed the full 449-product
  mapping from scratch on every call (2× per page × ~20 pages, many
  building in parallel), which timed out every single page past
  Next.js's 60s static-generation limit. Fixed with a per-process
  memoization cache — safe since the catalog is fixed for a build's
  lifetime.

**`/category/[slug]` now serves 6 real departments**: Toys & Games
(→ renamed Arts & Crafts), Home, Automotive, Grocery & Food, Apparel &
Accessories, Party Supplies — Home is populated only once Canvas Vows
goes live (see below).

### Compliance gate — fail-closed, now active (`369a80d`)

Activated the stricter `canShowRealImages()` that had been sitting
uncommitted in the working tree all last session, deliberately held
back until every partner with real images live today had a documented
decision. Old behavior was fail-*open* (anything not literally
`"pending"` showed real images, including an unset field — the actual
gap that let EVDANCE/Golden Maple's images show without ever being
reviewed). New behavior is fail-*closed*: only `"confirmed"` or
`"assessed-low-risk"` show real images; an unset field, `"pending"`, or
a typo'd value now default to the placeholder. Also added
`validateComplianceRegistry()`, which throws at module load if any
partner's `imageUsagePermission` holds a value outside the three
defined ones.

**Before activating, ran the actual gate against all 7 live/pending
partners and caught a real gap**: Golden Maple had been reviewed for
image rights (Branding tab: "No branding guidelines," same basis as
Canvas Vows/King Koil) but never actually got `imageUsagePermission`
written to the compliance file — confirmed by loading the site locally,
where every Golden Maple product image rendered as the placeholder.
Fixed by adding the entry before activating; re-verified all 7 pass.

### Every partner's image-usage rights — all reviewed, all documented

| Partner | Commit | Basis |
|---|---|---|
| Brooklyn Delhi | `b300996` (prior session) | Terms silent, content use encouraged — assessed-low-risk |
| EVDANCE | `f21d7da` | Checked AWIN terms page directly — every section silent on images — assessed-low-risk |
| Golden Maple | `369a80d` | Branding tab: "No branding guidelines" — assessed-low-risk (the gap the gate activation caught) |
| Canvas Vows | `94c82b3` | Branding tab: "No branding guidelines" — assessed-low-risk |
| King Koil | `94c82b3` | Branding tab: "No branding guidelines." — assessed-low-risk |
| AlorairCrawlspace | `94c82b3` | Explicit grant: "Access to... product images" as a program benefit — assessed-low-risk |
| Tsarbomba | `94c82b3` | Explicit grant: "High-Converting Creative Assets: Access to professional imagery," plus "SEO-Driven Marketers & Review Sites" named as a target partner type — assessed-low-risk |
| Cosabella | `b0ac34f` | **`"confirmed"`** — the strongest tier, one above the rest: a direct written grant verified verbatim in Cosabella's own binding Program Terms PDF ("4. Approved Imagery"), not our own risk read of softer marketing language |

**Giftlab was dropped entirely** (`94c82b3`) — ambiguous image terms +
low company rating. Removed from `partner-compliance.json`, the dead
`PARTNER_BIAS` rule in `lib/category-mapper.ts`, and both feed-audit
scripts. One historical bug-fix comment mentioning Giftlab was
deliberately kept (documents a real testing finding, not a live
dependency).

### Cosabella — new partner, compliance-cleared, not imported

Two source PDFs existed with different completeness — a marketing
"Publisher Resource Pack" (missing several claimed terms) and the real
"Program terms and conditions" (confirmed everything). Read both
directly rather than trusting either summary; the exercise caught that
the initially-quoted image-usage phrase wasn't actually in the first
PDF, which is exactly why the second, formal document mattered.
`status: "reviewed-not-applied"` — verified via the actual gate
functions that this fully blocks the partner from displaying regardless
of the (confirmed) image permission. **Feed has not been pulled yet.**

### Pending queue (nothing below is done — this is the punch list)

- **Canvas Vows** — compliance-cleared (`assessed-low-risk`), override
  already built and verified (204/204 real feed products → Home > Decor
  > Wall Decor > Wall Art, 0 outliers). Ready to import — this is the
  next thing happening as of this log entry.
- **King Koil, Tsarbomba** — AWIN feeds already pulled and tested against
  the mapper (see prior session's Part 4 testing), but not yet
  reviewed/finalized against the *current* taxonomy depth or given
  partner overrides. Compliance-cleared (`assessed-low-risk`) but not
  imported.
- **Cosabella** — compliance-cleared (`"confirmed"`, the strongest
  tier), but the AWIN feed has not been pulled or tested against the
  mapper at all yet.
- **Still fully untouched**: FTC affiliate disclosure, analytics, SEO
  work, legacy-code cleanup (`scripts/analyze-golden-maple.ts` is a
  self-described one-off still sitting in the repo;
  `lib/partner-compliance.ts`'s now-committed fail-closed logic vs. the
  `PartnerComplianceEntry` TypeScript type still not covering several
  ad-hoc fields like `noTrademarkBidding`/`noUnauthorizedCoupons`/
  `noBrandComparisonWording` that are used in the JSON but never
  declared in the type — pre-existing gap, not new), and the other 8
  pending AWIN advertisers reviewed early in the previous session
  (`aaawave`, `dignity-lifts`, `energy-muse`, `advanced-clinicals`,
  `beautyologie-caire-beauty`) that have compliance entries but no
  further action taken.
- **Two real production bugs found during a Vercel/image-optimization
  check (2026-07-30), not yet fixed — found via `get_runtime_errors`,
  confirmed real, deliberately left alone since they were out of scope
  for that task**:
  - `/api/cron/check-price-alerts` fails every run with `Missing
    NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — both are
    required to create an admin Supabase client` (7 occurrences over the
    prior 7 days, same error every time) — the cron job's Vercel env vars
    are missing/misconfigured.
  - One `/dashboard` request failed with `{"code":"PGRST303",...,
    "message":"JWT issued at future"}` — a Supabase/client clock-skew
    issue (single occurrence so far, but worth understanding since it's a
    real auth-path failure).

### Still uncommitted, unrelated to any of the above

`golden-maple`'s `commissionBase` in `lib/partner-compliance.json` has
been sitting as a locally-modified, never-committed change since before
this session started (`false`/`false`/`false`/`false` in the last commit
vs. `true`/`true`/`true`/`true` in the working tree) — every compliance
commit this session deliberately isolated around it rather than sweeping
it in unreviewed. Still needs an explicit decision. `CLAUDE.md`,
`.gitattributes`, `PHASE2-AUTOMATION-SPEC.md` also remain uncommitted
from earlier in the project, untouched this session.

### Superseded — see "Session log — 2026-07-30/31" below

Canvas Vows, King Koil, and Tsarbomba (from the pending queue above) were
all imported live in the next session. Cosabella's feed status, the two
production bugs, and the golden-maple `commissionBase` gap are still
accurate and carried forward unchanged. Everything else in this
"2026-07-29" section is historical framing only.

---

## Session log — 2026-07-30/31 (imports completed, SEO/structured-data foundation, image-optimization fix, brand rename)

Continuation of the previous session. Commits listed oldest→newest, all
pushed to `origin/main` unless noted otherwise. This log entry exists as
a context-window checkpoint — written mid-session, so "current" below
means as of this entry, not necessarily reflecting anything requested
after it.

### Partner imports — Canvas Vows, King Koil, Tsar Bomba all live

- **`4f6f302`** — Canvas Vows (204 products, real AWIN feed) →
  `Home > Decor > Wall Decor > Wall Art` override, matching the plan from
  the prior session.
- **`cf25c4a`** — King Koil (31 products) and Tsar Bomba (272 products,
  merged from two AWIN feeds — the "Default" and "US" feeds had partial
  overlap, merged and deduped rather than picking just one) imported
  live together.
- Catalog is now **956 real products across 6 partners** (Brooklyn Delhi,
  EVDANCE, Golden Maple, Canvas Vows, King Koil, Tsar Bomba).
- **Cosabella re-checked twice this session** (most recently just before
  this log entry) — AWIN confirms the program relationship as `Active`
  (joined), but **no product feed has been registered on AWIN's side
  either time**. Nothing to pull yet; compliance stays `"confirmed"`
  tier, `status: "reviewed-not-applied"`. Re-check again before assuming
  this has changed.

### SEO foundation — sitemap, robots, structured data, Search Console

- **`433b102`** — `app/sitemap.ts` (real-data-driven, auto-includes every
  live partner/product/category), `app/robots.ts` (disallows the legacy
  mock-system routes), and a real duplicate-title bug fix: several
  partners' feeds reuse the same product name across color/size variants,
  which collided on identical `<title>` tags — fixed with a shared
  `getProductTitleSuffix()` helper (price, then a real feed detail like
  color when price doesn't disambiguate, then a stable "N of M" index as
  last resort — never a fabricated distinguishing detail).
- **`ac4f330`** — JSON-LD structured data: `Product` schema on every real
  product page (price, brand, offer URL, `aggregateRating` only when a
  product actually has one), `BreadcrumbList` on category pages,
  `Organization` on the homepage.
- **`055ec0f`** — Fixed a real BreadcrumbList validation failure caught
  by Google's actual Rich Results Test (not just structural
  self-checking): the leaf category page's breadcrumb included two
  levels with no real URL of their own, which Google requires on every
  non-final item. Fixed by dropping those two levels from the JSON-LD
  rather than inventing URLs for them.
- **`c4121c8`** — Google Search Console site-verification meta tag.
- **`112a789`** — Real branded Open Graph image (`app/opengraph-image.tsx`,
  built via `ImageResponse`, real Fraunces/Schibsted Grotesk fonts fetched
  at build time). Root cause of the prior "unrelated coin image" in
  link previews: no OG image existed at all, so Facebook/Messenger fell
  back to the old raster favicon (a gold/bronze compass-and-magnifying-
  glass icon that reads as a coin out of context).

### Image-optimization / performance work

- **`9b482aa`** — Trimmed `next/image`'s `deviceSizes` from Next's
  default 8 breakpoints (up to 3840px) down to 7 (up to 1920px) — checked
  every real `next/image` usage on the site first; nothing ever needs
  wider than ~1920px given the site's `max-w-7xl` container cap. Cuts the
  size-variant matrix ~25%.
- **`1163a02`** — **The real fix for the "site loading slowly" report**,
  root-caused with actual data (Vercel runtime logs/errors — clean, no
  timeouts; direct `curl` timing — normal TTFBs; the real finding was
  page *weight*): Golden Maple/Tsar Bomba/Canvas Vows each rendered their
  entire catalog (204-348 products) on one page load — 1.5-2.8MB of HTML.
  Fixed with real static pagination (36 products/page,
  `/[partner]/page/N`, `lib/pagination.ts` + `components/Pagination.tsx`
  shared across all three) — verified page weight dropped 79-88%
  (Tsar Bomba 2.36MB→349KB, Golden Maple 2.78MB→335KB, Canvas Vows
  1.5MB→319KB), confirmed a full cross-page product audit shows zero
  duplicates/gaps.
- Same commit **installs `@vercel/speed-insights` for real** — it had
  been reported done in an earlier turn but was never actually in the
  codebase; this time verified via direct file/package inspection both
  before (confirmed absent) and after (confirmed present, wired into
  `app/layout.tsx` identically to the already-working `Analytics`
  component). **Known gap**: Vercel docs show a separate project-level
  "Enable Speed Insights" toggle beyond the code integration
  (`vercel project speed-insights` CLI command, or a dashboard toggle) —
  not controllable from here; worth confirming it's on if data seems
  thin.

### Brand rename: "Price Finder" → "Go Price Finder" — staged, NOT yet pushed

Full codebase audit done first (every `Price Finder`/`PriceFinder`/
`price-finder` occurrence, ~65 across 50 files) before touching anything,
categorized and confirmed line by line:

- **Updated**: logo/wordmark (`Logo.tsx`), footer (tagline, disclosure
  blurb, copyright), root metadata (`app/layout.tsx`), `Organization`
  JSON-LD `SITE_NAME`, the OG image (both `alt` text and the actual
  rendered PNG — regenerated via a real build, not a text patch), every
  page title (~50 occurrences, 25 files, all `"[Page] — Price Finder"` →
  `"[Page] — Go Price Finder"`), visible body copy (homepage narrative,
  "Why Price Finder" heading, "How Price Finder works," "New to Price
  Finder?"), and customer-facing email copy (`lib/email/resend.ts`'s
  "From" display name, `priceDropAlert.ts`'s header/footer).
- **Deliberately left alone, with real reasons**: `lib/theme-context.tsx`'s
  `localStorage` key `"price-finder-theme"` (renaming it would silently
  reset every returning visitor's saved theme — not customer-facing text,
  a storage identifier); `package.json`'s `"name": "price-finder"` (npm
  package identifier, cascades into `package-lock.json`, a separate
  "rename the whole project" decision); `app/products/[slug]/page.tsx`
  (still-live legacy mock-catalog page, already queued for removal —
  explicit instruction to leave it); a compliance note in
  `partner-compliance.json` that already informally said "GoPriceFinder"
  (a point-in-time compliance record, not live copy); internal-only
  comments/docs (`README.md`, `CLAUDE.md`, `DESIGN_SPEC.md`,
  `lib/partners.ts` comments, SQL migration headers) — not customer-
  facing, explicitly skipped per instruction.
- Verified via a full re-scan after editing: zero stray "Price Finder"
  left in any of the 34 touched files, all the "leave alone" files
  confirmed still untouched.
- **Staged and reviewed (before/after OG image shown, homepage/product
  page rendered output confirmed) but not yet committed or pushed** —
  waiting on final go-ahead.

### Pending queue (nothing below is done — this is the current punch list)

- **LCP investigation — in progress as of this log entry.** Vercel Speed
  Insights reports desktop LCP at 13,188ms (FCP and CLS both fine, so
  this is isolated to the largest-contentful-paint element specifically)
  — about to diagnose the actual LCP element, whether `priority` is
  missing on it, image size, or something else. Real diagnosis not done
  yet; no fix proposed yet.
- **Brand rename** — staged locally, fully verified, not committed/pushed
  (see above) — needs a final go/no-go.
- **Cosabella** — still compliance-cleared, still no AWIN feed registered
  (checked twice this session, most recently right before this log
  entry). Nothing else to do until AWIN shows a feed.
- **Two real production bugs**, found via Vercel's actual runtime-error
  data, confirmed real, still not fixed (deliberately out of scope both
  times they were found):
  - `/api/cron/check-price-alerts` — fails every run,
    `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`.
  - `/dashboard` — one `{"code":"PGRST303",..."JWT issued at future"}`
    error, a Supabase/client clock-skew issue.
- **8 unreviewed AWIN advertisers** carried forward unchanged from the
  prior session (only 5 are actually named in that log:
  `aaawave`, `dignity-lifts`, `energy-muse`, `advanced-clinicals`,
  `beautyologie-caire-beauty` — the "8" figure is inherited text, not
  independently re-verified this session).
- **Legacy mock-system cleanup** — `app/products/[slug]`, `lib/data.ts`,
  and the mock `/dashboard`/`/wishlist`/`/purchases` surface are still
  fully untouched; explicitly deferred again this session (see the brand-
  rename section above).
- **`golden-maple`'s `commissionBase`** — still uncommitted, still
  unresolved, still isolated out of every compliance commit (see "Still
  uncommitted, unrelated to any of the above" above — unchanged this
  session).
- FTC disclosure is now actually live (`a5e4192`, see prior section if
  added) — analytics, remaining SEO work, and legacy-code cleanup
  (`scripts/analyze-golden-maple.ts`, the `PartnerComplianceEntry` type
  gap) are still untouched.

### Three items flagged, not found in this session — needs your confirmation

The context-checkpoint request that produced this log entry also asked
to record "the Argendon fit decision," "a Cosabella clarification email
drafted but not sent," and "an IKEA application ready to draft." **None
of these appear anywhere in this session's actual history** — no
Argendon mention exists at all, no email was ever drafted for Cosabella
(its real status is above: compliance-cleared, no feed yet, nothing
drafted), and IKEA has never come up. Rather than invent details for a
save-point document a future session would treat as fact, these are
recorded here as unverified/unrecognized — confirm whether they belong
to a different project or conversation.
