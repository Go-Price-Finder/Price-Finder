# As-of label — persistence prerequisite, derivation rule, and shipping copy

**2026-08-17. Specification for Claude Code to implement. Cowork specifies; no
repo changes made by this session.**

Decisions this implements (Kai, 2026-08-17): Part B **Option 1** — per-product
date, inline beside the price, everywhere — shipping **before** the pipeline
fix. Provenance schema Part A approved separately. Companion documents:
`claude/price-provenance-and-as-of-proposals-2026-08-17.md` (the options and
their reasoning), `claude/status-corrections-2026-08-16.md` (Findings A/B/C).
Cross-referenced, not restated.

---

## 1. The correctness constraint everything else serves

**The label states when the *merchant's* price was last known, not when our
pipeline last ran.** Any implementation that reaches for
`current_prices.updated_at` or `catalog_products.updated_at` produces a new
falsehood in place of the old one — for Canvas Vows those read 2026-08-03 and
2026-08-17 respectively, against merchant data last refreshed 2026-05-15. Eighty
and ninety-four days wrong, both in the flattering direction.

**A second trap, less obvious and worth naming before anyone writes the query:**
do not read the feed's Last Imported *live* at render time either. A feed's Last
Imported advances when AWIN re-imports it, whether or not we have pulled from it
since. Reading live would date our stale copy with someone else's fresh
timestamp — the same error a third way. **Last Imported must be captured at the
moment we take data from the feed and stored with the thing we took.**

## 2. What page prices actually are today — read this before wiring anything

Product pages render `catalog_products` via `lib/catalog.ts`. They do **not**
read `current_prices`; the override layer has no page-level consumer
(`withLivePrice` has zero callers). So:

> The as-of label must describe the **catalog** price, because that is the price
> on the page.

Dating a displayed catalog price with an override's timestamp would mislabel the
27 products where the two differ. If page-level live pricing is ever wired (the
unmade decision in the corrections doc §7), the as-of source must switch in the
same change — noted here so the coupling is on record.

**Still true after the merge fix (`11ae044`), and worth stating so nobody reads
this section as stale.** That fix repairs the override lookup, so
`snapshotPrices` and `checkPriceDrops` now see live values. It does **not** wire
overrides to pages. Product pages still render `catalog_products`; the as-of
derivation in §3 and the dates in §4.4 are unaffected by it.

## 3. Derivation rule — REVISED 2026-08-17: as-of is a property of the FEED, not the partner

~~`as_of = LEAST(catalog_imported_at, feed_last_imported_at)` keyed per
partner.~~ — **SUPERSEDED 2026-08-17.** Reasonable when written, and it produced
the right answer for five of six partners. It was wrong in its **model**: it
assumed one partner draws from one feed. Tsar Bomba does not, and the shipped
implementation inherited the same wrong model from a different direction.

**The defect this model produced, live in production:** `lib/price-as-of.ts`
dates all 272 tsar-bomba products `2026-08-02`. Twenty-six of them came from the
Default feed (105368), frozen since `2026-05-15`, so those 26 pages overclaim
freshness by 79 days. My per-partner `LEAST` rule would have erred the opposite
way — dating all 272 as May 15 and understating the 246 US-feed products by 79
days. **Both implementations were wrong, and they were wrong in the same place:
the partner was treated as the unit of vintage.**

### 3.1 The corrected model

**Vintage attaches to the feed. A partner may draw from several feeds; a product
draws from exactly one.**

```
as_of(product) = LEAST(
    catalog_imported_at(the import that produced this product's row),
    feed_last_imported_at(the feed that supplied this product)
)
```

`LEAST` survives intact and for the same reason (§3.2). What changes is the key:
per source feed, resolved per product, rather than per partner.

Worked against real cases:

