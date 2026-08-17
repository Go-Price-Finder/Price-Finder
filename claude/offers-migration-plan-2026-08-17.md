# Canonical products and offers — written migration plan

**2026-08-17. WRITTEN PLAN. Nothing applied. No DDL executed.** Approved to
reach this stage on 2026-08-17; review before any step runs.

Design: `claude/identity-and-offers-design-2026-08-17.md` (approved, with the
ladder deferred). Precedent for method: migration `0015`, whose before-state
fingerprint approach is reused verbatim here.

**Approved decisions carried in:** nullable-then-tighten; change-events plus
heartbeat; defer the resolution ladder; build the structure now; **every offer
row carries `feed_id`**.

---

## 0. The `feed_id` spine

Added per the 2026-08-17 decision, and it is the organising constraint of this
plan rather than an extra column.

**`feed_id` is on every offer row, and it is the same key that
`price_history.feed_id` (migration `0015`) and `feed_status.feed_id` (as-of spec
§4.2, revised) use.** Three consumers, one key:

| consumer | uses `feed_id` for |
|---|---|
| as-of label | vintage of the displayed price, per product not per partner |
| freshness monitoring | which feeds are frozen — a single query over `feed_status` |
| price provenance | which source an observation came from, and how old that source's data was |

The tsar-bomba defect is what proves the key is cut at the right joint: one
partner, two feeds, two vintages, 26 pages currently overclaiming by 79 days.
A partner-keyed model cannot express it; a feed-keyed model resolves it without
a special case.

**Consequence for sequencing:** `feed_status` must exist before offers carry a
meaningful `feed_id`. It is Step 2 below, ahead of the offers table.

---

## 1. Steps, in order, each independently revertible

Every step states its own gate. No step proceeds while the previous step's gate
is unmet. Steps 1–4 are additive and reversible by `DROP`; Step 7 is the first
that is not.

### Step 1 — Before-state fingerprints (no writes)

Capture, to a file, using the `0015` method:

- `catalog_products`: row count, `sum(price)`, per-partner counts, and
  `md5(string_agg(id || '=' || price, ',' order by id))`.
- `price_history`: the `0015` fingerprints re-captured at cutover time (they
  will have grown past 14,293).
- `current_prices`: 669 rows, `sum(price)`, fingerprint.

**Gate:** file written, checksummed, delivered. Nothing proceeds without it.

### Step 2 — `feed_status` + `catalog_products.feed_id` (additive)

Create `feed_status` per as-of spec §4.2 (revised). Add
`catalog_products.feed_id` **nullable**, FK to `feed_status`.

Backfill: seven rows — canvas-vows 103552, king-koil (its feed id, to be read
from the feed list), tsar-bomba 105368 **and** 113495, evdance, golden-maple;
brooklyn-delhi gets a row with `feed_id` sentinel and NULL feed dates, since it
has no provisioned feed but does have a known catalog import date.

Per-product `feed_id` backfill: all products take their partner's single feed,
**except tsar-bomba**, whose 272 split 246/26.

~~from `_tsarbomba-mapping.json`~~ — **CORRECTED 2026-08-17.** That file is a
three-key column-name map and carries no product-to-feed attribution. The real
source is `scripts/_tsarbomba-merged-feed-fresh.csv`, which has a `data_feed_id`
column per row (113495 → 246, 105368 → 26), and those 26 join to
`catalog_products` by the `p=` parameter of `deep_link` returning **exactly 26**
— verified, not inferred. **Also corrected: tsar-bomba is not the only partner
with two feeds** — EVDANCE has `F1320` plus `108581`, the latter frozen
2026-05-15, making three of our feeds part of that freeze rather than two.

Step 2 is now written in full with SQL and gates in
`claude/migration-0016-feed-status-STEP2.md`; that document supersedes this
step's outline.

- **Gate A:** every `catalog_products` row has a non-NULL `feed_id`.
- **Gate B:** the tsar-bomba split is exactly 246/26. Any other split means the
  mapping file does not say what the commit message says, and **that is a stop**,
  not a number to reconcile in passing.
- **Gate C:** `catalog_products` price fingerprint unchanged from Step 1.

**This step alone fixes the live 79-day overclaim** once `lib/price-as-of.ts`
reads per-product `feed_id`. It is worth landing on its own merits before any
offers work, and it is the only step in this plan with a live defect attached.

### Step 2b — Import-time feed attribution (FORWARD RULE, added 2026-08-17)

**`scripts/import-partner.mjs` must record the source `feed_id` on every product
it writes, at import time.** Owner: Claude Code. Blocked on Step 2 (needs
`feed_status` to reference).

