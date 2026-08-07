# GoPriceFinder Website Redesign & Scale Architecture Plan

**Prepared:** 2026-08-03
**Context:** Follow-up to `claude/strategic-growth-plan-2026-08-02.md` and `claude/price-com-competitor-research-2026-08-02.md`. Kawsar's direction: the site should eventually combine Price.com's breadth (many categories, many partners, cash back, eventually 1M+ products as more advertisers are added) with camelcamelcamel's depth (real price history, trend charts, and price-drop alerts on every product) — not one model or the other, both, built out over time as advertiser count grows.

This doc records the current-state audit and the resulting architecture plan so this isn't lost or re-investigated later.

## 1. The visual redesign is done — this is not that

Colors/typography already match a Price.com-inspired but legally distinct light theme (see the corrected note in the strategic plan, Section 4). "Redesign" going forward means information architecture and infrastructure: what data each page shows, and what the site is built on top of — not colors.

## 2. Current state, confirmed by direct code audit (2026-08-03)

| Layer | Today | Scales to 1M+ products? |
|---|---|---|
| Catalog storage | Checked-in static TypeScript files (`lib/<partner>-data.ts`, ~10,000 lines today) read via `getAllRealProducts()` | **No.** Every catalog change requires editing a source file and a full rebuild/redeploy. |
| Search | Client-side Fuse.js indexing the *entire* catalog (`lib/search.ts`), ~1.5MB payload at 956 products, deferred until first search interaction but still fully shipped/parsed then | **No.** ~1.5MB scales roughly linearly — 1M+ products means a multi-gigabyte client-side index. Non-viable. |
| Partner onboarding | Fully manual: a human runs `scripts/import-partner.mjs` once per partner/per catalog refresh, which writes a new static TS file and registers it | **No.** Does not scale past a handful of partners without becoming the operator's full-time job. |
| Categories | Static taxonomy JSON (`config/walmart-taxonomy.json`) + a rule-based classifier run against the static catalog | **Partially.** The taxonomy itself can grow, but it inherits the storage/compute ceiling above, and new structurally different verticals (hotels, gift cards) need new taxonomy branches, not just more rows. |
| Price history / alerts | **Already built and running**: `public.price_history` (Supabase, append-only, daily snapshot via Vercel Cron), `check-price-alerts` cron evaluating drops daily | Yes — this part is already database-backed and scales fine. It just isn't surfaced on product pages yet (see below). |
| Live price refresh | **Already built and running** (this session's work): AWIN feed → match → upsert into `current_prices`, daily via Vercel Cron, 5 of 6 partners live | Refreshes *existing* products' prices at scale fine. Does not add *new* products — that's still the manual import script. |
| Product page | Image, price, rating, wishlist, outbound link, description, related products. JSON-LD included. | N/A — this is a feature-completeness question, not a scale question (see Section 4). |

**Bottom line:** the two infrastructure pieces built this session (price refresh, price history/alerts) are exactly the camelcamelcamel-style backbone the site needs, and they already scale. What's missing to reach "both models combined at real scale" is catalog storage, search, and partner onboarding — none of which are wired up yet, and all three block growth past roughly the current partner count regardless of how good the UI looks.

## 3. Three real blockers, ranked by what breaks first as advertiser count grows

1. **Partner onboarding pipeline (breaks first, ~10-20 partners in).** Kawsar's own stated plan is to start applying to more advertisers once web design work wraps. Every new partner today costs real manual hours (CSV import, image processing, category classification, manual registration) — this is the most immediate bottleneck, arrives before the other two become painful, and is squarely Workstream 3.2 (Partnerships) territory colliding with Workstream 3.1 (Engineering) territory. Fixing this means building a real catalog-ingestion pipeline: partners' feeds land in Supabase directly (not a generated TS file), ideally scheduled/automated the same way `refresh-prices` now is, rather than a human running a script per partner.

2. **Catalog storage (breaks next, tens of thousands of products in).** Once products live in Supabase as the source of truth instead of static TS files, both the onboarding pipeline (1) and search (3) become tractable, and category pages / product pages can be server-rendered from a real database query instead of an in-memory array. This is the foundational migration everything else depends on.

3. **Search (breaks last but most visibly, when it breaks).** Once catalog storage moves to Supabase, this becomes a database full-text search (Postgres `tsvector`/`pg_trgm`, which Supabase supports natively) or a dedicated search service (Algolia/Meilisearch/Typesense) if search UX needs to get more sophisticated (typo tolerance, faceted filtering by category/price/retailer) than Postgres full-text alone comfortably provides. Recommend starting with Postgres full-text (no new vendor, already have Supabase) and only reaching for a dedicated search service if/when query volume or UX needs outgrow it.

**Sequencing implication:** these three are not independent — (1) and (3) both depend on (2) being done first. So the real next infrastructure phase, once prioritized, is: migrate catalog to Supabase → rebuild search on top of Supabase → rebuild the partner-onboarding pipeline to write directly into Supabase instead of generating TS files. This is a genuinely large undertaking (each step touches most of the site's read paths) and should be scoped as its own phase, sequenced into Section 4 of the strategic plan rather than started ad hoc.

## 4. Product page redesign — the camelcamelcamel-style depth Kawsar asked for

This part is comparatively fast because the data already exists (`price_history`, alerts) — it's a UI gap, not an infrastructure gap. Recommended additions to every product page:

- **Price history chart** (not just the small sparkline already on card previews) — full interactive chart pulling from `public.price_history`, the actual camelcamelcamel signature feature.
- **"Set a price alert" CTA** directly on the product page (alerts infrastructure already exists via `check-price-alerts`; today there's apparently no direct on-page entry point per the audit — worth confirming/building this UI hook).
- **Historical low / average price callouts** ("Lowest price in the last 90 days: $X", "Today's price is Y% below average") — cheap to compute from existing `price_history` rows, high perceived value, exactly the kind of trust-building data point camelcamelcamel is known for.
- **Multi-retailer price comparison** (price.com-style) — once more than one partner carries overlapping/comparable products, show competing prices side by side on one product page. Low priority today since the 6 partners don't meaningfully overlap in catalog, but worth designing the UI to support it now so it's not a rebuild later.

This product-page work does **not** depend on the Section 3 infrastructure migration and can be built now, incrementally, without waiting on catalog/search scaling.

## 5. Recommended sequencing (fits into the existing Phase 0-5 roadmap, doesn't replace it)

1. **Now, low-risk, no dependency:** product-page redesign (Section 4) — ship the price-history chart, alert CTA, and historical-low callouts. Real user-facing value, uses infrastructure that's already live, doesn't block or get blocked by anything else.
2. **Before serious partner-count growth:** scope and build the Supabase-backed catalog migration + rebuilt onboarding pipeline (Section 3, items 1-2 together, since onboarding depends on storage). This should happen before Kawsar's "start applying to more advertisers" push produces a catalog nobody can manage.
3. **When search UX visibly strains** (either from more products or from user feedback): rebuild search on Postgres full-text against the now-Supabase-backed catalog (Section 3, item 3).
4. **Everything already in Section 4 of the strategic plan** (wallet/ledger, click-tracking redirects, Gift Cards/Hotels verticals) proceeds as already planned — this doc doesn't change that roadmap, it fills in the "how do we physically hold 1M+ products and still work well" question underneath it.

---

**Status update (as of 2026-08-05):** Item 1 (product-page redesign, Section 5) shipped — price-history chart and price-alert CTA are live on product pages. Item 2 (catalog migration) is underway per `claude/catalog-search-onboarding-migration-scope-2026-08-03.md` — schema shipped, backfill ~60% complete. Item 3 (search rebuild) has not started.