| product set | source feed | feed last imported | catalog imported | **as-of** |
|---|---|---|---|---|
| tsar-bomba, 246 products | US 113495 (fresh) | after Aug 2 | 2026-08-02 | **Aug 2, 2026** |
| tsar-bomba, 26 products | Default 105368 (frozen) | 2026-05-15 | 2026-08-02 | **May 15, 2026** |
| canvas-vows, 204 | 103552 (frozen) | 2026-05-15 | 2026-07-29 | **May 15, 2026** |
| king-koil, 29 | fresh | after Aug 2 | 2026-08-02 | **Aug 2, 2026** |
| evdance / golden-maple | fresh | after Jul 25 | 2026-07-25 | **Jul 25, 2026** |
| brooklyn-delhi, 29 | none provisioned | NULL | 2026-07-25 | **Jul 25, 2026** |

Only tsar-bomba splits today. It splits because `87877a2` merged two feeds of
different ages into one catalog — a merge whose own commit message documents the
split (`246 US + 26 Default-only = 272`). ~~The information needed to resolve it
already exists in `scripts/_tsarbomba-mapping.json`.~~ — **CORRECTED 2026-08-17:**
that file is a three-key column-name map with no feed attribution. The real
source is `scripts/_tsarbomba-merged-feed-fresh.csv`, whose `data_feed_id` column
gives 113495 → 246 and 105368 → 26 per row; those 26 join to `catalog_products`
by the `p=` parameter of `deep_link` and return **exactly 26**. Claude Code
reached the same conclusion independently by intersecting feed 105368's pclick
ids with the catalog.

### 3.2 Why `LEAST` still holds

Unchanged from the superseded version, restated because it is the part that was
right: our catalog holds feed content as it stood when we imported it, so the
true as-of is the feed's data date *at import time*.

- **Frozen feed:** LEAST(Jul 29, May 15) = May 15 — exact.
- **Fresh feed:** LEAST(Jul 25, Aug 17) = Jul 25 — correct, and the case that
  matters: *a daily-updating feed does not make our copy fresh if we last
  imported in July.*

It can err by at most one day, and never toward claiming more freshness than we
have. That invariant is what both current implementations violate for 26
products.

### 3.3 Consequence for storage — this is why the model change matters beyond the label

`feed_id` becomes the join key for vintage, and therefore has to be recorded
**per product**, not per partner. That is the same `feed_id` the offers design
puts on every offer row
(`claude/identity-and-offers-design-2026-08-17.md` §2), and the same one
migration `0015` added to `price_history`.

**One key, three consumers: the as-of label, feed-freshness monitoring, and
price provenance.** They were designed separately and converge on the same
column, which is the sign the model is now cut along the right joint. A
per-partner map cannot serve any of the three once a partner draws from two
feeds — which one already does.

**Interim — SHIPPED 2026-08-17 in `790b646`,** production-verified: the 26 read
May 15, the 246 read Aug 2, and nothing moved in the flattering direction. It is
a per-product override list in `lib/price-as-of.ts` carrying an explicit debt
header — a hand-maintained exception on top of a hand-maintained map, correctly
labelled as debt rather than left to look like design.

**That interim is replaced, not extended, by migration `0016`** (Step 2 of the
offers plan). `0016` stores `feed_id` per product, and the same change must
**delete** the interim path. Two hand-maintained layers become one resolvable
join.

## 3b. Derivation rule (original per-partner form, retained for reference)

For a displayed catalog price:

```
as_of = LEAST(catalog_imported_at, feed_last_imported_at)
```

with `feed_last_imported_at` NULL treated as "no feed" → fall back to
`catalog_imported_at` alone.

**Why LEAST is correct and not merely cautious.** Our catalog holds feed content
as it stood when we imported it. The true as-of is the feed's data date *at
import time*, which we did not record historically. Two cases, and LEAST lands
correctly on both:

- **Frozen feed.** Canvas Vows: imported 2026-07-29 from a feed whose data was
  already dated 2026-05-15. LEAST(Jul 29, May 15) = **May 15** — exact.
- **Fresh feed.** Golden Maple: imported 2026-07-25 from a feed that updates
  daily and today reads Aug 17. LEAST(Jul 25, Aug 17) = **Jul 25** — correct,
  and the important case: *a fresh feed does not make our displayed price fresh
  if we have not re-imported from it.* Taking `feed_last_imported_at` alone here
  would claim Aug 17 for a July copy.

