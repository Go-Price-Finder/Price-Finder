# Migration `0015` applied — `price_history` provenance, and the chart restore condition

**2026-08-17. Applied to production by the Cowork session at ~02:50 UTC via the
Supabase MCP `apply_migration` tool (not pasted).** Announced here per the
standing rule so no one investigates an unexplained change.

Design: `claude/price-provenance-and-as-of-proposals-2026-08-17.md` Part A
(approved). Before-state: `price_history-before-state-2026-08-17.md`.

---

## 1. What was applied — and what was deliberately NOT

**Applied (DDL + one provenance-only UPDATE):**

- Six nullable columns on `public.price_history`: `price_source`,
  `observed_at`, `feed_id`, `feed_last_imported_at`, `feed_last_checked_at`,
  `catalog_price_at_snapshot`.
- A CHECK constraint restricting `price_source` to
  `live_override` / `catalog_fallback` / `legacy_pre_provenance` (or NULL).
- Column comments carrying the mechanism for each, including why
  `feed_last_imported_at` must be captured at write time and never read live.
- Backfill: `price_source = 'legacy_pre_provenance'` for all rows with
  `recorded_date <= 2026-08-16`.

**Not applied, on purpose:**

- **No `NOT NULL` yet.** This is the single most important deviation from the
  Part A design as written, and it is a sequencing fix rather than a change of
  intent. Part A specifies `price_source` NOT NULL with no default, precisely so
  a writer that forgets fails loudly. But `snapshotPrices` does not set it yet,
  and it upserts into this table from the 12:00 UTC cron. Adding NOT NULL before
  the writer ships would not make a writer fail loudly in review — it would
  **break the daily snapshot in production on its next run.** NOT NULL is Phase 3.
- **No value written to `price`.** Not in any statement.
- **`catalog_price_at_snapshot` not backfilled.** Per Part A: today's catalog
  price is not the historical one, and writing it would fabricate a value we do
  not have.

## 2. Prediction vs. result

Stated before applying, in the before-state document:

| check | predicted | actual | |
|---|---|---|---|
| rows | 14293 | 14293 | ✓ |
| sum(price) | 4051649.50 | 4051649.50 | ✓ |
| min / max price | 2.00 / 4999.99 | 2.00 / 4999.99 | ✓ |
| row-level fingerprint | `557db9985e620a55e8b0dc62aef34db3` | `557db9985e620a55e8b0dc62aef34db3` | ✓ |
| rows labelled `legacy_pre_provenance` | 14293 | 14293 | ✓ |
| rows left unlabelled | 0 | 0 | ✓ |
| `observed_at` set | 0 | 0 | ✓ |
| `catalog_price_at_snapshot` set | 0 | 0 | ✓ |

**The migration is a verified no-op on every price value.** Not asserted —
checked against a fingerprint captured before the change, using the identical
expression.

## 3. Three-phase sequencing, and where we are

| phase | owner | state |
|---|---|---|
| 1 — columns nullable + backfill | Cowork (DB) | **DONE, 2026-08-17 02:50 UTC** |
| 2 — `snapshotPrices` sets provenance on write; `database.types.ts` hand-edited | Claude Code (repo) | **NOT STARTED — required next** |
| 3 — `SET NOT NULL` on `price_source` | Cowork (DB) | Blocked on Phase 2 verified in production |

**`database.types.ts` is now out of date** — `price_history` has six columns the
types do not know about. Nothing breaks (the new columns are nullable and no
existing code references them), but the repo's types and the database have
diverged, and closing that is part of Phase 2, in the same commit as the writer
change per the standing rule.

## 4. The 12:00 UTC window — time-boxed, and it closes on its own

`price_history` currently holds **zero rows dated 2026-08-17**. The snapshot
cron fires at **12:00 UTC**, and because the merge fix (`11ae044`) landed at
01:33 UTC, that run will be the first snapshot in the project's history to read
live overrides.

- **If Phase 2 ships before 12:00 UTC:** every row in the table is either
  cleanly `legacy_pre_provenance` or provenanced from birth. The
  "live-but-unprovenanced" class never comes into existence.
- **If it does not:** today's run writes 954 rows that are live-sourced with
  `price_source` NULL, and another 954 each day until Phase 2 lands. They remain
  identifiable — `price_source IS NULL AND recorded_date >= 2026-08-17` — and
  the column comment documents exactly that. Recoverable, not ideal.

Nothing is broken either way. This is an opportunity with an expiry, not a
deadline.

---

## 5. `PriceHistoryChart` restore condition — implementable spec

### 5.1 What counts as a valid observation

```
valid_observation  ⇔  price_source = 'live_override'  AND  observed_at IS NOT NULL
```

Everything else is **excluded from the series and from every derived
statistic** — `legacy_pre_provenance`, `catalog_fallback`, and NULL alike.

**Why `catalog_fallback` is excluded even though it is a real displayed price:**
the chart's claim is about what the merchant charged, not what we showed. A
catalog-sourced value is our own file restated. Including it is the Finding C
defect re-entering through the read path.

