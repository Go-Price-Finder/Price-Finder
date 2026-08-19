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
read by nothing (Section 2).

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

### ✅ CUTOVER — the merge fix is live (recorded 2026-08-17)

The key-mismatch fix shipped in `11ae044`, deployed READY
**2026-08-17T01:33:08Z**. Verified red→green on real data: merged-vs-static
divergence 0 before, exactly 27 after. Six-partner production baseline
captured pre-deploy and re-checked post-deploy: **6/6 displayed prices
unchanged**, including evdance's 21ft cable displaying $239.95 with a live
$219.95 override active in the merge layer — pages read `lib/catalog.ts`
and never this module, confirmed now by measurement, not just trace.
Pre-flight: **0 price alerts exist (0 rows, 0 users)**, so the first live
evaluation sends nothing; `evaluateAlertState`'s `alert_sent` guard bounds
any future first-run to one send per row per dip.

**The provenance line every future `price_history` consumer filters on:**

- `recorded_date <= 2026-08-16`: **catalog echo** — the static display
  price recorded daily by a merge that never fired. Not observations.
- `recorded_date >= 2026-08-17`: **live-but-unprovenanced** — snapshots now
  merge `current_prices`, but the table still has no provenance column
  distinguishing observed merchant prices from display prices, and
  `current_prices` itself is only as fresh as the feeds (two of six frozen;
  see Section 3).

**Pending discriminating check (scheduled, not yet run):** the first
post-cutover snapshot (2026-08-17 ~12:00 UTC) must record a value differing
from `catalog_products.price` for at least one of the 27 known-divergent
products. That is the production proof the merge fires; the local 27/27
red→green is the same assertion pre-deploy. If the 2026-08-17 snapshot
still equals catalog on all 27, the fix did not take in production — stop
and investigate before trusting anything above.

PriceHistoryChart **stays suppressed** — this fix changes what future rows
mean, not what the table contains; the restore condition (provenance) is
unchanged.

### Provenance landed before the first live snapshot (2026-08-17, pre-12:00 UTC)

Migration 0015 (Cowork, applied ~02:50 UTC): six nullable provenance
columns on `price_history` + CHECK
(`live_override | catalog_fallback | legacy_pre_provenance`), 14,293 prior
rows backfilled `legacy_pre_provenance`, values untouched. The snapshot
writer (`b89fe12`, deployed well before the 12:00 UTC cron) stamps every
new row: `price_source`, `observed_at` (from `current_prices.updated_at`,
insert-only caveat documented inline), `catalog_price_at_snapshot`, and
the three `feed_*` columns as explicit NULLs until feed persistence lands.
Dry-run over all 954: 669 live_override / 285 catalog_fallback / 0 null,
price equivalence with the merged path exact. **Result: the
"live-but-unprovenanced" class described above never came into existence
— every row is provenanced from birth or cleanly legacy.** Columns stay
nullable until Cowork tightens; do not tighten ahead of that.

Prediction for the first provenanced run (2026-08-17 12:00 UTC), pass/fail
on record: zero rows for 2026-08-17 with NULL `price_source`. If any are
NULL, the writer didn't take — stop and report, do not patch data.

**Expected-empty warning — do not "fix" this:** with Cowork's chart
restore condition (`price_source='live_override' AND observed_at IS NOT
NULL`, reading provenanced rows only), charts remain empty until
refresh-prices writes fresh observations — which is gated on the
operator's manual diagnostic of the cron. Empty charts in that window
LOOK like a regression and are not one: suppression and provenance turned
out to be the same action, and the emptiness is the honest state.

### As-of correction (2026-08-17): per-feed, not per-partner

The label section below/above stands corrected: the per-partner model
shipped in `ac9506a` overclaimed freshness for 26 tsar-bomba products —
Default-feed (105368) data frozen since 2026-05-15 displayed under an
"Aug 2, 2026" label, 79 days of overclaim, the same offence the chart was
suppressed for. My own file had documented it as "a v2 item"; the
operator's correction: **as-of is a property of the feed, not the
partner** — a partner can draw from multiple feeds. Remodelled in
`790b646` as per-feed vintage with the 26 mapped to their source feed
(derived from feed 105368's ids ∩ catalog; the suggested
`scripts/_tsarbomba-mapping.json` turned out to be a CSV column mapping,
not a product→feed map). Verified across all 954 and live in production:
the 26 read May 15, the 246 read Aug 2, no date anywhere moved in the
flattering direction. The per-feed shape is what the offers table needs,
so the structure persists past this fix.

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
sentence (see Section 8). Established with a read-only probe of AWIN's
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
and 113495 carries `vertical=Fashion`, so the frozen 105368 wins.
**Re-pinning is NOT authorized as of this writing.** Canvas Vows has no
alternative feed under its advertiser ID — that one needs AWIN-side action
(advertiser/account manager).

**Feed 113495's id format, verified before any pin (2026-08-16):**

- **Format: compatible.** All 234 rows carry `pclick.php?p=<id>` deep links
  with extractable ids — same shape as the static catalog's 272/272.
- **Id space: shared, not feed-scoped.** Of the 21 feed ids that match a
  catalog id, 20 have byte-identical normalized product names; the ids are
  real per-SKU identifiers, not per-feed numbering. (The 21st,
  id 45221769256, is a probable retitle — feed "The Tsar Bomba Women's
  Luxury Watch Nucleus Femme 04-TB8231" vs catalog "Tsar Bomba Women's
  Quartz Watch | White Gold | 35mm…" — same product family, needs a human
  eye before trusting.)
- **Coverage: a swap, not an upgrade.** 105368 matches 26 catalog products
  (reproduces the documented baseline exactly); 113495 matches 21 — and the
  two sets are **completely disjoint (zero overlap)**. A re-pin trades 26
  frozen-price products for 21 fresh-price products; the 26 keep their
  existing `current_prices` rows but stop being refreshable.
- **The zero overlap is expected by construction, not a mystery** —
  correction to how this section first read. Commit `87877a2` (2026-08-02)
  re-merged the tsar-bomba catalog as 246 US-feed (113495) + 26 Default-only
  (105368) products, joined on `merchant_product_id` precisely because — per
  that commit's own message — **AWIN assigns a distinct `aw_product_id` per
  feed for the same physical product.** The two feeds' catalog slices are
  disjoint by design.
- **The dominant effect is id churn, not catalog drift** — a second
  correction: an earlier draft read "213 of 234 rows not in catalog" as the
  product line moving on. Measured properly (2026-08-16, tiered: exact id →
  model token in feeds → model token on merchant → series phrase), the line
  is alive; the *ids* died. Only 47 of 272 catalog products' deep-link ids
  exist in any of the ten current feeds; 181 more are present at model level
  in the feeds under new ids. Section "Deep-link linkrot" below quantifies
  it. A re-pin alone still caps live-price coverage at 21/272; only a
  re-import re-keys the catalog to current ids — but see the sequencing
  conflict below before scheduling one.

### Deep-link linkrot: the tsar-bomba id linkage is mostly dead — the products aren't

Prompted by the disjoint-coverage finding: if 225 of 272 catalog ids appear
in neither English feed, are those products discontinued — live pages and
affiliate links for things nobody can buy?

Measured 2026-08-16 against the union of ALL ten tsar-bomba feeds
(advertiser 109230) and the merchant's live storefront
(tsarbomba.com `products.json`, 146 live products — checked directly, NOT
via awin1.com links, which would register self-clicks). Tiered
classification of the 272 catalog products, each tier only counting what the
previous tiers missed:

| Tier | Evidence | Products |
|---|---|---|
| 1 | exact deep-link id in a current feed | **47** |
| 2 | model token (TB####) in a current feed under a different id | 181 |
| 3 | model token live on merchant, absent from all feeds | 14 |
| 4 | series phrase live on merchant or in feeds | 20 |
| 5 | no evidence at any tier | 10 |

The tier-5 residual was then checked by hand: all ten are stainless-steel
"Elemental Series" skeleton watches, and that line is present in both the GB
feed (60 rows) and the merchant's live catalog (61 "Elemental" titles) —
they fell through because their names use en-dashes where every classifier
tier keyed on pipes or model tokens. **At series level, confirmed
discontinuations: approximately zero.**

**Update, same day: tier 5 died entirely.** One representative product per
tier was then fetched directly from the merchant's storefront (variant-level
Shopify JSON — never via awin1.com, which would register self-clicks). All
five exist and are purchasable, including the final "no evidence anywhere"
candidate: "Dark Matter 4 | Rafael Signed Limited Edition" is live at
$4,999.99, 1/1 variants available — the merchant's own search finds it. The
classifier called it absent because its series-phrase list enumerated
reactor/nucleus/elemental and not "dark matter." **Confirmed
discontinuations across all 272 products, after every tier and every
correction: zero found.**

### The vacuous join: keys that cannot match return zero, and zero reads as a pass

A distinct instance of the check-not-measuring-its-name family, caught
before it passed (2026-08-17, during Gate D of migration 0016). The task:
prove no evdance catalog product traces to frozen feed 108581. The first
join ran on `p=` deep-link ids and returned zero matches — which would have
closed the gate — but the zero was **structurally vacuous**: evdance's deep
links are `cread.php?ued=` format and carry no `p=` ids at all, so the join
had no keys on one side and could never have returned anything. A zero from
a join whose keys cannot match is not evidence of absence; it is the shape
of the query. The gate was instead closed with the merchant-URL join (both
sides carry `ued=`/product URLs): 108581's single product matched 0 of 72
catalog URLs, with 70/72 catalog URLs positively resolving into F1320 as
corroboration that the join CAN match. **Rule: before accepting a zero from
any join, verify the join key exists and is populated on both sides — a
join that cannot fail to return zero has not tested anything.**

### The namespace failure, named

The recurring shape — this document's second transferable lesson, alongside
"the check wasn't measuring what its name claimed": **"not found in the
namespace I checked" is not "not there."** Instances accumulated today
alone, each in a different namespace: advertiser *name* matching would have
missed a re-registered Canvas Vows feed (caught by re-checking under the
advertiser ID — still absent, but only the ID check makes that finding
sound); `aw_product_id` absence was read as product absence when the ids
are per-feed and churn (the products were alive under new ids); a
pipe-keyed classifier read en-dash-named Elemental watches as
discontinued; an enumerated series-phrase list read "Dark Matter 4" as
gone while the merchant's search returned it. The operator independently
logged the same failure three times in their own reasoning. Absence is a
claim about a namespace and a matching method, never about the world —
every absence finding needs its namespace named and a second, differently
keyed namespace checked before it's reported.

So the exposure inverts: the catastrophic reading (hundreds of dead
products) is wrong, but **225 of 272 products' affiliate deep links carry
`p=` ids that exist in no current feed.** Whether those pclick links still
redirect correctly at AWIN is untested and untestable from here without
firing affiliate clicks on our own account — the operator can click a
handful manually to settle it. Until then, treat tsar-bomba's deep links as
attribution-suspect rather than product-dead. Note each classifier tier's
failure in this measurement was a *naming-format* failure (pipes vs
en-dashes vs sentence-names) — the same lesson as Section 8, applied to
join keys.

**Canvas Vows has the same exposure and it is unmeasurable feed-side** —
its only feed is the frozen one, so "id present in a current feed" cannot
be evaluated. Recorded as unmeasurable, not as absent. (A partial
merchant-side check like tsar-bomba's would work if the Canvas Vows
storefront exposes a public product list; not attempted — out of scope
today.)

### Merchant-side ground truth: the same frozen feed split into opposite outcomes

Both frozen-feed partners were checked against their merchants' live
storefronts directly (public Shopify product JSON, 2026-08-16) — the first
measurement of what the frozen feeds actually *cost us*, as opposed to what
the mechanism implied.

**Tsar-bomba: no present error found.** Three of three price comparisons
(the tier-1/2/5 representatives with unambiguous product mappings) match the
merchant's live price exactly — $1500, $999.99, $4999.99. The frozen feed
means we cannot *detect* a reprice; the merchant simply has not repriced the
products checked. Future blindness, not present error.

**Canvas Vows: present error, live today.** canvasvows.com lists 258
products (we carry 204 — a catalog-coverage gap noted separately, not a
pricing item). Sampled 10 of ours across the full $45–$399 band: 9 matched
by exact title, 1 was retitled but still sold. Of the 9, **only 1 displayed
price equals any current variant price at any size.** Eight sell at no
current variant price — deltas $4–$20 in both directions, zero compare-at
hits (so genuine repricing, not a sale event). Two are strictly
unobtainable: our $75 and $100 sit below the merchant's cheapest current
variant ($79, $109).

**Full-catalog census (same day, all 204):** the 10-product sample
overstated the error rate — it extrapolated to ~160 wrong pages; the census
found **93**. Sampling across price bands is not sampling across products,
and the bands where repricing happened were overrepresented. The corrected
numbers, measured not extrapolated:

- 194 of 204 matched by exact title; the other 10 are retitled but still
  sold (0 absent — the namespace lesson held).
- Of the 194: **101 exact variant match (52%) — half the catalog is exactly
  right. 93 (48%) match no current variant at any size.** 0 compare-at
  hits: repricing, not sales.
- Of the 93: **10 strictly unobtainable** (ours below their cheapest
  variant — concentrated at two repriced tiers, $75→$79 and $100→$109,
  plus one $49.95→$79 outlier), 6 above their max, 77 in-range but wrong
  at every size.
- Direction: 51 understate (customer pays more than shown) vs 42
  overstate. Median |delta| **$6**; 72 of 93 within $10; max $100.

Shape summary for the remedy decision: half right, and the wrong half is
mostly small (median $6) and roughly bidirectional, with a thin
strictly-unobtainable tail of 10 pages at two price points. This is the
"mostly small deviations" shape, not the "mostly unobtainable
understatements" shape.