The rule can err by at most one day (a fresh feed's data date at import time may
be the day before the import). It never errs toward claiming more freshness than
we have. Going forward §4.3 makes it exact rather than inferred.

## 4. What has to be persisted

### 4.1 The two fields `refreshPrices` currently drops

`lib/pricing/refreshPrices.ts`'s local `FeedListRow` type (lines ~140–148)
declares seven fields. The CSV it already downloads on every run carries twelve;
`scripts/awin-status-report.ts` declares the full set. Add:

```
"Last Imported": string;
"Last Checked": string;
```

No new fetch, no new credential, no new URL — the bytes are already in the
response body and are being discarded at the type boundary.

### 4.2 New table — REVISED: keyed per FEED, not per partner

~~`partner_feed_status`, one row per partner, six rows.~~ — **SUPERSEDED
2026-08-17 by §3.** A partner-keyed table cannot express tsar-bomba, which draws
from two feeds of different vintages. Six rows was the wrong cardinality, not
just the wrong key.

```
feed_status
  feed_id                text primary key      -- AWIN Feed ID, e.g. '105368'
  partner_id             text not null fk -> partners(id)
  feed_name              text null
  feed_last_imported_at  timestamptz null      -- AWIN "Last Imported", read time
  feed_last_checked_at   timestamptz null      -- diagnostic; see below
  feed_status_read_at    timestamptz not null  -- when we read the two above
  catalog_imported_at    timestamptz not null  -- when this feed last fed our catalog
  catalog_import_ref     text null             -- commit SHA, for traceability
```

Plus the join that makes it resolvable per product — `catalog_products.feed_id`,
nullable, FK to `feed_status`. **That column is the whole point of the model
change:** it is the same `feed_id` on every offer row in the offers design and
the same one migration `0015` added to `price_history`. One key, three consumers.

Cardinality today: **seven rows, not six** — tsar-bomba contributes two
(Default 105368, US 113495) and brooklyn-delhi contributes none, so it needs a
`catalog_imported_at` with a NULL `feed_id` or a sentinel row. Decide which
deliberately; a NULL-feed product still needs an as-of date, and §5.4's
"Price date not recorded" is the wrong answer for a product whose import date we
know.

**Still read for free by `lib/catalog.ts`** — the same second query against
`partners` widens to a join, inside the existing `unstable_cache` snapshot. The
per-product `feed_id` adds one column to the catalog fetch, no round-trip.

**`feed_last_checked_at` earns its place here more than it did per-partner:** on
frozen feeds it reads earlier than Last Imported, so with per-feed rows a single
query identifies every frozen feed we draw from — which is the monitoring that
would have caught the May-15 freeze in days instead of three months.

### 4.2b Original per-partner table design (retained for reference)

Feed metadata is a property of the **feed**, not of 954 products. Storing it
per-product would multiply one fact by 954 and invite the copies to disagree.

| column | type | meaning |
|---|---|---|
| `partner_id` | text PK, FK → `partners(id)` | |
| `feed_id` | text NULL | AWIN Feed ID actually used by the last refresh |
| `feed_last_imported_at` | timestamptz NULL | AWIN's "Last Imported", captured at read time |
| `feed_last_checked_at` | timestamptz NULL | AWIN's "Last Checked" — diagnostic (see note) |
| `feed_status_read_at` | timestamptz NOT NULL | when we read the two above |
| `catalog_imported_at` | timestamptz NOT NULL | when we last ran an import into this partner's catalog |
| `catalog_import_ref` | text NULL | commit SHA of that import, for traceability |

- **Written by:** `refreshPrices` (feed columns, every run) and the catalog
  import script (`catalog_imported_at`, `catalog_import_ref`).
- **Read by:** `lib/catalog.ts`. **This is already free** — `fetchCatalogRaw`
  runs two queries, the second being
  `.select("id, name, tagline, href, logo_url, display_order")` on `partners`.
  Widening that select (or joining this table) adds six rows to a query that
  already exists inside the `unstable_cache` snapshot. No new round-trip per
  page, no change to the static-generation model.