**Why this is a step and not a nice-to-have.** Step 2's tsar-bomba backfill only
works because someone happened to keep `_tsarbomba-merged-feed-fresh.csv` in
`scripts/`. **That is luck, not design.** Nothing in the import pipeline records
which feed supplied a product; the attribution existed as a side effect of a
debugging artifact that was never meant to be load-bearing. Every future import
recreates the same archaeology, and the next one may not leave a CSV behind.

Requirements:

1. Every row written to `catalog_products` carries `feed_id`, sourced from the
   feed the importer actually read — not inferred from the partner.
2. The importer **upserts the corresponding `feed_status` row** in the same run:
   `catalog_imported_at = now()`, `catalog_import_ref` = the commit or run ID,
   and `feed_last_imported_at` / `feed_last_checked_at` as read from the feed
   list at that moment (§1 of the as-of spec: captured at read time, never live).
3. A merge of two feeds — which is what `87877a2` did — writes the correct
   `feed_id` **per row**, not one value for the batch. This is the case that
   produced the live defect, so it is the case the importer must handle by
   construction rather than by convention.
4. `feed_id` becomes NOT NULL on `catalog_products` once the importer sets it
   and the Step 2 backfill has run — same nullable-then-tighten pattern as
   `price_history.price_source`, for the same reason.

**Gate:** run an import for one partner into a scratch environment; assert every
written row has a non-NULL `feed_id` resolving to a `feed_status` row, and that
a deliberately two-feed merge produces two distinct `feed_id` values. **Assert
the failure case too** — an importer that cannot produce a wrong answer has not
been tested.

**This makes the `feed_id` convergence four consumers, not three:** the as-of
label, freshness monitoring, price provenance, and now import attribution. Four
independently-motivated needs landing on one key is the strongest evidence
available that the model is cut at the right joint.

---

### Step 3 — `canonical_products` and `offers` (additive, empty)

Create both per design §1.4 and §2, with `offers.feed_id` NOT NULL FK to
`feed_status` — the one NOT NULL in this plan, because unlike `price_source` on
`price_history` there is no existing writer to break: every row is created by
the Step 4 migration, which sets it.

`identity_status` defaults to `'unresolved'`. The ladder is deferred; the column
exists so that deferral is visible in the data rather than implied by its
absence.

**Gate:** both tables exist and are empty. No reader references them.

### Step 4 — Populate: 954 canonical products, 954 offers

One canonical per existing product; one offer per canonical.

- `offers.retailer` ← `catalog_products.partner_id`
- `offers.retailer_sku` ← `merchant_product_id` (100% filled and unique in every
  sampled feed — the most reliable field we have)
- `offers.price` / `deep_link` ← `catalog_products`
- `offers.currency` ← `'USD'` for all six. **Asserted, not assumed:** `87877a2`
  excluded the GB feed precisely because it mixes GBP and USD, so every feed we
  currently ingest is USD by construction. Recorded as an assertion so that when
  a GBP feed is ingested, this line is where it breaks loudly.
- `offers.feed_id` ← the per-product `feed_id` from Step 2
- `offers.observed_at` ← `LEAST(catalog_imported_at, feed_last_imported_at)` for
  that feed — the same expression the as-of label uses, so label and offer
  cannot disagree
- `offers.availability` ← `'unknown'`. We do not currently ingest availability;
  `'in_stock'` would be a fabricated value.

**Gates:** exactly 954 canonical, exactly 954 offers, exactly one offer per
canonical, zero offers with NULL `feed_id`, and a per-offer price fingerprint
that matches Step 1's `catalog_products` fingerprint **field-for-field, not
count-for-count**. Membership is not equality.

### Step 5 — `offer_price_observations`, partitioned, and backfill

Create per design §3, `PARTITION BY RANGE (observed_at)`, monthly partitions
from 2026-08 forward plus a catch-all for earlier.

Backfill from `price_history`, keyed to each product's single offer, carrying
`price_source` verbatim — the 14,293 `legacy_pre_provenance` rows arrive already
labelled, which is exactly why that label was kept distinct from
`catalog_fallback` in `0015`.

- **Gate:** observation count equals the `price_history` count at cutover; global
  price fingerprint identical.
- **Note:** the backfill lands as daily snapshots because that is what the source
  is. Change-event storage (§4.1 of the design) applies to **new writes** from
  Step 6 onward. Converting history retroactively would discard the record of
  what was actually snapshotted. Flagged so the mixed storage model is a
  documented decision rather than something a later reader discovers.

### Step 6 — Writers move to change-event + heartbeat