A sampling-design failure worth keeping with the rest of the collection:
**sampling across price bands is not sampling across products.** The
10-product sample was deliberately spread across the $45–$399 band for
representativeness, and that construction is exactly what skewed it — the
merchant's repricing happened at specific tiers, so band-spread picks
overrepresented repriced tiers by design and extrapolated to ~160 wrong
pages where the census found 93. A stratification chosen to be fair along
one axis silently became a bias along the axis that mattered.

### Remedy decision (operator, 2026-08-16): no hotfix, no catalog edit, no suppression

Decided with reasons, so the next person proposing a quick fix meets the
reasoning and not just the verdict:

1. **The shape is ordinary staleness.** 101 exact, 93 off by a median $6 in
   both directions, and a tail of 10 explained by two merchant tier
   repricings ($4 and $9). Every comparison site carries drift between
   refreshes.
2. **What's actually dishonest is not the drift — it's that the page
   implies a currency it doesn't have.** NO price on this site, for ANY
   partner, says when it was last verified. Canvas Vows just makes an
   invisible problem visible.
3. **The real fix is an as-of date on displayed prices, site-wide.**
   Truthful at $6 of drift and truthful at three months of it, and it
   converts a hidden error into one the customer can evaluate. Same move as
   the chart suppression: make the label say what the data supports.
   Scoped as a product change, not a hotfix — placement and wording are
   operator decisions, and it interacts with the provenance work. **Not
   built yet; do not build without the operator's placement/wording call.**
4. **Explicitly NOT hand-fixing the 10 unobtainable pages.** Editing
   catalog prices writes a fabricated price movement into `price_history` —
   the exact mechanism behind the five king-koil artifacts (the `87877a2`
   precedent), deliberately triggered, in a table that still has no
   provenance. The remedy would manufacture the artifact the chart was
   suppressed over. Recorded because this is the fix someone will propose
   again.
5. **The real fix for Canvas Vows specifically remains the AWIN ticket.**
   The as-of label makes the staleness honest; only a working feed makes it
   small.

The generalization, recorded in the operator's words as the correction of
their own repeated mistake: **the mechanism never predicts the consequence;
the merchant's repricing behavior does.** False for tsar-bomba,
substantially true for canvas-vows, same frozen feed, one partner apart.
Five instances today of asserting a consequence from a mechanism — the dead
cron, the 669 displayed prices, the discontinued products, the
three-month-old prices — and this is the first time measurement split the
same mechanism into opposite outcomes.

**Remedy space (product decision, deliberately not chosen here):** while
feed 103552 is frozen there is NO correct-price source available through
AWIN at all. Every remedy is therefore one of: suppression, an explicit
as-of label, or a non-feed data source (the merchant's own storefront being
the demonstrated candidate). Which one is right depends on the delta shape
the full-catalog measurement returns — mostly-small-overstatements calls
for a different answer than mostly-unobtainable-understatements.

### Canvas Vows mojibake: the import succeeded, every check passed, the output was unreadable

Found by the operator in the feed file (2026-08-16), confirmed live on
production, then scoped in our data:

- **203 of 204 canvas-vows descriptions carry double-encoded UTF-8** — 882
  occurrences ("—" renders as "â€"", "'" as "â€™"). Names: zero. **All
  five other partners: zero** — including tsar-bomba, whose feed comes off
  the same `datafeeds.shareasale.com` bridge and is clean, so this is a
  per-merchant-upload corruption, not a bridge-global one.
- The DB counts match the operator's feed-side counts exactly (203 rows /
  882 occurrences): **the import was byte-faithful; it imported garbage
  correctly.** The 38/38 verify suite then confirmed the garbage was
  preserved perfectly — it asserts fidelity, and fidelity held.
- Render surface: three per product — meta description (first 155 chars),
  page body, and JSON-LD `description` — across 203 live pages.
- **The lesson, same family as the rest of this document, applied to
  content rather than numbers:** the import succeeded, every check passed,
  and the output was unreadable. Nothing anywhere in the pipeline was
  measuring whether the text was *legible* — only whether it was
  *faithful*.

**Freshness constraint recorded:** the feed as our pipeline fetches it has
NO last-updated column at all (the feed URL requests a fixed column list
that omits it); the operator's fuller local export has the column, empty on
all 204 rows. Either way: the merchant never populates it, so **AWIN's
ingest timestamp is the only freshness signal that exists for Canvas Vows —
and it is the signal that froze.** Any future freshness check for this
partner has nothing else to key on.

**Repair proposal — simulated read-only, NOT applied, not yet authorized:**

- Recipe: encode as **WHATWG windows-1252 (with C1 passthrough), decode as
  UTF-8**, applied per-string only where a strict round-trip proves it
  (re-encoding the repaired text reproduces the stored bytes exactly);
  anything that fails the round-trip is left untouched.
- Two near-miss recipes, recorded because measurement eliminated them:
  plain Latin-1 (the textbook fix) cannot encode € or ™, which the
  corrupted text contains; strict CP1252 rejects the five bytes
  (0x81/0x8D/0x8F/0x90/0x9D) the original corrupting decoder passed
  through as C1 controls. Only the passthrough variant round-trips.
- Measured result: **203 of 203 affected descriptions repair cleanly, 0
  fail the round-trip, 1 description untouched (no artifacts).**
- Class distinction (why this is proposable while the price edit was
  declined): it is a **description-only** change — price is untouched, so
  nothing is written into `price_history` and no Finding-C artifact is
  manufactured.
- **Constraint for whoever applies it:** `scripts/verify-catalog-migration.ts`
  asserts catalog_products equals the static `lib/canvas-vows-data.ts`
  byte-for-byte (38/38). Repairing the DB alone breaks the suite; the
  repair must fix **both sides in the same change** — or explicitly retire
  that assertion — and it must be applied via MCP or a runner script, never
  by pasting (the NBSP rule; this is exactly a byte-fidelity change).

### Sequencing conflict: the coverage fix is also the contamination event

Both horns, stated without resolution — this is an operator decision:

- **Horn A:** a tsar-bomba re-import is the correct fix for everything
  above. Only 47/272 exact-SKU id linkages survive; a re-pin without
  re-import caps live-price coverage at 21/272; the catalog's deep-link ids
  are mostly dead in current feeds. `refreshPrices.ts`'s own
  `idNotInCatalogExamples` doc says a nonzero count means re-import.
- **Horn B:** a re-import is exactly the action that manufactures
  price-history artifacts. Verified against the live table: commit
  `87877a2` (2026-08-02, "Refresh King Koil and Tsar Bomba catalogs")
  changed king-koil catalog prices, and the 2026-08-03 snapshot recorded
  **5 king-koil price changes** — catalog-rewrite artifacts indistinguishable
  in `price_history` from observed market movements, because the table has
  no provenance column. A 272-product tsar-bomba re-import does the same
  thing at roughly ten times the scale, into the same provenance-less
  table, on whatever day it runs.

The cutover-date rule (Section 2) mitigates for *future* consumers but does
not mark which historical rows are rewrite artifacts. Do not schedule the
re-import until the operator has chosen how to sequence it against
`price_history` integrity — options exist (provenance column first;
recording the re-import date alongside the cutover date; accepting the
artifacts and documenting the date), but this document deliberately does
not pick one.

### Standing risk: every numeric-ID feed still in use is one event from this

The 2026-05-15 freeze hit only numeric-ID feeds and left every F-prefixed
feed untouched (0 of 345). Any partner still anchored to a numeric feed is
therefore exposed to a repeat — **"it works now" is not evidence of safety;
it is the same state the frozen 190 were in on 2026-05-14.** And the failure
is silent: nothing errors, the feed keeps serving its final snapshot, and
the symptom is prices that quietly stop moving — discovered months later,
exactly as happened here.

Where our five partners stand:

| Partner | Feed | ID generation | State |
|---|---|---|---|
| canvas-vows | 103552 | numeric | **frozen 2026-05-15** |
| tsar-bomba | 105368 (selected) | numeric | **frozen 2026-05-15** |
| tsar-bomba | 113495 (candidate) | numeric | live — **still exposed** |
| king-koil | 101819 | numeric | live — **exposed** |
| evdance | F1320 (pinned) | F-scheme | live, safe from this event |
| golden-maple | F2615 | F-scheme | live, safe from this event |

Note that Tsarbomba's entire feed family — all ten feeds, including the
fresh regional ones — is numeric, so even the candidate re-pin stays on the
exposed generation.

**Standing preference, recorded now rather than decided under pressure
later:** if AWIN offers an F-scheme equivalent for any partner currently on
a numeric feed (king-koil and tsar-bomba above all), prefer it — raise it in
any AWIN conversation that happens anyway, including the Canvas Vows ticket.
Additionally, any future freshness check on these partners should assert
that `Last Imported` is recent, not that the download succeeds — the frozen
feeds download fine, which is exactly what makes the failure silent.

---

## 4. RESOLVED: the Publisher API 401 was a stale credential in the wrong env file — not a broken API

During the read-only account audit (2026-08-16), every Publisher API call
returned **HTTP 401** while the datafeed list (separate `AWIN_FEED_LIST_URL`
credential) worked. Diagnosed same day, read-only:

- **The API, the header shape, and the account were never the problem.**
  The script's `Authorization: Bearer <token>` matches AWIN's documented
  OAuth2 auth exactly (confirmed against help.awin.com/apidocs and
  empirically: a bare non-Bearer header draws a *different* 401). The
  publisher id (3002879) is correct and confirmed as "Price Finder",
  role userOwner.
- **Root cause:** `.env` and `.env.local` both define `AWIN_API_TOKEN`,
  **with different values.** The AWIN scripts run with `--env-file=.env`
  (their own documented invocation); the operator verified the token in
  `.env.local` against the AWIN UI. `.env`'s token → 401 `invalid_token`;
  `.env.local`'s token → 200. The comparison was valid for the file it was
  run on and irrelevant to the file that was failing.
- **Sixth namespace instance of the day, and this one the operator
  authored** (recorded at their instruction): the verify-against-the-UI
  step named `.env.local` — named a file, and named the wrong one. Same
  shape as the other five; the namespace was a *file* this time.
- Resolution is operator-only: token being **rotated** (not copied across),
  because the stale value leaked (below) and "already invalid" rests on one
  endpoint's rejection — an inference. **Rotation blast radius includes the
  Vercel project env:** `lib/cashback/syncAwinTransactions.ts` (sync-cashback
  cron, daily 14:00 UTC) reads `AWIN_API_TOKEN` from Vercel env and swallows
  a 401 into `result.errors` inside an HTTP 200 — the same silent-success
  shape as refresh-prices — so a rotation that misses Vercel fails silently
  every day.

### Operational note: auth-endpoint error bodies can contain the credential

AWIN's OAuth layer **echoes the presented token back in the 401
`error_description`**. During diagnosis, raw 401 bodies were printed
verbatim before this was known, which put the (stale) token value into a
stored session transcript — the trigger for rotating rather than copying.
The current token was never exposed; the probe that tested it redacted the
response against the token value before printing anything.

The rule, broader than AWIN: **never print a raw response body from an
authentication endpoint.** Error responses routinely echo the presented
credential. Redact token-shaped content — or split-and-mask against the
known credential — before any response body reaches a log, a transcript, or
a terminal.

---

## 5. AWIN Publisher MasterTag: evaluated without installing, and declined for the general case

Evaluated 2026-08-16, entirely read-only — nothing was added to any layout,
nothing deployed, nothing activated on AWIN's side.

**The tag doesn't exist yet.** `https://www.dwin2.com/pub.3002879.min.js`
returns 404 (five URL variants tested). A control — another publisher's
live tag, `pub.45628.min.js` — returns 200 while a second arbitrary id 404s
like ours, so the URL pattern is right and the file is **provisioned
per-publisher when MasterTag is activated in the dashboard**. Activation is
the operator's step and is deliberately deferred (see below).

**What the control tag reveals** (caveat: another publisher's plugin set;
ours may provision differently):

- **2,199,188 bytes parsed / ~474 KB brotli over the wire.** This site's
  entire First Load JS budget is 103 kB compressed.
- **It embeds a 20,424-domain merchant match table** — 16.5% of the file is
  domain string literals. That is Convert-a-Link's advertiser list, shipped
  to every visitor.
- Runtime markers: 1 MutationObserver, click/mousedown/touchstart
  listeners, 4 `sendBeacon` call sites, `zenaps.com` endpoints (Bounceless
  Tracking), loads at least one further script — and **zero `.href =`
  assignments**, consistent with click-time interception rather than DOM
  rewriting (tentative until measured live).

**Decision (operator, 2026-08-16): production install is a NO on the
general case.** 474 KB over the wire against a 103 kB total budget, on a
site with two prior incidents of exactly this shape (the 2026-08-01 LCP
regression, the search-freeze TBT bug), for a plugin whose core function
has nothing to do on our pages — product links are already server-rendered
`awin1.com` pclick URLs, so Convert-a-Link has nothing to convert.