- **Keep `feed_last_checked_at`** even though nothing renders it: on frozen
  feeds it reads *earlier* than Last Imported, which is what makes a frozen feed
  self-identifying. It is the diagnostic that distinguishes "nothing changed"
  from "AWIN stopped looking."
- **`feed_status_read_at` matters.** Without it, a Last Imported value has no
  provenance of its own and cannot be aged out or rechecked.

### 4.3 Also record it at write time (per §1's second trap)

- On `current_prices`, alongside the existing `source` column: `feed_id`,
  `feed_last_imported_at` **as read during that refresh run**. This is what
  Part A's `price_history.feed_last_imported_at` copies through, and what makes
  an override's as-of exact rather than inferred.
- In the catalog import script: record the feed's Last Imported *at import time*
  into `partner_feed_status.catalog_imported_at`'s row. Once one import has run
  under this scheme, §3's LEAST inference is replaced by a recorded fact for
  that partner.

### 4.4 Backfill — real values, verified from git

`catalog_imported_at` backfilled from the identified import commits. These are
the import commits, not last-touch commits: two partners' most recent
file-touching commits are category edits, not imports, and using those would
overstate freshness by days.

| partner | `catalog_imported_at` | `catalog_import_ref` | commit subject |
|---|---|---|---|
| brooklyn-delhi | 2026-07-25 03:41 UTC | `8f1342a` | Import Brooklyn Delhi products and add category page |
| evdance | 2026-07-25 19:47 UTC | `14dc4cf` | Import EVDANCE (72) and Golden Maple (348) products from Awin feed |
| golden-maple | 2026-07-25 19:47 UTC | `14dc4cf` | (same commit) |
| canvas-vows | 2026-07-29 17:38 UTC | `4f6f302` | Import Canvas Vows live (204 products) |
| king-koil | 2026-08-02 23:32 UTC | `87877a2` | Refresh King Koil and Tsar Bomba catalogs from fresh AWIN feeds |
| tsar-bomba | 2026-08-02 23:32 UTC | `87877a2` | (same commit) |

Feed columns backfill on the first `refreshPrices` run after 4.1 ships. Until
then they are NULL and §3 falls back to `catalog_imported_at` — which is honest,
just less precise for the frozen-feed partners.

**Resulting as-of dates on first ship** (LEAST of the two, feed dates as
currently known):

| partner | catalog imported | feed last imported | **as-of shown** |
|---|---|---|---|
| canvas-vows | Jul 29 | **May 15** | **May 15, 2026** |
| tsar-bomba (246, feed 113495) | Aug 2 | fresh | **Aug 2, 2026** |
| tsar-bomba (26, feed 105368) | Aug 2 | **May 15** | **May 15, 2026** |
| evdance | Jul 25 | fresh | **Jul 25, 2026** |
| golden-maple | Jul 25 | fresh | **Jul 25, 2026** |
| king-koil | Aug 2 | fresh | **Aug 2, 2026** |
| brooklyn-delhi | Jul 25 | none | **Jul 25, 2026** |

Nothing on the site will read as "today," and nothing should. That is the point
of shipping this before the pipeline fix rather than after.



### 4.5 What these dates reveal about us, not about AWIN — state it before shipping

**On first ship, nothing on the site reads as "today," and nothing on the site
reads as recent.** The frozen feeds are the dramatic case, but they are not the
whole finding:

| partner | feed health | as-of age on 2026-08-17 |
|---|---|---|
| canvas-vows | frozen since May 15 | 94 days |
| tsar-bomba | frozen since May 15 | 94 days |
| brooklyn-delhi | no feed provisioned | 23 days |
| evdance | **healthy, updates daily** | 23 days |
| golden-maple | **healthy, updates daily** | 23 days |
| king-koil | **healthy, updates daily** | 15 days |

Three of six partners have perfectly healthy feeds and catalogs between two and
three weeks old. (Canvas Vows is the one partner whose *price
correctness* has actually been measured, by Claude Code: of 204 products, 194
titles matched — 101 priced correctly, 93 not — and 10 were retitled, so their
price correctness was **never measured**. Those 10 are unknown, not wrong. That
census belongs to `claude/pricing-pipeline-findings-2026-08-16.md`; cited here
only to note that "stale" and "wrong" have been separately quantified for one
partner and for no other.) **That is a finding about our own re-import cadence, not about
AWIN.** The label is about to make it visible on every page, and the first
reaction to seeing those dates will be to assume something is broken. It is not.
This is the actual cadence, measured, and it has been the cadence all along.

