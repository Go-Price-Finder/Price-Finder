# Pricing pipeline findings — 2026-08-16

Findings only — no code change ships with this document. The
`getEffectivePrice` fix, any deletion, any cron invocation, and any feed
re-pinning are explicitly NOT authorized as of this writing. When the merge fix is authorized it gets
batch discipline (capture-before, verify-after, one revertible commit), not a
drive-by bugfix: the moment that lookup starts hitting, `price_history` begins
recording live values and price alerts evaluate live prices for the first
time. That is a product change, not a refactor.

Investigated by three parties whose findings compose: a Claude Code session
(runtime logs, DB measurements, AWIN probes), a Cowork session (the merge-bug
code trace and the discriminating test design), and the operator (who caught
each summary-vs-data contradiction below). Every claim here was verified
against the live database or the code at `eac1881`, not carried over from any
session's summary.

---

## 1. The headline: there is NO evidence that refresh-prices is broken

The investigation opened on the premise that the refresh-prices cron had been
dead for ~two weeks, based on three symptoms. All three dissolve on
measurement:

| Apparent symptom | What it actually is |
|---|---|
| Coverage numerators frozen since 2026-08-03 (204/29/346/64/26/0) | **The documented healthy output.** These are exactly the post-fix match counts recorded in `lib/pricing/refreshPrices.ts`'s own header (64/81 evdance, 346/352 golden-maple, tsar-bomba 26, brooklyn-delhi skipped — no AWIN feed). A working job reproduces these same six numbers every day. |
| `current_prices.updated_at` frozen at 2026-08-02/03 | **Structurally frozen.** No trigger exists on the table (verified: `pg_trigger` returns zero rows), the upsert payload omits `updated_at`, and `DEFAULT now()` fires on INSERT only. `ON CONFLICT DO UPDATE` leaves it at insert time forever, whether or not prices change. |
| `price_history` flat for 14 days across all 954 products | **`price_history` never reads `current_prices`** — see the merge bug below. It snapshots the static catalog price every day regardless of what refresh-prices writes. |

Each symptom is fully explained without refresh-prices being broken. What the
runtime logs actually show: 7 hits on `/api/cron/refresh-prices` in the last
7 days, all at the scheduled 11:00–11:01 UTC, **all HTTP 200**, zero runtime
errors project-wide. The 200 rules out the two loud failure modes
(`AWIN_FEED_LIST_URL` unset → immediate throw; feed-list fetch non-OK →
throw). The cron may be perfectly healthy and merely invisible — its output
read by nothing (Section 3).

What remains unknown: whether the job's 200 bodies report real matches or
per-partner errors — everything past the feed-list fetch is swallowed into
`result.errors[]` in a response body nothing logs. Only reading one
authenticated run's body settles it (operator action; requires
`CRON_SECRET`).

### The transferable lesson

Each of the three symptoms is another instance of the failure family the
Step 14 plan already catalogued five times: **the check was not measuring
what its name claimed.** "Coverage" measured the job's constant healthy
output; "updated_at" measured insert time; "price_history" measured the
static catalog. The new part is what happens when instances stack:
**independent instances of the same blind spot compose into a false
narrative that each one alone wouldn't support.** Three measurements that
individually just measure the wrong thing, together read convincingly as a
two-week production outage — complete with a plausible start date and a
per-partner damage table. The composed story was coherent, detailed, and
wrong.

---

## 2. The merge bug: `getEffectivePrice`'s override lookup can never hit

Found by the Cowork session's code trace; verified independently against the
file and the live data.

**Code** (`lib/pricing/getEffectivePrice.ts` at `eac1881`):

- Line 49 builds the map key: `` map.set(`${row.product_id}:${row.retailer}`, row) ``
- Line 58 looks up: `overrides.get(product.id)`

**Data**: `current_prices.product_id` already contains the partner prefix —
it IS `RealProduct.id` (`partner:slug`). So:

| | value |
|---|---|
| `product_id` | `canvas-vows:1st-anniversary-gift-a-personalized-word-art-canvas` |
| `retailer` | `canvas-vows` |
| key built | `canvas-vows:1st-anniversary-…:canvas-vows` |
| key looked up | `canvas-vows:1st-anniversary-…` |

The keys can never be equal. `applyOverride` is a no-op for every product
and always has been. The doc comment on `fetchCurrentPriceOverrides`
(line 35) asserting the shapes match "one-for-one" is wrong — and
`withLivePrice` in the same file (line 93) contradicts it with the correct
`.eq("product_id", product.id)` and a comment spelling out that `product_id`
is the whole id.

**Measurement** (the discriminating test — either half alone is only a
hypothesis): 27 products have `current_prices.price` differing from
`catalog_products.price`. If the merge worked, `price_history` would show
the `current_prices` value for them. Measured across all 14 snapshot days
(2026-08-03 → 2026-08-16):

```
products  always_catalog_value  ever_current_value  days  distinct_prices
      27                    27                   0    14                1
```

27/27 recorded the catalog value on every day; zero ever recorded the
override. The differences run both directions (some overrides higher, some
lower), so this is not a sign-convention artifact. Designed by Cowork,
reproduced independently — same numbers.

**Consequences:**

- **`current_prices` is a write-only table today.** Its only read path is
  `fetchCurrentPriceOverrides` → `getAllRealProductsWithLivePrices`, whose
  merge never hits.
- **Price alerts have never evaluated a live price.**
  `lib/alerts/checkPriceDrops.ts:49` uses the same broken function; the
  `product.price` it feeds to `evaluateAlertState` is always the static
  price.
- **`price_history` contains 14 days of manufactured observations** — the
  static catalog price recorded daily as though freshly observed
  (2026-08-03 → 2026-08-16, 954 rows/day, snapshot-prices ran 14/14 days at
  12:00–12:03 UTC). For the 27 products above, the recorded price is known
  to differ from the best available live price.
- **`withLivePrice` — the correctly-written variant — has zero callers.**

**Do NOT delete any `price_history` rows.** Those rows — specifically the
27 products — are the evidence for everything in this section. Deletion is
the irreversible option; the guard belongs on the read side. When the
pipeline is verified working, record a cutover date here and have any future
consumer filter to rows after it.

### Blast radius of the eventual fix — traced, not assumed

`grep -rn '"current_prices"'` across `app/`, `components/`, `lib/` returns
exactly three lines: two in `getEffectivePrice.ts`, one (the write) in
`refreshPrices.ts`. **No page or component imports `getEffectivePrice` at
all.** Product pages render `catalog_products.price` via `lib/catalog.ts`.

Fixing the merge therefore changes **`price_history` and price alerts only —
not one displayed price.**

An earlier claim during the investigation — that the fix would change 669
displayed prices — was wrong, and the error is worth recording more than
the correction (operator's own assessment of their claim): it was reasoned
from what the override layer is *for* rather than from its call sites, and
it was the fourth blast-radius assertion that day made without tracing the
call graph. Two sessions (Claude Code and Cowork) corrected it
independently by doing the trace. **A blast-radius claim is a claim about
call sites, and only a call-site trace can support it.**

---

## 3. AWIN feed staleness: 476 products' prices cannot move, cron or no cron

Found when the operator read the feed-audit table against its own summary
sentence (see Section 5). Established with a read-only probe of AWIN's
feed-list CSV (2026-08-16):

| Partner | Feed used by refreshPrices | Last Imported | Last Checked |
|---|---|---|---|
| EVDANCE | F1320 (pinned) | 2026-08-16 | 2026-08-16 |
| Golden Maple | F2615 | 2026-08-16 | 2026-08-16 |
| King Koil | 101819 | 2026-08-16 | 2026-08-16 |
| **Canvas Vows** | **103552** | **2026-05-15** | **2025-10-07** |
| **Tsarbomba** | **105368** | **2026-05-15** | **2025-10-07** |
| Brooklyn Delhi | — none — | | |

What the fields mean (established before acting on them): for healthy feeds
the two timestamps track within seconds, so `Last Imported` is AWIN's own
ingestion of the advertiser's source. For the stale pair, `Last Checked` is
ten months old and *earlier than* Last Imported — AWIN has stopped both
checking and importing. This is ingestion-side abandonment, not a quiet
source file. The feeds still download fine; they serve the frozen May-15
snapshot.

**It is a platform-wide event, not these advertisers:** 190 of 951 feeds in
the list froze on exactly 2026-05-15. Only 35 of the 190 have
ShareASale-shaped names, so it is not purely the ShareASale bridge — but 190
advertisers do not all stop uploading the same day. Something happened on
AWIN's side on 2026-05-15. (EVDANCE's abandoned legacy feed 108581 is in the
same cluster; harmless, since F1320 is pinned.)