**Architectural option on record — an option with a condition, NOT a
recommendation:** the only way Convert-a-Link earns its weight here is if
we deliberately replace pclick deep links with plain merchant URLs and let
the tag convert at click time. That would make the stale-`p=`-id problem
(Section 3's linkrot) structurally disappear — no ids in our HTML at all.
It is 474 KB on every page view to avoid a periodic re-import — a bad
trade **unless AWIN confirms historical ids are dead** (ticket question 4).
Revisit only when that answer arrives.

**Narrow measurement plan, gated on the operator saying so — not scheduled:**

- Hypothesis: the tag is composed per-publisher from enabled plugins, and
  the 20,424-domain table ships only with Convert-a-Link. A tag provisioned
  with **Bounceless Tracking alone** should be a small fraction of 474 KB.
- Refutation condition, stated in advance: if it comes back near 474 KB
  regardless, the tag is monolithic and the whole idea is dead for this
  site.
- Protocol when authorized: operator activates Bounceless Tracking only
  (not Convert-a-Link, not adMission) → the file provisions → preview-only
  deploy behind an environment gate, never production → measure First Load
  JS, LCP, TBT, long-tasks profile on a product page and the homepage
  against production baseline, real browser and real interaction (the
  2026-08-01 methodology) → characterize network behavior and the
  crawler-vs-JS-user view of product links.
- Deliberately not today: no activation sits on the account while the
  ticket is asking AWIN attribution questions.

## 6. Live-price display: Option A is the CHOSEN architecture, and it does not ship yet

Decided by the operator 2026-08-17, after the merge-fix cutover, recorded so
nobody re-litigates it.

**The decision:** when live-price display ships, it ships as **Option A —
build-time merge inside `fetchCatalogRaw`, within the `unstable_cache`
boundary, plus a scheduled daily rebuild** (deploy hook after refresh-prices,
~11:30 UTC). **The placement is the detail most likely to be lost:** merging
inside the cached fetch is what keeps the whole build rendering one
consistent snapshot AND keeps the query guard intact — the guard counts
`__FETCH_CATALOG_HIT__` markers per cached-function invocation, so a second
query inside the boundary is invisible to it, while a merge anywhere outside
the boundary runs per-worker and breaks the collect/render expectations.

**Why not yet:**
- Payoff today is 27 of 954 products (2.8%), and the ceiling is structural:
  285 products have no override at all, and two partners' overrides cannot
  move while their feeds are frozen. Option A's value scales with feed
  health, currently 4 of 6 — the same change is worth multiples more after
  the AWIN situation resolves.
- Cost is a daily 1,043-page rebuild, indefinitely, starting the day it
  ships.
- Ordering: fresher numbers without saying when they're from just moves the
  honesty problem. The as-of label is honest regardless of feed health — it
  ships first.

**Disqualified alternatives, with reasons, so nobody reaches for them later:**
- **ISR (Option B):** trips every documented tripwire at once —
  `getRealProduct` must revert to its single-row query or each request pays
  the 993× payload regression; the `mappedCatalogCache` staleness residual
  becomes live; and it reverses the Step 13 fully-static decision the whole
  Step 14 architecture stands on. All for freshness the upstream feeds
  (daily at best, frozen for two partners) cannot justify.
- **Client-side price swap (Option C):** RLS permits it, but served
  HTML/JSON-LD would carry the catalog price while JS swaps the visible one
  — a structured-data/displayed-price mismatch on the one number the site's
  credibility rests on, plus price-flash and a per-page-view fetch. It is
  PriceHistoryChart's architecture applied to the price itself.

**Two side effects, GATED — not accepted.** Neither ships as a side effect
of a price-display change; when Option A is authorized, each needs its own
before/after and its own decision:
- `getProductTitleSuffix` dedupes colliding products on `name && price`
  (`lib/catalog.ts:419`), so merged prices change collision sets and page
  `<title>`s move. That is a **content change**, not a price change.
- `getFeaturedDeals` filters `originalPrice > price` (`lib/catalog.ts:563`)
  and overrides carry feed RRP as `original_price`, so homepage Featured
  Deals selection changes. That is a **merchandising change**, not a price
  change.
- Pattern name, for recognition: an unrequested behaviour change arriving
  inside a refactor — the same shape as the category filter a subagent
  declined to apply earlier in this project.

**The verify suite under Option A: it does not break, it changes MEANING.**
It compares the static files against `catalog_products` and neither side
changes — 38/38 survives mechanically. What changes is what a pass
certifies: no longer "what the user sees," but "the base layer under an
overlay." Semantic carve-out, documented here, not a failing check.

### The as-of label (ships first) — and a correction to its data source

The honest as-of for **displayed** prices is **the catalog's
last-verification date, not the feed's last-import date.** King-koil's feed
imports daily, but the displayed prices date from the 2026-08-02 catalog
refresh — a feed-dated label would overclaim freshness for every partner
whose feed outruns their catalog. Feed-last-import becomes the correct
field only under Option A, when pages display merged prices. (Same failure
family as everything else in this document: the label must date the number
actually shown.)

Per-partner as-of dates, derived from git history and feed vintage:
canvas-vows **2026-05-15** (imported Jul 29 from a feed frozen May 15 — the
price data's vintage, and the census-proven drift case); king-koil and
tsar-bomba 2026-08-02 (the `87877a2` refresh; tsar-bomba carries a code
caveat — 26 of its 272 came from the frozen Default feed and are May-15
vintage; per-product precision is a v2); brooklyn-delhi, evdance,
golden-maple 2026-07-25 (original imports).

## 7. Featured Deals vs the strategy's inclusion rule — quantified, sequencing problem confirmed

`getFeaturedDeals` ranks by discount off merchant `originalPrice` — "% off
MSRP" ranking, which the product-strategy inclusion rule forbids (a deal is
defined by a product's own price history, not a merchant's claim). Not
fixed; quantified (2026-08-17):

- **Products currently surfacing: 0** (correction — Cowork measured the
  live page; an earlier draft of this section said 1 by reading the
  Supabase pool). `/deals` still reads the STATIC path (`lib/partners` —
  Batch 5 never ran), where no product literal sets `originalPrice`, so
  the live page renders zero deals. The Supabase pool
  (`original_price > price` in `catalog_products`) is exactly 1 — one
  brooklyn-delhi product — which is what would surface if/when the deals
  page migrates. The homepage removed its Featured Deals section entirely
  (`app/page.tsx:40`).
- **Survivors under a history-based rule today: 0.** No product has any
  usable self-history — everything before the 2026-08-17 cutover is
  catalog echo, and live-observed rows begin accumulating today, one per
  day. A "below its own typical price" rule cannot qualify anything for
  days-to-weeks.
- So **adopting the history-based inclusion rule costs nothing** (operator
  conclusion from Cowork's measurement): the MSRP-ranked surface is zero
  products live and one in the pool, and the honest replacement rule has
  nothing to run on yet either — a sequencing convenience, not a
  trade-off. Two watch-items recorded: the Option A gated
  side effect (overrides carry feed RRP as `original_price`, which would
  inflate this pool the day live display ships), and the strategy doc
  itself — which is NOT yet in this repo (see below).

**Blocked P1 (2026-08-17): `claude/product-strategy-2026-08-17.md` and
Cowork's D2 record do not exist locally** — `git status` clean, no such
files on disk. Same transfer gap as the status-corrections doc. Nothing
can be committed until the files actually land; this section's
strategy-rule paraphrase is from the operator's message, not the doc.

## 8. Process finding: prose written from the conclusion, not from the table

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

## 9. Email deliverability (2026-08-17): the domain works, the app was pointed at nobody, and the cron swallowed send failures

### 9a. The domain and the pipe are proven

One authorized test message, from `Go Price Finder <alerts@send.gopricefinder.com>`
(the only Resend-verified domain) to gpf@gopricefinder.com:

- Resend id `f5864a69-3f7e-46d7-a6ca-0c7f6bbe286a`, created 20:44:17Z.
- SES id `<010001a01177c74d-a8842155-8d50-43e2-ad54-6c0be2abcab1-000000@email.amazonses.com>`.
- Delivery event confirmed DELIVERED (read from Resend's logs on the Cowork
  side — see 9c for why this session couldn't read it) and physically
  present in the gpf@ inbox (operator).
- Negative control ran FIRST: a send from the bare, unverified
  `alerts@gopricefinder.com` was rejected with a loud, distinguishable
  403 `validation_error` ("The gopricefinder.com domain is not verified").
  The test could have failed, and the failure shape was observed before
  the pass was trusted.

### 9b. The fallback finding — record this shape

The app's only from address is:

```ts
EMAIL_FROM = process.env.RESEND_FROM_EMAIL ?? "Go Price Finder <onboarding@resend.dev>";
```

`RESEND_FROM_EMAIL` was set NOWHERE — not in Vercel, not locally. Production
resolved to `onboarding@resend.dev`, Resend's shared test sender.

**The predicted failure was a bare `@gopricefinder.com` from address, which
fails loudly at send time (the 403 above). The actual state was worse in a
quieter way: `onboarding@resend.dev` is a sender that WORKS for the account
owner's own address and silently reaches nobody else.** A deliverability
test written by someone who assumed the loud shape — send to yourself,
watch it arrive — would have PASSED against a configuration that cannot
email a single real user. The test that catches this must send from the
address the app would actually use, to an address the account does not own,
or must assert the resolved from address itself. (This session's test
hardcoded the verified address and therefore proved the domain, not the
app; the app-level fix is the env var, recorded below.)

Fixed 2026-08-17: `RESEND_FROM_EMAIL="Go Price Finder <alerts@send.gopricefinder.com>"`
set in `.env.local` (this session) and in Vercel Production + Preview
(operator). The Vercel value takes effect at the next deploy, not before —
env vars are read at runtime from the deployment's environment, and the
deployment live at the time of this finding (`dpl_CArd9y8SZVfHsMVdy26BAkGn5jpL`,
commit `419b3e4`) predates the variable.

**CORRECTION (2026-08-17, operator's read of the full Resend send log):
"email was never capable of sending" — this section's original framing —
is FALSE, and the truth is worse.** Resend id
`90041e8a-de63-4a05-846c-22ee048bde79`, 2026-07-23 03:42Z: delivered AND
OPENED, From `Price Finder <onboarding@resend.dev>`, To
kawsar0990a@gmail.com. That is the fallback sender WORKING in production —
to the account owner. The accurate claim: email could reach exactly one
person and nobody else. The hypothesis stated above ("a test written by
someone who assumed the loud shape would have passed") is no longer a
hypothesis; it has an artifact — someone tested the feature on themselves,
saw success, and the configuration that cannot email a single real user
looked healthy for 26 days. Historical note on that July message: it
carried fabricated demo content to a real inbox — a headphones product not
in the catalog, an Amazon search URL, an Unsplash stock photo (verified
not live: 0 of 954 catalog rows have an Unsplash image). It came from the
test scripts' invented payload, since replaced with real catalog data —
see §9j for the bug that payload masked.

### 9c. Send-only key scoping — the read-block is evidence, not a gap

The new RESEND_API_KEY is send-scoped: `emails.send` works;
`emails.get(id)` returns 401 `restricted_api_key` ("This API key is
restricted to only send emails"). This blocked in-session delivery
confirmation (resolved via dashboard on the Cowork side) and is POSITIVE
evidence the key rotation shipped the least-privilege scope it claimed to.
The old full-scope key remains active pending the CI check (now done — see
9e); revocation is the operator's call.

### 9d. The swallow, fixed and demonstrated failing (third instance of the silent-200 family)

`checkPriceDrops` catches per-row errors into `result.errors[]` (correct —
one bad row must not stop the rest), but the cron route returned
`{ ok: true, ...result }` with HTTP 200 regardless. A send failure was
invisible in the only place Vercel records cron outcomes, which is exactly
the refresh-prices shape (§1) and the sync-cashback shape (§4). Third
instance of the family: **the check was not measuring what its name
claimed** — `ok: true` meant "the loop finished", not "the emails sent".

Fixed 2026-08-17 in `app/api/cron/check-price-alerts/route.ts`: any
per-row error ⇒ HTTP 500, `ok: false`, errors in the body.

Demonstrated failing before trusted: one temporary wishlist row (operator's
own account, id `379d6e12-cfd4-43a5-be82-4808d47ef980`, inserted and
deleted the same run, zero alert rows remain), the from address forced to
the bare domain (the known 403 producer), the REAL route handler invoked
against the REAL database: prediction `500 / checked:1 / sent:0 / one
error naming the unverified domain` matched exactly. The fix has been
observed producing a non-200 on a real send failure, not merely observed
succeeding.

**Who observes the non-200: today, NOTHING, automatically.** Verified
against Vercel's docs: failed cron invocations surface in the dashboard
Crons tab, in runtime logs (`vercel logs --status-code 5xx`), and on the
Observability page — all pull-based; Vercel's native notifications cover
deployment failures, not runtime 5xx on cron paths. This is the dead-cron
lesson in different clothing and it is recorded deliberately: we ship the
loud failure KNOWING it has no automatic observer. Proposal (not built,
not authorized): an external dead-man's-switch monitor (healthchecks.io
class) pinged at the END of each cron run on success — a missed ping
alerts the operator by a channel that is neither Vercel nor Resend, so it
catches both the dead-cron shape (no run) and the loud-failure shape
(run, non-200), with no circularity through the email channel being
monitored.

### 9e. CI audit: the old key is not load-bearing anywhere in CI

`.github/` contains exactly one workflow (`verify.yml`); zero references
to RESEND anywhere in it — as designed, it wires only the two anon
Supabase vars into the Build step. The old key's remaining known homes are
Vercel envs and the Resend dashboard. No CI secret was changed.

### 9f. Assembly test (2026-08-17, evening): the deployed path sent — the from header is the open measurement

The §9a test proved the domain and §9d proved the failure branch; neither
proved the deployed app SENDS through its own resolved configuration —
components verified, assembly unverified, the exact state that let
onboarding@resend.dev sit in production looking healthy. Authorized
exercise: one temporary wishlist row (operator's account, id
`b67c355c-ec73-4659-a484-c49493a327fa`, inserted 21:12Z and deleted the
same run, table back to 0 rows), then the DEPLOYED route
(`dpl_3jv6rSxoeXJeNXWXnKSdGKouwGWZ` at `748491c`, holding the production
alias) invoked with CRON_SECRET.

Result: HTTP 200, `{ok:true, checked:1, sent:1, reset:0, errors:[]}` —
prediction matched. The success branch of the fixed route has now run for
real: Resend ACCEPTED a send from whatever `EMAIL_FROM` resolved to in
production.

**The from header on the delivered message is the measurement, and it is
PENDING an operator read.** The message went to the wishlist user's
address (kawsar0990a@gmail.com); the Gmail account readable from this
session is a different mailbox (it holds neither this message nor the
§9a test that gpf@ verifiably received), so the header could not be read
here. Acceptance narrows the state to exactly two:
`alerts@send.gopricefinder.com` (env var resolved — assembly proven) or
`onboarding@resend.dev` (env var did NOT reach the deployment, and that
Gmail happens to be the Resend account-owner address — the finding stands
despite the 200). The route response cannot distinguish these; only the
received header can. Recorded rule restated: report the from address on
the delivered message, not the one expected.

**CLOSED (2026-08-17, operator's read from the Resend side):** message
`f9c15a1c-2a18-466a-af7c-811cd0f6212b` reads
`From: Go Price Finder <alerts@send.gopricefinder.com>`. The Vercel
variable reached the build; the deployed app sends through its own
resolved configuration. Assembly proven — and the same log read produced
§9b's correction and the §9j/§9k defects, all found in the RENDERED
message, none visible in the template source or the route response.

### 9g. sync-cashback's identical swallow — fixed, demonstrated failing (2026-08-17)

Same shape as §9d, fourth confirmed instance of the family:
`syncAwinTransactions` collects per-transaction errors into
`result.errors[]` (six collection sites), and the cron route returned
`{ ok: true }` HTTP 200 regardless. Fixed identically: any error ⇒ 500,
`ok: false`. Demonstrated failing before trusted: a FAKE AWIN token
(the real one untouched, per standing rule) forced in-process produced a
real 401 from api.awin.com, collected — not thrown — and the route
returned 500 with the error named in the body; prediction matched. (AWIN's
401 body echoes the presented token — harmless here because it was the
fake demo string, and one more confirmation of the never-print-raw-
auth-bodies rule from §4.)

### 9h. Dead-man's switch — BUILT (2026-08-17), inert until the operator provisions the monitor

`lib/monitoring/pingHealthcheck.ts` + one call at the end of each of the
four cron routes, on a fully CLEAN run only (check-price-alerts and
sync-cashback: `ok === true`; snapshot-prices: `errors` empty;
refresh-prices: every partner's `errors` empty — its HTTP behavior is
deliberately unchanged, so for those two routes the missed ping is the
ONLY loud signal of a partial failure). Missed ping ⇒ healthchecks.io
alerts the operator through a channel that is neither Vercel nor Resend —
no circularity with either thing being monitored. Covers both observed
failure shapes: the dead cron (no run ⇒ no ping) and the loud-but-
unobserved failure (non-2xx ⇒ no ping).

Verified: with `HEALTHCHECKS_PING_KEY` unset, zero fetches, no behavior
change (the §9g demonstration ran the full route this way); with a key
set, exactly one fetch per clean run, failures swallowed after a 5s
timeout, never throws — a broken monitor ping fails INTO the alert, not
past it. **The control is INERT until the operator creates the
healthchecks.io project, sets `HEALTHCHECKS_PING_KEY` in Vercel, and
assigns each check a daily schedule + grace window; until then the
no-observer state of §9d persists.** Slugs: `refresh-prices`,
`snapshot-prices`, `check-price-alerts`, `sync-cashback` (auto-created on
first ping via `?create=1`).

### 9i. Process note: the commit trailer changed because the model changed

`748491c` and later carry `Co-Authored-By: Claude Fable 5`; earlier
commits carry `Claude Opus 5`. Neither is a typo: the trailer records the
model actually driving the session, and this session's model is Fable 5
where prior sessions ran Opus 5. Standardizing on the old trailer would
misattribute authorship, so the convention going forward is: the trailer
names the model that authored the commit. (Operator concurred 2026-08-17:
"Uniformity is not worth a false attribution.")

### 9j. LIVE DEFECT, fixed 2026-08-17: every alert email had a broken hero image — and the regression shape matters

The template emitted `product.image` verbatim into `<img src>`. All 954
catalog rows hold SITE-RELATIVE paths
(`/images/<partner>/<slug>.webp`-style, measured from Supabase by the
operator), and email clients have no base URL — so every price alert this
system could send had a broken image, in every client, always.

**The regression shape, recorded deliberately: the template never
changed — the MEANING of `product.image` did.** The 2026-07-23 test
message used the scripts' fabricated demo payload with an ABSOLUTE
Unsplash URL, which rendered fine. When real catalog data replaced demo
data, the same template became wrong. The only email anyone ever
inspected was the one where it happened to work — a test payload that
doesn't match production data doesn't test production. Both test scripts
now use a real catalog product for exactly this reason.

Fix: `lib/siteOrigin.ts` derives the origin — never a hand-maintained
constant — from `NEXT_PUBLIC_SITE_URL` (the codebase's existing
absolute-link convention, used by lib/supabase/actions.ts) falling back
to Vercel's `VERCEL_PROJECT_PRODUCTION_URL` system var. When neither
exists the image is OMITTED entirely: an email with no image beats an
email with a broken one, and the template never emits a relative URL
again. Verified on rendered bytes: absolute `https://gopricefinder.com/...`
URL (confirmed serving HTTP 200), and the omission branch confirmed with
both vars absent — which is also `.env.local`'s actual state, so local
renders omit the image until the operator adds the var locally.

**The .webp decision — accept the gap, documented:** 713 of 954 images
are .webp, which classic desktop Outlook (Word rendering engine) does not
render even when absolute. Reasons to accept rather than convert: the
entire current recipient base is three users on gmail.com/yahoo.com, both
of which render WebP; classic-desktop-Outlook share of CONSUMER email is
small and shrinking (new Outlook, Outlook web, and mobile all render
WebP); the degradation is a blank slot with alt text, not a broken
layout; and the alternatives are real costs against a hypothetical
audience — Next's image optimizer negotiates format by Accept header
(unverified behavior for webp-source-to-legacy-client, not something to
build on), an external conversion proxy adds a dependency and a privacy
hop, and pre-generating 954 JPEG variants is storage and build work. If
the audience ever includes desktop-Outlook users in numbers, the fix
belongs at image serving (host JPEG variants), not in the template.
Revisit trigger: audience evidence, not speculation.

### 9k. The savings claim was not supported by the data — presentation fixed, 2026-08-17

The email rendered a struck-through "old price" and a "You save $X
(Y% off)" badge, both derived from `wishlists.price_saved` — the price
when the user bookmarked the product. `catalog_products.original_price`
is NULL for that product and non-null for exactly ONE row in the whole
catalog, so there is no market "was" price anywhere in the data.
"Cheaper than when you saved it" and "87% off" are different claims and
the email made the second — same family as the PriceHistoryChart
incident: a true underlying number presented as a claim it does not
support.

Fixed in presentation only, data untouched: the current price stands
alone (no strikethrough), followed by "When you saved it: $X — it's $Y
less now", and the drop line only renders when the price actually IS
lower than the saved price (a wishlist row saved BELOW the current price
still alerts if the target allows it, and must not claim a drop it
can't show). No percent-off badge on any basis: the honest percent
("N% lower than when you saved it") is computable but invites exactly
the "% off" misread this fixes, and there is no other basis to compute
one from. Verified on rendered bytes, both branches.

### 9l. Auth redirects pointed at localhost in production — and the three-claims pattern that found it

**Measured state as found (operator, Supabase dashboard):** Site URL
`http://localhost:3000`, Redirect URLs allow-list EMPTY. **Measured in
code:** `lib/supabase/actions.ts` fell back to `http://localhost:3000`
whenever `NEXT_PUBLIC_SITE_URL` was unset — and it was unset in Vercel
(and locally). Both layers pointed every auth redirect at localhost;
nothing was rescuing anything.

**The pattern that found it is the finding (operator's own record,
verbatim intent):** three successive claims on this one question —
"nobody can register", then "registration works", then "Supabase's
fallback masks it" — each falsified by the next measurement, each
correction itself another unmeasured inference reasoned forward from a
mechanism. None of the three framings is carried into this doc as fact;
only measurements are.

**Measured (2026-08-17, throwaway user `shawn+authtest-20260817@`,
created and deleted the same session, 3 original users untouched):**

- Confirmation email (real bytes, received mailbox): link is
  `<project>.supabase.co/auth/v1/verify?token=…&type=signup&redirect_to=
  https://gopricefinder.com/auth/callback` — the new allow-list accepts
  the explicit target.
- Click mechanics (untampered link via `admin.generateLink`, no email
  transport): `email_confirmed_at` NULL before click → click returns 303
  → confirmed_at SET server-side → redirect to target with the session
  in the URL FRAGMENT. So under the old config, confirmation genuinely
  succeeded while the user landed on a dead localhost page —
  `email_confirmed_at` proves a token was processed, NOT that anyone had
  a working signup. The operator's inferred mechanism is now measured,
  and it held. The verify endpoint 303s to the redirect target even on
  an invalid token (error in the fragment), so the target page is the
  only thing a user ever sees.
- Recovery email (real bytes, no explicit redirect): link is
  `…/auth/v1/verify?token=…&type=recovery&redirect_to=https://gopricefinder.com`
  — the Site URL default, i.e. the operator's config change is live;
  under the old config this would have been localhost. The recovery
  session travels in the fragment TO the redirect target (same measured
  mechanics as confirmation), which is the operator's predicted
  hard-break mechanism — confirmed as mechanism, but overtaken by a
  bigger fact:
- **The app has NO password-reset flow at all.** Zero calls to
  `resetPasswordForEmail`, no forgot-password UI, no page that consumes
  a recovery session (the root page ignores fragment tokens — the app
  is cookie-based via @supabase/ssr). Reset isn't broken-by-localhost;
  it is absent. A user who forgets their password has no recovery path.
  Recorded as a product gap, not fixed (not authorized, and it's a
  feature, not a repair).
- Trace of `NEXT_PUBLIC_SITE_URL` consumers: exactly two —
  `lib/supabase/actions.ts` (signup emailRedirectTo) and
  `lib/siteOrigin.ts` (email images, §9j). Auth flows in code: password
  sign-in (no redirect email), signup confirmation (fixed origin), sign
  out. No magic link, no OAuth. Nothing else redirects.
- auth.users: all 3 rows have `email_confirmed_at` set (operator-
  measured — consistent with click-confirms-then-strands, though what
  each human actually saw is not knowable from here);
  mok7950@gmail.com created 2026-08-05, `last_sign_in_at` NULL —
  confirmed, never signed in.

**Fixed (2026-08-17):** operator set Supabase Site URL to
`https://gopricefinder.com`, allow-list to `https://gopricefinder.com/**`
+ `http://localhost:3000/**`, and Vercel `NEXT_PUBLIC_SITE_URL`
(build-time — not in the running deployment until the next build). Code:
the localhost fallback in actions.ts is REMOVED — `siteUrl()` now derives
from lib/siteOrigin.ts and THROWS when no origin is derivable. Loud by
design: being rescued by another system's default is not being correct,
and here nothing was even rescuing it. `.env.local` and
`.env.local.example` now carry the var for local dev. Limitation noted:
the Gmail-MCP transport mangles Supabase's one-time tokens (both emails,
different corruption each) — link HOSTS and redirect_to are measurable
through it; tokens are not, hence the generateLink path for click
mechanics.

### 9m. The near-miss class: defects whose only detector is "someone complains"

Separate from the errors above, the shape itself: a production defect
that produced NO symptom in any system we watch — every check was green,
`email_confirmed_at` filled in, crons 200'd — because the failure
surfaced only in a stranded human's browser tab, and the one user who
may have hit it (mok7950: confirmed, never signed in, never came back)
is indistinguishable from a user who simply lost interest. The project
currently has NO detector for this class: the dead-man's switch (§9h)
catches jobs that stop running, the non-200 fixes (§9d/§9g) catch jobs
that fail loudly, but nothing catches a flow that completes successfully
while delivering the user somewhere useless. The general form: **the
system's own success signals measure the system's bookkeeping, not the
user's outcome.** No fix shipped for the class (candidates — funnel
metrics on signup→first-sign-in conversion, synthetic end-to-end probes
that walk the real flow as a user would — are product/infra decisions,
operator's call); the lesson recorded is that "no complaints" is not
evidence of "no defect" when the defect's only witness is a stranger
with no reason to report it.

### 9n. Instrument note: when the measuring instrument corrupts the measurement, replace the instrument

Recorded at the operator's request as its own lesson (2026-08-17). The
Gmail-MCP transport mangles Supabase's one-time tokens (§9l) — the first
click-test failed on all three plausible reconstructions of the mangled
token. The wrong next move was to report "click mechanics unmeasurable"
through the broken instrument; the right one, taken, was to notice the
instrument itself was the problem and swap it: `admin.generateLink`
returns the identical /auth/v1/verify link server-side with no transport
in between, and the click mechanics measured cleanly on the first try.
The general form: **a failed measurement is a fact about the instrument
until proven to be a fact about the system** — distinguish them before
reporting either. Most of the day's other errors were the inverse
(trusting readings that were about the instrument — a test payload, a
green 200, a filled-in timestamp — as if they were about the system).

### 9o. Password reset — BUILT and verified end to end through the real production flow (2026-08-17)

Why it existed as a hard blocker: Supabase will not let a confirmed email
re-register, so a forgotten password was a PERMANENT lockout with no
recovery path and no way to tell us (§9l). Built: `/auth/forgot-password`
(entry point linked from the login form) → `resetPasswordForEmail` with
`redirectTo=/auth/callback?next=/auth/reset-password` →
`/auth/reset-password` sets the new password via `updatePasswordAction`
(requires the recovery session; expired/reused links get a clear error
pointing back to the entry point). Design matches the existing auth
cards. Page count 1043 → 1045.

Verified, the §9f standard (deployed path, arrived bytes, real click):

- Deployed form, first attempt (22:2xZ): **"email rate limit exceeded"**
  — surfaced loudly in the UI, and itself a standing finding: Supabase's
  BUILT-IN SMTP allows ~2 auth emails/hour project-wide, signups and
  resets sharing the budget. At any real volume that cap is its own
  outage. Standard fix: Supabase custom SMTP pointed at the
  already-verified send.gopricefinder.com Resend domain
  (operator-owned config; not touched, recommended).
- Second attempt after the window (22:57Z): arrived bytes read from the
  received mailbox — `…/auth/v1/verify?token=pkce_…&type=recovery&
  redirect_to=https%3A%2F%2Fgopricefinder.com%2Fauth%2Fcallback%3Fnext%3D
  %2Fauth%2Freset-password` — exactly the predicted target, PKCE
  (initiated by the deployed ssr client). The Gmail-MCP token mangling
  (§9n) did NOT recur on this message; the transport corrupts
  intermittently, not always.
- **The real click, in the same browser that submitted the form (holding
  the PKCE verifier cookie): verify → /auth/callback exchanged the code —
  the first time `exchangeCodeForSession` has EVER run in production
  (§9l: all prior confirmations stranded on localhost before reaching
  it) — → landed on the reset form with a live session → new password
  set through the deployed form → redirected to /wishlist signed in.**
- Assertions: the form-set password signs in; the original password is
  rejected; throwaway deleted; auth.users and public.users both back to
  exactly the 3 original rows.
- Earlier same-evening mechanics leg (untampered instrument, §9n):
  recovery token → session → password change → new works / old rejected —
  measured independently of the browser flow.

### 9p. Synthetic auth probe — BUILT, first production run green (2026-08-17)

The §9m detector, chosen by the operator over funnel metrics ("a funnel
only moves after enough real people have already been harmed to shift a
number"). Daily cron (15:00 UTC, `/api/cron/auth-probe`,
`lib/monitoring/authProbe.ts`): creates a throwaway user, clicks a real
confirmation link, and asserts what the USER experiences — the redirect
targets this site and, followed to the end, resolves to a real page
(HTTP 200 on this host); a row changing is exactly the green signal that
hid the §9l defect, so the row change alone is never the pass. Then:
recovery token changes the password, new password signs in, old password
rejected, /auth/reset-password serves. Cleanup verified BY COUNT on both
auth.users and public.users against the pre-run baseline; leftover probe
users from a prior failed run are treated as failures in their own
right. Any failed assertion ⇒ HTTP 500 + no dead-man's ping (slug
`auth-probe`) — a broken auth flow surfaces through the same channel as
a dead cron, once the healthchecks key exists.

First production run (22:2xZ, deployed route, CRON_SECRET): 200, nine
steps green, zero errors, cleanup verified at baseline 4/4. Operator
independently verified both user tables with the join in both
directions — zero auth-without-public, zero orphaned-public; the
handle_new_user cascade holds on delete.

Scope note, deliberate: the probe asserts flow mechanics and user-facing
pages, not SMTP delivery (email transport can't be asserted from a
Vercel cron, and §9o's rate-limit finding is a reason to not spend the
shared email budget daily).

### 9q. Build-time third-party dependency — removed; "transient" named the frequency and skipped the consequence

The c668ee8 deploy failed: `/opengraph-image` prerender fetched
fonts.googleapis.com at build time and got ETIMEDOUT. The first filing
called it "transient, pre-existing, retriggered clean" — operationally
right, diagnostically wrong (operator's correction, recorded): what it
actually described is that EVERY production deploy sat behind a
successful network fetch to a third party, on a project that has already
shipped two urgent corrections (the chart suppression, the mojibake
repair) where a dice roll between decision and production is not
acceptable. **A retry that succeeds is evidence the dependency is flaky,
not evidence the dependency is fine.** The right response to a transient
external dependency in a build is not a better retry; it is not having
the dependency.

Fix (2026-08-17): fonts vendored into `app/fonts/`, both fetch sites
removed.

- `app/opengraph-image.tsx` read fonts via two fetches per family at
  every build. Now reads vendored TTFs. Instrument detail worth keeping:
  the old code's comment claimed Google served woff2 — it didn't; the
  fetch sent no browser User-Agent, so Google served TTF (satori rejects
  woff2 here with "Unsupported OpenType signature wOF2", which is how
  the wrong comment surfaced). The vendored files are the same TTF
  instances that fetch actually received.
- `app/layout.tsx` used next/font/google (build-time download,
  cache-mitigated, cold cache = network — the exact risk verify.yml's
  comment documented for CI). Now next/font/local against vendored
  latin-subset variable woff2s with the same axes (Schibsted wght
  400..900; Fraunces opsz/SOFT/WONK); runtime serving was already
  self-hosted either way, so the served HTML changes only in hashed font
  URLs and fallback-metric source (Fraunces' fallback pinned to a serif
  to match).
- Verified: rendered OG image from the vendored build is BYTE-IDENTICAL
  to the production baseline (sha256 `da32b308…` both sides); build
  1045/1045 with zero font fetches.

Full build-time external-fetch inventory (grep of app/ + lib/ for
fetch/next-font, all prerender paths): the two sites above, plus
Supabase catalog reads during static generation — a first-party DATA
dependency that is the point of the architecture, not removable without
giving up SSG; recorded as accepted, distinct in kind. Nothing else.
Related note: the derive-don't-hardcode rule paid off here — CLAUDE.md
never pinned the 1043 page count, so the two new auth pages (1045)
required no magic-constant bump (operator observation, kept).

### 9r. The refresh pipeline was WORKING all along — three compounding blindnesses made it unreadable (2026-08-18, 00:xx UTC)

**The verdict first, from the instrumented run (deployed route, one
sanctioned manual invocation):** all five verified partners matched —
canvas-vows 204/204 (by id), king-koil 26/27 (id), tsar-bomba 26/189
(id; the linkrot), evdance 52/71 (name), golden-maple 323/359 (name) —
631 rows upserted, **zero partners at matched==0**, and the discriminator
caught a live event on its first run: evdance `changedVsCurrent=1`, a
real price change written by that very run. Per the pre-stated
distinction: matched > 0 with unchanged ≈ matched ⇒ **working pipeline,
mostly-static feeds** — the "broken, and the 200 is a lie" branch is
refuted. Independent corroboration: the 27-vs-28 reconciliation (§ below)
shows a divergence that appeared BETWEEN the 01:33Z cutover measurement
and the 12:00Z snapshot — bracketing the 11:00Z cron, the only writer.

**Why 15 days of this looked like a dead pipeline — three compounding
blindnesses, each recorded:**

1. **The header comment lied.** It claimed "upsert any price that's
   changed"; the code has never filtered to changes — every matched row
   is upserted every run. (Comment corrected in code.)
2. **`current_prices.updated_at` never bumps on update.** 0006 gives it
   `default now()` and NO on-update trigger; the upsert payload never
   included it, and ON CONFLICT DO UPDATE only writes payload columns.
   So max(updated_at)=Aug-3 meant "last NEW ROW Aug 3", not "last write
   Aug 3" — fifteen days of successful daily updates and fifteen days of
   nothing leave IDENTICAL timestamps. This also retro-invalidates
   every "0 rows updated today" observation made via updated_at,
   including this doc's own earlier ones and the operator's independent
   two-write-days measurement: those measured inserts, not writes.
3. **The discriminating counters lived only in response bodies nothing
   stored.**

**OPERATOR ERROR, recorded as such (operator's own instruction,
2026-08-18) — alongside the code defect, not folded into it:** the
fifteen-days-dead claim was the operator's; they ran the query
themselves, and escalated the result above Batch 4 and partner expansion
on the strength of a column whose name did not describe its contents.
The comment lied, and separately the operator trusted a field name over
its behaviour — the same family of error, committed by the person
policing the family. Corollary, also theirs: **a wrong instrument
silently poisons every reading taken with it, including ones already
published as fact** — the "zero rows written today" measurement earlier
the same evening was retro-invalidated by the same defect.

**Fixes shipped (`8811f0c`), scoped to instrumentation + control:**
- Counters per partner per run: feedRows/matched/compared/
  unchangedVsCatalog/newRows/changedVsCurrent/unchangedVsCurrent/
  upserted/errors — `changedVsCurrent` measured against the table's
  BEFORE state. Persisted as structured log lines in Vercel runtime logs
  (retention-limited — a durable `refresh_runs` table is the right home
  and is DDL, so it goes through the second-reader rule: Cowork writes,
  this session reviews) and returned in the body.
- **Observation stamping:** every upserted row now sets updated_at
  explicitly — a same-price sighting in today's feed IS a fresh
  observation. This is what makes any freshness signal meaningful, and
  it flows into snapshot observed_at with correct semantics.
- **Liveness control:** verified partner + feed downloaded + matched 0
  ⇒ failure. **Freshness control:** max(current_prices.updated_at)
  older than 2 days ⇒ failure regardless of what any run returned.
  Threshold derived, not picked: after stamping, staleness measures
  "runs that touched the table," whose cadence WE own (daily cron) —
  2 days = one missed run + jitter; raising it converts missed runs
  into silence and the derivation is pinned in the route comment.
  Control failures ⇒ HTTP 500 + no dead-man's ping. **Demonstrated
  failing on real data first: RED at 14.9 days against today's pre-run
  state; GREEN after the instrumented run because 631 rows were
  demonstrably stamped — both readings correct.**

**Item-3 answer — the 285 products with no current_prices row ever, three
distinct classes, not one:** brooklyn-delhi 29/29 (partner skipped by
design — AWIN has no feed; `verified: false` with reason); tsar-bomba
246/272 (feed ids dead — the known linkrot; their feed rows exist but
carry ids absent from the catalog); evdance 8 + golden-maple 2
(name-matching tail — feed names that normalize to nothing in the
catalog). None of these is the same failure as a working-but-unread
pipeline, and none is fixed by anything in this section.

**Item-5 answer — 27 vs 28 reconciled:** the registration's own
comparison (current_prices vs catalog_products), re-run today, yields 28
— and so does the snapshot-based comparison; the two catalog sources
agree. Since the cutover measurement recorded exactly 27 at 01:33Z and
the first divergent-28 evidence is the 12:00Z snapshot, the 28th
divergence (golden-maple wet palette, 45.99 vs 44.99) appeared in the
window containing the 11:00Z refresh run — the only writer. The
registered 27 was CORRECT at registration time; the count moved because
the pipeline moved a price. Working-pipeline evidence, not a
registration defect.

**New residue found by the instrument, flagged not fixed: 38 zombie
overrides.** 669 rows exist; today's run touched 631. The other 38
(golden-maple 23, evdance 12, king-koil 3) were written in the Aug-2/3
era by matching that no longer matches (feed name churn; king-koil's
feed shrank) — they override the catalog with Aug-3 prices indefinitely,
their updated_at will never advance, and the freshness control (MAX)
does not see them. Any remedy (delete stale overrides, read-side TTL,
per-row staleness sweep) is a separate decision, not taken.
(Superseded same night: remedy decided and shipped — §9s.)

### 9s. Freshness control v2 (count-based, per-partner), read-side TTL for stale overrides, and the observed_at answer (2026-08-18)

**Control v2 — the day-one blind spot, named by the operator and
closed:** max(updated_at) is the age of the NEWEST row; it reddens only
when EVERY row is stale — total death, the least likely failure. One
partner silently dropping out of matching (exactly the zombie shape §9r
found) leaves MAX fresh and the check green. Replaced with a count:
**zero override rows older than the threshold, reported per partner** —
"golden-maple stopped matching" and "everything died" now produce
different signals. Demonstrated failing on today's data, prediction
exact: **RED — 38 stale rows, golden-maple=23, evdance=12, king-koil=3.**
Consequence stated plainly: this check stays RED daily (500, no ping)
until the 38 are resolved — that red is honest (38 uncorroborated
prices exist) but it will mask NEW stale rows inside an already-red
signal and will fire the dead-man alert every day once the healthchecks
key lands. Resolution paths (operator's call): authorized deletion
after the observation is recorded, or a catalog re-import that lets
matching reach those products again.

**Read-side TTL — operator decision, shipped:** an override whose
updated_at is older than the freshness threshold is NOT applied; the
product falls back to catalog price. Not deletion — the observation
stays in the table, and if matching resumes the next stamp self-heals
the row back into use. An uncorroborated 15-day-old price presented as
live is the same offence PriceHistoryChart was suppressed for. Impact
stated BEFORE shipping and verified after: the TTL'd reader applies
exactly **631** of 669 overrides; **8 products change value** (all
evdance chargers, stale overrides differing from catalog — 3 correcting
down, 5 up), **30** change provenance only (stale value equals catalog:
live_override → catalog_fallback in the next snapshot, honest); the
sentinel 21ft (stamped 00:12Z) stays applied at 219.95. Wrong-signature
named in advance: any of the 631 fresh rows dropping out would mean the
filter is broken — verified not the case. Premise correction recorded:
product PAGES don't consume overrides (Option A is gated), so the
change surfaces in snapshots and alert evaluation, not page HTML.
Both readers (fetchCurrentPriceOverrides and the zero-caller
withLivePrice) carry the same filter — the two must agree on what
counts as live.

**observed_at — yes, frozen too, by inheritance; asked before assumed:**
price_history.observed_at is not independently stamped; snapshotPrices
copies override.updated_at at write time. Every eligible row written to
date therefore inherited the insert-only defect: all 669 say
2026-08-02/03 while the pipeline was in fact re-observing daily — the
recorded observation age UNDERSTATES actual recency (backwards from the
usual failure: the data is FRESHER than its label). Second instance of
the same defect in the same table, via inheritance. What the chart can
honestly show: nothing about observation age from rows recorded through
2026-08-17; from the first post-stamping snapshot (2026-08-18 12:00)
onward, observed_at is accurate. This does not un-fail the chart-restore
conditions (§ previous ruling stands); it adds one: age claims must not
be drawn from pre-2026-08-18 rows.

**refresh_runs table:** deferred to the DDL second-reader flow at the
operator's instruction — Cowork writes the migration, this session
reviews against its stated gates before application. Not written here.

### 9t. Zombie diagnosis: 38/38 are feed-side removals; alert ruling; migration 0017 review (2026-08-18)

**The diagnosis (operator-authorized, read-only; remedy deliberately not
presumed):** for every one of the 38, is the product present in today's
feed by the same key matching uses? Answer, unanimous across all three
partners: **NO — all 38 are feed-side removals; matching did not
regress.** golden-maple (feed F2615, 359 rows): all 23 names absent —
cork-sheet and replaceable-brush product lines dropped from the feed.
evdance (F1320, 71 rows): all 12 names absent — the "flux" charger line
(including all 8 price-flip products from §9s) no longer in the feed.
king-koil (101819, 27 rows): all 3 p= ids absent — dropped or
renumbered. Zero "present-but-unmatched" (regression-shaped) cases;
zero shadowed by catalog name collisions (checked — byName is last-wins
and could have hidden this shape). Per the operator's own framing the
remedy now chooses itself — the rows are dead and deletion is
defensible — but that decision is the operator's and nothing was
changed; the TTL keeps the harm neutralized meanwhile. Worth noting:
the diagnosis method (compare against the same feed the matcher reads,
with the same key extraction) is committed in the transcript record;
the check distinguished three failure shapes in advance rather than
accepting the first zero.

**Alert ruling (operator, 2026-08-18), recorded as a conscious
time-boxed exception, not a mute:** five slugs arm when the healthchecks
key lands (snapshot-prices, check-price-alerts, sync-cashback,
auth-probe, refresh-prices' four siblings) — **refresh-prices is HELD.**
Arming condition, named: the 38 resolved. Deadline, named:
**2026-08-25.** If still unresolved then, continuing the hold must be a
conscious decision taken that day — a mute that outlives its deadline
without a decision is the antipattern this doc keeps finding. (Kept in
front of us, operator's remark: today produced label-vs-reality defects
in BOTH directions from one root — overstating freshness in
current_prices reads, understating it in observed_at — and only one of
those is the kind anyone thinks to look for.)

**Migration 0017 (refresh_runs) review — Cowork wrote, this session
reviewed against the stated gates per the 419b3e4 rule; apply is
Cowork's step:**

1. PASS — `refresh_runs` does not exist (probe returns PGRST205,
   schema-cache miss).
2. SQL enables RLS and declares zero policies ✓. The "RLS + no policies
   = invisible to anon" mechanism could NOT be demonstrated pre-apply:
   every candidate table with no anon policy has zero rows, and 0=0 is
   the vacuous zero this doc refuses to count. Post-apply test
   specified instead, on the real table: seed one service-role row,
   then anon select must return zero rows WITHOUT error while service
   sees one. To be run by this session immediately after apply.
3. AGREE, no argument — telemetry must survive its subject; a record
   that vanishes when the partner does is not a record.
4. AGREE — the table observes, it does not constrain.
5. SQL passes (all integers nullable). **Writer-contract caveat,
   flagged:** the in-memory PartnerRefreshResult initializes every
   counter to 0, so the FUTURE writer must map "errored/skipped before
   stage X" to NULL, not pass initialized zeros through — otherwise
   zero-and-unknown collapse re-enters via the writer with the schema
   powerless to stop it. Skipped partners' feed_rows must be NULL, not
   0; a failed feed download likewise.
6. GAPS, reported before apply: (a) `match_strategy text` (singular)
   cannot carry the instrument's matchedById/matchedByName counts — a
   partner can match via both, and the id-vs-name share is the match
   reliability signal; recommend two integer columns or accept the loss
   explicitly. (b) Missing columns for emitted counters: new_rows (part
   of the discriminator triple), compared (distinguishes matched-but-
   price-unparseable), unchanged_vs_catalog / price_changes_vs_catalog,
   duplicate_key_collisions — recommend at minimum new_rows and
   compared, or record which counters are deliberately not persisted.
   (c) `error_message text` vs the instrument's errors[] — writer joins
   or truncates; acceptable, noted. All present columns' types match
   the instrument's emissions ✓.

### 9u. Technical SEO audit (2026-08-18, read-only, findings only — operator chooses order after Search Console lands)

Context: 227 visitors/30d, 5 Google referrals, domain 4 weeks old.
Operator's own probe caveats honored — everything below measured from
parsed XML and raw served HTML, not summarized renderings.

- **Sitemap (was the top suspect): NO DEFECT.** 1031 parsed `<url>`
  entries (the ~565 was a summarizing model's miscount); **954/954
  product hrefs present**, zero missing; the 14-route gap to the 1045
  build is the intentionally excluded auth/account/search set.
  app/sitemap.ts reads getAllRealProducts — same source as the pages.
  LOW: no `<lastmod>` on any entry (the one hint Google actually uses;
  changefreq/priority are ignored).
- **MEDIUM — no `<link rel="canonical">` anywhere** (checked home,
  product, category). Inbound AWIN clickthroughs and future UTM-tagged
  URLs can index as duplicates with nothing declaring the clean URL.
  Self-referencing canonicals via Next metadata is the cheap fix.
- **MEDIUM — www → apex redirect is 307 (temporary).** Weaker
  canonical-consolidation signal than permanent; Vercel domain-config
  toggle, operator-side. (http→https and trailing-slash are 308 ✓.)
- **MEDIUM — category pages render entire departments server-side:**
  arts-crafts = 348 product cards, **3.1 MB HTML**. Upside measured: no
  orphan pages — every product is ≤3 hops from home (nav → category →
  product; partner pagination is a second path). The structural cost is
  page weight, not reachability. grocery-food "23 with no pagination"
  is complete, not truncated (23 is the whole department).
- **INFO — robots.txt:** `/products/` is vestigial (no such route;
  serves only 404s) — disallow harmless; `/search` disallow is the
  documented deliberate choice (no unique indexable content, matches
  sitemap exclusion).
- **GOOD — head/schema on all three page types:** title, meta
  description, lang, viewport, og:* complete; Product JSON-LD rich
  (offers + shippingDetails + hasMerchantReturnPolicy — the two old
  Search Console warnings remain fixed); **schema price matches
  displayed price** (structurally guaranteed today: pages and schema
  both read the static catalog; re-check the day Option A wires
  overrides into pages); breadcrumb JSON-LD present on category pages.
- **CWV:** lab run blocked tonight (anonymous PSI quota exhausted);
  structural indicators on the product page are healthy — hero image
  preloaded with srcset, fonts preloaded (the §9q vendored woff2s,
  self-hosted), 95 KB HTML, 103 KB shared JS; prior homepage LCP/TBT
  fixes (2026-08-01 doc) remain in place. The weak CWV spot is the 3.1
  MB category HTML above. Field p75s live in the Speed Insights
  dashboard (no query API — operator-side read).
- **Traffic interpretation, stated once:** with the sitemap complete
  and on-page basics present, 5 Google referrals at week 4 is a normal
  cold start, not a technical block — the levers are canonicals (small),
  category page weight (medium), lastmod (small), and everything
  Search Console shows in ~48h.

### 9v. Tsar-bomba coverage: the zero was feed SELECTION, not matching — selection now data-driven (2026-08-19)

**Diagnosis (Gate D discipline held):** "113495 matches zero catalog
rows" decomposed under both-sides key verification (catalog 272/272
p= ids populated; 113495 234/234 aw_product_ids) with a positive control
(same join vs 105368 → the known 26): the true id intersection is
**21, not 0** — matching the prior "disjoint 21-product swap" record.
Mechanism A: refreshPrices NEVER READ 113495 — the English/no-Vertical
heuristic always picked the frozen default (105368) because the live
feed carries Vertical=Fashion. Mechanism B: the other 225 cannot
id-match — disjoint id spaces (113495 ∩ 105368 = 0 shared ids), and
since the 246 were IMPORTED from 113495 on 08-02 yet only 21 ids
survive, **113495 regenerated 213 of 234 ids in 16 days** — id-matching
against it rots fast; at re-import time, investigate merchant_product_id
as the durable key. 113495 is ALIVE (Last Imported 2026-08-12).

**Operator error, recorded at their instruction alongside §9l's
three-claims and §9r's fifteen-days-dead — third instance this week of
reasoning outcome-to-mechanism:** "the active feed matches nothing" was
inferred from a coverage zero without checking whether the mechanism
ever ran. The pattern, not the instances, is the finding.

**Blast radius, measured before shipping:** heuristic pick vs
feed_status-driven pick differs for tsar-bomba ONLY (105368 →
105368+113495); canvas-vows 103552, king-koil 101819, evdance F1320,
golden-maple F2615 all identical; brooklyn-delhi's difference is
representational (heuristic-finds-nothing vs explicit `none:` sentinel —
same skip, now data).

**Shipped (operator decisions 1+2):** feed selection reads
feed_status.is_catalog_source — curated data, not a string coincidence;
a wrong selection is now a visible data error (missing rows → loud
partner error; feed_status read failure → whole run fails; sentinel
rows → explicit skip). Partners can carry MULTIPLE catalog-source
feeds; results and log lines are now per (partner, feed). pinnedFeedId
is gone (feed_status replaced it). Both tsar feeds read: the frozen 26
stay (honest 2026-05-15 vintage), the live 21 add on top. Verified
in-process against the real route, predictions exact: tsar 105368
{189 rows, 26 matched} + 113495 {234 rows, 21 matched, 21 NEW},
all other partners byte-identical behaviour, current_prices 669 → 690,
tsar coverage 26 → 47, freshness red 38 unchanged. Expect tomorrow's
snapshot at ~652 live_override / ~302 catalog_fallback.

**PERMANENT RULE (operator, 2026-08-19): model-token matching is
REJECTED — not risky, wrong by construction.** 204 catalog products
collapse to 31 distinct TB-model tokens, so a model-level join
guarantees many-to-one collisions — fabricated price movements, the
PriceHistoryChart offence. Not to be revisited because 130 is a bigger
number than 56.

**Design only, NOT shipped — exact-name matching for up to 56 more:**
The zero-shared-names question is SETTLED: same inventory (12 shared
model tokens), radically different name formatting — 105368 uses terse
names carrying variant colors ("Elemental Series-Automatic Watch
TB8209A Silver Blue"); 113495 uses long marketing copy WITHOUT variant
colors (variant lives in its `colour` column). Consequences for the
design: (a) the 56 exact matches are catalog names that came FROM
113495 at import and haven't churned — name churn is real, so this
bridge decays like the id bridge; (b) any name match must verify
variant identity via the colour column, not the name; (c) protocol per
the standing gate — verified sample against tsar-bomba's live site
BEFORE bulk, prediction stated (ceiling: 21 id + ≤56 name = 77 of 246),
and ONE confirmed wrong-variant match kills the METHOD, not the sample.
This is a bridge, not a destination — the structural fix is re-import
from 113495, blocked on Step 14.

**Tag for 2026-08-25 (operator instruction, carried):** tsar-bomba's
`unchangedVsCurrent` on feed 105368 measures re-confirmation of a feed
frozen 2026-05-15, NOT merchant pricing behaviour — per-feed counters
now make that attribution visible (the earlier partner-level "0/26
one-day change" figure is withdrawn on the same grounds). Only feed
113495's counters speak to Tsar Bomba's live repricing.

### 9w. Diff-instrument validation (pre-08-25), exact-name NO-GO, and the durable-key rule (2026-08-19)

**The 08-25 diff instrument is VALID for all three priority feeds —
measured, not assumed** (prompted by §9v's finding that 113495
regenerated 213/234 ids in 16 days, which would have made a churning-key
diff uninterpretable): re-pulled today vs the 08-18 baselines —
Alorair F2715: 186/186 ids in both, 0 lost, 0 new; aaawave F2639:
1678/1678, 0 lost, 5 new; Vevor 72571: 20453/20453, 0 lost, 15 new.
Zero baseline ids lost anywhere. The tsar-bomba id churn is a property
of that feed (classic-template aw_product_id regeneration), not of the
shelf.

**Diff keys declared for Monday:** Alorair and aaawave are
Google-template feeds — key = `id` (the merchant's own item id; proven
stable). Vevor is classic-template — the baseline is keyed on
aw_product_id (proven stable across this check); as insurance against
mid-week churn, today's full aw_product_id → merchant_product_id map
(20,468 rows) is committed alongside the baselines
(`28831-72571-keymap-2026-08-19.ndjson.gz`), so the diff can bridge to
the durable key even if aw ids regenerate before Monday.

**Instrument artifact, confessed before it becomes a finding:** the
name-overlap side-measurement showed absurd churn (Vevor 118/17,345
names "matching" after one day) — that is the BASELINE's 80-char name
truncation colliding with full-length names in the comparison, i.e. a
fact about the instrument (§9n), not about merchants. Names play no
part in any diff key; the baselines stand.

**Exact-name bridge: NO-GO (operator decision 2026-08-19), recorded so
it is not relitigated:** ≤56 products on one merchant; names churn on
the same schedule as ids so it rots identically; per-row merchant-site
verification is manual, unscalable, and repeats as names drift; and the
real fix (re-import keyed on merchant_product_id) is blocked on the
Step 14 cutover. The 21 id-recovered products are kept; the effort goes
to the cutover, which unblocks the catalog pipeline rather than 56
products.

**DURABLE-KEY RULE (standing, operator 2026-08-19): merchant_product_id
(or the Google-template `id`, which is merchant-owned) is the key for
ALL future feed work — diffing, re-import, new-partner onboarding.
aw_product_id is an export-time artifact, not an identity.**

### 9x. Zombie ruling executed; availability sweep inverts the hypothesis; feed-drop monitoring proposal (2026-08-19)

**Deletion (operator-authorized):** the 38 stale current_prices rows
deleted (golden-maple 23, evdance 12, king-koil 3 — count verified
before and after). current_prices at **652**; tsar-bomba holds 47;
**freshness control GREEN (0 stale)**. price_history retains every
observation. The refresh-prices healthcheck slug's arming condition
("the 38 resolved") is now MET — operator can arm it.

**Availability sweep (read-only, merchant sites only — the AWIN
tracking links were never clicked; gm/ev merchant URLs extracted from
the catalog's own cread ued= params, king-koil resolved via the
merchant's products.json): 36 of 38 are STILL LIVE.** golden-maple 22
live / 1 gone (face-skin-tones acrylic paint set, 404); evdance 11
live / 1 gone (U40 wall-mounted charger, 404); king-koil 3/3 live
(variants of the merchant's single air-mattress listing —
kingkoilairbeds.com sells exactly one product). **Feed-drop here is a
CURATION signal, not an availability signal** — these merchants trimmed
their feeds while continuing to sell. The
shopper-clicks-through-to-a-dead-product failure is real for exactly 2
pages, not 38. Those 2 are flagged for an operator page decision
(retire/noindex/keep); no catalogue change made.

**Feed-drop as a monitored signal — proposal, not built:** the detector
largely already exists: any product whose override stops being stamped
trips the count-based per-partner freshness control within 2 days (that
is precisely how the 38 surfaced). What's missing is attribution and a
runbook. Proposed: (a) a `droppedFromFeed` list in each refresh run's
per-feed log line — the partner's current_prices rows unmatched by any
of its feeds this run (cheap: the pre-upsert read already fetches them);
(b) a standing runbook for freshness red: run the availability check
(the script pattern now exists) → merchant-live ⇒ curation drop, delete
the stale override, keep the page; merchant-404 ⇒ discontinuation,
retire/noindex the page (operator decision); (c) optionally fold
per-product drop events into refresh_runs once applied. Until (a)
ships, the freshness red IS the alarm and the runbook is manual.

**Migration 0017 v2:** the amendment list arrived but the assembled SQL
text did not — review pending the actual bytes (the second-reader rule
reviews the writer's text, not the reviewer's reconstruction).
Pre-stated requirements for the two named checks: constraint
`unique (run_id, partner_id, feed_id)` with `feed_id text NOT NULL`
(a nullable feed_id lets Postgres treat NULLs as distinct and silently
permit duplicate partner rows); nullable-integer set = feed_rows,
matched, matched_by_id, matched_by_name, compared, new_rows,
changed_vs_current, unchanged_vs_current, upserted,
duplicate_key_collisions, stale_overrides.

### 9y. Migration 0017 applied; gate-2 behaviour verified; the WRITER CONTRACT (binding, 2026-08-19)

0017 v2 applied by Cowork at this session's clean verdict (config
verified Cowork-side: table exists, RLS on, 0 policies, 11 nullable
integers, feed_id NOT NULL, 1 unique constraint on (run_id, partner_id,
feed_id)). **Gate-2 BEHAVIOUR verified on the live table** (config ≠
behaviour): one service-role row seeded → service reads 1 row no error;
**anon reads 0 rows NO error** (the expected silent invisibility, not
the worse errors-instead case); anon INSERT rejected loudly (42501 RLS
violation); seed deleted, table left at 0 rows.

**THE WRITER CONTRACT — two clauses, binding on whoever builds the
refresh_runs writer (not yet authorized):**

1. Counters initialise to 0 in memory. The writer MUST map
   skipped-or-errored-before-a-stage to NULL, never 0. Zero and unknown
   must not collapse — that collapse is the origin of the fifteen-day
   story (§9r) and must not re-enter through the writer.
2. feed_id is NOT NULL and skip entries have no feed. RULING: skip
   entries are WRITTEN, under the feed_status sentinel id
   (none:<partner> form) — never omitted. A skipped partner that leaves
   no row is indistinguishable from a partner nobody tried, which is
   clause 1's ambiguity in a different column.

Types: refresh_runs hand-added to database.types.ts in its own commit
(this section's companion), matching 0017 v2 exactly, with the contract
restated in the type's doc comment. feed_status's own hand-edit landed
2026-08-19 in `a4d6ffb` (it rode the feed-selection commit rather than
its own — noted; the drift habit ends with both tables now in types).

### 9z. refresh_runs writer BUILT and contract-demonstrated; the two dead pages fixed (2026-08-19)

**Writer** (`lib/pricing/recordRefreshRuns.ts`, wired into the
refresh-prices route): keyed off a new `stage` field on
PartnerRefreshResult (skipped / pre-download / downloaded / diffed /
done) — recorded fact, not inference, which is what makes the NULL
mapping honest. Both binding clauses demonstrated on the LIVE table
before trusting: (clause 2) a real run wrote brooklyn-delhi under
`none:brooklyn-delhi` with ALL counters NULL — sentinel + NULL, not
absence + zeros; (clause 1) a synthetic pre-download entry through the
real writer landed all-NULL (the in-memory zeros did not leak), and a
downloaded-stage entry kept known counters (100/40) while NULLing
unreached ones. The distinction also holds for stale_overrides: a
successful freshness read writes known zeros; a failed read writes NULL.
Demo rows deleted; the real run's 7 rows stand as the first durable
telemetry. That run was also refresh-prices' FIRST GREEN (200, 0 stale)
since the count-based control shipped — the ping condition now passes
daily if nothing regresses. Telemetry write failure surfaces as a route
failure (500, no ping) — silently lost telemetry is the original sin.
Known limitation, recorded: a run that THROWS (e.g. feed-list URL
missing, feed_status unreadable) writes no rows at all — the 500 is the
signal for that class; a run-level sentinel row could close it later.

**Dead pages** (operator decision, third delivery): the two
merchant-404 products (golden-maple face-skin-tones paint set, evdance
U40 charger) keep their pages and their index status; the outbound
affiliate link is replaced by "<Partner> no longer stocks this item";
the link explainer paragraph is suppressed; and the Product JSON-LD
drops the offer url and says availability=Discontinued — schema and
display in agreement (§3/§9k rule). Implemented as a two-entry hand
list (`lib/discontinued.ts`) with the explicit note that the
generalized discontinued-product flow is the pattern to build AFTER the
Step 14 cutover — the list must not grow past a handful.

**Next (operator pivot, binding): infrastructure intake stops. Step 14
Batch 4 is the critical path** — the read-only getProductTitleSuffix
question (rendering for the 225 no-price products vs the static path,
sampled across both the 47 and the 225) is the next turn's work.

### §10. Batch 4 gate: CLEAN — 272/272 title parity, and the blocker's premise dissolved (2026-08-19)

**The sweep (all 272 tsar-bomba products, not a sample):** name + 
getProductTitleSuffix output compared between the static path
(lib/partners) and the DB path (catalog_products via fetchCatalogRaw's
exact SELECT — lib/catalog itself can't run outside the Next runtime,
its unstable_cache throws, so the sweep replicates its query and the
textually-identical 10-line suffix algorithm): **272/272 identical, 0
divergent, 0 missing**, across both populations (47 with current_prices
rows, 225 without; population split verified in-sweep).

**The structural answer to the blocker:** NEITHER suffix implementation
reads current_prices — both render the CATALOG price (lib/catalog reads
catalog_products only; Option A remains gated) — so "no price row"
cannot affect a title under current code. The 47/225 distinction is
irrelevant to metadata parity. Additionally: all six PRODUCT templates
already import from @/lib/catalog (tsar-bomba included) — production
product titles already render from the DB and the build is green at
1045/1045. The remaining static-path consumers are the aggregate
surfaces: app/page.tsx (home), categories + category/[slug] +
category/[...path], deals, trending, sitemap.ts, OurPartners,
RealProductCard, and the pricing libs (getEffectivePrice /
refreshPrices / snapshotPrices read the static catalog by design until
Option A). Batch 4's gate is answered: no divergence exists to block
the cutover of those surfaces.

### §11. Step 14 plan reconciled against the repo; Batch 5 SHIPPED; the fifth instance (2026-08-19)

**OPERATOR ERROR, recorded at their instruction as the FIFTH instance
this week and the most expensive:** "Batch 4 is blocked" was inherited
from the 2026-08-16 handover and steered ~six messages of planning
across two days without being checked against the repo — despite the
handover's own opening instruction (written by the same operator) to
verify rather than trust it. The other four instances misdirected
measurements; this one misdirected the plan. The critical path
(catalogue-expansion surfaces) sat behind a batch that shipped on
2026-08-1x as `00e4aae`/`771c7db`.

**Plan-vs-repo reconciliation (verified by evidence, not checkboxes —
the plan's checkbox state is globally stale and should never be read
as status; the inline ✅ annotation boxes are the reliable layer):**

- Tasks 1–5: ALL DONE. catalog-types.ts exists; all 13 lib/catalog
  exports present (incl. every Batch-5 dependency); category-mapper
  memo shipped via a12f809 (the 2026-08-01 LCP work — the plan's Task 3
  by another route); unstable_cache live; check-build-queries.mjs +
  verify-catalog-migration.ts exist; CI carries the two anon Supabase
  secrets.
- Batches 1–4: ALL SHIPPED (419f132, 67c31a8, 6bb3f43, 00e4aae +
  771c7db) — closing grep gate re-verified clean.
- Batch 5: was genuinely not done — now SHIPPED (815bb25, below).
- Batch 6: NOT done — lib/data.ts unmigrated, and the three
  record-why comments (search.ts, refreshPrices.ts,
  getEffectivePrice.ts) are absent. SearchBar's type-only import is
  intact (the load-bearing `type` keyword present).
- Batch 7 (delete lib/partners): not started, and per Batch 6's own
  note CANNOT run until the three request-time consumers get narrow
  queries.
- Handover assertions: kawsar/260806 remote branch GONE (deleted this
  session, 2026-08-16; shawn/260806 remains as instructed). Cashback
  RLS: migration 0007 defines owner-scoped SELECT-only policies on
  cashback_claims + cashback_ledger_entries (no write policies) — as
  designed. CI migration-drift check: DOES NOT EXIST in verify.yml
  (tsc/lint/build only) — if the handover claimed one, that claim is
  stale. CLAUDE.md brand colours: the section exists and is
  conceptually current but nominally stale — it names cream/sage while
  the code's tokens are NAMED noir/gilt/ivory/espresso with cream/sage
  VALUES (per opengraph-image.tsx's own token-mirror comment).

**Batch 5 shipped (815bb25) with the hold's reason stated first:** the
plan's stated reason for holding Batch 5 was SEQUENCING — it aggregates
across all partners, so it runs after every partner batch. Batches 1–4
being verifiably shipped, the reason is gone, not forgotten. (The
operator's original "do NOT start Batch 5" sentence arrived truncated
in the 2026-08-16 handover; its tail is unknowable, but the plan-side
reason is the documented one and it is satisfied.) Verified per the
plan's own protocol: 1049/1049 pages, query guard PASS (11 collect /
0 render), First Load JS unchanged at 103 kB, full static-vs-catalog
equivalence suite green. **Prediction recorded before deploy: /deals
does NOT change — getFeaturedDeals is static=1 = catalog=1; one product
is the honest-markdown policy, not the static path.** All aggregate
surfaces (home, categories tree, deals, trending, sitemap, OurPartners)
now read the DB catalog — the real gate on catalogue expansion is open;
what remains of Step 14 is Batch 6 (lib/data.ts + three record-why
comments) and the Batch 7 deletion blocked behind narrow queries.

Also: affiliate-disclosure's in-prose gopricefinder@gmail.com corrected
to gpf@gopricefinder.com (operator-authorized; last surviving
instance). Footer editorial call (dead-link removal) endorsed and kept.

### §12. THE META-FINDING (operator, 2026-08-19, recorded in its sharpest form) — and the Batch 6/7 hold

**In a stale document, STATUS CLAIMS ROT AND JUDGMENTS DON'T.**
Everything the 2026-08-16 handover asserted about STATE was wrong or
unverifiable (Batch 4 blocked; the CI drift check existing; tasks 1–5
open). Everything it asserted about METHOD held perfectly (verify
against the artifact; prove a check can fail; an AI reporting done is
not evidence). That is how the plan and the handover are to be READ
from here, and how the next handover must be WRITTEN: the two layers
separated explicitly, because one has a shelf life and the other
doesn't.

**Batch 6 and 7: HELD, deliberately — not blocked.** The cutover's
purpose (cheap catalogue expansion) is achieved with Batch 5. 6 and 7
are the deletion endgame, and deletion is the one irreversible step.
Per the plan's own judgment-layer instruction — the layer that survived
reconciliation — Batch 7 does not run until every earlier batch has
been live long enough to TRUST, not merely to pass its checks. Batch 5
was an hour old at the time of this ruling.

### §13. The third axis: OWN-BRAND vs RESELLER — sixth instance, standing rule, GTIN ruling (2026-08-19)

**OPERATOR ERROR, recorded at their instruction as the SIXTH instance:**
every merchant on the issued Tier-1 shortlist (BedJet, KEETSA, Big Fig,
Mellow Sleep, GARVEE, Erommy, Kingbull, Troxus, Addmotor, Cyrusher) is
own-brand DTC — a list structurally incapable of producing a price
comparison, ranked on approval bar and volatility without ever asking
who RESELLS. The aaawave join test isolated the variable cleanly:
15/15 aaawave (branded resold inventory) vs 0/15 evdance and Autel —
evdance's 97% GTIN coverage joining to NOTHING is the perfect control.
Comparison requires a product with more than one seller; own-brand
guarantees exactly one, forever.

**STANDING RULE (operator, 2026-08-19): merchant selection has THREE
axes, not two — volatility, accessibility, and OWN-BRAND vs RESELLER.
The third is structural; no amount of traffic moves it.** And it is
MEASURABLE, not judged: distinct `brand` values in a 100-row feed
sample (own-brand ≈ 1, reseller ≈ many) — measured classifications in
the sourcing doc.

**GTIN ruling (operator): CAPTURE, DO NOT JOIN.** Import path now
extracts a validated 8–14-digit GTIN/EAN/UPC into generated data
(scripts/import-partner.mjs; optional `gtin` on RealProduct). No join
logic, no comparison surface — today GTIN would join aaawave to nothing
we hold, and machinery for an unavailable join is premature. The
asymmetry is the reason: capturing is cheap; re-importing to backfill
an identifier is expensive. Insurance, not architecture.
catalog_products' matching column is a pending Cowork DDL item (the
0017 second-reader flow applies).

**Vevor, both true, neither cancels the other (operator instruction):**
20,453 products, the biggest volatile shelf feed, excellent for price
HISTORY — and its AWIN feed carries NO identifier column, so via AWIN
it can never participate in COMPARISON. (Sourcing doc records the CJ
twist: Vevor's CJ feed carries GTIN at 100% — the limitation is the
AWIN export, not the merchant.)

### §13b. The axis refines under measurement: per-product multi-seller share (2026-08-19, late)

Two join tests with predictions registered first; BOTH predictions
wrong, faithfully recorded. Vevor-on-CJ: predicted LOW (own-brand rule)
— measured **85% of sampled GTINs carried by another merchant**
(UnbeatableSale 34/40, Wayfair 12). The evdance result did NOT
reproduce; own-brand-at-manufacture is not single-seller when the
manufacturer DISTRIBUTES. Full Compass: predicted >25% — measured 40%
(zZounds leading), so the aaawave result generalises beyond PC parts.
**The §13 third axis is hereby refined: the operative property is
PER-PRODUCT MULTI-SELLER SHARE, measured by GTIN join test — not the
merchant's nameplate.** Measured league table: Vevor 85%, aaawave 57%,
Full Compass 40%, Tennis Express 7%, evdance 0%, Autel 0%. §13's
"Vevor can never participate in comparison" is corrected in place: the
AWIN feed lacks identity, the products do not lack counterparties.
Comparison-pair map and re-ranked shortlist: partner-sourcing doc.

**§13b correction (2026-08-19, Vevor plan measurement):** multi-seller
tallies must EXCLUDE the merchant's own regional programmes — "Vevor
AU/CA/UK/MX" is the same nameplate, not a counterparty. Vevor's league
entry corrects to **72%** (≥$100 tier, Vevor-named carriers excluded);
the raw 85% included regional-programme rows. Second finding: **no
per-product AWIN↔CJ bridge exists for Vevor** (SKU 0/300, title 2%) —
its comparison capability is real and unreachable through the AWIN
membership; full analysis and the aaawave-first recommendation in
claude/vevor-import-plan-2026-08-19.md.

**SEVENTH INSTANCE (operator, self-recorded 2026-08-19):** the
"own-brand means single-seller" rule was built from two data points
(evdance, Autel) and applied categorically without testing a third —
Vevor's 72% refuted it. The replacement rule is superior because it is
measured, not judged, and the league table is now the PRIMARY merchant
selection instrument, kept current as merchants are tested.

**TECHNIQUE (operator credit, recorded):** registering a prediction AND
naming the exact mechanism that would refute it, then observing that
mechanism — predicting your own framework's failure condition is the
strongest form of being wrong, and the reason the Vevor result was
trusted immediately instead of argued with.

**TECHNIQUE, recorded at operator request (the Monoprice catch):**
distinct-brand sampling — count distinct `brand` values in a ~100-row
feed sample; own-brand ≈ 1–2, reseller ≈ tens. Twenty rows turned a
judged axis into a measured one and caught a name that reads reseller
measuring as house-brand (Monoprice, 2 brands). Reusable anywhere a
feed exposes a brand column; pairs with the GTIN join test (this
section) which measures the finer per-product property.

### §14. 0018 reviewed CLEAN; the identity/observation rule; Vevor ruling; eighth instance (2026-08-19)

**Migration 0018 (catalog_products.gtin): verdict CLEAN** on the
delivered bytes (sha256 5e6dd227…, 1,529 bytes, hash-verified per the
relay rule; column confirmed absent pre-apply). All gates hold:
nullable/no-default, CHECK accepts NULL + 8/12/13/14 digits and rejects
empty/7/15/non-digit/hyphen/whitespace, index partial and NOT unique,
nothing else touched. Check-digit omission accepted — shared-invalid
GTINs are shared manufacturer data, real joins a validator would burn.
Post-apply behaviour test (incl. an actual REJECTED insert and
pg_indexes verification) runs on apply confirmation.

**RULE, recorded as one position with 0017's opposite stance:
CONSTRAIN IDENTITY, DO NOT CONSTRAIN OBSERVATION.** match_strategy
records what happened — constraining it stops the table describing
reality. gtin is a join claim — a malformed value colliding with
another malformed value puts two unrelated products in front of a
customer as the same item at two prices: not a bad record, a lie on
the page.

**EIGHTH INSTANCE (operator, self-recorded):** Vevor was re-ranked
first on its 85% multi-seller share without checking whether the held
membership could realise it (it cannot: no GTIN in the AWIN feed, SKU
bridge 0/300, title bridge 2%). The property was real; the path was
never checked. RULING: Vevor takes NEITHER path yet — Path A waits on
the CJ approval (which waits on traffic), Path B (volume without
comparison) declined: undifferentiated inventory spending crawl ration
is what earned the 203-page backlog. Revisit when the CJ approval
lands or the indexing ration loosens. League-table rule made standing:
a merchant's own regional nameplates are not a second seller.

**aaawave tranche 1 selected** (500 products, GTIN-bearing ×
highest-price, $161.99–$18,999 median $429); staging control accepted
as specified; Cowork DDL spec delivered (aaawave plan doc) — the import
is blocked on those rows by design.

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
  migration-shaped (9 live sibling feeds); 113495's id format verified
  compatible but its coverage is a disjoint 21-product swap for the current
  26 — a re-import, not just a re-pin, is what recovers coverage. Re-pinning
  not authorized. Canvas Vows is abandonment-shaped by advertiser ID (needs
  an AWIN conversation).
- Numeric-ID exposure: king-koil and all ten tsar-bomba feeds remain on the
  generation the freeze hit; evdance and golden-maple are on the untouched
  F-scheme. Standing preference: move to F-scheme equivalents where AWIN
  offers them.
- Tsar-bomba linkrot: 225/272 deep-link ids exist in no current feed, but
  the products are alive (confirmed discontinuations: zero, all tiers).
  Deep links attribution-suspect; pclick redirect validity referred to AWIN
  (ticket question 4) rather than self-click-tested.
- Merchant ground truth split: tsar-bomba 3/3 prices match live (blindness,
  not error); canvas-vows census: 101/194 exact, **93 pages match no
  current variant** (median |delta| $6, 51 understate / 42 overstate, 10
  strictly unobtainable). Remedy DECIDED (operator, 2026-08-16): no hotfix,
  no catalog edit, no suppression — site-wide as-of date on displayed
  prices, scoped as a product change, not built pending placement/wording;
  the 10 unobtainable pages deliberately NOT hand-fixed (a catalog price
  edit manufactures the Finding-C artifact); working feed via the AWIN
  ticket remains the real Canvas Vows fix.
- Canvas Vows catalog-coverage gap noted for later: merchant lists 258 live
  products; we carry 204.
- Canvas Vows mojibake: REPAIRED (authorized, 2026-08-16, `07b080a`) —
  both sides in one change, 203 DB rows + 882 static-file sequences,
  all-gates-before-first-write, post-verified 204/204 with zero residual,
  suite 38/38, prediction matched exactly. Before-state: 204 descriptions
  dumped with sha256 pre-write; prior file bytes in git at `255699a`.
  Frozen-file carve-out documented in the Step 14 plan.
- Canvas Vows freshness: no last-updated data exists anywhere in the feed
  pipeline for this partner — AWIN's ingest timestamp is the only signal,
  and it's the frozen one.
- MasterTag: production install declined for the general case (474 KB wire
  / 2.2 MB parsed vs a 103 kB budget; Convert-a-Link has nothing to convert
  here). Convert-a-Link-instead-of-pclick recorded as an option conditional
  on AWIN confirming historical ids are dead. Narrow Bounceless-only
  measurement designed with its refutation condition stated; gated on the
  operator, deliberately not while the attribution ticket is open.
- Re-import sequencing: unresolved conflict on record — re-import is both
  the coverage fix and a price-history contamination event (87877a2
  precedent: 5 fabricated king-koil movements, verified). Operator decides
  sequencing; not scheduled.
- AWIN Publisher API 401: RESOLVED — stale credential in `.env` while the
  verified one lived in `.env.local`; API/header/account all correct. Token
  rotation in progress (operator), must include the Vercel env var or
  sync-cashback 401s silently. Env-file consolidation proposed, not
  implemented.
- `price_history`: nothing deleted; nothing may be deleted. Cutover-date
  filtering is the sanctioned mechanism once the pipeline works.
- INCIDENT (2026-08-16): PriceHistoryChart rendered this table as market
  history on all 954 product pages for 13 days; suppressed in `cfc8c03`,
  verified gone in production. Full record and restore condition:
  `claude/incident-2026-08-16-price-history-chart.md`.
- Email (2026-08-17, §9): send.gopricefinder.com proven end to end
  (accepted → delivered → in inbox); `RESEND_FROM_EMAIL` was unset
  everywhere and production fell back to `onboarding@resend.dev` — a
  sender that reaches only the account owner (quieter and worse than the
  predicted loud bare-domain failure); env var now set locally + in Vercel,
  effective at next deploy. check-price-alerts no longer returns 200 when
  a send fails (fix demonstrated failing before trusted); the non-200 has
  NO automatic observer today — recorded knowingly, dead-man's-switch
  monitor proposed, not built. CI contains no RESEND reference; old key
  revocation is unblocked and remains the operator's call.
- Email/crons (2026-08-17, evening, §9f–9h): deployed send path exercised
  end to end (200, sent:1) and CLOSED — operator read the header from the
  Resend side: From alerts@send.gopricefinder.com; the Vercel var reached
  the build. sync-cashback's identical swallow fixed and demonstrated
  failing (fourth instance of the family). Dead-man's switch BUILT into
  all four cron routes (clean-run-only pings, healthchecks.io class,
  non-Vercel non-Resend alert channel) but INERT until
  HEALTHCHECKS_PING_KEY is provisioned — the no-observer gap stays open
  until then. Old-key revocation being actioned by the operator.
- Email content (2026-08-17, late, §9b-correction/§9j/§9k, from the
  operator's full send-log read): "never capable of sending" was FALSE —
  the onboarding fallback delivered to the account owner on 2026-07-23
  (opened), i.e. email reached exactly one person and nobody else, and
  looked healthy doing it. Every alert email had a broken hero image
  (954/954 relative paths; template unchanged, the MEANING of
  product.image changed when real data replaced demo data) — fixed via
  derived origin (lib/siteOrigin.ts), image omitted when no origin
  derivable, never relative. Savings presentation unsupported by data
  (strikethrough + %-off derived from price_saved) — replaced with the
  claim the data supports: current price vs "when you saved it". .webp
  Outlook-classic gap accepted with reasoning and a revisit trigger
  (§9j). Test scripts' fabricated demo payload replaced with real
  catalog data. Rendered-bytes verification pending one post-deploy send
  (the template-source trap is §9j's whole lesson).
- Auth (2026-08-17, night, §9l–§9m): Supabase Site URL was localhost with
  an EMPTY allow-list AND the app fell back to localhost — every auth
  redirect in production pointed at a dead page; confirmation succeeded
  server-side (measured: NULL → click → set, session in fragment to the
  target) while users landed nowhere. Operator fixed both configs; code
  fallback removed, siteUrl() now throws when no origin derivable.
  Password reset: NOT broken — ABSENT (no flow in the app at all);
  recovery mechanics measured healthy on the new config. The
  three-claims pattern and the near-miss class (§9m: success signals
  measure bookkeeping, not user outcomes; no detector exists for
  complete-but-useless flows) recorded. Throwaway test user created and
  deleted same session; 3 original users untouched.
- Auth features (2026-08-17, late night, §9o–§9q): password reset BUILT
  and verified through the real production flow end to end — arrived
  bytes, real click in the initiating browser, exchangeCodeForSession's
  first-ever production run, form-set password in / old rejected,
  cleanup 3/3 both tables. Synthetic auth probe BUILT (daily 15:00 UTC),
  first production run 9/9 green — asserts user-experienced outcomes,
  cleanup by count. Build-time third-party fetches REMOVED (fonts
  vendored; OG image byte-identical, sha256 da32b308…); build no longer
  gambles on fonts.googleapis.com. NEW standing finding: Supabase
  built-in SMTP caps auth email at ~2/hour project-wide — custom SMTP
  via the verified Resend domain recommended, operator-owned. Pages
  1043 → 1045.
- Refresh pipeline (2026-08-18, §9r): WORKING all along — instrumented
  run matched 631 rows across all 5 verified partners and caught one
  live price change (evdance); 15 days of apparent no-ops were three
  compounding blindnesses (lying comment, updated_at never bumping on
  update, counters stored nowhere). Observation stamping + liveness +
  freshness controls shipped and demonstrated (RED 14.9d pre-run,
  GREEN post-run, both correct). 27-vs-28 reconciled: the 28th
  divergence was WRITTEN by the 11:00Z cron — working-pipeline
  evidence, registration was correct. The 285 rowless products are
  three design/known classes (brooklyn-delhi skip 29, tsar linkrot 246,
  name-tail 10). NEW: 38 zombie overrides (Aug-3 prices, unreachable by
  current matching, invisible to MAX-based freshness) — flagged, not
  fixed. Chart restore: NO (operator ruling recorded — depth 1 day,
  stale observations, read filter is a decision not code).
- Freshness v2 + TTL (2026-08-18, §9s): count-based per-partner
  freshness control (RED today: 38 = gm23/ev12/kk3 — stays red until
  the zombies are resolved, by design); read-side TTL ships — stale
  overrides not applied, observation kept, self-healing; verified 631
  applied / 8 value flips (all evdance) / sentinel holds; pages
  unaffected (Option A gated). observed_at: frozen too, by inheritance
  from updated_at — all pre-2026-08-18 rows understate observation
  recency; accurate from the first post-stamping snapshot. Operator
  error recorded as such in §9r (field name trusted over behaviour;
  wrong instrument poisons published readings). refresh_runs deferred
  to Cowork DDL flow.
