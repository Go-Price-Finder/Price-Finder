# aaawave import plan (2026-08-19) — PREPARED, NOT RUN

First catalogue expansion since 2026-08-03 and the FIRST import into the
post-cutover architecture (Batch 5 live: every aggregate surface reads
the DB catalog). Operator runs it; this plan states what must be true
before, what the numbers should be after, and what would mean the
import went wrong rather than the code.

## Feed facts (measured 2026-08-19, feed F2639)

1,683 rows; **1,683 distinct titles — zero name collisions** (the
king-koil variant hazard does not exist here); aw_deep_link populated
100%; GTIN populated 91% (1,535); 71 distinct google_product_category
values (Computer Components / Storage / Audio taxonomy); prices in
"345.99 USD" form (parsePrice handles). Google-template feed.

## Importer prep — DONE this turn (code, additive)

- deepLink candidates now include `aw_deep_link` and `link` — without
  this, deep-link resolution FAILED outright on Google-template feeds.
- category candidates now include `google_product_category` — without
  this, every product landed "Uncategorized" (product_type is empty in
  these feeds).
- GTIN capture already landed (2e4c758): validated 8–14-digit values
  flow into the generated data file.

## Prerequisites BEFORE running (owner per item)

1. **DDL (Cowork writes, session reviews, operator applies — standing
   rule):** `alter type retailer add value 'aaawave'` (0004 pattern);
   `partners` table row (id, name, tagline, href=/aaawave,
   display_order); `feed_status` row (feed_id F2639,
   partner_id aaawave, is_catalog_source=true) — refresh-prices
   selection is data-driven and will otherwise error loudly for the
   partner.
2. **Code (session):** PARTNER_AWIN_NAMES entry in refreshPrices
   (advertiserName exact from AWIN: "aaawave", verified:true);
   partner-compliance.json entry (status active);
   lib/partner-policies.ts entry (REAL shipping/returns researched from
   aaawave.com — structured-data emits it; no invented values);
   app/aaawave/ route templates (copy the batch-4 pattern: landing +
   [slug] + page/[page]).
3. **Import run (operator):** `node scripts/import-partner.mjs
   --csv <feed.csv> --partner-id aaawave --partner-name "aaawave"` —
   downloads 1,683 images to public/images/aaawave/.
4. **Catalog sync to catalog_products** (the 87877a2-pattern step —
   Cowork/operator owned).

## Expected numbers (the import-went-wrong tripwires)

- catalog_products: 954 → **2,637** (+1,683 exactly; any other delta =
  dup/skip investigation before proceeding).
- Build: 1,049 → **~2,770** pages (+1,683 detail, +1 landing, +35
  pagination at 48/page, + new category-tree pages — count them, don't
  absorb them).
- GTIN captured on ≈ **1,535** rows (~91%). Materially lower = capture
  regression, not feed change.
- "Uncategorized" share ≈ 0 (google_product_category is 100%-ish
  populated). A large Uncategorized block = the candidate fix didn't
  take.
- Query-count guard unchanged; equivalence suite green; First Load JS
  still 103 kB.
- refresh-prices next run: new per-feed line for aaawave/F2639 with
  matched ≈ feed rows (id-matching needs the deep-link p= extraction to
  work on cread/Google links — VERIFY matched > 0 on the first run; a
  zero is the §9v selection lesson again).
- Sitemap grows by the same page delta; verify from served XML.

## Crawl budget — RECOMMENDATION: STAGE IT

203 pages already sit "discovered, currently not indexed" against 1,035
URLs at ~5 weeks of domain age: Google is already rationing this
domain's crawl. Doubling the catalogue in one deploy dilutes crawl over
~2,800 URLs and pushes the unindexed backlog up, slowing indexing of
the pages that already earn impressions. Staging proposal:
**tranche 1 = the GTIN-bearing, CJ-overlapping subset once
antonline/UnbeatableSale approvals land** (comparison-capable pages are
the differentiated content worth Google's ration — and the site's
actual thesis); remainder after Search Console shows tranche 1 being
absorbed. Mechanically: pre-filter the feed CSV to the tranche and run
the importer on the filtered file; a later full-CSV rerun regenerates
the complete file (the importer rewrites wholesale). If the operator
prefers one shot, it is SAFE in the no-penalty sense — indexing is
throttled, not punished — but slower for everything already live.

## Migration 0018 proposal (catalog_products.gtin) — for Cowork to draft

Proposed shape (prose, not SQL — Cowork writes DDL per the standing
rule):
- `gtin text null` on catalog_products. NULLABLE — absent-from-feed is
  unknown, not empty (the 0017 zero/unknown rule).
- CHECK constraint: 8–14 digits (`^[0-9]{8,14}$`). Divergence from
  0017's "observe, don't constrain": an identifier that mis-joins is
  actively harmful, and the importer already validates the same shape —
  the CHECK makes the DB agree with the writer. Argue it down if
  disagreed.
- **Partial, NON-unique index** on gtin where gtin is not null.
  Explicitly NOT unique: the same GTIN across partners is the entire
  point (cross-merchant comparison), and even a same-partner duplicate
  is a data question, not an integrity violation.
- No FK, no backfill in this migration — backfilling the existing 954
  from feeds is a separate task with its own verification.
- RLS: table already public-read; GTIN is public product data. No
  policy change.
- Gates to state in the draft: column absent today; nullable; CHECK
  behaviour on empty string (must reject — NULL is the absent form);
  index is partial + non-unique; existing rows unaffected (all NULL).

## What was deliberately not done

No import run, no application, no DDL written here. The 08-25 diff
remains the main clock; aaawave's diff doubles as the volatility test
for this import's inventory.