**Why it went unnoticed, which is the part worth writing down:** the architecture
assumed the daily `refresh-prices` cron would carry price freshness, so catalog
re-import cadence was never supposed to matter — a catalog could be weeks old
because the override layer would keep prices current on top of it. Two findings
undo that assumption. `refresh-prices` has written nothing since 2026-08-03
(Finding A), and even when it did write, the override never reached anything a
user sees (Finding B). **With the override layer inert, catalog re-import cadence
is, and always has been, the site's entire price-freshness story.** Nobody chose
that; it is what was left after the layer above it stopped working.

So the honest reading of the six dates above: two partners are stale because
AWIN stopped importing, and four are stale because we re-import when someone
runs a script. Fixing the feeds addresses the first. Only a re-import cadence —
or a working override path to pages — addresses the second.

**And the merge fix does not change this — added 2026-08-17 after `11ae044`
landed.** Overrides now merge correctly, but pages still render
`catalog_products`. So for the four healthy-feed partners, **nothing shipped
today alters their displayed price staleness at all.** The layer that was
supposed to carry freshness works now, and still does not reach the page. Their
as-of dates on the label will be identical before and after the fix.

**This bears on a decision already made, and the owner has flagged it as the
better argument.** `withLivePrice` (page-level live pricing) was declined on
2026-08-17 on the grounds that it benefits only the 27 products whose override
differs from catalog. §4.5 shows that framing was too narrow in two ways:

1. **It counts the wrong population.** The benefit is not "27 products get a
   different number." It is that the freshness path reaches the page at all —
   without it, displayed price freshness is capped by re-import cadence for
   *all 954*, however healthy the feeds are.
2. **The 27 is a floor measured on a stopped pipeline, not a steady-state
   figure — labelled as reasoning, not measurement.** `current_prices` has been
   frozen since 2026-08-03 (Finding A) while catalogs date from Jul 25–Aug 2.
   In a working steady state, overrides would refresh daily against live feeds
   while catalogs stayed weeks old, so divergence would accumulate with catalog
   age rather than sit at 27. For the three healthy-feed partners in particular,
   real merchant prices have had two to three weeks to move away from our
   catalogs and we currently have no visibility into whether they did.

   **This is directly testable and the test is already scheduled:** the pending
   manual `refresh-prices` run (corrections doc §2, HUMAN-ONLY) reports
   per-partner upsert counts, and an upsert count *is* the number of prices that
   moved since 2026-08-03. If that number is large for evdance, golden-maple or
   king-koil, the "only 27" premise is measurably wrong. If it is near zero, the
   premise holds and reading 3 (feeds genuinely unchanged) gains support.

**Not a reversal.** The decision stands tonight and the label ships first
regardless — recorded here so the reason to revisit is on the record rather than
in someone's head, and so whoever revisits it has the argument and the pending
measurement together.

---

## 5. The copy

### 5.1 The string

```
Price as of {Month D, YYYY} ({relative age})
```

The relative age is part of the shipping string, not an option — see 5.2 for its
rules. 5.1 covers the date half.

US date format — the site prices in USD and deliberately excluded the GBP feed
for that reason.

**Three months ago:**

> Price as of May 15, 2026 (94 days ago)

**Yesterday:**

> Price as of August 16, 2026 (yesterday)

Identical sentence structure, identical word count pattern, identical position,
identical styling. The date carries all the information and the sentence carries
none of the judgment. **No conditional warning icon, no color change, no "may be
out of date" appended when the date is old** — a label that changes shape when
the news is bad teaches people that the unchanged shape means good news, which
converts every quiet label into an unearned claim.

### 5.2 The relative age — DECIDED 2026-08-17: include it, always present

```
Price as of {Month D, YYYY} ({relative age})
```