### The migration hypothesis, tested (2026-08-16)

Hypothesis (operator's): 190 feeds re-provisioned under new IDs on one day is
what a platform migration looks like — if AWIN retired old feed IDs on
2026-05-15 and issued replacements, our pinned/selected IDs point at retired
records that still serve their final snapshot and never update again.

Tested against the full 951-feed list, matching by **Advertiser ID, never by
name**. Caveat on method: the feed-list CSV carries no feed-creation date, so
"replacement feed" is proxied as *same-advertiser feed with import activity
after 2026-05-16*.

Results:

- **The ID-scheme correlation is total on one side:** of 345 F-prefixed
  feeds, **zero** are frozen (333 imported after the freeze date). All 190
  frozen feeds are numeric-ID feeds. The F-scheme is a newer platform
  generation, and nothing on it was touched by the event.
- **But numeric feeds were not wholesale retired:** 412 of 606 numeric feeds
  imported after the freeze — King Koil's single numeric feed 101819 imported
  the same day as this probe. So the event hit a *subset* of legacy feeds,
  not the legacy scheme as a whole.
- **Migration vs abandonment, per advertiser:** of the 150 advertisers owning
  a frozen feed, **48 have another feed importing after the freeze
  (migration-shaped); 102 have none (abandonment-shaped).** The hypothesis's
  "if most do, it's migration" test therefore FAILS population-wide — the
  majority look abandoned. What survives is the platform-event claim (the
  one-day cluster and the perfect F-scheme immunity), not the universal
  re-provisioning claim.

Per our two affected partners, the split lands one on each side:

- **Tsarbomba — migration-shaped.** Advertiser ID 109230 owns 10 feeds: the
  frozen 105368 plus **nine actively-importing regional feeds** (imports
  through 2026-08-13), including English "US Feed" 113495 and "GB Feed"
  108928. The advertiser is alive on AWIN and publishing; our selection rule
  is simply anchored to the retired record. Fixable on our side.
- **Canvas Vows — abandonment-shaped, now verified by advertiser ID.**
  Advertiser ID 90193 owns exactly one feed: the frozen 103552. The earlier
  "no alternative feed at all" claim came from name matching — re-checked by
  ID because a migration that renamed advertisers would defeat name matching
  (the searching-one-corpus-and-reporting-absence shape). By ID: still
  nothing. A re-registration under a *different* advertiser ID and name would
  be invisible to this probe, but nothing observable exists. This one is an
  AWIN/advertiser conversation, not a code fix.
- **EVDANCE and Golden Maple are already on the migrated scheme** — F1320 and
  F2615 (both F-prefixed, both importing daily). EVDANCE's frozen numeric
  108581 sits in the abandoned cluster as its fossil predecessor. This is why
  those two partners' prices move (Section 3's corroboration table) while the
  numeric-anchored partners' don't.

**Cross-corroboration with the override data** — per-partner breakdown of
the 27 differing products:

```
canvas-vows   204 rows   0 differ     (feed frozen since May 15)
evdance        64 rows  25 differ     (feed fresh)
golden-maple  346 rows   2 differ     (feed fresh)
king-koil      29 rows   0 differ     (feed fresh; prices genuinely static)
tsar-bomba     26 rows   0 differ     (feed frozen since May 15)
```