### 5.2 Collapse restatements — the non-obvious rule

Rows are **not** points. `snapshotPrices` writes one row per product per day
regardless of whether anything was observed, so a `current_prices` row that
sits unchanged for thirteen days produces thirteen `live_override` rows that
all share one `observed_at`. Charting them as thirteen points asserts thirteen
days of confirmed price stability on the strength of a single observation —
which is Finding C wearing a new hat.

```
series_points = SELECT DISTINCT ON (observed_at) observed_at, price
                FROM price_history
                WHERE product_id = $1 AND retailer = $2
                  AND price_source = 'live_override'
                  AND observed_at IS NOT NULL
                  AND observed_at >= now() - interval '90 days'
                ORDER BY observed_at, recorded_date
```

**Plot the x-axis on `observed_at`, not `recorded_date`.** `recorded_date` is
when we snapshotted; `observed_at` is when the market was seen. They are
different quantities and only one of them is what a price history chart claims.

### 5.3 Thresholds and what renders

| condition | renders |
|---|---|
| `count(distinct observed_at) >= 3` (existing `MIN_POINTS_FOR_CHART`) | the chart |
| `count(distinct observed_at) < 3` | the existing empty state, copy unchanged |
| any error | the existing error/empty state |

Derived statistics — Lowest / Average / Highest — are computed **over the
collapsed series points only**, never over raw rows. The *"This is the lowest
price we've tracked in the last 90 days"* badge renders only when the chart
renders, i.e. only above the threshold.

`catalog_price_at_snapshot` is **not** needed for exclusion under this rule.
Filtering to `live_override` already excludes catalog re-import artifacts,
because a re-import can only move a catalog-sourced value. The column earns its
place as the detector for re-import events generally (and for any future
consumer of `catalog_fallback` rows), not as part of this filter.

### 5.4 Already suppressed — this is a RESTORE gate, not a suppression plan

**Correction to an earlier draft of this section, and to what I reported.** I
wrote that implementing this filter would suppress the charts automatically and
that "suppress the chart" and "ship provenance" were therefore the same action.
That was written without knowing the chart had **already been suppressed in
production** by Claude Code in `cfc8c03` (2026-08-16), recorded in
`claude/incident-2026-08-16-price-history-chart.md`. The component returns
`null` via a constant-gated, hook-free wrapper; it mounts nothing and fetches
nothing. The five king-koil phantom-low pages have not been live since then.

So this section is a **restore condition**, in the literal sense: the gate for
un-suppressing. Nothing here needs to be done to stop the bleeding; it has
stopped.

**Two independent restore conditions were written without reference to each
other, and they agree.** Claude Code's incident doc requires (1) provenance
distinguishing observed prices from display snapshots and rewrite artifacts, and
(2) the chart reading only observed rows. §5.1–5.3 above are the same two
conditions expressed as an implementable filter, plus three refinements that
document does not carry: collapse restatements by distinct `observed_at`, plot
the x-axis on `observed_at` rather than `recorded_date`, and the named
verification in §5.5. **The two are compatible; this one is a superset.** Where
they are read together, treat the incident doc as the decision and this section
as the implementation of it.

The five artifact rows are dated 2026-08-02/03 and are therefore
`legacy_pre_provenance`, so they are excluded permanently, not just until the
window rolls past them.

### 5.5 Named verification

State before, check after:

1. All five affected king-koil products (`…pump-5`, `-6`, `-7`, `-8`, `-11`)
   render the empty state. `…pump-7` in particular displays no *Lowest: $79.95*.
2. Every product renders the empty state on day one of Phase 2. **An
   immediately-populated chart means the filter is not applied** — that is the
   failing signal, not a pleasant surprise.
3. Charts begin appearing no earlier than the third distinct `observed_at`.
   Since `current_prices` has been frozen since 2026-08-03, *this requires
   `refresh-prices` to start writing again* — see §5.6.
4. The 285 products with no `current_prices` row never render a chart under this
   rule. Confirm that is understood rather than discovered later.

### 5.6 Pre-empt: the charts will stay empty, and that is not a bug

Two independent reasons, and someone will read either as a regression:

- **Phase 2 alone produces one observation per product per day only if the
  override is refreshed.** `current_prices` has not been written since
  2026-08-03. Until `refresh-prices` writes again, every day's snapshot carries
  the same `observed_at`, collapses to **one** point, and stays below the
  threshold **indefinitely**.
- **The 285 products with no override row never qualify at all**, including all
  29 brooklyn-delhi (no feed provisioned).

So the honest statement of the dependency chain: **charts return only after
`refresh-prices` is producing genuine daily observations** — which is gated on
the feed-staleness question (three open readings, corrections doc §2), which is
gated on the manual diagnostic run that only Kai can perform. The chart is
downstream of that, not of this migration.

**Copy caveat worth a decision, not blocking:** the empty state reads "check
back soon for a full history chart." For the 285 uncovered products that is a
promise we currently cannot keep. Differentiated copy for "no coverage" versus
"not enough observations yet" is a small, honest improvement — flagged, not
specified.