**Reasoning for the record (Kai):** an absolute date makes the reader do
arithmetic, and a label that requires work gets ignored — which is functionally
the same as not shipping it. It also stops the label being purely a caveat: on a
partner with a fresh catalog it reads as a strength, which is worth something on
a price-comparison site. Yes it amplifies; that is the correct direction to err
when a customer has no way to tell which page they are on.

**The parenthetical is always present, never conditional** — that is what keeps
it one shape rather than a warning that appears only when the news is bad.

`{relative age}` rules:

| age | renders |
|---|---|
| same calendar day | `today` |
| 1 day | `yesterday` |
| 2+ days | `{N} days ago` |

> Price as of May 15, 2026 (94 days ago)
> Price as of August 16, 2026 (yesterday)
> Price as of August 17, 2026 (today)

**Do not switch units at a threshold** — no "3 months ago", no "about 3 weeks".
A unit that changes with age is shape-change by another name, and rounding is
where a stale number gets quietly softened. `today` and `yesterday` are the only
special cases; both are exact, neither rounds, and both replace a phrasing
("0 days ago", "1 day ago") that reads as machine output rather than English.

Count in **whole calendar days in the site's display timezone**, not 24-hour
periods, so the boundary matches what "yesterday" means to a reader. An age that
computes as negative (clock skew) renders `today`; never render a future age.

### 5.3 Placement

- **Product detail pages** — directly beneath the price, above the "View on
  {Partner}" CTA. Small type, secondary color (the existing `text-ivory-400`
  class used for the affiliate-disclosure line is the right weight). It must sit
  with the price, not in a footnote: a disclosure the reader reaches after
  deciding is not a disclosure.
- **Listing and category cards** — same string, same styling, one line under the
  price. This is the surface that matters most: the comparison grid is where the
  site makes its core claim, and it is the placement Option 3 was rejected for
  omitting.
- **Anywhere a price appears without an as-of date is a defect**, including
  search results, trending, deals, and any future surface. Worth a grep-based
  check in the same change rather than a promise.

### 5.4 The no-date case

After 4.4 every product has at least `catalog_imported_at`, so this should never
render. Specify it anyway, because "should never happen" is how placeholders get
written later:

> Price date not recorded

Same position, same styling, no invented date, no silent omission of the label.
If this string ever appears in production it is a bug in the backfill, and it is
better that it announce itself than that a price appear undated.

---

## 6. Verification for this change

State before shipping, check after:

1. All six partners render an as-of date matching the §4.4 table.
2. Canvas Vows reads **May 15, 2026** — not August 3, not August 17. An August
   date there means the implementation is reading a pipeline timestamp and §1
   has been violated.
   **Tsar Bomba SPLITS and must not be checked as one partner:** its 246
   US-feed products read **Aug 2, 2026** and its 26 Default-feed products read
   **May 15, 2026**. A single uniform date across all 272 — in either direction
   — means the per-feed model is not actually wired, only the per-partner one.
3. Golden Maple and EVDANCE read **Jul 25, 2026** despite their feeds being
   fresh today. If either shows today's date, `LEAST` has been dropped or Last
   Imported is being read live (§1, second trap).
4. No price is rendered anywhere without an adjacent as-of date.
5. The label is byte-identical in structure between a stale product and a fresh
   one — diff the rendered markup of a canvas-vows card against a king-koil card
   and confirm only the date and relative-age text differ. No extra class, icon,
   or wrapper may appear on the stale one.
6. A product whose as-of resolves to today renders `(today)` and one at one day
   renders `(yesterday)` — neither renders `(0 days ago)` / `(1 day ago)`. On
   first ship no product should resolve to either, so this is checkable only in
   a fixture or after a re-import; do not skip it on those grounds, because
   these are the two branches least likely to be exercised before a customer
   sees them.

## 7. Deliberately out of scope

- The pipeline fix, the feed-ID migration question, and chart suppression are
  each separate work.
- No explainer page is specified. Option 1 does not require one; if a "How we
  source prices" page is wanted later it should be real content, not a stub.
- `price_history` provenance (Part A) is independent of this and can land in
  either order.