Price movement exists only where the feed actually moves. The frozen-feed
partners show zero movement because their feed content predates (or equals)
the catalog import. The two datasets agree without either knowing about the
other.

**Consequence:** canvas-vows (204) + tsar-bomba (272) = **476 products whose
prices cannot change on the feed side**, independent of the merge bug and of
cron health. Fixing everything else still leaves these two partners serving
May prices.

**Partial mitigation available for Tsarbomba only:** a fresh English feed
exists (113495, "US Feed", 234 products, imported 2026-08-12) that
`refreshPrices`' selection rule skips — it prefers `English && !Vertical`,
and 113495 carries `vertical=Fashion`, so the frozen 105368 wins. Pinning
113495 via `pinnedFeedId` is a candidate fix, **but only after verifying its
deep-link id format matches the static catalog's** (the feed may use a
different id space; the file's own header demands re-verification after any
change). **Re-pinning is NOT authorized as of this writing.** Canvas Vows
has no alternative feed under its advertiser ID — that one needs AWIN-side
action (advertiser/account manager).

---

## 4. Separate open item: AWIN Publisher API returns 401

During the read-only account audit (2026-08-16), every Publisher API call —
joined/pending/suspended/rejected programmes, payment status — returned
**HTTP 401** with the `AWIN_API_TOKEN` in the local `.env`. The datafeed
list, which authenticates via the separate `AWIN_FEED_LIST_URL` credential,
worked (951 feeds).

- This does **not** explain anything above: `refreshPrices.ts` explicitly
  does not use `AWIN_API_TOKEN` (only the feed-list URL).
- What it does break: advertiser-name verification via
  `scripts/awin-status-report.ts` — the workflow that confirmed all six
  partner names in early August is currently non-functional.
- Needs its own look: token expired, revoked, or rotated. Credential
  handling is operator-only per CLAUDE.md.

---

## 5. Process finding: prose written from the conclusion, not from the table

Four times in one day, a summary sentence and its own supporting data
disagreed, and the data was right each time:

1. "Coverage frozen ⇒ cron dead" — the frozen numbers were the healthy
   output (Section 1).
2. "updated_at frozen ⇒ nothing writing" — structurally frozen by
   `ON CONFLICT` (Section 1).
3. "price_history flat ⇒ refresh broken" — price_history never read the
   refreshed data (Section 2).
4. "Every partner feed is fresh" — written directly above a table showing
   two feeds three months stale (Section 3).

The fourth is the purest instance: the table was correct, printed in the
same message, and the sentence above it said otherwise. The prose gets
written from the conclusion the writer already holds; the table gets written
from the data. When they disagree, believe the table — and treat a
summary sentence that no reader has checked against its own table as
unreviewed.

Related, same family (Section 2): four blast-radius assertions made in one
day without tracing the call graph. Both habits survive because their
outputs *look* like conclusions from evidence. The fix is the same
discipline in both cases: the claim must be derived from the artifact it is
about — the table, the call graph — not from the narrative around it.

---

## Current state summary (all verified at `eac1881`, 2026-08-16)

- refresh-prices cron: running daily, 200s, output unread — health unknown
  pending an authenticated body read (operator).
- snapshot-prices cron: ran 14/14 days; recorded static prices throughout.
- `current_prices`: 669 rows, write-only, last written 2026-08-02/03.
- Merge bug: confirmed in code and by measurement; fix NOT authorized yet.
- Price alerts: functioning, but against static prices only, always have.
- Canvas Vows + Tsarbomba feeds: frozen at AWIN since 2026-05-15
  (platform event, 190 feeds, all numeric-ID; zero F-prefixed feeds
  affected); 476 products immovable on the feed side. Tsarbomba is
  migration-shaped (9 live sibling feeds, fixable by re-pinning — not
  authorized); Canvas Vows is abandonment-shaped by advertiser ID (needs an
  AWIN conversation).
- AWIN Publisher API: 401, separate open item.
- `price_history`: nothing deleted; nothing may be deleted. Cutover-date
  filtering is the sanctioned mechanism once the pipeline works.