`snapshotPrices` writes an observation only when the observed value changes,
plus a weekly heartbeat, and updates `offers.observed_at` / `last_seen_at` in
place every run. Claude Code; `database.types.ts` in the same commit.

**Gate:** one full week of production runs with row growth matching prediction
to within a stated tolerance. **Predict the number before the week starts** —
an unpredicted row count that merely "looks reasonable" is not a check.

### Step 7 — Readers move, then `catalog_products.price` is dropped

The only irreversible step, and it goes last and alone.

Order: dual-read → migrate each reader → grep gate proving no reader touches
`catalog_products.price` → drop. **The grep gate must match the transitive path,
not just direct references** — see §3.

---

## 2. What this plan does NOT do

- **No resolution ladder.** Everything stays `unresolved`. Revisit when a second
  retailer carrying overlapping products exists.
- **No merging.** Zero rows in `match_candidates`; nothing to merge among six
  single-brand merchants.
- **No retention or downsampling job.** Partitioning is created; the retention
  tiers in design §4.3 are not implemented. Downsampling is irreversible and gets
  its own review, with a dry-run reporting mode first.
- **No `current_prices` absorption.** Its `(product_id, retailer)` key is
  already offer-shaped and it should fold into `offers`, but doing it in this
  plan would entangle the migration with the live override path that was only
  repaired today (`11ae044`). Separate change.

---

## 3. The gate design, stated explicitly because the last one failed

**Step 14's closing gate — `grep 'from "@/lib/[a-z-]*-data"' app/` — passed while
eight files still rendered from static data**, because they import
`@/lib/partners`, which imports the data files transitively. The gate measured
direct imports; the property that mattered was the read path. I reported the
cutover complete on that basis and was wrong.

Step 7's gate must therefore assert on the **transitive** property:

1. No file under `app/` or `components/` imports `@/lib/partners` **or** any
   `@/lib/*-data` module, directly or through a re-export.
2. `grep -rn 'catalog_products.*price\|\.price' ` over the reader set, reviewed
   by hand — a grep that returns nothing is only evidence if someone has checked
   the grep can return something. **Run it against a deliberately broken branch
   first and confirm it fails.** A gate never observed failing is not a gate.
3. A runtime assertion: `catalog_products.price` renamed to
   `price_deprecated_do_not_read` for one deploy before being dropped, so any
   missed reader fails loudly in CI rather than silently reading a stale column.

Point 3 is the one I would not skip. It converts "we grepped carefully" into
"the compiler checked."

---

## 4. Rollback

| step | rollback |
|---|---|
| 1 | n/a, read-only |
| 2 | drop `catalog_products.feed_id`, drop `feed_status` |
| 3 | drop both tables |
| 4 | truncate both tables |
| 5 | drop the partitioned table; `price_history` is untouched and remains authoritative throughout |
| 6 | revert the writer commit; observations resume as daily snapshots |
| 7 | **not cleanly revertible after the drop** — restore requires the Step 1 fingerprint file plus a backup |

`price_history` is **not** dropped by this plan. It remains the source of truth
until Step 7's gate passes, and its retirement should be a separate, later
decision with its own review — same reasoning as keeping the 14,293 evidence
rows.

---

## 5. Open questions before Step 1 runs

1. ~~Does Step 2 ship alone and immediately?~~ — **RESOLVED 2026-08-17: yes.**
   It ships alone, ahead of the rest. Note the change of character: the interim
   as-of fix **shipped** in `790b646` (production-verified — 26 read May 15, 246
   read Aug 2, nothing moved in the flattering direction), so Step 2 is no longer
   the first implementation. It is a **replacement**, and must delete
   `lib/price-as-of.ts`'s interim path in the same change.
2. ~~King Koil's, EVDANCE's and Golden Maple's feed IDs are not recorded in any
   doc I have.~~ — **RESOLVED 2026-08-17.** All verified against committed
   artifacts independently of the relay: `103552`, `101819`, `105368`, `113495`,
   `F1320`, `F2615`, plus `108581` (EVDANCE's second feed, frozen 2026-05-15,
   not in the relay) and no feed for brooklyn-delhi. See
   `claude/migration-0016-feed-status-STEP2.md` §1.
3. **Heartbeat interval:** weekly is proposed, not derived. It sets the floor on
   how fast a frozen feed becomes visible in observation data.
4. ~~`brooklyn-delhi` sentinel or nullable?~~ — **RESOLVED 2026-08-17:**
   sentinel `feed_id = 'none:brooklyn-delhi'`, so `feed_id` stays totally
   resolvable and no consumer needs a NULL branch. Reasoning in the Step 2
   doc §3.
