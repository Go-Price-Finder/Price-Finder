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

### §14b. 0018 behaviour-verified; 0019/0020 reviewed CLEAN (2026-08-19)

**0018 post-apply behaviour test (all mutations reverted, 0 gtin rows
after):** valid 13-digit accepted; five ACTUAL rejected writes (empty
string, 7 digits, 15 digits, hyphens, whitespace — all 23514);
**non-uniqueness proven positively: the same gtin accepted under two
partner_ids, 2 rows sharing it** — the property the column exists for,
tested by doing it, not by the absence of UNIQUE.

**0019 (retailer enum 'aaawave'): CLEAN.** Hash 5f5f769c…/568 bytes
exact; single idempotent ALTER TYPE ADD VALUE, nothing else; value
proven ABSENT live (22P02 on an enum-cast probe). The deliberate
0019/0020 split (never rely on "probably works" in a migration)
endorsed.

**0020 (partners row): CLEAN, one deliberate omission flagged for the
operator to own:** hash 1a0566a1…/1445 exact; live gates verified —
partners = 6, max display_order = 6, no aaawave row, id 'aaawave'
matches the enum value exactly, href internal, logo_url NULL like all
six. Tagline checked against the AWIN programme description AS SERVED
BY THE API (not the file's quotation): the quoted text is word-for-word
real, "AAAwave" styling is the merchant's own. The tagline drops
"Crypto mining equipment" from the merchant's category list —
defensible condensation, flagged per corrected-over-plausible so the
omission is a choice, not an accident.

Apply order 0019 → confirm → 0020, as specified. The sequencing rule
stands: session code entries land WITH the import, never before.

### §15. Gate 0: the 0020 row exposed an unconditional homepage render — found empirically, fixed centrally (2026-08-19)

The operator predicted the defect before authorizing the import: a
partners DB row landing AHEAD of its catalog (0020 applied, zero
products imported yet) might render on the homepage as a card linking
to a route that doesn't exist. The four gate-0 answers, re-measured
from the repo and live schema, confirmed it:

1. **Which surfaces read `partners`:** three — the homepage OurPartners
   grid, the homepage hero partner count, and the sitemap partner
   entries. All flow through `getPartners()` in lib/catalog.ts.
2. **Filter or unconditional:** UNCONDITIONAL. `getPartners()` returned
   every row; nothing checked products or feed_status.
3. **What /aaawave rendered:** Next's 404 — no route existed.
4. **Revalidation window:** `revalidate: false` on the unstable_cache
   wrapper — production only changes at deploy. BUT: warm builds reuse
   .next/cache across builds, so a pre-0020 snapshot masked the defect
   on the first test build (zero aaawave mentions — a vacuous zero).
   Only a cold build (`rm -rf .next`) rendered the AAAwave card
   pointing at the 404. **Exposure was nondeterministic per deploy**:
   whichever catalog snapshot the build happened to reuse decided
   whether the broken card shipped.

**Fix (commit 442d662):** `getPartners()` now ends with
`.filter((partner) => partner.products.length > 0)`. Chosen over a
feed_status check because display should track browsable content, not
pipeline metadata — a partner with products but a mis-set flag should
still render, and vice versa. `getPartner(id)` stays deliberately
unfiltered (a direct route with zero products is that route's own
concern, and filtering there would have masked THIS import's staging).
Verified: post-fix cold build = zero aaawave mentions with the 0020
row present; equivalence suite passed.

**New standing findings out of the same session:**
- *A header is not data* (import-partner.mjs `resolveColumn`): the AWIN
  Google-template feed carries a `sale_price` column that exists but is
  empty in every row, and `sale_price` outranks `price` in the
  candidate list. Header-presence matching mapped price→sale_price and
  silently skipped ALL 500 tranche rows as "missing price" — the same
  class as §9's sale_price finding, now on the import side. Fixed:
  resolveColumn only accepts a candidate column with ≥1 non-empty
  value.
- *The compliance gate composes correctly with honest metadata*:
  aaawave flipped to `status: "active"` (factually correct — joined
  programme 43143, feed F2639 served to this account as a member) with
  `imageUsagePermission: "pending"` because the AWIN dashboard terms
  page (ui.awin.com/merchant-profile-terms/43143) is operator-side and
  unchecked. The importer proceeded but downloaded NO images;
  normalizeProduct's per-partner gate renders IMAGE_PENDING_PLACEHOLDER
  for all 500, so the product-specific image paths emitted in
  lib/aaawave-data.ts are unreachable until the operator confirms terms
  and flips to "confirmed" (then images need a re-download pass).

### §16. Crossing 1,000 catalog rows silently deleted 454 pages from the build — PostgREST max-rows (2026-08-19)

The tranche took catalog_products from 954 to 1,454 rows.
fetchCatalogRaw's unpaged select was capped at PostgREST's max-rows
(1,000 on this project) — no error, no warning, 1,000 rows returned of
1,454. The build generated EXACTLY 1,000 product pages: tsar-bomba 0
(was 272), king-koil 0 (was 29), golden-maple 195 (was 348), and
alphabetical partner_id order decided who survived (aaawave, first
alphabetically, kept all 500 — the import looked perfect while it
silently evicted older partners' pages).

**Instruments that caught it vs. instruments that didn't:**
- check-build-queries PASSED (13 collect / 0 render) — it counts
  round trips, not rows. A correct instrument answering a different
  question.
- The equivalence suite (verify-catalog-migration.ts) CAUGHT it:
  static=lib/partners.ts vs catalog=DB diverged, and the diffs summed
  EXACTLY to the truncation: Apparel −272 (all of tsar-bomba) +
  Arts & Crafts −153 + Home −29 = 454 = 1,454 − 1,000. The arithmetic
  identified the mechanism before any code was read.
- Per-partner built-page counts confirmed empirically: 0 tsar-bomba
  HTML files in .next/server/app.

**Fix:** fetchCatalogRaw now pages with .range() in PAGE_SIZE=1000
chunks until a short page. The (partner_id, sort_order) ordering that
already existed for display-order reasons is also what makes paging
coherent (unique per row, so consecutive ranges never skip or
duplicate). Residual window: pages are separate requests, so a cron
write between two page reads can mix vintages within one build's fetch
— far smaller than the per-page refetch the cache wrapper prevents,
noted in the code.

**Standing lesson:** this is the third silent-cap failure in two days
(2MB cache item cap, header-not-data column mapping, now max-rows).
None of them error; all of them degrade. Every external boundary with
a default cap needs either a paging loop or a loud tripwire BEFORE the
catalog grows again — the full aaawave feed (2,637 rows) and any Vevor
import would each have crossed additional caps unannounced.

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

### §17. Codebase-wide PostgREST max-rows audit (2026-08-19, ordered after §16)

Method per the operator's instrument-discipline rule: a read that
silently returns 1,000 is indistinguishable from a table that has
1,000 rows, so every "rows returned" below was compared against an
independently obtained `count: exact, head: true` (which is computed
server-side and immune to max-rows). Head-count reads and single-row
reads (.maybeSingle/.limit(1) on unique keys) are immune by
construction. And the shape of how §16 hid is now a standing hazard:
aaawave sorts FIRST alphabetically, so the newest, most-scrutinised
partner was the last thing that would ever have revealed truncation —
scrutiny concentrated exactly where the bug wasn't.

Every `.from()` site in lib/, app/, components/, scripts/ (no .rpc()
reads exist):

| # | Site | Read (filter) | Rows today | Verdict |
|---|------|---------------|-----------:|---------|
| 1 | lib/catalog.ts fetchCatalogRaw | catalog_products, full | 1,454 | OVER — already paged+retried (§16, commits 78186ae/f71c65d) |
| 2 | lib/catalog.ts same fn | partners, full | 7 | SAFE (grows ~1/import) |
| 3 | lib/pricing/getEffectivePrice.ts fetchCurrentPriceOverrides | current_prices ≥ freshness cutoff | 652 (verified complete: unpaged return = exact count) | CLOSE — 65% of cap. Crosses if overrides exceed 1,000; aaawave matching alone could add up to 500 (652+500=1,152). Failure mode when crossed: rows beyond the cap silently keep static prices — invisible. HIGHEST-PRIORITY remaining fix. |
| 4 | app/api/cron/refresh-prices/route.ts freshness read | current_prices < cutoff | 0 | SAFE today, but it is an INSTRUMENT for the everything-went-stale scenario, exactly when the stale set would exceed 1,000 — it would under-report (still nonzero, so the alarm fires, but per-partner counts would lie). Recommend per-partner exact counts instead of row fetch. |
| 5 | lib/pricing/refreshPrices.ts pre-upsert diff | current_prices .eq(retailer) | max 323 (golden-maple; per-partner: cv 204, kk 26, tb 47, gm 323, ev 52) | SAFE today. Crosses when ONE partner holds >1,000 override rows (full-aaawave at 2,637 products would). Failure mode: newRows/changedVsCurrent counters corrupt; the upsert itself is unaffected. Fix before any >1,000-product partner matches. |
| 6 | lib/pricing/refreshPrices.ts feed selection | feed_status .eq(is_catalog_source, true) | 8 (of 9) | SAFE |
| 7 | lib/alerts/checkPriceDrops.ts | wishlists .not(target_price, is, null) | 0 | SAFE today, growth-unbounded with users. When alert rows exceed 1,000, alerts beyond the cap silently never send. Fix before alerts are promoted to users. |
| 8 | lib/supabase/queries.ts getWishlistByUser | wishlists .eq(user_id) | 0 | SAFE (per-user bound; a single user with >1,000 saved items would see a truncated list — cosmetic) |
| 9 | components/PriceHistoryChart.tsx | price_history .eq(product,retailer) ≥ 90d | ≤90/product by PK (one row per product×retailer×date) | SAFE — table is 16,201 rows total but is never read unpaged |
| 10 | lib/pricing/snapshotPrices.ts | price_history upsert only, 500-row batches, minimal returning | n/a | SAFE (write path) |
| 11 | lib/cashback/syncAwinTransactions.ts | 4 reads, all .maybeSingle()/.limit(1) on unique keys | 0 in all four tables | SAFE by construction |
| 12 | lib/monitoring/authProbe.ts | public.users via exact head-count | 3 | IMMUNE by design. Note: auth.admin.listUsers({perPage: 1000}) is a SEPARATE cap class (GoTrue pagination, not PostgREST) — revisit when users approach 1,000. |
| 13 | scripts/sync-aaawave-catalog.ts read-backs | exact head-counts | 500 | IMMUNE by design (the §16-era read-back was already non-self-referential) |
| 14 | (products table, 954 rows) | only ever read embedded inside wishlists join | bounded by parent | SAFE |

Summary: ONE read was over the cap (already fixed, §16). ZERO reads
are truncating today — every unpaged read's return was verified equal
to its exact count. ONE is close (fetchCurrentPriceOverrides, 65%) and
crosses on a predictable event (aaawave override matching). Two more
have named crossing conditions (per-partner overrides >1,000; alert
wishlist rows >1,000). Fixes deliberately NOT shipped with this audit
— priority is the operator's call; the audit is the deliverable.

### §18. §17 turned into a test; the counting rule adopted (2026-08-19)

**Rule adopted (operator ruling): a read whose purpose is to count
should COUNT, not fetch.** `count: exact, head: true` is computed
server-side and immune to max-rows; a fetch-then-count is capped at
1,000 and lies hardest exactly when the number is largest — which for
an instrument is exactly when it matters. Reference implementation:
the cron freshness check (app/api/cron/refresh-prices/route.ts) now
uses a global exact count plus per-partner exact counts, and gained a
blind-spot fix in the process: stale rows under a retailer NOT in the
current partner list are now reported as "unmapped" instead of being
invisible to grouping built from whatever rows happened to come back.

**Fixes shipped in one change (operator ruling: bundle, not sequence):**
- fetchCurrentPriceOverrides (was 652/1,000, crosses on aaawave
  matching; build-time read under revalidate: false, so truncation
  would FREEZE into published pages until the next deploy) — paged.
- refreshPrices pre-upsert diff (per-partner, max 323 today; corrupts
  discriminator counters at >1,000 overrides per partner) — paged.
- checkPriceDrops (0 rows today; the only failure mode on the list
  that breaks a promise to a user — the 1,001st armed wishlist row
  would silently never alert) — paged.
- lib/supabase/fetchAllRows.ts: the shared paging helper; deterministic
  PK ordering required, short-page termination.

**§17 as a test: scripts/check-postgrest-caps.mjs +
scripts/postgrest-cap-registry.json.** The audit is re-derived from
the code and the live DB on every run, so it cannot rot the way a
dated prose table does:
1. Scans every `.from()` chain in lib/app/components/scripts and
   classifies it (write / count-only / bounded / UNBOUNDED).
2. Every UNBOUNDED site must have a registry entry stating the bound.
   **How it detects additions: the scan is exhaustive and the registry
   only silences named sites — a new unbounded read anywhere fails the
   check until paged or registered with a reason.** Stale registry
   entries (site removed) also fail: no drift in either direction,
   same bidirectional pattern as check-build-queries.
3. Registry watches run live exact counts vs thresholds at 80% of the
   cap (reddens BEFORE truncation) — partners, feed_status, wishlists,
   current_prices at 800; catalog_products at 4,000 (that one guards
   the §16 gzip-cache headroom, since the read itself pages safely).

**Proven it can fail before trusting it passing (operator requirement):**
- Planted a temporary unbounded read (lib/__captest_planted.ts) →
  exit 1, named file:line and both remedies. Deleted.
- CAP_CHECK_SELFTEST=1 forces every watch threshold to -1 → exit 1,
  all 5 watches FAIL. Documented in the script header.
- Clean rerun → exit 0. First honest run also failed on the 4 real
  unbounded sites before the registry existed (the derivation is real,
  not seeded from the audit's conclusions).

Known stated limits: a hand-rolled single-shot .range(0,999) scans as
"bounded" (the scanner can't see loops — use fetchAllRows so the
mistake is unavailable); the scanner is regex-grade, not a TS parser.

Current machine-checked crossing table (2026-08-19, the check's own
output): partners 7/800, feed_status 9/800, wishlists 0/800,
current_prices 652/800, catalog_products 1,454/4,000 — all ok;
4 unbounded sites registered with named bounds; 33 total .from()
sites = 14 writes + 7 count-only + 8 bounded + 4 registered.

### §18b. The check now runs automatically and BLOCKS; the range rule closes the stated hole (2026-08-19)

**Where it runs (the honest answer was "nowhere" until this):** wired
as package.json `"prebuild"` — npm runs it before every `npm run
build`, locally and on Vercel, and a nonzero exit kills the build
before Next starts. Proven by planting a violation and running `npm
run build`: exit 1, zero build output lines. Mode split per the
operator's instruction (static never gated behind the credentialed
half):
- `--static`: classification + registry drift only. No credentials, no
  network. Runs anywhere.
- `--build-gate` (the prebuild mode, via --env-file-if-exists): static
  half always blocks; live watches also run whenever credentials are
  present (one retry on transient errors, then a persistent count
  failure FAILS the build — unknown is not zero). Credentials absent →
  loud skip line, static-only pass.
- default: both halves, exit 2 if credentials are missing.
Local builds get the live half from .env.local; Vercel builds get it
from project env (verified from the deploy build log).

**Range rule (operator ruling):** .range() is only auto-trusted as
paged when it is fetchAllRows itself or a visible fetchAllRows call
site. Any other .range() must be registered with a reason that proves
the loop — removing the specific convenient mistake of reaching for
.range to "handle" paging and stopping after one call. First honest
run flagged a real pre-existing case: fetchCatalogRaw's hand-rolled
loop, registered as KEPT deliberately (it carries the 57014
transient-retry the helper lacks, and its loop is proven by 1,454
built pages from a 1,454-row table). Failure mode proven with a
planted single-shot .range(0, 999): exit 1 naming file:line.

### §19. A positive control only licenses an absence claim if it is drawn from the same population as the claim (2026-08-19)

**The instance.** Asked to verify aaawave's image terms, I hand-rolled a
PDF text extractor, searched it, and reported that "exclusive assets
(banners, data feeds, links)" and thirteen related terms occur ZERO
times in the programme terms. I ran what looks like the correct
discipline: an earlier extraction pass had returned zero for
*everything*, I noticed, rejected it as broken, rebuilt the extractor,
and re-ran WITH positive controls (Commission 13, Prohibited 1,
Comparison 4, "Authorized dealer" 1) before accepting any zero. The
controls passed. The zeros were still false. The phrase is in the
document, four lines below "Authorized dealer" in the same block.

**Why the ritual did not save me.** The document embeds multiple subset
fonts with per-glyph CMaps. My parser assumed ONE uniform glyph→char
shift for the whole file, which happened to fit one subset. Confirmed
empirically after the fact: **"Exclusive" is not present in the raw
content streams at ANY single global offset** (searched -0x40..+0x40),
and the file declares no plain /BaseFont or /ToUnicode entries — they
are inside compressed object streams. Text set in the other subset
decoded to nothing recoverable. Every control I chose — all four — sat
in the subset my shift fitted. The lines that failed are exactly the
ones carrying ligatures (ﬀ ﬁ ﬂ ﬃ) and a curly apostrophe, because
those glyphs are what forced the other font in the first place.

So the controls certified the extraction of a population that
*excluded the failure mode by construction*. They could not have
failed. A control that cannot fail is not a control — it is decoration
that produces false confidence, which is worse than no control at all,
because it converts "I didn't check" into "I checked and it's clean."

**THE RULE (adopted, operator ruling — this is the durable half):**
*A positive control only licenses an absence claim if it is drawn from
the same population as the claim.* For extracted text specifically:
any absence claim requires at least one control that exercises the
suspect class — a ligature, a smart quote, a non-ASCII glyph, a line
from a different visual style/font — not merely a term you know is in
the document. Generalised: before accepting a zero, ask which
population the control samples and whether the failure being ruled out
could even appear in it. This is a level deeper than §16/§17's
vacuous-zero rule: those say *verify keys are populated on both sides
and run a positive control*; §19 says *the control must be capable of
detecting the specific failure*, and picking probes that avoid it is
the easy, invisible mistake.

**Second, smaller lesson: use the real tool.** `pdftotext` was
installed on this machine the whole time. I never checked — an earlier
unrelated error ("pdftoppm is not installed") led me to assume the
whole poppler suite was absent, and I wrote a parser instead of running
`command -v pdftotext`. The operator's independent `pdftotext` output
settled the question in one command. Standing consequence: the
hand-rolled extractor is NOT to be trusted for any other document, and
scratch/pdfextract*.py should not be reused — extract with pdftotext.

**Verification of the correction (with the trustworthy tool):** file
sha256 8e9a864b…2f55 confirmed identical to the operator's copy;
`pdftotext -enc UTF-8` finds `Exclusive assets (banners, data feeds,
links) available through Awin's dashboard.` Six terms I called absent
are present (Exclusive, asset, banner, data feed, feed, dashboard);
the remaining nine are genuinely zero and match the operator's own
extraction exactly (image, photo, creative, logo, copyright, licen,
intellectual property, permission, reproduce).

**Consequence for the ruling:** the affirmative-grant leg holds, the
image ruling is sound, imageUsagePermission flipped to "confirmed" and
the 500-product image pass ran. Residual risk (authorized-dealer
photography likely manufacturer-owned, no sublicensable rights
established) recorded in the registry entry, reverts in one field edit.

### §19b. Flipping the compliance flag was NOT enough — the gate is baked in at write time (2026-08-19)

Recorded because the verification step the operator specified ("no page
still renders the pending placeholder") is the only thing that caught
it. After imageUsagePermission flipped to "confirmed" and 500/500
images downloaded successfully, a cold build STILL rendered the
placeholder on all 500 pages.

Cause: the placeholder swap happens in normalizeProduct
(lib/partners.ts) at the moment products are read from the static data
file — and scripts/sync-aaawave-catalog.ts wrote catalog_products from
those already-normalized products while the gate was CLOSED. So the
DB rows that Step-14 pages actually read had IMAGE_PENDING_PLACEHOLDER
stored in image/images. lib/catalog.ts's own header says this
explicitly ("the per-partner image-pending placeholder swap ... already
baked into every row at write time") — the design is intentional and
correct; the consequence is that a compliance flip is a TWO-part
change: flip the flag AND re-sync every affected row.

Standing rule for any future partner: flipping imageUsagePermission
requires re-running that partner's catalog sync, or the flip is
invisible in production. Verified after re-sync: 500 rows with real
paths / 0 placeholder in the DB; cold build 500 pages, 0 placeholders,
500 referencing a real webp; live production spot-checks return
HTTP 200 image/webp on sampled files, landing page 0 placeholders.

### §19c. The colliding GTIN is check-digit VALID — which retroactively justifies 0018 omitting check-digit validation (2026-08-19)

Operator computed it: `0606034877917` has a correct check digit
(computed 7, actual 7). It is a **structurally perfect GTIN on the
wrong product** — the same identifier appears in feed F2639 on both
"AMD Ryzen 7 7800X3D OEM + Cooler Master MasterLiquid 360" @ $395.99
(one of our 500) and "Pimoroni VL53L1X Time of Flight Sensor" @ $24.99.

**Consequence 1 — the omission was right, and for a sharper reason
than when it was made.** 0018 deliberately validated only shape
(`^[0-9]{8,14}$`), not the check digit. Had we implemented check-digit
validation, this row would have PASSED it, and a passing check digit
reads as evidence of a trustworthy key — the validation would have
actively increased confidence in the one row that most deserved
suspicion. Stated generally: **a constraint on identity catches
malformed identity, never misattributed identity.** Only the collision
guard catches this class. This is a case where adding a stricter
constraint would have made the system less safe by supplying false
assurance — the §19 pattern one layer down (a check that cannot detect
the failure is worse than no check, because it converts "unverified"
into "verified clean").

**Consequence 2 — this is the concrete instance of 0018's own stated
rationale.** The migration header argues, in its own words:

> "gtin is an IDENTITY CLAIM used to join. A malformed gtin that
> happens to collide with another malformed gtin produces a FALSE
> COMPARISON PAIR — two unrelated products shown to a customer as the
> same item at two prices. That is not a bad record, it is a lie on
> the page. Rule: constrain identity, do not constrain observation."

Measured reality refines it: the collision needed no malformed gtin at
all. A perfectly-formed one, wrong at the source, produces the identical
lie. The abstraction was written before the instance existed; the
instance is now on file next to it. The header's rule stands — what
changes is that shape validation is necessary and nowhere near
sufficient, and the guard, not the constraint, is what prevents the lie.

Feed-wide measurement behind this: 1,683 rows, 91.2% carry a valid
gtin, 1,520 distinct, **15 gtins appear on more than one row**, 2 of
which collide with our 500. All 500 of our products are reachable by
gtin in today's feed.

### §20. GTIN join shipped for aaawave — collision guard as the centrepiece (2026-08-19)

Approved and built. GTIN is FIRST-CHOICE, not sole-primary: name stays
armed behind it until the 08-25 diff measures GTIN churn, so the guard
is in place while the decision it informs stays open.

- `gtin` threaded RawPartnerProduct -> normalizeProduct -> RealProduct.
  RealProduct already declared `gtin?: string`; nothing populated it.
  catalog_products.gtin is deliberately NOT read by the refresh — two
  sources of truth in one pipeline is a drift surface we do not need.
- Per-partner `matchStrategy`, default `["id","name"]`, so canvas-vows,
  king-koil and tsar-bomba are bit-for-bit unaffected. aaawave opts into
  `["gtin","id","name"]`.
- **Collision guard:** a gtin is usable only when unambiguous on BOTH
  sides — exactly one catalog product and exactly one feed row. Feed-side
  counting spans the WHOLE feed, not just rows we carry, because a
  duplicate row we do not carry is precisely the one that would overwrite
  us. Banned gtins fall through to name; never resolved by picking the
  first or the closest price, both of which invent a decision the data
  does not support.
- The king-koil rule is preserved and deliberately NOT extended to gtin.
  An extracted id that is not ours means a SKU we do not carry -> stop.
  A gtin that is not ours means OUR side is sparse (only post-2026-08-19
  imports carry gtins) -> continue. Same syntax, different epistemics.

Behaviour-verified against the live feed writing nothing: 500/500 carry
a gtin; collisionsInCatalog=0, collisionsInFeed=2, keysUsable=498; the
guard FIRED on both known-bad gtins; matched=500 (byGtin=498, byName=2)
— the two banned ones recovered by name, the designed fallthrough. Match
total unchanged, so the registered 1,152 prediction stands; only the
attribution moves.

`refresh_runs.matched_by_gtin` is NOT written: the column does not exist
and the operator owns that migration, explicitly to avoid 0020's mistake
(schema ahead of its writer is indistinguishable from a broken writer).
Counters are live in the response body and logs today.

### §21. Materialisation audit: which compliance flags can actually be changed by changing them (2026-08-19)

Generalised from §19b at the operator's direction. A gate whose decision
is materialised into stored data at write time cannot be changed by
flipping the gate — and the failure mode is that NOTHING HAPPENS, which
is the hardest kind to notice, in the one layer where we would least
want to miss it.

**Write-time / materialised — flipping is a silent no-op until re-sync:**
- `imageUsagePermission` — normalizeProduct swaps the placeholder and the
  sync writes the RESULT into catalog_products.image/images. §19b, real.
- `status` and `comparisonEngineConfirmed` — checkImportGate filters
  ALL_WIRED_PARTNERS into PARTNERS at module load, and rows were written
  from that filtered export; lib/catalog.ts deliberately never re-checks.
  Setting a partner active creates nothing (benign). **Moving a partner
  AWAY from active removes nothing — production keeps serving a partner
  whose terms review was withdrawn.** That direction was previously
  unguarded and is the sharpest thing this audit found.
- `noPlagiarism` — import-time only; text already generated is never
  revisited.

**Read-time — takes effect at next deploy, no re-sync:**
- `excludedProducts`, via requiresPerSkuFeatureCheck() inside
  lib/catalog.ts's getFeaturedDeals/getBestSellers.

**Import-time warnings only:** ftcDisclosureRequired, priceSyncSensitive,
noMedicalClaims.

**Records only, no code branches on them:** commissionRate/Basis/Tiers,
commissionBase, cookieDays, paymentSchedule, excludedCategories,
termsSource, googleShoppingAllowed, couponSharingRestricted,
noBrandedPaidSearch, noUnauthorizedCoupons, noTrademarkBidding,
noCouponSiteBehavior, noMarketplaceResale, noScrapingWithoutConsent,
usAvailabilityOnly, paidSearchRequiresConsent, mustUseOfficialFeed,
noBrandComparisonWording and every *Note. Several are declared in the TS
type, which makes them LOOK enforced; none are.

**Remedy — both halves, because they reach different readers:**
1. `scripts/check-compliance-materialization.ts` compares the registry
   against stored rows on every build (wired into the blocking prebuild
   gate) and fails when they disagree, in BOTH directions — stale
   placeholders after an unlock, real photos still served after a
   withdrawal, and rows existing for a non-live partner.
2. A `$materialization` block at the top of partner-compliance.json
   states, per flag, where it is evaluated and what changing it requires,
   sitting where the next person editing a flag will actually look.

**It found a real pre-existing instance on its first run, and the first
diagnosis was wrong.** tsar-bomba had 10 rows holding the placeholder
while images were permitted. Not a stale sync — the placeholder is in the
STATIC data file (10 products whose photos failed to download at import
and were never retried), faithfully mirrored into the DB. The check now
compares against what the current registry plus static data would
produce rather than against a blanket zero, so it names the right
remedy: an import-time image gap, reported as a note. Left as a finding
for the operator to rule on, not silently fixed.

Proven able to fail before being trusted: flipping aaawave to "pending"
with the DB unchanged -> FAIL naming 500 rows serving unpermitted photos,
and `npm run build` exits 1 with zero Next output; selftest with inverted
expectations -> exit 1; restored -> PASS.

### §22. Image retry pass: the population, the per-image outcomes, and 19 dead sources (2026-08-19)

**Population first (operator condition 1):** the §21 checker's method,
run across every partner's static data file. tsar-bomba's 10 are NOT
the whole population — **canvas-vows has 9 products whose data file
points at real image paths for files that never existed on disk**
(never committed, confirmed absent from git history), a strictly WORSE
variant: those pages have served broken 404 images since import
(verified live: image URL 404, product page 200). All other partners
clean: brooklyn-delhi 0, evdance 0, golden-maple 0, king-koil 0,
aaawave 0, gallery images included. Two failure shapes, same class:
the tsar importer recorded failure AS the placeholder (visible),
the canvas importer recorded the intended path and lost the failure
entirely (invisible). Population: 19.

**Retry pass, per-image (operator condition 2 — no aggregates).**
Sources re-derived from the live AWIN feeds by the refresh's own
id-first/name-second discipline. Outcomes:
- canvas-vows, all 9: source URL FOUND in feed 103552 by exact deep-link
  id — every one FAILED HTTP 404 at cdn.shopify.com. Notably all eight
  1st-anniversary variants advertise the SAME image URL (couch_3_…),
  itself dead.
- tsar-bomba, 6 of 10: source URL found (5 by name in live feed 113495,
  1 by id in 113495, 1 by id in frozen 105368) — every one FAILED HTTP
  404 at cdn.shopify.com, including a URL versioned ~2026-04.
- tsar-bomba, 3 of 10: NOT PRESENT in either feed by id or name — the
  known tsar linkrot/delisted class.

**19/19 failure is suspiciously uniform, so per §19 a control from the
same population ran before accepting it:** 8 image URLs for products
whose images DID work at import, fetched through the identical code
path — 8/8 HTTP 200 (4 per feed). The 404s are genuine upstream
linkrot: the feeds advertise image URLs the merchant CDNs no longer
serve for exactly these products. The retry pass cannot succeed from
these sources; merchant-page scraping was considered and not attempted
(the only URLs we hold are AWIN tracking links, and self-clicks are
prohibited; guessing Shopify handles is speculation, not sourcing).

**Fix within reach, applied:** the canvas-vows 9 now point at the
pending placeholder in the data file (a placeholder beats a broken
image; reversible per product) with the mandatory §21 second half —
the 9 catalog_products rows re-synced, read-back verified 9/9.
tsar-bomba's 10 already rendered the placeholder; unchanged.
The materialisation checker now reports both partners as
import-image-gap notes, DB and static in agreement, PASS.

**Left for the operator:** whether these 19 (esp. the 3 absent from
feeds entirely) should remain listed at all — they cannot receive
price refreshes and their images are gone at the source. Delisting is
beyond this session's authorized scope.

### §23. Homepage honesty pass — every self-description audited against what the code does (2026-08-19)

Same defect class as the data layer's, in copy, where a visitor reads
it. Method: extract ALL rendered text from a cold build's index.html,
identify every claim of capability/cadence/status, verify each against
code. Verdicts:

| Claim (rendered) | Where | Verdict | Action |
|---|---|---|---|
| "Weekly" price checks / "checked every week" | Hero stat + tagline | FALSE — cron is daily (vercel.json 11:00Z) | -> "Daily" / "every day" |
| "every price is checked weekly" | FutureOfWebsite | FALSE — same | -> daily |
| "Prices are checked weekly," | WhyTrustPrices | FALSE — same | -> daily |
| "Price history and drop alerts are in development" | HowItWorks step 2 | FALSE — alerts LIVE (checkPriceDrops, 13:00Z cron, Resend); history RECORDING live (snapshot-prices, 16,201 rows); only charts pending | rewritten: alerts live, charts on the way |
| "We lay retailer prices side by side... flag the lowest one" | HowItWorks step 3 | FALSE — no cross-store comparison surface exists (§20 gtin work is what will enable it); no lowest-flag; no shipping/fees anywhere | rewritten to what is true today; step retitled |
| "Data collection in progress" x3 | WhyPriceFinder cards | FALSE — no per-user savings collection exists (no users); one card claimed "stores compared side by side on every search" | cards replaced with three claims the code keeps (real markdowns / alerts live / checked daily) |
| "Data collection in progress." | Footer tagline, EVERY page | FALSE — same | rewritten |
| Footer "Get price drop alerts" + email + Subscribe | Footer, EVERY page | WORST ON PAGE — the submit handler was a deliberate no-op (SearchBar disableSearchNav): took a visitor's email under the promise of alerts and dropped it | dead form removed; replaced with a link to the REAL alert flow (wishlist + target price) |
| "each listing shows when it was last verified" | WhyTrustPrices | TRUE (PriceAsOfLabel; all 7 partners mapped) | kept |
| "Discounts are real markdowns only... deals page says so" | WhyTrustPrices | TRUE (originalPrice only from feed's own markdown; /deals honest-empty verified at Batch 5) | kept |
| "Every affiliate link is disclosed" / "Rankings aren't for sale" | WhyTrustPrices | TRUE | kept |
| Hero products/partners counts | Hero | TRUE (computed from live catalog per build) | kept |
| "no sponsored rankings, no fabricated discounts" | Hero | TRUE | kept |

Stated caveat on "daily", recorded in the code comment: the daily
refresh covers the six feed-bearing partners; brooklyn-delhi's 29
products (2% of catalog) have no AWIN feed and are not re-checked —
the per-listing as-of label carries that per-listing truth, which is
why the "checked daily" + "each listing shows when verified" pairing
is the honest formulation.

Verified: rendered re-sweep post-fix — weekly / in development / in
progress / side by side / Subscribe / lowest all ZERO on the built
homepage, with a live positive control ('checked' x5). Per §19: the
sweep's zero is licensed because the same extraction found all of
these strings before the fix.

OUT OF SCOPE, REPORTED NOT FIXED (operator named the homepage):
/how-it-works carries the same class, worse — "we scan the whole
market at once", "lay out matching listings side by side", "Price
history tracking is coming soon... notified as soon as drop alerts go
live" (alerts are live), and a paragraph describing product pages
listing "the retailers we track for that item, sorted cheapest first,
with a 'Best Price' badge" — NO such multi-retailer product-page list
or badge exists anywhere. /wishlist also says "Comparing N items
across retailers, side by side." One commit away on request.

### §24. THE RULE: an error handler that writes the value it would have written on success is not error handling, it is failure erasure (2026-08-19, operator ruling)

Canvas-vows is the finding, not tsar-bomba. Tsar's import failures were
recorded AS the placeholder — visible, degrading honestly. Canvas's
importer generated the data file with the INTENDED image paths
regardless of download outcome, reporting failures only to scrollback —
its own message said it plainly: "data file still references these
paths — re-run this script later" (advice that was itself broken: the
duplicate-registry guard exits 1 on re-runs for wired partners). So 9
product pages served broken 404 images to real visitors for weeks with
nothing anywhere indicating a problem. The difference between a system
that degrades and one that lies — and the lying variant is the one to
hunt. Same family as §19's check-that-cannot-fail: both convert "this
broke" into "this is fine."

**Fixed:** import-partner.mjs now writes IMAGE_PENDING_PLACEHOLDER into
the generated data file for every failed download — visible degradation
that matches the compliance gate's own rendering and stays observable
after the process exits, because check-compliance-materialization.ts
surfaces it permanently as an import-image-gap note.

**Audit of the rest of the family** (importer, syncs, refresh, catalog):
- import-partner.mjs image paths — THE instance, fixed above.
- import-partner.mjs empty-description fallback ("<name> from
  <partner>.") — borderline: synthesizes success-shaped content on a
  data gap, but the sentence is true and visible. Reported, unchanged.
- import-partner.mjs --tagline default "" — silently empty registry
  entry (bit aaawave; caught by hand). Reported, unchanged.
- category-mapper department fallback — visible label, honest-ish.
  Reported, unchanged.
- getPriceAsOf unknown partner -> label silently absent — an ABSENT
  claim, not a false one; acceptable. Reported.
- Everything else already fails loudly: parsePrice null -> row skipped
  and counted; resolveColumn -> exit 1; sync scripts -> exit 1 per
  failure; refresh/catalog reads -> throw; cron catches -> HTTP 500;
  writer contract -> NULL-not-0. The §19b footer Subscribe no-op was the
  UI-side member of this family, already removed.

### §25. Site-wide claim inventory; the rendered-output sweep becomes permanent (2026-08-19, operator rulings)

**Why permanent (operator's words, recorded):** the footer Subscribe
form was not a wording problem — it collected visitors' email addresses
under a promise of price alerts and discarded them, on every page, and
NO source-level review would have caught a submit handler that no-ops,
because the source looked like a working form. Claims must be checked
where the visitor meets them: in the rendered output.

**The instrument:** scripts/check-rendered-claims.mjs, wired as
package.json "postbuild" so `npm run build` (local and Vercel) fails if
a banned phrase reappears in any site-owned route's rendered HTML.
String-level regression tripwire over every §23/§25-confirmed
falsehood, with a route-scoped allowlist requiring a written reason, a
site-name positive control (a broken extractor's clean result is
worthless, §19), and CLAIMS_CHECK_SELFTEST=1 proven to exit 1. Its
stated limit: a NEW false claim in fresh wording passes — the semantic
audit remains session work whenever self-description copy changes.
**Its first honest run failed the build on a route nobody had audited**
(/categories "Coming soon") — which on inspection is an HONEST stated
policy about empty taxonomy nodes, now the allowlist's first entry,
with the reason written next to it.

**/how-it-works and /wishlist fixed to the homepage standard:** "we
scan the whole market at once" (we search our own 1,454-product
catalog); "lay out matching listings side by side" (no same-product
cross-store surface exists); "Price history tracking is coming soon...
notified as soon as drop alerts go live" (alerts are LIVE; recording is
live; only charts pending); the multi-retailer product-page list
"sorted cheapest first, with a 'Best Price' badge" (exists nowhere —
rewritten as what's being built next); /wishlist "Comparing N items
across retailers, side by side" (it is a saved-items list with target
prices — now says so).

**Sweep of all 19 site-owned routes found one more false-claim family
nobody named: PriceHistorySparkline, on EVERY product card.**
"Tracking since launch — 1 price drop ($95 → $63)" presented the feed's
own markdown (originalPrice) as a price drop WE OBSERVED over time — we
never observed the higher price. And "no price changes yet" was false
for products where the daily refresh HAS recorded changes (evdance
flips). The card only knows price/originalPrice, so it now claims
exactly what those fields support: "Marked down by the store: $X → $Y"
and "Price history charts are on the way".

**Verdicts on the remaining routes:** deals ("genuine markdowns...
never a fabricated discount" — TRUE, verified at Batch 5); categories
(honest, allowlisted); trending/search/auth (no self-claims beyond the
shared footer, now honest); partner pages (merchant-authored content +
the fixed sparkline). Trust pages (about/contact/privacy/terms/
affiliate-disclosure) are operator-authored verbatim text — verified
claims hold (password hashing, transactional-email provider, no payment
processing, affiliate-only links), with ONE line flagged for the
operator rather than edited: /about's "When you look at a product...
the goal is that you can see not just the price but the context —
what it cost last month" is aspiration-framed ("the goal is") but
adjacent to a capability that isn't displayed yet; the operator owns
those words and the call.

**Ruling 2 executed — the 3 feed-absent tsar products, measured at the
merchant's own storefront (search-suggest + product JSON, never a
tracking link):**
- TB8228CF ($500): LIVE and purchasable, exact model title, merchant
  price $500.00 — equals ours exactly.
- TB8220L ($1,200): LIVE and purchasable — RENAMED "Nucleus Femme 03"
  at the merchant, Blue variant $1,200.00 equals ours exactly. The
  rename is why name matching could never find it: the name-decay
  failure mode §20 anticipates, proven on real data.
- TB8218 ($830.99): ambiguous — the fixed SKU is gone; the model
  survives only inside a build-your-own "Atomic-Custom Watch Kit"
  configurator (variant prices $259.96–$3,059.84). Our exact
  configuration/price is not confirmable.
All 19 broken-image products remain listed per the ruling (absence
from a feed is a fact about the feed — the 36-of-38 lesson); the
delist decision on TB8218 is the operator's, now with the measurement
in hand.

### §26. TB8218 delisted; TB8220L renamed — name decay caught in the act (2026-08-19, operator rulings)

**/about corrected at the operator's own instruction** — their words:
"my error... I wrote it, and it fails the standard I have been enforcing
on you all night." The sentence implying visible price history ("the
context around it — how it has moved") is replaced with text that says
exactly what is true: prices recorded daily, history being collected
now, charts not live yet, "we'd rather tell you that than imply we
already have it." Both phrasings banned in the rendered-claims tripwire.

**TB8218 delisted** (the one product of the 19 whose merchant page could
not confirm our price): the fixed SKU is gone and the model survives
only inside a configurator spanning $259.96–$3,059.84, so our page
asserted $830.99 for something nobody could buy at that price — a wrong
price, not stale data, the one category not tolerated. Removed from the
static file AND the catalog row deleted (both sides, §21 discipline);
tsar-bomba 272 → 271, catalog 1,454 → 1,453. Its 17 price_history rows
are KEPT — observations are records. current_prices/wishlists/clicks:
zero references, verified before deletion.

**TB8220L renamed to the merchant's current name, "Nucleus Femme 03"**
(static file + catalog row, read-back verified). Recorded as its own
finding per the ruling: **name decay caught in the act, in our own
catalogue, on a product whose price we still have exactly right.** The
merchant renamed the product; name-matching could never find it in any
feed again; the price never drifted. This is the precise failure the
GTIN work (§20) exists to prevent, demonstrated free of charge six days
before the 08-25 diff. The instance is now cited inside
lib/pricing/refreshPrices.ts's matchStrategy rationale, so the argument
carries a real case, not an abstraction.

### §27. THE RULE: a component that renders an inference must be checked against what its props can actually support (2026-08-19, operator ruling)

PriceHistorySparkline is recorded as the most serious finding of the
night, above the Subscribe form: a site whose single claim is that it
does not fabricate observations was fabricating observations on its
most-rendered component — presenting the feed's own markdown as a drop
we watched happen, when we never saw the higher price. The tell, per
the operator: its sibling caption was false in the OTHER direction
("no price changes yet" where changes were recorded), meaning nobody
had ever checked either branch against reality — both drifted
independently. The component only ever held price and originalPrice —
two numbers from one instant — and it rendered a claim about time.

**Audit of every component rendering a derived or narrative claim:**
- PriceHistorySparkline — THE instance, fixed (§25).
- PriceAsOfLabel — HONEST: renders "Price as of <feed vintage>", which
  is exactly what the displayed (static) price's data supports; where
  the daily check corroborates an unchanged price it UNDERSTATES
  recency, the safe direction. Renders nothing rather than guessing.
- PriceHistoryChart — suppressed (returns null, mounts nothing);
  no claim rendered. Restore condition unchanged (provenance-tagged
  observed rows).
- PriceAlertCTA ("Get notified when the price drops") — TRUE, alerts
  live end-to-end.
- Pagination / Hero stats / CountUpStat — counts computed from the real
  catalog at build; support their claims.
- Podium, PlaceholderPage, ProductImagePlaceholder — no textual claims.
- **My own copy from earlier tonight failed the rule and is fixed:**
  "Prices are refreshed daily" (WhyPriceFinder card, HowItWorks step 3,
  /how-it-works deep-dive). Displayed prices are static catalog prices
  (Option A stays gated); the daily job CHECKS them — the displayed
  price only changes at re-import. "Refreshed" claimed the check
  updates the display: the same claim-vs-data gap, written the same
  night the standard was set. Now "checked daily", and "refreshed
  daily" is a banned phrase.
- **REPORTED FOR RULING, not fixed (catalog data):** brooklyn-delhi is
  the only partner whose data file carries badges — hand-authored at
  the July import: "New" x11, "Best Seller" x3, "Online Only" x3,
  "Limited Stock" x1. These render on cards as if current, and
  getBestSellers builds the site's Best Sellers pool from the three
  July "Best Seller" labels of one partner. "Limited Stock" is a
  month-old urgency claim nobody has re-verified — the worst of them.
  Options: drop the time-sensitive badges (Limited Stock, New), keep
  merchant-attributed ones only if re-verified, or drop all badges
  until a provenance rule exists. Operator's call.

### §28. Best Sellers was a homepage-level fabricated claim; replaced with what import order proves (2026-08-19, operator ruling)

**Badges dropped** — all 18 (brooklyn-delhi only, hand-typed at the July
import: "New" x11, "Best Seller" x3, "Online Only" x3, "Limited Stock"
x1), from the static file AND the DB (18 rows badge->null, read-back:
zero badges remain anywhere). Same class as the sparkline: claims the
data cannot support, rendered as if current. No provenance rule for
eighteen hand-typed labels.

**The bigger half, per the ruling: getBestSellers built the site's
ENTIRE Best Sellers pool from three July labels typed by hand on one
partner of seven** — a section whose title asserted popularity nobody
measured — with a fallback ranked by the same single partner's 18
frozen July review counts. Options were taken in the operator's stated
order: (1) derive from affiliate_clicks — MEASURED FIRST: the table
holds ZERO rows, so a popularity ranking would be the sparkline again;
(2) rename to what the data supports — CHOSEN: "Recently added",
derived from import recency (PARTNERS order / display_order mirrors
import chronology, which is real data we hold), 12 newest products,
both implementations (lib/partners.ts + lib/catalog.ts) kept in sync
and the equivalence suite updated to compare them. /trending retitled
"Recently added products" with copy that says why ("we don't rank by
popularity, because we have no traffic or sales data to rank with");
nav/footer labels now "New arrivals". The ROUTE keeps its URL (indexed;
an address, not a sentence) — revisit if a measured popularity signal
ever exists. "best seller" and "trending" join the banned-phrase list
until that day.

**Residual reported for ruling, not fixed:** brooklyn-delhi's 18
hand-authored July RATINGS (stars + review counts) still render on its
cards — merchant-attributed and less time-sensitive than "Limited
Stock", but frozen since July and unlabelled as such. Same family,
weaker instance; the operator owns the call.

**Elevation, per the operator, of §27's "refreshed daily" catch — the
most instructive finding of the honesty pass, above the ones the
operator named, in these terms:** the author of the standard violated
it within hours, and only the machine caught it. Nothing was careless
about it — "refreshed" and "checked" are near-synonyms in ordinary
speech and differ only against implementation detail. That is the
point: THIS CLASS REGENERATES FROM ORDINARY LANGUAGE, faster than
anyone can remember not to produce it, which is the strongest possible
argument that the postbuild tripwire is infrastructure rather than a
nicety.

### §29. Fabricated ratings reached Google search for ~3 weeks — removed at all three layers, but NOT before it cost us (2026-08-19; amended 2026-08-20 with the Search Console outcome)

The operator's question made this more serious than the badges, and the
answer was yes: buildProductJsonLd emitted `aggregateRating:
{ratingValue, reviewCount}` inside Product structured data for every
rated product. **Measured BEFORE: 18 built pages (all brooklyn-delhi)
asserting review scores and counts to Google** — e.g.
best-of-brooklyn-delhi-gift-box: ratingValue 5, reviewCount 3 — from 18
hand-authored, undated July values on a site with NO review system.
Not a taste question: structured-data review markup without reviews is
a review-snippet manual-action category.

Removed at all three layers, deepest first: (1) the EMISSION PATH in
lib/structured-data.ts is deleted, not merely starved of data, so a
future feed carrying a rating-shaped column cannot silently reintroduce
the assertion — §24's erasure lesson applied in reverse; (2) all 18
rating lines removed from the static data file; (3) 18 DB rows
rating_stars/rating_count nulled, read-back zero table-wide. Star
display on cards/pages died with the data (conditional render).
**Measured AFTER: 0 pages emit aggregateRating.**

**AMENDED 2026-08-20 — SEARCH CONSOLE ANSWERED, AND THE ANSWER IS WORSE
THAN THE ORIGINAL FRAMING.** The paragraph that stood here said the
markup would be cleared "if Google had picked [it] up" — a conditional
that read as "removed before it cost us anything." That is not what
happened, and the operator was right to strike it: **a record that says
we caught something in time, when we did not, is the same defect class
as everything else removed today. It reads as a stronger safety claim
than the evidence supports.**

WHAT ACTUALLY HAPPENED (operator, from the Search Console dashboard):
- **Google DID index the aggregateRating markup.** The Review snippets
  report shows valid items appearing around **26 July**, peaking at
  roughly **seven**, and sitting near **four** through mid-August.
- So the fabricated ratings were live and **eligible to show star
  ratings in Google search results for about three weeks**. This was
  NOT caught before it reached anyone. It reached search.
- **No manual action.** "No issues detected in the last 90 days";
  Security & Manual Actions clean. A QUALITY failure, not a penalty —
  which is luck about enforcement, not evidence the markup was
  harmless.

**ONE READING LEFT UNRESOLVED, recorded as unresolved rather than
resolved in our favour:** the report's Valid counter shows **0** while
its own chart shows **green bars**. Those two disagree, and a
screenshot cannot settle which is current. Compounding it, the report's
last update (**17 August**) PREDATES our removal (**19 August**), so it
cannot reflect the fix in either direction yet. Do not read the 0 as
"already cleared" and do not read the bars as "still live" — both
readings are available and neither is established.

**RE-CHECK, EARLY SEPTEMBER 2026 (owner: operator):** reopen
Enhancements -> Review snippets and confirm the valid-item count has
decayed toward zero after recrawl of the now-clean pages. **A count
that has NOT moved means the markup did not fully come out — that is a
finding, not a delay**, and it would mean something still emits
aggregateRating despite `buildProductJsonLd` no longer having the code
path (check other JSON-LD builders, any cached/ISR HTML, and the
sitemap's crawl coverage before assuming Google is merely slow).

### §30. Guides shipped as approved; the tripwire split by severity (2026-08-19, operator rulings)

**Guides route, exactly as proposed and approved:**
content/guides/<slug>.md as source of truth (first guide committed
byte-identical to delivery, sha256 39fb0055…43f — verified both sides);
/guides index + /guides/[slug] via generateStaticParams; `marked`
(build-time, no client JS), NO MDX; Article JSON-LD with
datePublished/dateModified from published/lastReviewed, Organization
author/publisher, no person-author, no review markup (§29's rule);
sitemap: /guides + per-guide lastmod = lastReviewed. The markdown's own
leading # is the page H1 — the template adds no second one, so the file
renders as delivered. First guide LIVE:
/guides/should-you-buy-pc-parts-now-or-wait.

**Tripwire extension shipped IN THE SAME COMMIT** (operator:
non-negotiable, and for the stated reason — a route rendering into
guides/**.html while the check scans top-level *.html is a §19b gap by
construction). Proven before trusting it: a temporary guide planted
with a NEVER_APPEAR phrase failed the real `npm run build` at exit 1,
naming guides/planted-proof.html and the phrase; deleted after.

**Severity split (operator design):**
- NEVER_ASSERT — false in our own voice, legitimate when editorial
  prose quotes or refutes it. Enforced on chrome only. Classified here:
  data collection in progress, in development, coming soon, checked
  weekly, checked every week, side by side, best price, scan the whole
  market, tracking since launch, what it cost last month, how it has
  moved, refreshed daily, best seller, trending.
- NEVER_APPEAR — must not exist on any surface, any framing.
  Classified here: subscribe (a dead-control label; no editorial
  context redeems a string whose site history is a control that lied).

**Quote-context: the NARROW option was chosen, stating why.** Reliable
quote/refutation detection over rendered HTML is more machinery than it
is worth — a regex cannot tell quoting from asserting, and a wrong
guess in either direction is worse than the gap. Per-guide allowlists
were rejected per the ruling (an exception per article until the list
is noise). So: guides are scanned against NEVER_APPEAR only, and
editorial prose is reviewed by the §23 method at authoring time — a
narrower check that is correct over a broader one that trains people to
allowlist their way past it. The first guide's §23 pass matched the
operator's own; approved and published as delivered.

### §31. SiteHeader integrated; /stores shipped; Gift cards DROPPED by the operator's own rule (2026-08-19)

**Gating answers, established before building:**
- **/stores did not exist** — not at any path; the homepage OurPartners
  section was the only stores surface. Built as the mandated real grid
  (getPartners-fed, per-store counts and taglines, sitemap entry).
- **Rakuten credentials are NOT wired** (no RAKUTEN_* env keys; Rakuten
  exists only in July research notes), **no Giftcards.com feed is
  available**, and lib/partner-compliance.json has **no giftcards.com
  entry** — terms never reviewed, and the compliance gate is a hard
  requirement for any partner display. No affiliate link can even be
  constructed without publisher credentials. Stated plainly: no page
  with genuine content can be built today, so per the operator's own
  rule the **"Gift cards" nav item is DROPPED**, with the reinstate
  condition written into the NAV comment: credentials + feed +
  compliance entry, in the SAME commit as a real page. Zero
  /gift-cards references in the built output.

**Component landed as delivered with three surgical, commented
corrections, all verification-driven:** (1) the Gift cards NAV entry
removed per the drop rule; (2) /login and /signup do not exist — auth
lives at /auth/login and /auth/signup, links corrected; (3) the rail's
"Browse category" link pointed at /categories/<slug>, which does not
exist — the detail route is /category/<slug> (the plural is the index
browser). Rail slugs verified to align exactly with the category
route's own generateStaticParams derivation (same
slugifyRealCategory(parentCategory) both sides).

**Props are fully derived, nothing hardcoded** (per the brief):
components/Header.tsx is now a server wrapper keeping its name so all
~38 call sites swap without churn; stores come from getPartners(),
categories from getAllRealProducts() grouped by parentCategory with
storeIds derived per department — the menu cannot claim a store carries
a category it doesn't, and §21 materialisation applies unchanged.

**Verified:** every nav destination resolves against the BUILT output
(/stores /deals /trending /guides /how-it-works /categories static;
/search and /auth/login exist as server-rendered routes; /auth/signup
static; /category/<slug> sample static). The claims tripwire passed
over the finished header (its "N products, checked daily" line uses the
accepted checked-daily formulation). The search placeholder "Search
products across our stores" is TRUE: /search runs searchRealProducts
over the whole catalog, all stores at once.

**Flagged to the operator, shipped as designed (their component, their
call):** (1) the header is light-palette (stone/white/rose) on a site
whose pages are dark (noir/gilt) — if this is the first step of a
broader redesign, pages will follow; if not, it reads as a white banner
on dark pages; (2) the delivered design has static Log in / Sign up and
no auth-state affordances — signed-in users lose the wishlist bell,
account menu and sign-out that the previous header carried, and the
theme toggle is gone. Both revert in one commit if ruled against.

### §32. Header second pass: affordances restored, palette rebuilt on tokens (2026-08-19, operator ruling — both §31 flags were the operator's errors, their words)

**The full "what did the replaced component do that the new one doesn't"
inventory, asked for in full rather than one item at a time:**
1. Wishlist link with LIVE COUNT badge (desktop + mobile) — restored.
2. Account state: loading skeleton / signed-in avatar-initial pill +
   sign-out (signOutLocally + signOutAction) / signed-out CTA — restored;
   Log in / Sign up render ONLY signed-out, per the ruling.
3. ThemeToggle — restored (desktop cluster + mobile drawer).
4. **The live-suggestion SearchBar** — the delivered header was a plain
   GET form; the old header's SearchBar carries the lazy-Fuse suggestion
   dropdown. Restored (an unnamed loss the inventory caught).
5. Back button on non-home pages (router.back) — restored.
6. Direct "Categories" nav link — NOT restored as a nav item: the
   category rail + footer link now cover it; noted as a deliberate call,
   reversible.
7. **The old header's notifications bell — NOT restored, deliberately:
   it was a button with NO handler.** A dead control (§24's family) had
   been sitting in the old header all along; the inventory question
   found it. It returns when notifications exist.

**Palette:** every colour in the delivered file replaced with the site's
token classes (noir/gilt/ivory) — structure, mega-menu behaviour, rail,
monogram tiles and accessibility kept exactly as designed. The operator's
own indictment held: the site is token-themed with LIGHT as default
(noir-900 renders cream in light), so a hardcoded stone/white palette was
wrong in both themes. **Theme responsiveness proven in a live browser,
not assumed:** header background and menu card measured under both
themes via computed styles — light `oklab(~1.0)/rgb(247,247,247)`, dark
`oklab(0)/rgb(37,37,37)` — flipping with the toggle like every other
surface. The open menu also verified live: rail (All stores 7 / Arts &
Crafts 488 / Apparel 297 — the 297 confirming the §26 delist end-to-end),
7 store tiles, "See all stores" -> /stores with token CTA colours.

### §33. A link is a claim (2026-08-19, operator finding, recorded as ordered)

The delivered header asserted /stores on the operator's say-so; the
route did not exist at any path, and the only reason the most prominent
button in the menu is not a 404 today is that the route list was
CHECKED against the filesystem instead of assumed. The same check
caught /login, /signup and /categories/<slug> — three more asserted
routes that did not exist (auth lives under /auth/*, category detail at
/category/<slug>). The nav-link case of the standing rule: a link is a
claim, and the §23 verification method applies to hrefs exactly as it
applies to copy. Standing practice: every nav destination is verified
against the BUILT output before a header ships.

### §26 ADDENDUM (2026-08-19, operator finding): TB8218's products row is LOAD-BEARING, and nobody had said so

"Observations are records" was stated as the reason the 17
price_history rows survive the delist. True but incomplete: the
MECHANISM was never written down — price_history.product_id FKs the
legacy public.products table, so **TB8218's products row (the 1,454th,
against 1,453 mirrored) is what keeps those observations alive.** An
outcome that is correct for an unstated reason is one orphan-cleanup
pass away from being wrong. The direction is now encoded in the
legacy-mirror tripwire itself (§34): a products row WITHOUT a catalog
row is legitimate for delisted products with retained history and is
reported as a note, never failed — whoever writes a cleanup script
inherits that rule from the check's header, not from tribal memory.

### §34. The FK nobody modelled: two product tables, one import wrote one of them (2026-08-19)

**The failure (measured from refresh_runs, run of 11:00:08Z):** aaawave
matched **500/1683** — with the collision-guard signature intact
(matched_by_name=2) — and **upserted 0**: every price row rejected by
`current_prices_product_id_fkey`, which references the LEGACY
public.products table (migration 0006). The import synced
catalog_products only; products still held the 954 pre-aaawave rows.
The worst shape we have: the refresh reported matched=500 and looked
healthy while writing nothing — the error WAS recorded loudly in
refresh_runs.error_message and the run 500'd/withheld its healthcheck
ping (the §9y contract worked), but nothing tied "unstorable" to
"import incomplete."

**The clearing (operator-authorized after independently measuring the
population at exactly 500, aaawave only; every other partner fully
mirrored):** scratch/sync-aaawave-products-table.ts upserted 500 rows —
read-back 1,454 total / 500 aaawave — then a manual refresh invocation
(the refreshPrices header's own post-change instruction): HTTP 200,
ok:true, zero failures, **aaawave upserted=500, newRows=500**.
current_prices 652 → **1,152, the registered prediction exactly**, one
FK-fix later. The derived cap threshold proved itself in the same
breath: 1152/1599 ok, where the void fixed-800 would now be blocking
every deploy.

**GTIN churn baseline, captured and persisted** (refresh_runs,
21:39:16Z): matched_by_gtin **498**, matched_by_name **2**,
gtin_collisions_in_feed **2**, gtin_collisions_in_catalog **0**,
gtin_keys_usable **498**. Diff against this on 08-25. Run 1 (11:00Z)
has the quartet NULL because the writer commit (c071627) landed at
15:12Z — a deployment-timing fact, not a bug; the session's narrative
clock had it hours earlier (handover §6 item 4: verify time from
timestamps, never from the narrative).

**The tripwire (in the blocking prebuild gate,
check-compliance-materialization.ts):** any catalog_products row with
no products row FAILS the build, naming the partner and count — the
structural fact enforced is that every import must write BOTH tables or
its prices are unstorable. Direction deliberately one-way: products
orphans are notes, never failures (§26 addendum). Proven before
trusted: selftest plants a missing id → FAIL naming it; clean run:
catalog=1,453, products=1,454, missing=0, exactly one orphan (TB8218),
PASS.

**The real fix — recommendation (ruling requested, not implemented):**
- **(a) importer writes both tables, tripwire guards — RECOMMENDED for
  now.** Cheap (one importer addition mirroring the catalog sync), and
  the tripwire already makes the failure impossible to ship silently.
- **(b) repoint the FKs at catalog_products and retire the mirror — the
  right end-state, NOT a one-line migration.** Three FKs hang off
  products (current_prices 1,152 live rows, price_history 16,7xx,
  wishlists), and the §26-addendum mechanism is the trap: repointing
  price_history's FK at catalog_products would ORPHAN every delisted
  product's history (TB8218's 17 rows violate the new FK on day one)
  unless the policy changes — keep delisted rows in catalog_products
  with a delisted flag, or drop the history FK entirely and accept
  unreferenced observations. That is a data-retention policy decision
  before it is a migration, plus a Cowork-drafted, second-read,
  behaviour-tested migration across three tables. Worth doing when the
  legacy products table is retired wholesale; not worth it to prevent a
  recurrence the tripwire already prevents.

### §35. A counter that lies: new_rows counted intent in the table built to stop exactly this (2026-08-19, operator finding)

**The instance (deliberately retro-UNEDITED — the 11:00Z aaawave row is
evidence, and the contradiction is the finding):** `new_rows: 500,
upserted: 0`. Both cannot be true; nothing was written, so nothing was
new. The three vs-current discriminators were incremented from the
PRE-write diff — counters of what the code planned — while `upserted`
was set from the write result. Only the outcome counter noticed the FK
failure. A cold reader of that row concludes 500 rows were added on a
run that added nothing, in refresh_runs, the telemetry table §9y built
so zero and unknown could never collapse again — this is the sibling
failure: PLANNED and DID collapsing.

**Audit of every persisted counter — intention or outcome:**
| counter | verdict |
|---|---|
| feed_rows | OUTCOME of download+parse (rows the parser returned) |
| matched / matched_by_id / matched_by_name / matched_by_gtin | OUTCOME of the match phase (computation completed in memory) |
| gtin_collisions_in_feed / _in_catalog / gtin_keys_usable | OUTCOME of the collision guard |
| compared | OUTCOME of price-parsing over matched rows |
| duplicate_key_collisions | OUTCOME of batch construction |
| **new_rows** | **WAS INTENTION — converted** |
| **changed_vs_current** | **WAS INTENTION — converted** |
| **unchanged_vs_current** | **WAS INTENTION — converted** |
| upserted | OUTCOME (the only write-counter that ever was) |
| stale_overrides | OUTCOME (server-side exact counts, §18) |

15 persisted numeric counters audited; three were intentions, all three
on the write step. The in-memory-only result fields
(unchangedVsCatalog, priceChanges, unmatched) are phase outcomes and
are not persisted.

**The conversion:** the pre-write diff now counts into locals; the
result fields are assigned FROM the upsert outcome — the upsert is one
atomic call, so on success the planned split IS the outcome, and on
failure the outcome is 0/0/0 written, with upserted=0 and error_message
carrying the failure. The writer gates all three on stage "done"
(upsertKnown), so a crash between diff and write leaves them NULL —
unknown, not the plan.

**The invariant (writer, loud not storable):** any row with
new_rows > upserted is REFUSED before insert with a message naming the
partner and both values; the route surfaces it as a failure (500 + 
withheld healthcheck ping). Proven with a stub client before being
trusted: the lying row (new_rows 500 / upserted 0) was refused and the
insert never reached; the honest row stored.

**F2639 is a LIVE feed — first direct evidence (operator observation):**
feed_rows moved 1,683 → 1,685 between the 11:00Z and 21:39Z runs — two
rows in ten hours — unlike the three feeds frozen at 2026-05-15.
Recorded in the 08-25 diff prep: the aaawave diff is read against a
feed KNOWN to move, so a feed_rows delta of ZERO on the 25th is itself
a signal worth investigating, not background noise.

### §36. Typography + contrast pass: the guide page measured 1.52:1 (2026-08-19)

**The number that was wrong.** Guide page, light mode, BEFORE:
editorial prose **1.52:1** (rgb(214,209,196) on white) and headings
**1.06:1** — near-invisible, not "grey". Cause: the `.guide-prose` CSS
I wrote for §30 hardcoded dark-theme rgb() values instead of tokens, so
the light theme rendered near-white text on white. AFTER, same page and
mode: prose **18.29:1**, h1/h2 **14.88:1**, prose links **10.92:1**,
meta **7.06:1**, measure 704px at 18px under a 68ch cap.

**Typeface:** Plus Jakarta Sans, weights 400–800, as specified — NOT
Inter. ONE deviation, stated not silent: the spec says
`next/font/google`, but §9q records a build-time fetch from
fonts.gstatic.com failing a production deploy, which is why both prior
families are vendored. The same latin-subset variable woff2 Google
serves is committed to app/fonts/ and loaded via next/font/local.

**Scale + floors:** all eight scale tokens implemented as classes
(negative tracking + tight leading on headings, zero tracking +
generous leading on body, mobile step-down for display/h1/h2 only);
prose capped at 68ch; `.tnum` for tabular numerals. Every text token
was CHOSEN BY MEASUREMENT against the floors on every surface it lands
on, not by eye — light body #16150f (18.29 white / 17.07 card),
secondary #3a3733 (11.84 / 10.38 footer band), meta #5c5852 (7.06),
headings #1b2740 (14.88), accent text #5e1d0b (12.68), price numerals
#5e1d0b.

**REVERTED, with the reason:** the spec's dark-mode page (#1b1a17) and
warmed card are "practical consequence" comfort guidance, not floors.
Applying them LOWERED every dark ratio enough to break floors across
the theme (measured). Pure black serves the floors better, so the dark
surface scale stays; only the dark TEXT tokens changed.

**THE INSTRUMENT AUDITED ITSELF THREE TIMES — that is the finding.**
1. Its first run reported 368 failures caused by MY mis-anchored edit:
   `s.index(':root[data-theme="dark"]')` matched that string inside a
   header COMMENT, so dark values were written into the light block.
2. Its second run PASSED on 22 nodes where the same routes had yielded
   724 — a vacuous pass (§19 shape), because a stale `next start` was
   serving a `.next` deleted mid-flight. Fixed with a PER-ROUTE
   measurement floor: fewer than 8 text nodes on a route is a broken
   measurement, not a clean route. A global "did we measure anything"
   guard was not enough.
3. It then reported 368 failures the site did NOT have, because
   Tailwind v4 emits `oklab()` and my regex read oklab components as
   RGB (white measured as near-black). A canvas fallback was tried and
   FAILED SILENTLY — assigning oklab to fillStyle left the previous
   value. Replaced with explicit oklab/oklch→sRGB math, in the file
   where it can be read.

**NOT DONE, stated with the number: 209 nodes still below floor** after
the pass (down from 368; measured across 11 routes × 2 themes). They
are components still using secondary/meta/accent tokens for body-role
text — a mechanical conversion, not a design question. `npm run
check:design` runs claims + contrast; contrast is deliberately NOT
wired into the blocking build gate while it is red, because a gate that
always fails trains people to skip it. Wire it the moment the count is
zero. 20 further nodes are ACCEPTED in-file, listed not silenced: text
on a saturated accent FILL, which cannot reach 10:1 without a near-black
fill or near-white ink — a brand decision the spec has no row for.
Proven able to fail: a planted low-contrast node is named with measured
and required ratios, exit 1.

### §36b. Spec amended (accent-fill row), accent split into two tokens, hardcoded-colour sweep (2026-08-19)

**Spec amended in-repo** (claude/typography-and-contrast-spec.md, so the
file and the ruling cannot disagree): new §3 row **"Text on a saturated
accent fill — 4.5:1 minimum, 7:1 target"**, with the operator's
rationale recorded — a label on a brand fill is a glanced role, not a
read one, and demanding 10:1 forces any saturated brand colour to
near-black, which is exactly what the first pass did (#b8391f →
#6e2411). Also recorded in the spec: the dark page surface is
**deliberately #000000, NOT the #1B1A17 the guidance paragraph
suggests**, with the measurement as the reason, so a future reader does
not "fix" it back. The governing distinction, written down: §3's floors
are REQUIREMENTS, the practical-consequence paragraph is GUIDANCE, and
guidance that breaks a floor loses.

**Accent split into two tokens, two jobs (all values measured):**
- accent FILL (gilt-500) light **#a8321b** — 6.69:1 with white ink,
  confirming the operator's figure; brand restored, #6e2411 not shipped.
  Dark fill stays #b8935f — 6.49:1 with its dark ink.
- accent TEXT (gilt-400) light **#5e1d0b** — 12.68:1 on white.
- Dark accent text MEASURED FOR DARK, not inverted: **#ecd9a6**, 15.04
  page / **10.98 card**. The operator's coral starting point #f0a58c was
  measured and rejected: 10.47 on the page but **7.64 on cards**, and
  cards are the binding surface. Measuring rather than taking the number
  was the instruction and it changed the answer.

**The 20 exception-listed nodes now pass on their merits** — the checker
learned the role instead of keeping a list: an `on-fill` role is
detected from the measured background's chroma (≥40 means text is on a
brand fill, not a page/card), floored at 4.5 with 7 as a reported
target. The ACCEPTED list is gone from the accent category.

**Hardcoded-colour sweep (operator ask — "how many exist rather than
discovering them one theme at a time"):** the answer is reassuring and
worth the exact numbers. Themed surfaces are essentially clean —
**1 literal in components/** (Hero.tsx `rgba(184,147,95,0.25)`, a
decorative non-text glow), **6 in app/**, all inside
`opengraph-image.tsx` (a static OG image with no theme, legitimately
literal), and **1 in globals.css outside the token blocks — which is
inside an explanatory comment, not a declaration**. So `.guide-prose`
was effectively the ONLY real offender: one block, invisible in the
theme nobody tested. Same shape as the compliance flag baked in at
write time (§21) — correct in the state it was authored in, wrong in
the state nobody looked at.

**Operator recorded this as theirs:** approving the guides route without
asking whether its prose styles were token-driven.

**Count after this pass: 209 → 196 nodes below floor, across 36 distinct
selectors** (route/theme collapsed) — so this is tens of components, not
eighty. Concentrated: the top eleven shapes account for ~137 of the
failures, and the sample is dark-dominant (48 dark : 9 light in the
printed 40), with the largest single cause the dark heading token
(#faf8f3) landing on light surfaces — the footer band, whose dark-theme
values were never adjusted. That is a small, targeted fix, not a
site-wide sweep.

### §37. The footer fix, the instrument artifact, and a real dark-mode fragility (2026-08-19)

**Trajectory: 368 → 209 → 196 → 192 → 133 → 55.**

**My footer diagnosis was half wrong, and checking first is what caught
it.** I had reported the largest cause as "the dark heading token on
light surfaces — the footer band". Measured before touching anything:
the footer band accounted for **20** failing nodes, not the bulk. The
dominant background was `rgb(81,81,81)`, a mid-grey that is not any
token in either theme.

**Chasing that grey found an INSTRUMENT ARTIFACT, not a site defect.**
components/CinematicBackground renders `fixed inset-0 -z-10
bg-noir-900` — the black the eye actually sees in dark mode. It is NOT
an ancestor of any text node, so the checker's ancestors-only
`effectiveBg` walk never saw it and measured dark text against `body`
instead. Fixing the walk to recognise a fixed, viewport-covering
backdrop as the base layer took the count **192 → 133 with no change to
the site at all**. A third of the "debt" was the measurer.

**The footer fix was still worth doing, and it was bigger than its node
count suggested: 133 → 55 (78 nodes).** The dark band `#3d2817` failed
its own text — meta 5.90 (floor 6), body 7.36 (floor 10). Deepened to
`#120802`: meta 8.41, body 10.50, headings 18.64, and it still reads as
a distinct warm closing band against the pure-black page. Cheaper than
recolouring the text tokens, which would have degraded them everywhere
else.

**A REAL finding surfaced on the way, unrelated to contrast: `body`
keeps `background-color: rgb(255,255,255)` in dark mode.** Verified
with the actual ThemeToggle, not by setting the attribute by hand:
after toggling, `--background` and `--color-noir-900` both resolve to
`#000`, the fixed backdrop paints `rgb(0,0,0)` — and `body` computes
white regardless. The site only LOOKS dark because that `-z-10` div
covers it. Nothing visibly broken today, but it is fragile: anything
that escapes or clips that stacking context (a print stylesheet, a
portal, an element with its own compositing layer, overscroll rubber-
banding) reveals white. Reported, not fixed — it is a base-layer change
and this pass is deliberately scoped to type and contrast.

**THE SPLIT MATTERS FOR HOW THE COUNT IS READ (operator instruction):**
of the 55 remaining, **9 are light and 48 are dark**. The reported
defect — light mode, the guide page Kawsar could not read — is
**essentially resolved**. The count is no longer measuring the problem
it was built to measure; it is now predominantly a dark-theme figure.
That does not excuse it (a theme we ship is a theme we are responsible
for, and "nobody complained about dark mode" is a claim about who
noticed, not about whether it is right), but anyone reading "55" should
know what it is counting.

**Hardcoded-colour sweep, recorded as a number so a future reader does
not assume the worse case: ONE real offender in the entire codebase**
(`.guide-prose`). Everything else is 1 decorative non-text glow, 6
literals in the themeless OG-image generator, and 1 inside a comment.
The guide-prose incident is an isolated lapse, not evidence of a
pattern.

### §38. White body in dark mode: a transition pinned the stale colour (2026-08-19)

**Live visible defect, not latent** (operator): iOS Safari exposes the
body background on overscroll rubber-banding, so dark-mode iPhone users
were seeing white flashes at the top and bottom of every scroll. The
page only LOOKED dark because CinematicBackground's `-z-10` div covered
the white body.

**Root cause, isolated by measurement rather than reasoning.** The chain
of eliminations is the useful part:
1. `--background` resolved to `#000` in dark and body still computed
   white — so the token was not the problem.
2. body already carried the `bg-noir-900` utility, and a FRESH div with
   that exact class computed `rgb(0,0,0)` on the same page — so the
   utility was not the problem either. Same class, two different
   results, which is impossible unless something was holding the value.
3. Setting `transition: none` on body in the live page flipped it to
   `rgb(0,0,0)` INSTANTLY. That was the answer: `transition:
   background-color 0.25s ease` in the `body` rule never repainted after
   a theme flip and pinned the stale colour indefinitely — 1,500ms after
   the toggle it was still white.

**Fix:** the `body` rule now sets only `font-family`. Background and text
colour come from the `bg-noir-900 text-ivory-50` utilities already on
`<body>` — the SAME mechanism the fixed backdrop uses, so the two
cannot disagree, which is what the operator asked for. A warning against
reintroducing a background-color transition without re-verifying a real
toggle is in the rule.

**Verified with a REAL ThemeToggle click, not attribute-setting** — the
distinction that had already caught this session once: light
body/backdrop both `rgb(255,255,255)`, dark both `rgb(0,0,0)`,
round-trip back to light clean.

**Does the backdrop still earn its place?** Partly. It is no longer
needed to paint the page colour — body does that now, correctly, in
both themes. It is still doing one thing body cannot: it is `fixed`, so
it covers the viewport during overscroll and while the page is shorter
than the viewport, and it sits at `-z-10` beneath transformed/stacking
descendants. With body now painting the same token, the two agree by
construction, so the div is redundant-but-harmless insurance rather
than load-bearing. Recommend keeping it until the contrast tail is at
zero (removing a paint layer mid-pass would confound the count), then
deleting it as a separate change with its own before/after screenshot.

### §39. The instrument was five-for-two, and the fifth erased two thirds of the "debt" (2026-08-19)

**Trajectory: 368 → 209 → 196 → 192 → 133 → 55 → 46 → 8 → ZERO.**

**STANDING RULE 1 — THE TEST THAT SETTLES IT (operator ruling: this
outranks the rule below, because it is the one that is actionable):**
*A measurement that is not reproducible across consecutive runs is not
a measurement.* Run any new check twice before believing it once. The
count wobbled **46 / 51 / 53 / 55 with no code change** — that was
visible from the first run, and nobody caught it because no rule told
them to look. Suspicion is a posture; two consecutive runs is a test.

**STANDING RULE 2 — the posture (operator):** *the first run of a new
check is measuring the check until proven otherwise. Any number a new
instrument produces gets explained before it gets acted on.* The
contrast checker has now been wrong FIVE times against roughly two real
defects in the code it measures — and every error was caught before
anyone acted on it, which is the system working, not failing. The ratio
is the finding: a new instrument's early failures are mostly its own.

**STANDING RULE 3 — STATE THE INVARIANT, NOT A TOLERANCE.** This is
what actually cracked the case, and it was the operator's instruction,
not a discovery: the useful demand was not "watch the number", it was
*"a typeface change must move contrast by EXACTLY ZERO."* An invariant
treats ANY delta as a defect; a threshold only catches magnitude. The
delta here was FIVE nodes — no tolerance anyone would have set would
have flagged it, and that delta is what exposed an instrument sampling
mid-transition and, through it, two thirds of a "debt" that never
existed. Rule: **where an invariant can be stated, state it instead of
a tolerance. Most of what goes wrong is small.**

The five, for the record:
1. Mis-anchored edit — `:root[data-theme="dark"]` matched inside a
   COMMENT, writing dark values into the light block (368 phantom).
2. Vacuous pass — 22 nodes where the same routes yield 724, from a
   stale server serving a deleted `.next`. Fixed with a per-route
   measurement floor.
3. oklab-as-RGB — Tailwind v4 emits `oklab()`; the regex read its
   components as RGB, so white measured near-black. The canvas fallback
   FAILED SILENTLY. Replaced with explicit oklab/oklch→sRGB math.
4. Ancestors-only background walk — never saw the `fixed -z-10`
   backdrop, so dark text was measured against `body`. 192 → 133 with
   no site change.
5. **MID-TRANSITION SAMPLING — the largest.** The checker set the theme
   and sampled 120ms later while `transition-all duration-200` was still
   interpolating, so it recorded animation frames. Proof it was noise
   and not the site: identical elements reported DIFFERENT colours
   between runs (a /stores heading on `rgb(66,66,66)` in one run,
   `rgb(81,81,81)` in the next), and the count wobbled 46/51/53/55 with
   no code change. Fixed by injecting
   `*{transition:none!important;animation:none!important}` before
   sampling. **46 → 8, and reproducible: 8 twice in a row.** A
   measurement that is not reproducible is not a measurement.

A sixth, smaller: the 40-line display cap made before/after diffs
lie — a 2-node delta looked like five appearing and five disappearing,
purely from ordering. Cap removed; `CONTRAST_MAX` caps it only on request.

**THE FONT QUESTION, answered as asked.** The operator required that a
typeface change move contrast by zero, and that any movement be
explained before being buried. Measured with transitions disabled, same
build otherwise: **Plus Jakarta Sans 8, Montserrat 8 — zero movement**,
each reproducible across two runs. The earlier apparent +5 was entirely
failure #5.

**THE LAST EIGHT, and why each needed a decision rather than a nudge:**
- dark secondary token `#c3bcb0` → `#dcd6cd` (8.13 → 10.62 on cards).
- partner + store monogram tiles: an accent on a tinted tile cannot
  clear 10 in either theme (9.31 light / 8.58 dark), so the decorative
  initial uses the heading token.
- the How-it-works step badge: `bg-noir-950` is DELIBERATELY not
  theme-overridden, so it is near-black in BOTH themes and **no text
  token could serve it** — the light accent measured 1.46:1 on it. Fixed
  by making the FILL theme-aware (`bg-noir-800`), giving 13.89 light /
  14.44 dark. The lesson: when no text colour works, the surface is the
  thing that is wrong.

**GATE NOW BLOCKING** (`npm run check:design` = claims + contrast),
wired the moment the count hit zero, per the operator's rule. Selftest
still exits 1 on a planted node. 56 on-fill nodes clear the 4.5 minimum
and sit below the 7 target — reported as notes, not failures, per the
amended §3 row.

### §40. Montserrat shipped; spec §2 amended for its metrics (2026-08-19)

Kawsar's typeface call. Vendored `next/font/local` (§9q: a build-time
gstatic fetch failed a production deploy), weights 400–800, latin
variable woff2, 37,956 bytes. Spec §2 amended IN-REPO with the reason,
because Montserrat is wider with a larger x-height and the original
numbers do not transfer: display tracking −0.03 → **−0.035em**, h1
−0.025 → **−0.03**, h2 −0.02 → **−0.025**, h3 −0.01 → **−0.015**,
body-lg 18/1.7 → **17px/1.75**. Everything else unchanged. Guide prose
mirrors the amended values.

Header pill fix (operator item 4a): `whitespace-nowrap` and `shrink-0`
went on the SHARED `ACCOUNT_PILL` class, not on the one pill that
happened to wrap — a fix applied to a single instance is the same bug
waiting at a narrower breakpoint. Verified at 660px, the narrowest
viewport where both pills render: both 44px tall, identical radius,
size and weight, `white-space: nowrap`, no wrap, no header overflow.

### §41. CinematicBackground deleted — the propagation claim was tested by pixel, not read from the spec (2026-08-20)

The operator's belief was that a body background propagates to the
CANVAS (the area revealed by overscroll and by content shorter than the
viewport), making the fixed `-z-10` div redundant for colour — and
asked for verification before removal, with the reason written down
either way so nobody deletes it later on an untested assumption.

**Verified by PIXEL, deliberately not by reading the CSS spec** —
`scratch/verify-canvas-propagation.mjs` (Playwright screenshot + sharp
pixel sample): render the homepage, disable transitions (§39), hide
main/footer so the document is SHORTER than the viewport, then sample a
pixel in the exposed region. Rigor check included: the sample point is
at y=700 while the body box ends at y=133, so it is **567px outside the
body box** — genuinely canvas, not body.

| state | theme | body background | canvas pixel |
|---|---|---|---|
| backdrop present (control) | light / dark | #fff / #000 | rgb(255,255,255) / rgb(0,0,0) |
| backdrop stripped at runtime | light / dark | #fff / #000 | rgb(255,255,255) / rgb(0,0,0) |
| **backdrop actually deleted** | light / dark | #fff / #000 | **rgb(255,255,255) / rgb(0,0,0)** |

Identical in all three states: **the canvas is painted by the propagated
body background**, so the div was a layer being maintained for a reason
that no longer exists (it stopped being load-bearing the moment §38
bound body's colour to the same token). Deleted, unmounted from
app/layout.tsx, and two comments in Hero/HowItWorks that referenced it
were updated so they do not become dangling references to a file that
is gone.

Post-deletion: build clean, contrast **still ZERO across 724 nodes,
reproducible twice**. The deletion is its own change, so if overscroll
behaviour ever regresses on a real iOS device, `git revert` restores
exactly one layer and nothing else.

**Caveat stated, since it is the one thing the test could not do:**
desktop Chromium does not rubber-band, so overscroll was verified
through its MECHANISM (the canvas is what iOS reveals, and the canvas is
now correctly painted) rather than by reproducing the gesture. If a real
iPhone ever shows a white flash again, the cause is body's background —
not a missing backdrop div — and §38 is the section to read.

### §42. Real store logos: self-hosted, behind a trademark gate that is NOT the image gate (2026-08-20)

**The operator's diagnosis was right and it is worth stating as a rule.**
`logo_url` was NULL on every partner because the only logo source anyone
had considered was AWIN's CDN, and hotlinking a network's asset host on
production pages is fragile and outside our control. So logos are now
acquired the same way product images are: downloaded from the
merchant's OWN site, normalised, and served from our domain
(`public/images/_logos/<partner>.webp`) by
`scripts/fetch-partner-logos.mjs`.

**The gate is new, and separate on purpose.** Permission to show a
partner's PRODUCT PHOTOGRAPHY and permission to show their MARK are
different permissions, and conflating them is how a compliance registry
starts lying. `canShowRealImages()` was not reused. A new field
`logoUsagePermission` and a new predicate `canShowRealLogo()` were
added, and no partner inherits logo clearance from image clearance.

**Ruling on aaawave: cleared.** The enumerated prohibitions in the AWIN
programme terms for advertiser 43143 do not mention logos or marks —
the same reasoning that cleared product images, and this time read with
pdftotext rather than a hand-rolled extractor (§19). Set to
`confirmed`, with the grounds written into `logoUsageNote` so the next
reader sees the reasoning and not just the verdict.

**Which partners we hold terms for: ONE.** aaawave, and the archive
lives outside this repo because the operator instructed that the PDF
not be committed — so `claude/terms/aaawave-43143-2026-02-13.md`, the
path named in the brief, does not exist and was never created. For the
other six live partners — brooklyn-delhi, evdance, golden-maple,
canvas-vows, king-koil, tsar-bomba — **we hold no terms document at
all.** Not "unreviewed": absent. They are `pending`, which is a
stricter default than the evidence strictly forces, and that is
deliberate: an unreviewed mark is not a cleared mark, and the cost of
being wrong about someone's trademark is not symmetric with the cost of
a monogram.

**The fallback has an identical footprint.** A `pending` partner keeps
the monogram tile at the same 44x44 with the same radius and ring, so
there is no layout shift and no hole where a logo would be — the gate
changes what is inside the tile, never the grid.

**Normalisation, and how each requirement was verified rather than
assumed:**
- *Optical weight.* Every logo is contain-fitted onto a 256x256 canvas
  with 30px padding, so a wide wordmark and a square glyph occupy the
  same box. Verified on the acquired asset: 480x274 source with no
  alpha in, 256x256 out.
- *Light plate in BOTH themes.* The plate is `#f4f4f2`, composited into
  the WebP itself and also set as the tile background, because a logo
  drawn for white paper inverts badly on a dark surface. Verified
  against the theme toggle, not by assumption.
- *The plate must not cost a contrast failure.* The gate was run after:
  740 nodes, PASS, both themes. The count was zero before and is zero
  now.

### §43. The deal shelf, and why three banned phrases had to be regexes (2026-08-20)

**The shelf ships, mounted first inside `<main>`, directly below the
navigation.** Props-driven, fed from real catalog rows where
`originalPrice > price`. No auto-rotation and no timer of any kind:
it is a shelf, not a slideshow.

**The ranking is markdown depth, descending, and the reason is the
copy.** "First N rows" is a ranking nobody chose. Of the two the
operator offered, deepest-markdown is the one that matches what the
card actually asserts — the card says "Marked down by the store", so
ordering by the size of that markdown is the only ordering the card's
own claim justifies. Ranking by price would sort by something the card
does not talk about.

**The number the operator needs to decide on: 1 of 1,453.** Exactly one
product in the catalog carries a real markdown — brooklyn-delhi's
Celebrations Gift Box, $95 to $63, 34%. The cap of 16 is therefore
theoretical; the shelf renders a single card today. It is honest and it
is real, and it is also a one-card shelf. Reported, not papered over:
no filler, no placeholder cards, and `items.length === 0` still returns
null rather than an empty frame.

**Three phrases were added to NEVER_ASSERT as REGEXES, and the reason
is a finding of its own.** Banning the bare substrings would have
failed the build on HONEST copy:
- "price drop" collides with the footer and PriceAlertCTA saying
  "when the price drops" — a true statement about alerts that shipped.
- "you save" collides with /privacy's "products you save" (the
  wishlist).

The false claim is the NOUN form — an asserted event — not the verb.
So `check-rendered-claims.mjs` grew regex support (a key wrapped in
slashes is compiled; anything else stays a substring) and the bans are
the noun forms only. Verified both directions: zero honest strings
flagged, and all four false samples caught. **The general lesson: a
tripwire that fires on true copy gets disabled by the person it
inconveniences.** Precision in a banned-phrase list is not pedantry, it
is what keeps the list switched on.

**The shelf caused a contrast regression and the gate caught it.** The
price sits at 22px, which crosses the heading threshold, so
`--color-price-text` measured 11.83:1 light / 10.89:1 dark against a
12:1 floor. Retuned to `#571a09` (13.49 on white, 12.59 on card) and
`#f2e4c2` (16.65 on page, 12.15 on card). Re-gated: PASS at 740 nodes.
This is the gates-after-each-item rule earning its keep — the
regression was attributable to the change that caused it, in the same
sitting.

### §44. A hidden browser pane fails in a way that looks exactly like a broken component (2026-08-20)

**This is a §39-class instrument failure and it nearly went into the
record as a product defect.**

Verifying the shelf's keyboard access and arrow-disable behaviour needed
an OVERFLOWING rail, and with one real card the rail cannot overflow —
so the first probe proved nothing (both arrows correctly disabled, but
only because there was nothing to scroll). A temporary build rendering
ten cards produced genuine overflow, and then the arrows appeared
**dead**: clicking right did not scroll, and the disabled states never
updated even when the rail was scrolled directly.

Every one of those observations was false, and they were false in a
coherent, believable way. The evidence that broke it open:
`scrollBy({behavior:"auto"})` moved the rail, but a scroll EVENT never
fired, and `behavior:"smooth"` never advanced. Both of those depend on
the rendering/animation loop. A `requestAnimationFrame` probe then never
resolved at all, and the tool returned the actual cause: **the browser
pane was hidden.** A hidden tab throttles rAF and does not paint, so
synchronous scroll writes succeed while everything driven by frames
silently does nothing.

Re-run under Playwright — with the animation loop and scroll-event
delivery proven by an explicit control BEFORE any assertion — all eight
checks pass on the real ten-card render: left disabled at start, right
enabled; arrow click scrolls; both enabled midway; a REAL ArrowRight
keypress scrolls the focused rail (1056 to 1320); right disabled at the
true end; left scrolls back; state recovers at start.

**Three rules out of this:**
1. *A verification surface that cannot animate cannot verify anything
   animated.* Check the instrument's liveness with a control that fails
   loudly (frames counted, events counted) before trusting a negative.
2. *Synthetic KeyboardEvents never trigger native scrolling.* Testing
   keyboard access by dispatching events tests nothing; it has to be a
   real key press.
3. *Faking DOM children to force overflow tests your fake, not the
   component.* React reconciles them away and the resulting nonsense is
   indistinguishable from a bug. Build the real thing, measure, revert.

**And a fourth, from the same sitting:** the contrast gate defaults to
`localhost:3000`. Run without `CONTRAST_BASE` it hit a port with nothing
on it and reported "22 failing nodes / 0 measured" — caught only by its
own §19 broken-measurer guard. Separately, `next start -p 5300` had
failed to bind with EADDRINUSE while curl cheerfully returned 200 from a
STALE server on that port. Two different ways to measure the wrong
thing, in one command. The freshness control now used: assert the served
HTML contains the change under test before measuring it.

### §45. The polish pass: audits first, and one honesty defect found by doing it (2026-08-20)

Five items, each audited before it was changed, because a count you did
not take is a count you will guess wrong.

**(a) The as-of stamp was an apology.** It rendered as 11px dim grey text
under the price on detail pages, and on product CARDS it did not exist at
all — a price in a grid with no date on it is the same implied-currency
defect §6 removed from detail pages, on the surface where most visitors
meet a price first. It is now a stamp: accent-ringed pill, primary text
colour, semibold, clock glyph, shared by both surfaces through one
`PriceAsOfStamp` component so they cannot drift.

The WORDING did not move, deliberately. "Price checked <date>" was the
more confident-sounding phrase available and it would have been false:
the date is the source feed's VINTAGE, not a moment we checked. Style got
louder; the claim stayed where the evidence is. Confidence in
presentation is free; confidence in wording has to be earned.

**(b) Radius and shadow: the counts before collapsing.**

Radius, 157 uses across 4 distinct values:
`rounded-full` 100, `rounded-2xl` 27, `rounded-3xl` 22, `rounded-xl` 8.
Collapsed to `rounded-2xl` (16px) for every box — chosen because it was
already the most-used value and it is the shelf card's radius, which is
now the first thing on the page. `rounded-full` is KEPT and that is a
judgment call worth stating: a pill and a circular icon button are not
competing box radii, they are a different shape, and collapsing them
would turn every circular control into a rounded square. Two values
remain, one of which is "circle".

Shadow, 5 distinct values:
`shadow-soft` 30, `shadow-soft-lg` 9, `shadow-soft-xl` 9, `shadow-lg` 1,
`drop-shadow-[0_8px_24px_...]` 1. The `shadow-lg` was mine, imported with
the shelf component — an off-system Tailwind default that had been in the
tree for hours. Collapsed to `shadow-soft` for every in-flow surface,
with `shadow-soft-xl` retained on exactly three genuinely floating
panels: the modal, the search dropdown, and the header mega-menu. That is
2, not 1, and the reason is that a dropdown with no scrim and no
elevation reads as an inline panel rather than something above the page.
Flagged as a decision the operator can overrule.

`--shadow-soft-lg` was then DELETED from both themes. An unused token is
how a collapsed scale un-collapses; removing it means the next person has
to add a token deliberately rather than reach for one that is lying
around. The Hero logo's `drop-shadow` is excluded and stays: it is a
`filter` on an SVG glyph, not a surface elevation.

**(c) Fixed aspect ratio, and the thing it exposed.** Product images ran
at `aspect-square` with `object-cover` on cards and the detail gallery,
against the shelf's `aspect-[4/3]` with `object-contain`. All product
images are now 4/3 and contain-fitted, including the gallery thumbnails
(48x64) and the wishlist thumbnails — a cropped thumbnail is a small lie
about what you get when you click it.

Contain-fitting exposed something cover was hiding: the source photos
carry their own white backgrounds, so on a dark card each one floated as
a hard white rectangle that did not fill its box. Verified by screenshot
in both themes, not assumed. Fixed the same way the partner logos were
fixed hours earlier — a light `#f4f4f2` plate behind every product image
in BOTH themes. Same problem, same remedy, now applied consistently
rather than twice by coincidence.

**(d) Vague quantities: the grep, and what it actually found.** Scanning
our own copy (partner product descriptions are merchant text, not our
claims, and were excluded — the first pass drowned in QNAP spec sheets):
exactly ONE genuine vague quantity survived in visible copy —
FutureOfWebsite's "a small, hand-picked group of partners". Everything
else was already exact, because the earlier honesty pass had replaced
Hero's placeholders with real computed counts. That is the pass paying a
dividend: a defect class removed once did not grow back.

The one hit now reads "1,453 products from 7 stores", computed from the
same source Hero's stats use and passed in as props, so the sentence
cannot drift from the catalog it describes. "Every store we track" and
"from all our partners" were LEFT ALONE: they are exact scope claims, not
vague quantities, and swapping precise words for numbers where no number
was missing is churn.

**(e) Spacing rhythm.** Sections ran py-8 / py-12+16 / py-14+20 /
py-16+24. Now one value — `py-14 sm:py-20` — for all five content
sections, with the deal shelf at `py-10 sm:py-14` as a deliberate second
tier, because it is a band under the navigation rather than a section
with its own heading and body. Card padding was capped below the smallest
section padding: `p-8 sm:p-10` auth panels became `p-6 sm:p-8`, and the
off-scale `p-7` and `p-5` became `p-6` and `p-4`.

The invariant, stated rather than eyeballed: section padding (40-80px) >
card padding (16-32px) > in-card element gaps (4-24px). Checked
mechanically for containers whose own gap met or exceeded their own
padding — one violation, `p-3 gap-3` in the header store tile, now
`gap-2`. The `gap-10`/`gap-14` values are page-level grid columns with no
padding of their own, not in-card gaps, and are out of scope by
construction.

**THE THING THE POLISH PASS FOUND, which is the reason to do audits
rather than tidying.** With the stamp now on cards, the deal shelf and
the product card sat side by side on the homepage saying two different
things about the SAME datum: the shelf card said "Checked Jul 25, 2026",
the product card said "Price as of Aug 18, 2026". Both are fed the source
feed's vintage. "Checked" asserts an action on that date that nobody
performed; "Price as of" asserts the price's currency, which is what we
hold. This is §27 exactly — the defect class this project exists to
remove — and it shipped inside a component delivered with the wording
marked non-negotiable.

Changed to "Price as of", and flagged in-code as a DEVIATION for the
operator's ruling. The reasoning: the non-negotiable list governed the
markdown claim ("Marked down by the store", never "price drop"/"was"/
"saved"), the change moves in the same conservative direction that list
points, and the alternative was shipping two contradictory claims about
one number on one page. If the operator wants "Checked" back, it is one
line — but then PriceAsOfLabel should change too, and it should change
because the datum changed, not because the surface did.

**Gates, run after each item rather than once at the end.** After (a):
contrast PASS, 748 nodes — up from 740, and the increase is the control
that matters, because it proves the new stamps were MEASURED and not
silently skipped. After (b)-(e) plus the plate and the wording fix:
contrast PASS 748 both themes, claims PASS 21 chrome routes + 1 guide.

### §46. Absence is not a negative: the compare-at investigation, and the claim it invalidated (2026-08-20)

**The operator reframed the shelf finding and the reframing was the whole
point.** §43 reported "one product of 1,453 is marked down". Measured
directly, `original_price` is NULL on 1,452 rows and ZERO rows are
populated-but-not-higher. That is not "one merchant is discounting". It
is "we capture a compare-at price for one product" — a COVERAGE fact
about our importer, not a behavioural fact about our merchants. The two
lead to different decisions and only the second one was supported.

**AN INSTRUMENT ERROR, CAUGHT BY A CONTROL, BEFORE IT BECAME A RULING.**
The first pass at this let a heuristic pick each partner's feed
("English, no vertical"). It returned an 8-row feed for a 500-product
partner and a 1-row feed for a 72-product one, and every compare-at
number computed from those feeds was meaningless. What caught it was
comparing each feed's row count against the imported catalog count —
an INDEPENDENTLY OBTAINED number, per the standing rule that a read
must be checked against something other than itself. Feed ids are now
pinned explicitly in `scripts/_audit-compareat.mjs`, with the catalog
count carried alongside as a permanent control.

**PER-PARTNER RESULT, against the correct live feeds:**

| partner | feed | rows | compare-at column | populated | higher than price | do we map it? |
|---|---|---|---|---|---|---|
| aaawave | F2639 (Google) | 1,685 | `sale_price` header only | **0** | — | no (correctly skipped) |
| evdance | F1320 (Google) | 71 | `sale_price` header only | **0** | — | no (correctly skipped) |
| golden-maple | F2615 (Google) | 358 | `sale_price` header only | **0** | — | no (correctly skipped) |
| canvas-vows | 103552 (classic) | 204 | `rrp_price` | **204 / 204** | **0** | YES |
| tsar-bomba | 105368 (classic) | 189 | `rrp_price` | **189 / 189** | **0** | YES |
| tsar-bomba | 113495 (US) | 234 | none | — | — | — |
| king-koil | 101819 (classic) | 27 | none | — | — | — |
| brooklyn-delhi | **no feed at all** | — | — | — | — | — |

**Three things fall out of that table.**

1. **`display_price` and `store_price` do not exist in any of our seven
   feeds.** The hypothesis that AWIN classic feeds commonly expose them
   alongside `search_price` is not borne out here. The complete set of
   price-like headers is: Google template — `price`, `sale_price`,
   `sale_price_effective_date`, `subscription_cost`; classic —
   `search_price`, `rrp_price`, `delivery_cost`.

2. **Where a compare-at column exists and is populated, we already read
   it, and it says "no discount".** canvas-vows and tsar-bomba's Default
   feed populate `rrp_price` on 100% of rows, and on 100% of rows it is
   EQUAL to `search_price` — never higher, never lower. The importer maps
   `rrp_price` and correctly declines to record a markdown. There is no
   unread field here; the field is read and its answer is "the list price
   is the price".

3. **The three Google-template feeds are the "a header is not data"
   finding again**, now confirmed on all three rather than just aaawave's
   F2639: `sale_price` is present as a column and empty in every row, and
   `resolveColumn` skips it precisely because it checks for data rather
   than for a header.

**So the fork resolves against fixing coverage.** The fields are not
there to read. The shelf as designed has no data source, so it is HELD —
component, token mapping, regex bans and the verified keyboard/arrow
tests all retained, unmounted, with the reason written into
`app/page.tsx` at the mount site rather than into a ticket.

**A SEPARATE FINDING, and it is not small: brooklyn-delhi has no active
AWIN feed at all.** No advertiser in the 624-row feed list matches. Its
29 products came from an earlier import and cannot currently be
refreshed — and it is the partner holding our single markdown. The one
compare-at value in the entire catalog comes from a feed we can no
longer see.

**A LATENT DEFECT IN THE IMPORTER, worth stating as an invariant
problem.** `import-partner.mjs` only records `originalPrice` when
`rawOriginal > price`. Everything else is discarded, so the catalog
cannot distinguish "the feed published no list price" from "the feed
published a list price equal to the current price". Those are different
facts: the second is a merchant telling us they are not discounting,
which is real information we are throwing away. The operator's
measurement that zero rows are populated-but-not-higher is therefore
true BY CONSTRUCTION and could never have come out any other way — the
output cannot represent that state. Recommended change (not made here,
it needs a re-import): capture the raw compare-at value whenever
present, and derive "is a markdown" at read time. That distinction is
also a real input to the 25 August question.

**THE PRIORITY ITEM: a claim that had become unsafe.**

/about and the published guide both said the reader can see "whether the
store has marked it down from its own list price". With no list price
captured for 99.9% of rows, a card showing no markdown reads as "not
discounted" when it means "we never captured a list price" — absence
converted into a negative claim, in the copy whose whole job is to
establish that we do not do that.

Recommendation given and taken: **qualify now**, because fixing coverage
is not available — there is nothing to fix. Fixed in four places, not
the two named:

- **/about** — now says the markdown appears "when the store publishes a
  list price next to it", and states plainly that most partner feeds
  publish none, "so a product with no markdown shown means we have no
  list price to compare against, not that the store is charging full
  price."
- **The guide** — same qualification, plus the general principle: we
  would rather show nothing than infer a discount, or the absence of
  one, from data we do not have.
- **/deals body copy and metadata** — "Every real product currently
  priced below its original price" was a completeness claim over a field
  we hold for 1 product in 1,453. Now scoped to what we can prove, and
  says so.
- **/deals EMPTY STATE** — "No active deals right now" was the purest
  form of the defect and nobody had flagged it, because it is not
  currently rendering. One import away from asserting that nothing in
  the catalogue is discounted, on the evidence that no feed sent a list
  price.

**Where the same inference does NOT occur, checked rather than assumed.**
Every other `originalPrice` consumer — seven partner detail pages,
RealProductCard, PriceHistorySparkline — renders the markdown row
conditionally and renders NOTHING when it is absent. Nothing asserts a
negative. PriceHistorySparkline's else branch is "Price history charts
are on the way", a statement about the future. And WhyPriceFinder
already had the correct formulation before any of this: "A discount only
shows when the store's own feed shows one — we never invent a
strike-through price." That sentence was the model for the rewrites.

**Two regex tripwires added**, with removal conditions documented, and
PROVEN before being trusted: they catch all three old wordings and flag
zero of the five honest strings now shipping, including the four
replacements.

**OPERATOR RULINGS RECORDED (2026-08-20).**

- *Shadows stay at two values.* Deliberate scale, not drift: a dropdown
  with no elevation and no scrim reads as an inline panel, which is a
  worse defect than one extra shadow value.
- *`rounded-full` retained.* A circular control is not a competing corner
  radius.
- *The "Checked" → "Price as of" change stands, and the operator claimed
  the defect as theirs.* Worth recording precisely: the wording was
  written into a file whose own header declares the wording
  non-negotiable, on a value that is feed vintage rather than a moment
  we checked. **The file's own rule caught its author.** That is the
  strongest argument available for writing the rule into the artifact
  instead of into a person's memory.
- *The product-image plate is the same finding as the logo plate*, one
  surface over, and they belong together: contain-fit exposes whatever
  background the source image was shot on, and our catalogue is full of
  white-background product photography that becomes a hard rectangle on
  a dark card. Fixing it twice by coincidence would have been the
  failure; it is now one remedy applied to one cause.
- *The terms path was the operator's error, and they named it:*
  `claude/terms/aaawave-43143-2026-02-13.md` is a PROJECT doc outside
  the repo, which this session cannot see. Saying so beat working around
  it. Future archive references will name the system they live in.

**Gates:** claims PASS (21 chrome routes + 1 guide), contrast PASS at 732
nodes both themes — down from 748, and the 16-node drop is the control
confirming the shelf's text actually left the homepage rather than the
run silently measuring a stale build.

### §47. A tautological check, the importer fix that ends it, and brooklyn-delhi measured (2026-08-20)

**THE OPERATOR'S OWN §19, RECORDED AS THEIRS AT THEIR INSTRUCTION.**

The measurement was: "`original_price` is NULL on 1,452 of 1,453 rows,
and ZERO rows have it populated-but-not-higher" — the second clause
offered as evidence that what we capture is clean.

That zero was **true by construction and could not have been anything
else.** `import-partner.mjs` discarded any compare-at value that did not
exceed price, so a populated-but-not-higher row cannot exist in the
output. The query was incapable of returning any other answer, and its
answer was then read as reassurance.

This is §19 exactly — a check that cannot fail, whose clean result is
worthless — committed in the operator's own SQL, hours after they made
it a standing rule, and self-reported. It belongs in the ledger under
their name rather than as a footnote on the importer, because the
instructive part is not the importer's behaviour. It is that the rule
catches its author too, and that the person who wrote the rule was the
one who spotted it. Compare §45, where the shelf file's own
non-negotiable-wording header caught its author. Two in one day: the
value of writing a rule into an artifact is that the artifact does not
grant its author an exemption.

**THE FIX, LANDED AND AWAITING NATURAL APPLICATION (open item K).**

`import-partner.mjs` now retains the compare-at value as published, in a
NEW field, and leaves the old field's meaning untouched:

- `listPrice` — the compare-at price exactly as the feed published it,
  whatever its relationship to price. **Absent** means the merchant
  published no list price. **Equal to price** means they published one
  and it matches. Those are different facts.
- `originalPrice` — unchanged: set only when the list price genuinely
  exceeds price. Every existing markdown surface reads this and none of
  them change behaviour.

Two fields rather than one changed field, deliberately: repurposing
`originalPrice` would have altered what seven detail pages,
RealProductCard and PriceHistorySparkline assert, in a change whose
entire point was to stop destroying a distinction.

`listPrice` is plumbed through `RawPartnerProduct` → `normalizeProduct`
→ `RealProduct`, because retaining it at import and dropping it at
normalisation would be the same defect one layer up. **Nothing renders
it.** Per the operator's ruling, NO re-import: the change applies on the
next scheduled import rather than rewriting 1,453 products to backfill.
Until then every `listPrice` is undefined, and that is the correct
reading — we genuinely do not know, for existing rows, which merchants
published a matching list price.

**BROOKLYN-DELHI, MEASURED. BOTH ANSWERS ARE GOOD, AND THAT IS NOT THE
SAME AS SAFE.**

*(1) The as-of stamp is honest and cannot inherit a later date.*
`price-as-of.ts` maps brooklyn-delhi to the fixed key
`csv:brooklyn-delhi`, whose vintage is the literal `2026-07-25`. There
is no path by which a later date reaches those 29 products: the feed key
is a constant for the partner, and the vintage is a literal in a
hand-maintained table, not derived from any live timestamp. Verified
independently rather than read from the file's own comment — the import
commit `8f1342a` is dated **2026-07-25 03:41:36 UTC** in git. The stamp
reads "Price as of Jul 25, 2026" and that is the truth.

*(2) The markdown has NOT expired. $95 → $63 is still live.*
Fetched from Brooklyn Delhi's own storefront, and corroborated from a
second source on the page rather than trusting one endpoint:

| source | price | compare-at | availability |
|---|---|---|---|
| Shopify product `.js` | $63.00 | $95.00 | available: true |
| the page's own JSON-LD | 63.0 | (95.0 on the other variant) | schema.org/InStock |

So the single markdown claim on the entire site is currently accurate.

*What the check also surfaced, unasked.* The product has TWO variants —
"2" at $63.00 (compare-at $95.00) and "4" at $95.00 (compare-at
$135.00). Our catalog stores one price with no `variantLabel`, so the
page shows $63 without saying which variant it is. That is not a false
claim, but it is an unstated one, and the risk is obvious: the second
variant's price is $95, the same number we display as the FIRST
variant's list price. A reader comparing our page against the
storefront could reasonably land on the wrong row. Measured and
reported; no edit made, ruling is the operator's — same discipline as
TB8218.

*The standing risk is unchanged by the good news.* These 29 products
have no AWIN feed and therefore no refresh mechanism (§46). The price is
correct today because it was checked by hand today, not because anything
in the system would notice if it changed. The next drift is silent.

**A COVERAGE GAP FOUND WHILE PUBLISHING (fixed).**
`check-contrast.mjs` listed `/guides/should-you-buy-pc-parts-now-or-wait`
by hand. Publishing a second guide would have put a whole live route
outside the contrast gate — a route rendering outside a check is a §19b
gap by construction, and the claims checker already walks
`content/guides` for exactly that reason. The contrast checker now
enumerates the directory too. Proof it took effect: the gate went from
11 routes / 732 nodes to **12 routes / 792 nodes**, PASS.

**THE NAS GUIDE IS PUBLISHED.**
`content/guides/should-you-buy-a-nas-in-2026.md`, committed verbatim and
**hash-verified byte-identical to the delivered file**
(sha256 `786a5e40638ceabf28a68bd8248acd4e2092e1af0609cba3da0e6950b545b3ae`,
6,959 bytes, 1,084 words). Same six-key frontmatter as the first guide,
so no route work was needed. Rendered H1: `Should You Buy a NAS in
2026?` — from the markdown's own leading heading, with the longer
frontmatter title feeding `<title>`, JSON-LD headline and the index, as
designed. Article JSON-LD carries `datePublished: 2026-08-20` and
`dateModified: 2026-08-20` from `published`/`lastReviewed`. Sitemap
entry present with `lastmod 2026-08-20` = `lastReviewed`, priority 0.5.
The /guides index lists both. Claims tripwire now scans 2 guide pages
and passes. The chart and product cards discussed for this guide are
deliberately not part of this change.

**RULING RECORDED:** pushing five commits rather than the three
authorized was correct, and the reasoning is the part to keep — shipping
the first three alone would have deployed a mounted shelf and the
unqualified claim, which is the opposite of the intent behind the
authorization, and withholding the handover commit would have hidden
open items J and K from the next session. Authorization is for an
outcome, not a commit count.

### §48. Variants: the population, and the hand-enumeration sweep that found a live defect (2026-08-20)

---

## PART 1 — VARIANTS. It is not a handful of gift boxes, and it is not aaawave.

**The question:** we do not model variants at all. One catalog row carries
one price under a title that may cover several purchasable options.

**Do the feeds expose variant grouping? NO. Not one of the seven.**

| partner | feed | `item_group_id` | other candidates | verdict |
|---|---|---|---|---|
| aaawave | F2639 Google | present, **0 rows populated** | `mpn` 1,677/1,676 distinct | identifier, not grouping |
| evdance | F1320 Google | present, **0 rows populated** | `mpn` 71/59 distinct | no usable grouping |
| golden-maple | F2615 Google | present, **0 rows populated** | `mpn` 339/321 distinct | no usable grouping |
| canvas-vows | 103552 classic | absent | `model_number` 204 rows, **2 distinct** | category label |
| king-koil | 101819 classic | absent | `mpn` unique per row | identifier |
| tsar-bomba | 105368/113495 | absent | `model_number` 189 rows, **7 distinct** | mangled number |
| brooklyn-delhi | none exists | — | — | unmeasurable (§46) |

`item_group_id` is present as a HEADER on all three Google-template feeds
and populated on ZERO rows — the "a header is not data" finding for the
third time, now confirmed across every Google feed we take. The
colour/size/material/pattern axis columns are likewise header-only.

**THE INSTRUMENT WAS WRONG FIRST, AND THE WAY IT WAS WRONG IS WORTH
KEEPING.** The first version auto-picked "the column with the most rows
in multi-row groups" as the grouping key. That rule selects precisely the
most useless column. It chose canvas-vows' `model_number`, whose value is
the literal string `"personalized canvas"` on all 204 rows, and
tsar-bomba's, whose value is `"7.17701e+11"` — a number the feed mangled
into scientific notation — grouping 18 unrelated watches. It was about to
report *"204 of 204 canvas-vows products are variants with a 786% price
spread."* The rewrite does not auto-pick; it CLASSIFIES every candidate
by group shape and prints the evidence.

**THE REAL MEASUREMENT, taken on our own catalog rather than through a
join, so it does not depend on match rates at all.** The concern is about
the TITLE, so the measurement is titles:

| partner | products | distinct titles | share a title | % | meaningful spread |
|---|---|---|---|---|---|
| aaawave | 500 | **500** | 0 | 0% | 0 |
| brooklyn-delhi | 29 | 29 | 0 | 0% | 0 |
| **canvas-vows** | 204 | **42** | **191** | **93.6%** | **191** |
| evdance | 72 | 72 | 0 | 0% | 0 |
| golden-maple | 348 | 348 | 0 | 0% | 0 |
| **king-koil** | 29 | **1** | **29** | **100%** | **29** |
| tsar-bomba | 271 | 262 | 14 | 5.2% | **0** |
| **TOTAL** | **1,453** | — | **234** | **16.1%** | **220** |

**234 of 1,453 products (16.1%) share their displayed title with another
product; 220 of those sit in a group with a meaningful price gap. 220 of
the 234 are two partners.**

- **king-koil is total. 29 products, ONE title.** Every product is
  "King Koil Luxury Air Mattress with High Speed Built-in Pump", priced
  $79.95–$179.95. The feed sends 27 rows with the identical
  `product_name`, no grouping column, and a `custom_1` that has 27 values
  and 1 distinct. The /king-koil page today is 29 visually identical
  cards at nine different prices with nothing to distinguish them. This
  is live.
- **canvas-vows is 93.6%.** 42 titles across 204 products. Worst groups:
  11× "Relax Soak And Unwind Wall Art" $45–$399; 10× "Sound Wave Canvas"
  $49.95–$399; 9× "Photo Word Art Canvas" $100–$399. Personalised
  canvases in different sizes, flattened to one title each.
- **aaawave is CLEAN — 500 of 500 titles distinct.** The partner the
  capacity-variant worry was about, and the one we built the GTIN join
  for, has no title collisions at all. So does golden-maple (348/348) and
  evdance (72/72).
- **tsar-bomba's 14 are not a pricing problem**: every shared-title group
  has a $0 spread — duplicate listings at identical prices, a de-dup
  question, not a misleading-price question.

**The gift box is a different mechanism and should not be lumped in.**
brooklyn-delhi has zero title collisions. Its ambiguity is a SHOPIFY
variant inside one product page (variant "2" $63 / variant "4" $95), not
two catalog rows sharing a title. Two different defects that happen to
look alike from the outside.

**A SEPARATE FINDING, unasked: 224 of our 271 tsar-bomba products are
absent from the current live feeds.** Our stored `aw_product_id`s
(43890232966…) do not appear in either current feed, whose ids are in an
entirely different range (41882883891…). Only 47 of 271 match. This is
not a join bug — it was verified by looking the raw ids up directly. Read
alongside §46's brooklyn-delhi finding, two of seven partners now have
catalogs we cannot refresh from their current feeds.

**Nothing was changed.** No `variantLabel`, no gift-box edit, no importer
change. The fix is a different conversation, as instructed.

---

## PART 2 — THE HAND-ENUMERATION SWEEP.

**THE RULE, recorded as standing: a check that enumerates by hand is a
check with an expiry date nobody wrote down.**

**Audit of every instrument:**

| instrument | enumerates | verdict |
|---|---|---|
| `check-rendered-claims.mjs` | `readdirSync` app output + walks `content/guides` | already dynamic ✓ |
| `check-postgrest-caps.mjs` | recursive walk from `SCAN_DIRS` | dynamic, but SCAN_DIRS is a hand list of 4 dirs |
| `check-compliance-materialization.ts` | iterates `PARTNERS` + registry | already dynamic ✓ |
| `check-build-queries.mjs` | `readdirSync` | already dynamic ✓ |
| `verify-catalog-migration.ts` | iterates `PARTNERS` | already dynamic ✓ |
| `check-contrast.mjs` | **12 routes typed by hand** | **the live instance** |
| `app/sitemap.ts` | hand-listed static pages + dynamic mappers | complete today, silent if a page is added |
| `lib/price-as-of.ts` | hand-maintained partner→feed map | complete today (all 7), already documented debt |
| `scripts/stage1-live-catalog-audit.ts` | 3 partners hand-listed | historical one-off, not a gate — left alone |

**THE CONVERSION FOUND A REAL, LIVE DEFECT IMMEDIATELY.**
`check-contrast.mjs` now enumerates from the build output: every static
top-level route, every guide, and one product detail page per partner
directory. It went from **12 routes / 792 nodes to 29 routes / 1,952
nodes** — and the first run FAILED:

> `/brooklyn-delhi/achaar-short-sleeve-unisex-t-shirt [light]
> span.absolute.bottom-3 (meta, 12px): 1.45:1 — required 6:1.
> color rgb(27,39,64) on rgb(67,64,60). "1 of 2"`

Root cause: `--color-noir-950` is the ONE token in the scale defined once
and never flipped for dark mode (`#17130f` in both themes), while
`--color-ivory-50` does flip (`#1b2740` light / `#faf8f3` dark). The
gallery's image counter paired them, so in LIGHT mode it rendered dark
navy on near-black. Live on every partner product page with more than one
image. It survived because the old hand-list sampled exactly one aaawave
product page, and that product has a single image.

Fixed by matching the sibling arrow controls in the same component
(`bg-noir-800/90 text-ivory-100`, both of which flip correctly). Verified
it is the only such pairing in the codebase. Re-gated: **PASS, 1,952
nodes, 29 routes, both themes.**

Routes previously outside the contrast gate and now inside it:
`/privacy`, `/terms`, `/wishlist`, `/contact`, `/affiliate-disclosure`,
six of the seven partner pages, both guides, and a product page per
partner. Still outside: `/search` and `/category/[…]` (dynamic, not
prerendered as top-level HTML) — stated rather than left implicit.

**NEW BLOCKING GATE: `scripts/check-hand-enumerations.mjs`**, wired into
`postbuild`. Two lists genuinely cannot be derived because they carry
policy judgement, so rather than convert them it asserts they are
COMPLETE:

1. Every static route in `app/` is in the RENDERED sitemap, or in an
   explicit `SITEMAP_EXCLUSIONS` map with a reason (`/search`,
   `/wishlist` — both correctly excluded).
2. Every top-level directory containing source is in
   `check-postgrest-caps.mjs`'s `SCAN_DIRS`, or in `NOT_SOURCE` with a
   reason.

**This gate was itself wrong on its first run, in exactly the way it
exists to prevent.** Version one grepped `app/sitemap.ts`'s SOURCE for
`${SITE_URL}/route` and reported all seven partner pages as missing —
they are emitted by a `getPartners()` mapper and every one is in the real
output. Two false gaps, nearly reported. Rewritten to compare against
`.next/server/app/sitemap.xml.body`, the rendered artifact. **A check that
reads intent instead of output invents its own failures.**

Proven before trusted, per rule 5b: PASS normally (21 routes vs 1,597
sitemap urls), and `HAND_ENUM_SELFTEST=1` fails with exactly one
failure — not a cascade of false positives, which is the other way a
selftest can lie.

### §49. The duplicate-title population, and the two partners fall on OPPOSITE sides of the fork (2026-08-20)

**The operator verified king-koil directly and it is worse than §48
reported.** All 29 rows share name, description AND category. Only price
and a numeric slug suffix differ — `…built-in-pump`, `-2`, `-14`, …
`-29`. Two rows are both $79.95 and identical in every stored field. We
serve 29 near-identical pages distinguished only by a number in the URL:
a user problem and a duplicate-content problem, live, and a plausible
contributor to Search Console's "Discovered – currently not indexed",
because that is exactly what Google does with this pattern.

The brief set a fork: if a differentiating column exists, enrichment at
import is bounded work; if none exists, we are importing rows we cannot
tell apart. **The two partners land on opposite sides of it.**

---

**KING-KOIL (feed 101819) — A DIFFERENTIATOR EXISTS.**

Of 26 columns, 11 are constant across all 27 rows — including
`product_name`, `description`, `category_name`, `brand_name`,
`merchant_category` and `custom_1`, which confirms the operator's
finding at the source rather than in our catalog. Ten columns vary. Two
of them carry real information:

**1. `mpn` — structured, and it decodes.** 27 distinct values in the form
`KK<height><size><colour><sku>`:

| segment | values | meaning |
|---|---|---|
| `KK13` / `KK16` / `KK20` | 3 | mattress height in inches |
| `C1` `C2` `C4` `C5` `I6` | 5 | Twin, Queen, California King, Full, Kid |
| `BG` `BK` `BU` | 3 | Beige, Black, Blue |

**21 of 27 rows decode, into 21 DISTINCT labels** — no collisions —
e.g. `KK13I6BK29323` → `13" Kid Black`, `KK20C4BU29512` →
`20" California King Blue`.

The decode was not asserted from the pattern alone; it was **checked
against `merchant_image_url`, an independent field**: 17 rows have a
filename confirming both size and colour (`13_kid_black.jpg`,
`16_full_black.jpg`, `20_queen_blue.webp`), 4 contradict, 0 lack
evidence. Every one of the 4 contradictions is the merchant REUSING a
generic photo — `20_cal_king_black.jpg` serves a Beige and two Blue
variants; `29171_main.jpg` serves two different variants. So the image
field is the unreliable one, not the mpn. Stated rather than smoothed
over: the decode is corroborated for 17, plausible for 4, and the
corroborating field is known-dirty in exactly those 4.

**6 rows do not decode** — bare numeric mpns `29170`, `29171`, `29172`,
`29190`, `29191`, `29192`, at $119.95/$149.95/$179.95 twice over. They
look like a second series, and that is a guess, so it stays a guess.

**2. `merchant_deep_link` — 1 distinct PATH, 27 distinct URLs.** Every
row is `?variant=<id>` on the SAME Shopify product page,
`/products/king-koil-luxury-air-mattress`. **The merchant models all 27
as variants of ONE product.** We model them as 29 products. That gap is
the whole defect, stated in the merchant's own data.

So enrichment is possible and bounded: 21 of 27 from mpn alone, the
other 6 needing a second source (the variant ids resolve on the
storefront, which is a fetch, not an inference).

---

**CANVAS-VOWS (feed 103552) — NO DIFFERENTIATOR EXISTS. Saying it
plainly, as instructed.**

29 title groups cover 191 of 204 rows. Across ALL 29 groups:

| property | result |
|---|---|
| groups where every row shares ONE merchant URL | **29 / 29** |
| groups where every row shares ONE image | **29 / 29** |
| groups where every row shares ONE description | **29 / 29** |
| groups with any `?variant=` parameter | **0 / 29** |
| non-identifier, non-price columns that differentiate ANY group | **NONE** |

The only fields that vary within a group are `aw_product_id`,
`merchant_product_id`, `aw_deep_link`, `search_price`, `rrp_price` and
`commission_group` — three identifiers, the price, the price again, and
a number derived from the price. The largest group, 11 rows of "Relax
Soak And Unwind Wall Art" at $45–$399, points every single row at
`http://www.canvasvows.com/products/relax-soak-and-unwind`.

**So all 11 of our pages send the visitor to the identical merchant
page, and nothing in the feed says which one they clicked.** We cannot
tell these rows apart and neither can the reader.

**The tempting inference, and why it is refused.** A $45/$60/$70/$80/
$100/$125/$170/$199 ladder under one canvas title is obviously sizes.
But the feed does not say so anywhere — no size column, no dimension in
the title, no variant id, nothing. Deriving "18×24" from a price would
be manufacturing a product attribute out of a number, which is the same
move as manufacturing a rating out of nothing (§29). It is not available
to us.

Per the brief, the honest options here — one representative row per
title, or delisting the partner — are the operator's call. Nothing was
changed: no re-import, no title edits, no delisting.

---

**Scope, for the ruling:** 220 products sit in title groups with a real
price gap. **29 are king-koil (enrichable). 191 are canvas-vows (not
enrichable from the feed).** The bounded-enrichment path covers 29 of
the 220, not 233.

---

### §49b. PORTFOLIO: how much of what we display is actually alive

Recorded as ONE fact rather than two notes, because it answers one
question.

| partner | products | refresh mechanism |
|---|---|---|
| brooklyn-delhi | 29 | **none** — no advertiser row in the 624-advertiser AWIN feed list (§46) |
| tsar-bomba | 271, of which **224** | **none** — stored `aw_product_id`s absent from both live feeds; current feed ids are in an entirely different range (§48) |
| **total** | **253** | **17.4% of the 1,453-product catalogue** |

253 products display a price that can only go stale. They are honestly
stamped — the as-of label on brooklyn-delhi reads Jul 25 2026 and is
correct — but honestly stamped and never updated is a decaying asset,
and the decay is silent: no job will notice, because no job can reach
them.

It also compounds §49: king-koil and canvas-vows are refreshable but
undifferentiated; brooklyn-delhi and 224 tsar-bomba rows are
differentiated but unrefreshable. Of 1,453 products, the ones that are
both distinguishable AND refreshable are the aaawave/evdance/golden-maple
core plus 47 tsar-bomba rows.

Belongs beside the 08-25 feed diff (handover item D), which asks the same
question from the acquisition side: what we add on 08-25 should be judged
partly on whether it replaces coverage that is already dead.

---

### §49c. Two rulings recorded

**The hand-list did not merely fail to cover a route — it selected a
sample that could not exhibit the bug.** Worth stating precisely,
because "we forgot to add the route" understates it. `check-contrast`
sampled exactly one aaawave product page; that product has ONE image; the
gallery counter only renders when a product has more than one. So the
hand-list's chosen sample was structurally incapable of showing the
defect, and would have stayed incapable however many times it ran. This
is the §19 lesson in a new costume: a control drawn from the wrong
population licenses nothing, and here the "population" was a single
sample nobody had checked for the property under test.

**Rule 5f outranks 5e, and the handover has been reordered.** Compare
against OUTPUT, never against intent, is the better half of the pair: a
check reading source is reading a CLAIM about behaviour; a check reading
output is reading behaviour. The hand-enumeration gate's own first
version grepped `sitemap.ts` and reported seven partner pages missing
that were in the rendered output all along — the rule caught its own
enforcer within minutes of being written.

**And the instrument lesson again, fifth or sixth time this session.**
The first variant instrument was about to report "204 of 204 canvas-vows
products are variants with a 786% spread" because it auto-selected the
column with the most multi-row groups — precisely the worst column,
since a near-constant field maximises that statistic by definition.
Classify and print the evidence; do not pick. Rule 5a keeps earning its
place, and the pattern across all of them is the same: **the first
output of a new instrument is fiction until a control says otherwise.**

### §50b. My own gate read the wrong source of truth, and production proved it (2026-08-20)

**The collapse shipped with a defect the gate should have caught, and
the gate missed it for the exact reason it exists.**

Verified on production after deploy: `/king-koil` served **29** products
and the sitemap listed **29** king-koil URLs, against **26** in the
static data. The three unnameable products were still being rendered and
still advertised to crawlers — while `next.config.ts` returned **308**
for those same URLs. A sitemap entry that redirects is a "page with
redirect" in Search Console: precisely the opposite of what the
redirects were added to achieve, on a site already struggling to get
indexed.

**Root cause: the site renders from `catalog_products`, not from
`lib/<partner>-data.ts`.** Migration 0008 moved the read; the static
files are the IMPORT ARTIFACT. Deleting a product from the static file
removes nothing from the live site. The canvas-vows collapse worked on
production only because the 162 DATABASE rows were deleted too — the
file edit was cosmetic.

**`check-merged-slugs.mjs` validated `from` slugs against the static
files, found them absent, and passed.** It was checking intent, not
behaviour — **rule 5f, violated by the gate written hours earlier to
enforce rule 5e.** The second time in two days one of my gates read
source instead of output, and the first time it reached production.

Rewritten to validate against `.next/server/app/sitemap.xml.body`:
every `from` must be ABSENT from the rendered sitemap, every `to` must
be present. Run against the shipped build it **failed on exactly the
three real URLs and nothing else** — a stronger demonstration than any
selftest, because the bug was real and already live.

**Fixed without touching the database**, which matters because deleting
those three rows is not authorized. `app/sitemap.ts` now filters out any
URL present in `lib/merged-slugs.json`. That is the correct behaviour
for ANY future merge, needs no DB change, and cannot drift because it
reads the same map `next.config.ts` does. Sitemap 1,431 → 1,428.

**Still outstanding and deliberately not fixed:** `catalog_products`
holds 29 king-koil rows against 26 in the static data. Three pages are
generated and immediately shadowed by their own redirect — wasteful,
harmless, and awaiting the ruling that authorization explicitly withheld.

**The general lesson, third instance:** *a check is only as good as the
artifact it reads.* Static files, source code and config all describe
intent. The rendered sitemap, the built HTML and the live response
describe behaviour. Every gate in this repo should now name which one it
reads, and it should be the second.

### §51. Nineteen days of price history we already had, and what it actually says (2026-08-20)

**THE FINDING IS NOT "WE FOUND SOME DATA."** `price_history` holds
**18,154 observations from 2026-08-02 to 2026-08-20** — nineteen days,
all seven partners, recorded daily by a job built for exactly this
purpose. We spent three weeks describing the 25 August feed diff as our
*first* measurement of price movement while the answer accumulated every
night in a table nobody queried. The operator found it. Neither of us
looked, and the reason is worth naming: we kept asking "can we measure
movement?" and never asked "are we already measuring it?"

Coverage, measured:

| partner | products | observations | days | first | last |
|---|---|---|---|---|---|
| golden-maple | 348 | 6,612 | 19.0 avg | 08-02 | 08-20 |
| tsar-bomba | 272 | 4,895 | 18.0 | 08-02 | 08-20 |
| canvas-vows | 204 | 3,723 | 18.3 | 08-02 | 08-20 |
| evdance | 72 | 1,368 | 19.0 | 08-02 | 08-20 |
| brooklyn-delhi | 29 | 551 | 19.0 | 08-02 | 08-20 |
| king-koil | 29 | 505 | 17.4 | 08-02 | 08-20 |
| aaawave | 500 | 500 | 1.0 | 08-20 | 08-20 |

brooklyn-delhi is the sharp one: **551 observations of products whose
feed no longer exists (§46).** We cannot refresh the catalog price, but
we have been recording the same price nightly for nineteen days. The
history says, correctly, that nothing has moved — because nothing can.

---

## THE MOVEMENT REPORT — and the headline does not survive contact with provenance

Raw movement reproduces the operator's figures exactly: evdance 26/72
(36.1%), king-koil 6/29 (20.7%), golden-maple 2/348, everyone else zero.
**All movement in nineteen days occurs on FIVE DAYS, and it is
synchronised per partner** — which was the first thing that looked wrong.
Twenty-six products do not independently reprice on the same Monday.

They did not. `price_history.price_source` records how each observation
was obtained, and it **flips from `legacy_pre_provenance` to
`live_override` on exactly 2026-08-17** — the same day as evdance's and
golden-maple's entire movement.

Every change event, classified by whether the SOURCE also changed:

| partner | date | source transition | events | verdict |
|---|---|---|---|---|
| evdance | 08-17 | legacy → **live_override** | 26 | **CONFOUNDED** |
| evdance | 08-18 | live_override → **catalog_fallback** | 8 | **CONFOUNDED** |
| evdance | 08-18 | live_override → live_override | 1 | real |
| golden-maple | 08-17 | legacy → **live_override** | 2 | **CONFOUNDED** |
| king-koil | 08-03 | legacy → legacy | 5 | real |
| king-koil | 08-20 | live_override → live_override | 2 | real |

**36 of 44 change events coincide with a change in how the price was
obtained. Only 8 are observed with the measurement apparatus held
still.**

Stated precisely, because the distinction matters: a source transition
does not *prove* the merchant's price held steady. It means the
observation **cannot distinguish** a merchant repricing from us starting
to read a different number, so it cannot be offered as evidence of
merchant behaviour. Confounded, not disproven.

**So the defensible figure is not 26 of 72. It is 1 of 72.**

| partner | raw movers | movers with the source held constant |
|---|---|---|
| evdance | 26 (36.1%) | **1** |
| king-koil | 6 (20.7%) | **5** |
| golden-maple | 2 | **0** |

This is the §27 defect class pointed at our own analysis: a change in the
measuring apparatus recorded as a change in the world. The most exciting
number in the dataset was an artifact of our own pipeline, and it would
have been the headline.

---

## THE EIGHT REAL OBSERVATIONS

**evdance — one product, and it is a genuine drop.**
EVDANCE Level 2 EV Charger NEMA 14-50 NACS 40A: **$369.95 → $339.95
(−8.1%) on 18 August**, source stable either side.

**king-koil — five products, seven events, and they do NOT move
together.** Five changed on 3 August, but the directions and magnitudes
have nothing in common: −25.0%, −22.2%, −6.7%, +6.3%, **+125.1%**. A
sitewide reprice looks like one number applied to everything; this looks
like a per-variant correction batch on the day after our first
observation.

| variant | date | from | to | % |
|---|---|---|---|---|
| Twin 20" Black | 08-03 | $159.95 | $119.95 | −25.0 |
| Queen 20" Beige | 08-03 | $179.95 | $139.95 | −22.2 |
| *(the unnameable `-5`)* | 08-03 | $149.95 | $139.95 | −6.7 |
| California King 16" Beige | 08-03 | $159.95 | $169.95 | +6.3 |
| California King 20" Beige | 08-03 | $79.95 | $179.95 | **+125.1** |
| Queen 20" Beige | 08-20 | $139.95 | $149.95 | +7.1 |
| Twin 16" Black | 08-20 | $119.95 | $109.95 | −8.3 |

**The +125.1% is almost certainly a correction, not a price rise.**
$79.95 is the Kids-13" price; a California King listed at it on 2 August
and at $179.95 from 3 August reads as a bad row being fixed. Flagged as
suspect rather than reported as a merchant raising a price 125%.

**AND THE TWO MERCHANT DISCREPANCIES FROM §47 ARE EXACTLY THE TWO
20 AUGUST EVENTS.** Reported then as "our catalog disagrees with the
merchant":

| variant | our catalog | merchant (checked by hand) | our own history, 08-20 |
|---|---|---|---|
| Queen 20" Beige | $139.95 | $149.95 | $139.95 → **$149.95** |
| Twin 16" Black | $119.95 | $109.95 | $119.95 → **$109.95** |

**Our price history caught both, on the day they happened, and the
displayed catalog price is what is stale.** The history is not a
prospective asset waiting for enough data — it is already more current
than the page. That is the single most useful sentence in this finding.

---

**THE "OSCILLATION" WAS THE APPARATUS ROUND-TRIPPING, PROVEN.** Nine
evdance products moved on 17 August and moved again on 18 August, and
all nine "ended where they started" — the classic signature of a
promotional price that reverts. It is not that. Measured directly:

- 26 changed on 08-17 (source legacy_pre_provenance -> live_override)
- 9 changed again on 08-18
- **9 of 9 returned to EXACTLY their 16 August price**
- **8 of those 9 did so on a `catalog_fallback` source**

So the sequence is: the pipeline started reading a live price, then fell
back to the catalog price — which is the number it had been reading all
along. A round trip of our own plumbing, indistinguishable from a
merchant running a one-day sale unless you look at `price_source`. Had
this shipped as a chart, we would have drawn nine one-day promotions
that never happened.

## WHAT THIS CHANGES

1. **The 25 August diff is no longer our first measurement.** It is the
   twenty-fourth day of one. It should be interpreted against this
   baseline, not as a starting point.
2. **`price_source` must be carried into any movement claim.** A change
   whose source also changed is not evidence. Any future chart or "price
   dropped" assertion has to filter on source stability or it will ship
   the confound to visitors — which is precisely the sparkline defect of
   §25, one layer deeper.
3. **`feed_last_imported_at` is NULL on every price_history row.** The
   provenance columns from migration 0022 are declared but unpopulated
   here, so feed vintage cannot yet be used to separate "the feed
   refreshed" from "the merchant repriced". That is the next
   instrumentation gap, and it is the one that would settle the 36
   confounded events.
4. **Nineteen days is enough to say something and not enough to say
   much.** Eight real changes across 1,288 products in three weeks. The
   honest summary is that this catalogue is mostly static, that
   king-koil is the only partner with repeated genuine movement, and
   that we now have the instrument to know when that stops being true.

### §50. The collapse: verified against the authority, and blocked by the gate that exists for this (2026-08-20)

**THE VERIFICATION CHANGED THE RULING'S INPUT, WHICH IS WHY IT WAS
ORDERED.** The operator required the mpn decode be confirmed against the
merchant before any enrichment. It was, and by something better than the
three or four spot-checks asked for: every feed row carries a distinct
`?variant=` id on the merchant's own product page, and Shopify publishes
**every** variant name at one endpoint. So all rows were checked, not a
sample.

Result: **21 of 21 decodable rows CONFIRMED, 0 contradicted** — and the
height matched too, which the decode had predicted but nothing had
tested. The merchant declares options `["Color","Size","Height"]` with
titles like `Beige / Twin / 13"`. Critically, **all five rows whose
IMAGE had contradicted the decode were confirmed by the merchant**,
which settles that the image field was the dirty one, exactly as §49
argued but could not prove.

**AND IT OVERTURNED THE PREMISE OF THE DROP INSTRUCTION.** The brief
said to drop the six bare-numeric mpns because "we cannot identify
them". The merchant identifies all six:

| mpn | merchant's own name |
|---|---|
| 29191 | Beige / Twin / 20" |
| 29190 | Beige / Queen / 20" |
| 29192 | Beige / California King / 20" |
| 29171 | Black / Twin / 20" |
| 29170 | Black / Queen / 20" |
| 29172 | Black / California King / 20" |

Every one is a 20" variant — not a guessed "second series", a published
name. Since the instruction's stated reason had evaporated, dropping
them would have deleted six pages we CAN name, on a premise known to be
false. They were kept and named from the authority.

**The real unnameable set is 3, and it is a different 3.** Measured on
OUR catalog rather than the feed: of 29 king-koil products, **26 resolve
to a merchant variant name, in 26 distinct labels with zero
collisions**; 3 do not, because their `aw_product_id` is absent from the
current feed entirely. Those 3 are the drop set.

**Enrichment therefore uses the merchant's words, not our pattern.**
Slugs and titles are built from the merchant's own option values —
`king-koil-luxury-air-mattress-twin-13in-beige` — so the decode ends up
as corroboration rather than as the source of truth. That is a better
outcome than the brief asked for and it costs nothing.

**A CONSEQUENCE THE BRIEF DID NOT COVER: enriching a slug is a URL
change.** Renaming 26 slugs orphans 26 indexed URLs just as surely as
deleting them. The redirect map is therefore **191**, not the 168 the
brief estimated:

| | count |
|---|---|
| king-koil RENAMES (old slug → enriched slug) | 26 |
| king-koil DROPS (unnameable → same-price sibling) | 3 |
| canvas-vows DROPS (duplicate title → lowest-priced row) | 162 |
| **total permanent redirects** | **191** |

Pre-change report, as required: **165 of 165 dropped slugs were present
in the rendered sitemap**, and all 42 canvas-vows survivors are too — so
every redirect lands on a page Google already knows. Map validated
before anything was written: 162 unique sources → 29 distinct survivors,
**no orphans, no chains, no self-redirects, no duplicate sources**, and
the kept-is-lowest invariant holds for all 162. Group sizes 1–10; 13
survivors are singleton titles that were never duplicated.

**canvas-vows collapse:** 204 → 42, keeping the lowest-priced row per
title group, tie-broken on slug so the choice is reproducible rather
than incidental. 204 = 42 + 162 balances exactly.

**The measurement afterwards landed where the operator predicted.**
234 of 1,453 → **14 of 1,288 (1.1%), all tsar-bomba, all $0 spread** —
a de-dup question, not a misleading-price one. aaawave, brooklyn-delhi,
canvas-vows, evdance, golden-maple and king-koil now have zero
duplicate titles.

**A NEW BLOCKING GATE, because a redirect map is exactly the shape that
rots.** `scripts/check-merged-slugs.mjs` (prebuild) re-derives its
validation from the CURRENT data files every build: every `from` must no
longer exist as a product (or the redirect shadows a live page), every
`to` must exist (or we 301 into a 404), no chains, no self-redirects, no
duplicate sources. Proven before trusted: PASS on 191 against 68 live
URLs; `MERGED_SLUGS_SELFTEST=1` exits 1.

---

**THE BUILD IS BLOCKED, AND THE THING BLOCKING IT IS RIGHT.**

`check-compliance-materialization` fails prebuild:

> canvas-vows: 9 stored rows hold the pending placeholder but the
> current registry + static data expect 2.

This is §21 landing on its author. The collapse changed the STATIC data;
`catalog_products` in Supabase still holds the old rows. Measured
directly rather than inferred:

| partner | stored rows | static data now |
|---|---|---|
| canvas-vows | **204** | 42 |
| king-koil | **29** | 26 |

So 165 orphan rows, plus 26 king-koil rows whose slug no longer matches.
Reconciling them is a **database deletion**, which sits on the
NOT-AUTHORIZED list, and the authorization given covered pages and
redirects — it did not mention the mirror. It also touches rows that
`current_prices` reaches through the legacy `products` table (§34), so
it is not a casual delete.

Stopped there and reported. The static-data change, the redirects and
both gates are committed but NOT pushed: shipping a catalog whose mirror
disagrees with it is the defect this project has spent two days
removing, and the gate blocking the build is the same gate written to
prevent exactly this. It did its job on the person who wired it in.


**AMENDED 2026-08-20 after the operator's rulings and §51.**

- **Slugs are NOT renamed.** `catalog_products.id` is
  `partner_id || ':' || slug`, and `price_history` hangs off that id.
  Renaming 26 slugs would have changed 26 primary keys and orphaned
  their history — including five of the six king-koil movers, which
  §51 shows is the only repeated genuine price movement in the entire
  catalogue. The duplicate-content defect was identical TITLES,
  descriptions and categories on 29 pages; ugly-but-stable URLs were
  never the problem. Titles enriched, slugs untouched, and the redirect
  map drops from 191 to **165**.
- **RULING 3, RECORDED AS THE OPERATOR ASKED: their instruction was
  overturned by evidence, and they said so themselves.** The brief said
  to drop the six bare-numeric mpns because "we cannot identify them".
  The verification they ordered showed the merchant names all six.
  Their words: *"your keeping the six bare numerics was right and I was
  wrong… Deleting six nameable pages on a premise your own verification
  had just falsified would have been the error."* The rule that produced
  the good outcome is theirs too — verify against the authority before
  changing anything — and it worked by overturning the person who wrote
  it.
- **The canvas-vows deletion was executed and it was safe, which was
  checked and not assumed.** `price_history` and `current_prices` FK
  against `products`, NOT `catalog_products`, and nothing references
  `catalog_products` at all — so deleting from it cannot cascade. Had
  the FK pointed the other way, `ON DELETE CASCADE` would have silently
  destroyed 3,723 observations. Verified before the delete ran.
- **The 162 rows to delete were derived TWICE, independently.** Once
  from the static data files, once by running the same rule
  (`row_number() over (partition by lower(trim(name)) order by price,
  slug)`) inside Postgres against its own rows. Both produced 42
  survivors and 162 deletions, and the 42 slugs were diffed and are
  IDENTICAL. Executed: canvas-vows 204 → 42. Confirmed after:
  price_history 18,154 unchanged (canvas-vows' 3,723 intact per the
  TB8218 principle), products 1,454 unchanged, current_prices 1,152
  unchanged.
- **26 king-koil titles updated in place, slugs untouched.**
- **king-koil `catalog_products` remains at 29 against 26 in the static
  data** — the 3 unnameable rows were NOT deleted, because the
  authorization was explicitly limited to the 162. Their pages are gone
  and redirected; their rows stay. Recorded as a known, deliberate
  discrepancy rather than silently reconciled.
- Build passes every gate: caps, compliance materialization, merged
  slugs, rendered claims, hand-enumerations. Sitemap 1,597 → 1,431.

### §52. Provenance: what it takes, what is unrecoverable, and the king-koil six reduced to two (2026-08-20)

**THE OPERATOR'S CORRECTION, RECORDED AS THEIRS AND IN THEIR TERMS:**

> I counted distinct prices and announced a strategic conclusion without
> asking how the price was obtained. Second time today I drew a
> conclusion from this table family without interrogating the
> measurement — the compare-at check was the first. Same failure, same
> afternoon.

Both instances are in the ledger under their name: §47 (the tautological
compare-at query) and this one. The pattern connecting them is not
carelessness, it is that **a table of numbers invites you to compute
before you ask what produced the numbers** — and this table family
answers the question the whole product rests on, which makes it the most
tempting place to skip that step.

---

## 1. `feed_last_imported_at` — what it takes

**Does it need a migration? NO.** `price_history` already has `feed_id`,
`feed_last_imported_at` and `feed_last_checked_at` (migration 0015). The
writer, `lib/pricing/snapshotPrices.ts`, sets all three to explicit
NULL, with a comment saying they are "the eventual honest source…
written as explicit NULLs until feed persistence lands". Measured:
**0 of 18,154 rows have any of them populated.**

**Is the value available at write time? NOT TODAY, and the gap is one
step further back than it looks.** The snapshot job reads the static
catalog plus `current_prices` overrides. It never touches AWIN. The
obvious fix — join `feed_status` at write time — does not work yet,
because **`feed_status.feed_last_imported_at` is itself NULL for 4 of 9
feeds, and they are exactly the wrong four**: evdance F1320,
golden-maple F2615, king-koil 101819, tsar-bomba 113495 — every
partner with a *current* feed, which is every partner that could
plausibly move. The three populated ones (canvas-vows 103552,
tsar-bomba 105368, aaawave F2639) are frozen or one-shot.

So the real chain is two links, not one:

1. Something must populate `feed_status.feed_last_imported_at` from the
   AWIN feed list's own "Last Imported" column. That value is available —
   `scripts/_audit-compareat.mjs` reads it today — so this is a small
   scheduled job, not new infrastructure.
2. `snapshotPrices` then joins `feed_status` by partner→feed and writes
   the three columns instead of NULL.

Neither step needs DDL. Step 1 is the one that does not exist.

**Can existing rows be backfilled? NO — and this is the answer worth
having.** `feed_status` is a CURRENT-STATE table: one row per feed, no
temporal dimension, no history. There is no record anywhere of what
`feed_last_imported_at` was on 17 August. Backfilling from `feed_status`
would stamp all 18,154 historical rows with today's value — a
fabrication, and precisely the defect class this project exists to
remove. **The 18,154 existing observations are permanently ambiguous
with respect to feed vintage.**

One narrow exception, offered and then dismissed: for the two feeds
frozen at 2026-05-15 (canvas-vows 103552, tsar-bomba 105368) the vintage
genuinely did not change over the window, so those rows *could* be
stamped honestly. Those are also the two partners with **zero**
movement, so it buys nothing analytically and adds a special case. Not
worth doing.

**So: the first day of trustworthy history is the first snapshot after
step 1 and step 2 both land. Not 08-20. Everything before it is a
record of prices we displayed, not a record of prices merchants set.**
The operator asked to be told this rather than let the record look
continuous. It is not continuous.

---

## 2. THE PROVENANCE CLIFF IS DATED, AND IT IS NOT A COINCIDENCE

`price_source` by first appearance:

| value | rows | window | days |
|---|---|---|---|
| `legacy_pre_provenance` | 14,293 | 08-02 → 08-16 | 15 |
| `catalog_fallback` | 984 | 08-17 → 08-20 | 4 |
| `live_override` | 2,877 | 08-17 → 08-20 | 4 |

**Provenance recording began on 2026-08-17 — the exact day of evdance's
26 "moves" and golden-maple's 2.** Fifteen of nineteen days predate it,
which means for 08-02 → 08-16 we do not merely lack the feed vintage,
**we do not know the price source at all.**

That matters for my own previous correction. I called 8 events
"source-stable". Five of those (king-koil, 08-03) sit inside the
pre-provenance window, where both sides are labelled
`legacy_pre_provenance` — which says *we were not recording*, not *it did
not change*. My classification was too generous to itself.

---

## 3. KING-KOIL, EVERY OBSERVATION — and five of the six do not survive

Full daily series for all six movers, 08-02 → 08-20:

| variant | 08-02 | 08-03 | …through 08-18 | 08-20 |
|---|---|---|---|---|
| Twin 20" Black | 159.95 | **119.95** | flat | 119.95 |
| Queen 20" Beige | 179.95 | **139.95** | flat | **149.95** |
| Cal King 20" Beige | **79.95** | **179.95** | flat | 179.95 |
| Cal King 16" Beige | 159.95 | **169.95** | flat | 169.95 |
| *(deleted `-5`)* | 149.95 | **139.95** | flat | 139.95 |
| Twin 16" Black | *(absent)* | 119.95 | flat | **109.95** |

**Every 08-03 move is a single step off the 08-02 value, followed by
seventeen flat days.** Five products repricing once, simultaneously, on
the second day of observation and never again is not merchant behaviour.

**And the reason is measurable: 08-02 was a PARTIAL snapshot, for
king-koil only.** Rows recorded on the first day: 937 total, of which
**king-koil 12** — against 29 from 08-03 onward. evdance (72) and
golden-maple (348) were complete from day one. So five of the twelve
king-koil products captured on the first run changed on the second run,
a 42% change rate that then falls to zero for seventeen days.

The clincher is the +125%: **Cal King 20" Beige at $79.95 on 08-02.
$79.95 is the Kids-13" price.** A California King was never $79.95. That
is a bad row in a partial first snapshot, not a merchant mispricing —
though it cannot be *proven* either way, because we do not retain the
feed as it stood that day, which is the same gap as §52.1.

**Revised, and this is the honest number:**

| tier | events | what it is |
|---|---|---|
| **Unambiguous** | **3** | provenance-era, source recorded and identical either side |
| Contaminated | 5 | king-koil 08-03 — pre-provenance AND off a 12-of-29 partial first snapshot |
| Confounded | 36 | 08-17/08-18, coincident with the provenance rollout |

**The three that survive everything:**

1. EVDANCE Level 2 EV Charger NEMA 14-50 NACS 40A — **$369.95 → $339.95
   (−8.1%), 18 August**
2. King Koil Queen 20" Beige — **$139.95 → $149.95 (+7.1%), 20 August**
3. King Koil Twin 16" Black — **$119.95 → $109.95 (−8.3%), 20 August**

**Two of the three are independently corroborated.** The king-koil pair
are the same two discrepancies found by hand against the merchant's
storefront in §47, and the merchant's live variant prices are **$149.95**
and **$109.95** — matching our history exactly, against a catalog page
still showing the old number.

So: three unambiguous price movements, in nineteen days, across 1,288
products. That is the real evidence base, and it is thin — but two of the
three are corroborated by an independent source, which is more than the
36 can say.

**A useful counter-observation, because it cuts the other way.** The
deleted `-5` row flipped `live_override → catalog_fallback` on 18 August
**with no price change at all**. So a source flip does not automatically
move the recorded price — which means the 36 confounded events were not
inevitable artifacts of the rollout. They are genuine differences
between the override value and the catalog value, surfacing on the day
we started applying one. That is still not merchant movement, but it is
not noise either: it is a measurement of how far our catalog had drifted
from `current_prices`.

---

## 4. IS THE 25 AUGUST DIFF STILL THE RIGHT INSTRUMENT? NO — AND RUNNING IT AS PLANNED WOULD WASTE IT

The single-day diff was designed for a world where we believed we had no
history. We have nineteen days. Three things follow:

**(a) For the NEW partners (Alorair, Vevor) the diff is still exactly
right.** We have no history for them at all, so a first-import diff is
the only instrument available and its purpose is unchanged.

**(b) For the SEVEN EXISTING partners it is now the weaker instrument.**
A one-day delta cannot distinguish a merchant reprice from a feed
refresh from a source flip — the three failure modes this session
found — whereas a 24-day series with `price_source` can at least
separate the third. Running a bare diff on the 25th produces one more
ambiguous data point and invites exactly the conclusion the operator
just retracted.

**(c) The sequencing matters more than the instrument.** If the
provenance work from §52.1 lands between now and the 25th, it will
create **a second cliff**: a new `price_source` value, or feed columns
going from NULL to populated, on whatever day it ships. Any diff
straddling that date is confounded by construction — the same trap as
08-17, walked into with full knowledge.

**What to run on the 25th instead:**

1. **Land §52.1 first, or explicitly after the 25th — not across it.**
   This is the actual recommendation. If it lands before, the 25th is
   the first interpretable day and worth marking. If it cannot, freeze
   the pipeline through the 25th so the diff measures merchants rather
   than us.
2. **Replace the single-day diff with a windowed movement report** for
   existing partners: per product, the full series, every change
   annotated with whether `price_source` held constant, and a headline
   that counts ONLY source-stable changes. That is this section's query
   set, parameterised — a few hours, not new infrastructure.
3. **Keep the acquisition diff for Alorair and Vevor**, unchanged, and
   report it separately so a new-partner import is never averaged in with
   an existing-partner series.
4. **Add one control that does not exist today: a per-day row-count
   check per partner.** The king-koil 12-of-29 partial snapshot went
   unnoticed for nineteen days and produced five false "price changes".
   A one-line assertion — every partner's row count is constant
   day-to-day, or the day is flagged — would have caught it on 3 August.

---

## 5. UNGATING `withLivePrice` — SCOPE ONLY, NOT AUTHORIZED, NOT BUILT

**What exists.** `withLivePrice(product)` and
`getAllRealProductsWithLivePrices()` are written, working, and already in
production use — by `checkPriceDrops` (alerts) and by `snapshotPrices`
(the history). Both apply a **read-side TTL**: an override whose
`updated_at` is older than the freshness cutoff is NOT applied and the
product falls back to its catalog price. So the "uncorroborated old
observation presented as live" failure is already designed out.

**What ungating means, concretely.** Nothing is gated by a flag — the
functions are simply not called from any render path. Grep confirms zero
usages in `app/` or `components/`. Ungating = having the catalog read
path (`lib/catalog.ts`) merge overrides the same way the alert path
already does.

**What would change on the page.**
- Product cards and detail pages would show the `current_prices` value
  where one exists and is fresh, instead of the catalog value. Measured
  scope: **1,152 override rows against 1,288 products (89%)**.
- The two king-koil discrepancies would disappear on the spot — the page
  would show $149.95 and $109.95, matching the merchant.
- The as-of stamp becomes **wrong for those products**. It currently says
  "Price as of <feed vintage>", which is true of a catalog price and
  false of a live-override price whose real timestamp is
  `current_prices.updated_at`. This is the biggest single consequence and
  it is a claims problem, not a rendering one: shipping live prices under
  a feed-vintage stamp would be a §27 defect on 89% of the catalogue.
- `/deals` and any markdown surface would recompute against the live
  price, so the set of products showing a markdown could change.

**What could go wrong.**
1. **The as-of label silently lies** (above). Any ungating must ship
   *with* a per-source label, not after it.
2. **`updated_at` is set on INSERT only** — the writer's own comment says
   the upsert's ON CONFLICT path does not touch it. So the TTL can
   expire a row whose price was re-confirmed today, dropping a good
   override. The TTL is protective but its input is understated.
3. **Static-generation cost.** The catalog read path is used at build
   time for ~1,288 product pages; adding an override fetch is one query
   if batched through `getAllRealProductsWithLivePrices()`, and 1,288 if
   someone reaches for `withLivePrice()` per page. The batch function
   exists precisely for this and its header says so.
4. **Price displayed ≠ price snapshotted** would end, which is good, but
   it means `catalog_price_at_snapshot` becomes the only remaining record
   of what the page used to show.
5. **136 products have no override row** (1,288 − 1,152), so the page
   would mix live and catalog prices with no visible distinction unless
   the label distinguishes them.

**My assessment, unrequested but relevant:** the blocker is not the
plumbing, which is done and already trusted for alerts. It is that
ungating without a source-aware as-of label converts a working honesty
mechanism into a false one on most of the catalogue. Those two changes
are one change.

### §53. Provenance landed. 2026-08-21 is day one of trustworthy history (2026-08-21)

**THE SENTENCE THAT MUST TRAVEL WITH THE NUMBER, at the operator's
instruction, because the wrong reading is the easy one:**

> **Three unambiguous changes in nineteen days is NOT evidence that our
> merchants do not reprice. It is evidence that our instrument could not
> distinguish repricing from its own behaviour.**

Anyone who reads "3 in 19 days" without that attached will conclude the
catalogue is static and act on it. The correct conclusion is narrower and
duller: for sixteen of nineteen days we recorded prices without recording
where they came from, so most of what looks like movement is
unattributable in either direction. Absence of measurable movement is not
measured absence of movement.

---

## The 08-02 contamination has a documented cause, found in git

§52 called the king-koil 08-03 cohort a first-run artifact from a partial
snapshot. The actual mechanism is stronger and is in the history:

**commit `87877a2`, 2026-08-02 — "Refresh King Koil and Tsar Bomba
catalogs from fresh AWIN feeds"** — 38 price lines changed, the file
going from 31 products to 29.

So the five "price changes" on 08-03 are **our own catalog re-import**,
landing the same day as the first snapshot. The 08-02 job caught 12 rows
of a catalog mid-refresh; 08-03 caught the refreshed state. The +125%
row's 08-02 value of $79.95 came from the pre-refresh catalog. Confirmed
a data error by operator ruling, and **not to be reported as movement
anywhere.**

## A SECOND partial day, worse, and nobody knew

Looking for the first, the assertion's own logic surfaced another:

| date | rows | shape |
|---|---|---|
| 2026-08-18 | 954 | complete |
| **2026-08-19** | **500** | brooklyn-delhi 29, canvas-vows **51 of 204**, evdance 72, golden-maple 348. **king-koil and tsar-bomba absent entirely.** |
| 2026-08-20 | 1,453 | complete |

29 + 51 + 72 + 348 = **exactly 500**, which is `BATCH_SIZE`. The first
batch landed and every subsequent batch failed. **953 of 1,453
observations were lost on 19 August** and the only signal was a missed
dead-man's-switch ping, because the route returned HTTP 200 with the
errors buried in the response body.

Two partial days in nineteen. Neither noticed at the time. This is what
the operator's assertion was ordered for, and it found its second case
before it was even deployed.

---

## WHAT WAS BUILT

**1. `scripts/sync-feed-status.mjs` — the link that never existed.**
Reads AWIN's feed list and writes `feed_last_imported_at`,
`feed_last_checked_at` and `feed_status_read_at` into `feed_status`.
Run: 956 feeds read, **8 of 9 rows written**, 1 skipped (the
`none:brooklyn-delhi` sentinel, which legitimately has no feed).

The four that were NULL — the four current feeds, the only ones that
could move — now carry a vintage:

| partner | feed | was | now |
|---|---|---|---|
| king-koil | 101819 | NULL | **2026-08-20T12:14:36Z** |
| tsar-bomba | 113495 | NULL | 2026-08-12T06:45:42Z |
| golden-maple | F2615 | NULL | 2026-08-21T01:46:40Z |
| evdance | F1320 | NULL | 2026-08-21T01:50:13Z |

**king-koil's feed refreshed at 12:14Z on 20 August — which is exactly
when the two corroborated king-koil moves appeared.** That is not a
confound, it is the mechanism: a feed refresh is how a merchant's new
price reaches us. We now record it, so next time the explanation is in
the row rather than reconstructed two days later.

**2. `snapshotPrices` stamps every row.** `feed_id`,
`feed_last_imported_at` and `feed_last_checked_at` are resolved per
product via a new `getSourceFeedStatusId()` in `lib/price-as-of.ts`,
which reuses the existing tsar-bomba two-feed split rather than
re-deriving it. **NULL now means "we do not know which feed or when" —
never "the feed did not refresh."** Absence of a record is not a record
of absence.

Verified before writing, by dry run: 1,288 rows, **every row carries a
feed_id**, 1,259 carry a vintage, and the 29 without are brooklyn-delhi,
correctly, because it has no feed. Then run for real:

| date | rows | with feed_id | with vintage | distinct feeds |
|---|---|---|---|---|
| 2026-08-19 | 500 | 0 | 0 | 0 |
| 2026-08-20 | 1,453 | 0 | 0 | 0 |
| **2026-08-21** | **1,288** | **1,288** | **1,259** | **8** |

**3. The per-partner row-count assertion, at TWO severities — and the
split is a correction I made to my own first design.**

My first version failed the cron on *any* population change. That would
have returned 500 on every legitimate import day, and an alarm that
fires on normal operation is an alarm someone turns off. Split instead:

- **FATAL** — a partner's row count is short of what the catalog holds.
  That is a partial snapshot and is always a defect. The route now
  returns **500** and skips the dead-man's-switch ping. This is the
  08-02 and 08-19 failure shape.
- **SURFACED, NOT FATAL** — the count moved against yesterday. A real
  import does this. Reported in the response and consumed by the
  movement report, which must not attribute movement to merchants across
  a boundary where the population changed.

Both behaved correctly on their first real run. Today's snapshot had
**no fatal failures**, and surfaced exactly the two population changes
the collapse caused: canvas-vows 204→42 and king-koil 29→26.

The two new `feed_status` reads were caught by the caps gate as
unbounded and are registered with the bound named (one row per tracked
feed, 9 today, watched on the whole table). Rule 8 working on the person
adding the read.

---

## BACKFILL: A PROPERTY, NOT A REGRET

Stated as the operator asked, as a fact about the data rather than an
apology:

**`feed_status` is current-state. One row per feed, no temporal
dimension. Nothing anywhere recorded its value on any past day.**
Stamping the 18,154 existing `price_history` rows from today's value
would fabricate a measurement — inventing a vintage for an observation
whose vintage was never captured. **Those rows are permanently ambiguous
on feed vintage.** 15 of the 19 days also predate `price_source`
entirely, so for those we do not know the source either.

**The first day of trustworthy history is 2026-08-21.** Everything
before it is a record of prices we displayed, not a record of prices
merchants set.

*(Note on dates: this session's stated date was 2026-08-20, but real UTC
rolled over during the work — the snapshot above is stamped 08-21 and
the clock read 02:22Z. The 23 August deadline is therefore two days out,
not three.)*

---

## SEQUENCING: LANDED, AND IT DOES NOT STRADDLE THE 25th

The hard rule was: land by end of 23 August or freeze until after the
25th, and do not split the difference. **It is landed on 21 August** —
both links, plus the assertion. The 25th is now clean: the provenance
cliff is at 08-21, four days before, so a diff run on the 25th sits
entirely inside the instrumented era.

### §54. Live prices: built, flagged off, and the label caught the trap mid-build (2026-08-21)

**Operator ruling:** build it behind a flag, do not ship it, bring the
exact per-source label wording for approval before anything renders.
Their reasoning, which is the ruling: *the label and the price are one
change, not two.*

**Built.** `lib/pricing/applyLivePrices.ts` merges `current_prices` into
the catalog when `LIVE_PRICES=1`, setting `priceSource` and
`priceObservedAt` on each product. Applied in `fetchCatalog()` — the
UNCACHED wrapper — deliberately, because merging inside
`unstable_cache(..., { revalidate: false })` would freeze the live price
at cache fill, which is the opposite of live.

**THE TRAP SPRANG DURING THE BUILD, WHICH IS THE FINDING.** First
flagged build: the PRICE changed on the page ($139.95 → $149.95,
resolving the king-koil discrepancy) while the label still read "Price as
of <feed vintage>" — **0 live stamps, 260 catalog stamps.** I had added
the props and not wired the seven call sites, so the flag reproduced
precisely the defect it exists to prevent, at full scale, in my own
build. Fixed by extracting `resolveAsOfStamp()` as the ONE place that
decides, used by both the detail page and the grid card. Re-verified:
260 live stamps, 0 catalog stamps.

**Verified in both directions, because a flag nobody has switched is a
claim:**

| | price shown | stamp |
|---|---|---|
| `LIVE_PRICES` unset (shipped) | $139.95 (stale) | "Price as of…" ×260, live ×0 |
| `LIVE_PRICES=1` | **$149.95** (matches merchant) | "Price checked…" ×260, catalog ×0 |

**PROPOSED WORDING — NOT APPROVED, NOT REACHABLE.** In code as
`PROPOSED_LIVE_LABEL`, only reachable when the flag is on, which it is
nowhere:

- **Catalog price** — `"Price as of {feed vintage}"`. Unchanged and
  already approved. True: it describes when that feed's data was current.
- **Live price** — proposed `"Price checked {observed date}"`. The date
  is `current_prices.updated_at`, a real observation made when the
  refresh job read the merchant's feed. "Checked" was deliberately
  REJECTED for the catalog case in §45 because a feed vintage is not a
  check — but here it is one, and "as of" would understate what we know.
  Alternatives for the operator: "Price observed {date}", "Last checked
  {date}", or keeping "Price as of {date}" against the observation date.

**A CONSTRAINT BIGGER THAN THE LABEL, found while building.** Partner and
product pages are statically generated. A live price merged at build time
is frozen in the emitted HTML until the next build, so **ungating alone
buys build-frequency freshness, not live freshness.** ISR (`revalidate`)
or a dynamic segment is a separate decision layered on top. Also: when
enabled this adds one Supabase round trip per `fetchCatalog()` call, and
`fetchCatalog` runs concurrently at build time —
`scripts/check-build-queries.mjs` must be re-run as part of any enabling.

### §55. One label, and the real blocker is a column on current_prices (2026-08-21)

**OPERATOR RULING, and it is better than what I proposed.** One sentence
for both sources — **"Price as of {date}"** — where the date is always
the FEED VINTAGE behind that price, never our read time. What changes
between a catalog price and a live one is which date fills the slot, not
what the sentence claims.

My proposed "Price checked {date}" is rejected, and the reasoning is
worth keeping because it inverts the original defect: `updated_at`
records when WE read the feed. **A price read on the 20th from a feed
exported on the 14th is a 14th-of-August price.** "Price checked 20
August" would overstate freshness by six days — the catalog
overstatement turned inside out. I had reasoned that "as of" would
UNDERSTATE what we know; the correction is that what we know is the
vintage, not the read.

**It also disposes of the static-generation worry from §54 without any
work.** Because the label names a DATE rather than claiming currency, a
stale build degrades honestly on its own: a date four days old simply
reads as four days old. There is nothing to fix.

---

## THE BLOCKER, measured

**`current_prices` carries no feed vintage.** Its columns are
`product_id, retailer, price, original_price, source, updated_at`. So we
cannot name the date a live price is as of, and that — not the wording,
not the caching — is what keeps the flag off.

**Is the value available at write time? YES, and it is already in hand.**
`lib/pricing/refreshPrices.ts` fetches the AWIN feed list
(`fetchFeedList`) and reads `feed_status` to choose feeds per partner. It
downloads each feed from a feed-list row that carries that feed's own
"Last Imported". It simply does not persist it.

**Does it need a column? YES — and therefore a migration, so the
second-reader rule applies (standing rule 1).** Proposed, for review
rather than applied: add `feed_id text` and `feed_last_imported_at
timestamptz` to `public.current_prices`. `refreshPrices` then sets both
on the upsert, from the feed-list row it already holds for that partner.
Mirrors `price_history` exactly, which is the point: two tables
describing the same observation should describe it the same way.

**Is the past recoverable? THE QUESTION BARELY APPLIES, and this is the
good news.** `refresh_runs` logs `feed_id` and `feed_rows` per partner
per run — the 2026-08-20 11:00:06Z run is fully logged — but **no
vintage**, so the value behind existing rows is not reconstructable.

But unlike `price_history`, **`current_prices` is a CURRENT-STATE table
with no history to lose.** Every row is overwritten by the next refresh.
So there is no permanent ambiguity here and no backfill to argue about:
once the column exists and the writer sets it, **every live price
carries a correct vintage after the next 11:00Z run.** The gap is one
refresh, not nineteen days.

**Interim behaviour, built and verified:** with `LIVE_PRICES=1` the live
price applies ($139.95 to $149.95, the king-koil discrepancy resolving)
and **zero stamps render**, because `resolveAsOfStamp` refuses to name a
date it does not have. It deliberately does NOT fall back to the catalog
vintage, which would be wrong in the other direction — that date
describes the import, not this number. The failure mode is *no claim*,
never a wrong one, and it is visible in the build output rather than
hidden.

---

### §55b. Our daily history has been silently lossy for its entire existence

Recorded at the operator's instruction, because the implication is larger
than either incident.

| date | rows | what happened |
|---|---|---|
| 2026-08-02 | 937 | king-koil 12 of 29 — caught mid catalog re-import (`87877a2`) |
| 2026-08-19 | 500 | **exactly one BATCH_SIZE.** king-koil and tsar-bomba absent entirely; canvas-vows 51 of 204. **953 of 1,453 observations lost.** |

**Two partial days in nineteen. Neither detected at the time.** The only
signal 08-19 produced was a missed dead-man's-switch ping that nobody
chased, because the route returned HTTP 200 with the errors buried in the
response body — a success status on a run that lost two thirds of its
work.

The implication, stated plainly: **the daily price history has been
lossy since the day it started, and we had no instrument capable of
telling us.** Every conclusion drawn from it before 2026-08-21 inherits
that. The second partial day was found only because an assertion was
being built for the first — which means the true rate of loss over
nineteen days is a lower bound, not a count.

### §55c. STANDING RULE — an alarm that fires during normal operation is worse than no alarm

My first design for the row-count assertion failed the cron on ANY
per-partner population change. It would have returned HTTP 500 on every
legitimate import day. I caught it before it shipped and split the
severities — FATAL for a partial snapshot, SURFACED for a population
move — but the rule generalises and belongs in the ledger on its own:

**An alarm that fires during normal operation gets muted, and a muted
alarm is worse than none — it converts an absent signal into a false
sense of coverage.** This is the failure mode that kills monitoring
systems everywhere, and it is the same shape as §19: a check whose output
carries no information still looks like a check.

The corollary for design: before adding an alarm, name the normal
operations that will trip it. If the list is non-empty, the alarm is
mis-specified, not the operations.

### §57. Migration drift: recovered exactly, and the gate that was designed six days ago and never built (2026-08-21)

**THE DRIFT IS BIGGER THAN EIGHT, IN BOTH DIRECTIONS.** The repo held 14
files; the database has **23** applied. The gap is not 0015–0022:

| | count | |
|---|---|---|
| applied with no repo file | **12** | 0015–0023 (9) **plus three nobody had noticed** |
| repo files with no applied record | **3** | 0001–0003, which predate migration tracking |

The three unnoticed ones — `add_current_prices_fk`,
`add_affiliate_clicks_click_id_default`, `add_migration_auditor_role` —
were applied between numbered migrations and never named in any
handover. A count-based comparison would have found 14 ≠ 23 and told you
nothing about which, or that three of the files are legitimately
unmatched.

---

## RECOVERY: the answer to the recommendation is "recover", decisively

`supabase_migrations.schema_migrations` has a **`statements` array that
retains the full applied text, comments included** — verified on every
row, 96 to 4,836 bytes each. So recovery is not a reconstruction: it is
the exact text that ran. Regenerating DDL from the live schema would
produce a file that yields the same schema while discarding every
comment and every stated reason, which on this project is most of the
value — migration 0015's comment alone explains why its columns are
nullable and what `legacy_pre_provenance` means.

**RECOVERED AND HASH-VERIFIED, five files:**

| file | bytes | md5 verified against DB |
|---|---|---|
| `0015_price_history_provenance.sql` | 3,720 | `827b1b58…` ✓ |
| `0016_feed_status.sql` | 2,791 | `fdf6c718…` ✓ |
| `0006a_add_current_prices_fk.sql` | 159 | `60c6fee1…` ✓ |
| `0011a_add_affiliate_clicks_click_id_default.sql` | 96 | `39c6cfbb…` ✓ |
| `0014a_add_migration_auditor_role.sql` | 914 | `86d3325c…` ✓ |

**Method, because it matters more than the result.** The defect being
repaired is that the repo does not match the database; retyping SQL out
of a query result re-introduces exactly that divergence at a smaller
scale, and one mistyped character in a migration is invisible until
someone rebuilds. So the text was emitted from Postgres as base64,
decoded to disk mechanically, and each file's md5 compared against a
hash **computed by the database**. Not "transcribed carefully" —
verified byte-identical.

The `a`-suffix names (`0006a`, `0011a`, `0014a`) place the three
unnumbered migrations in their real applied order without renumbering
anything that already exists.

**WHAT WAS DELIBERATELY NOT RECOVERED, and why.** 0017–0023 are still
missing, and I could have taken them from the database in one command.
I did not:

- 0017, 0018, 0019, 0020 retain their authored headers — recovery would
  be lossless for these four.
- **0021, 0022 and 0023 are DDL ONLY.** 0023 proves the gap exactly: the
  authored file is 3,359 bytes, the applied statements are **497**. The
  entire reasoning header — the render contract, the NULL semantics, the
  no-backfill argument — was never applied and is not in the database.

Committing DDL-only versions would turn the gate green while leaving the
repo poorer than the artifacts that exist, and a green gate removes the
pressure to commit the real files. That is rule 5g wearing a different
costume: **do not silence an alarm with an inferior artifact.** The
operator holds these files; they are the better source.

---

## THE GATE

**`scripts/check-migration-drift.mjs`, wired into `prebuild`. It fails
today, by design** — the repo genuinely cannot rebuild the schema, which
is the condition the gate exists to surface. It names all seven missing
files and the recovery command.

**IDENTITIES, NOT COUNTS — a deliberate deviation from the brief.** A
count check is weaker twice over: it passes if someone commits a file
with the wrong name, and it would fail *forever* here for a legitimate
reason, since 0001–0003 predate tracking and can never have an applied
record. The gate matches normalized names (both `0015_x` and bare `x`
conventions are present in the data) and carries the three baseline
files in an explicit `PRE_TRACKING_BASELINE` map with reasons.

**THE CHECK IS SPLIT, AND THE HALVES COMPOSE.** `supabase_migrations` is
not exposed through PostgREST and the build has no direct Postgres
connection, so a build-time gate cannot query the database:

- **this gate**, every build, no credential: *files == manifest*
- **CI**, with the auditor credential: *manifest == database*

Together: files == database. Running only the first half is circular — a
manifest never re-derived from the database drifts with the directory it
describes — and the failure message says so rather than leaving the next
reader to discover it.

**AND THE CI HALF WAS ALREADY DESIGNED, SIX DAYS AGO.** The recovered
`0014a_add_migration_auditor_role.sql` creates a least-privilege
`migration_auditor` role, granted SELECT on exactly
`supabase_migrations.schema_migrations` and revoked from everything else,
with a header that says it is "for the CI migration-history check" and
that its password is set by a human and held in GitHub Actions secrets,
never read by an AI session. **The role exists. The check was never
built.** So the credential path for the CI half is already in place and
was deliberately designed to be unavailable to sessions like this one —
which is why this half stops at the manifest.

---

### §57b. STANDING RULE — the tool that applies a migration must also write it

Recorded as a process failure rather than a fix, at the operator's
instruction.

Applying DDL through the MCP tool is convenient and **silently skips the
step that writes the file.** Nothing failed, nothing warned, and the
divergence accumulated across twelve migrations and three weeks. The
convenience is precisely the hazard: a workflow that succeeds while
leaving half the work undone will be repeated, because it feels finished.

**The rule: a migration lands in the repo FIRST and is applied SECOND —
or the tool that applies it also writes it. Never applied-only.**

The general form, which is the same shape as §48 and §50b: **when one
action has two halves and only one of them is enforced by a tool, the
unenforced half is optional in practice no matter what the process
document says.** The fix is never "remember"; it is to make the enforced
half fail without the other.

### §58. The seven files, the CI half, and what a six-day gap actually means (2026-08-21)

**ALL SEVEN VERIFIED, TWO WAYS.** Hashes and byte counts match the
operator's manifest on six of seven; 0020's stated suffix differs by one
character (`a80e711` vs the file's `b80e711`) while its prefix and byte
count match exactly — a typo in the message, not a wrong file, and the
SQL comparison settles it independently.

**Executable SQL compared against what the database actually applied,
per instruction: IDENTICAL on all seven.** Comments differ by design;
not one statement does.

| migration | normalized SQL |
|---|---|
| 0017_refresh_runs | 890 chars, identical |
| 0018_catalog_products_gtin | 281, identical |
| 0019_retailer_enum_aaawave | 61, identical |
| 0020_partners_aaawave | 194, identical |
| 0021_feed_status_aaawave | 708, identical |
| 0022_refresh_runs_gtin_counters | 195, identical |
| 0023_current_prices_feed_provenance | 487, identical |

The comparison could not use a line-based `--` filter: **0023's own
column comment contains the string "-- never fall back to the catalog
vintage" inside a quoted literal**, and a naive stripper would truncate
that statement and then report a mismatch it had caused itself. The
stripper respects single-quoted strings with `''` escaping and `$$`
dollar-quoting (0014a uses a `DO $$` block).

**Gate green on identity: 26 files against 23 applied, 3 pre-tracking
baseline files excused.** Selftest still exits 1. Full build passes every
gate — caps, compliance materialization, migration drift, rendered
claims, hand-enumerations, merged slugs.

**One thing deleted rather than registered.** The caps gate flagged
`scripts/_recover-migrations.mjs` as a new unbounded read. That script
never worked — PostgREST does not expose `supabase_migrations`, so it
failed on every invocation — and registering it would have preserved a
false promise in the failure message of another gate. Deleted, and the
drift gate's recovery guidance now describes the method that actually
worked: privileged query → base64 → decode → md5 verified against a hash
computed by the database. With the caveat that some migrations retain
only their DDL, so **the authored file is preferred where one exists.**

---

## THE ORPHANS ARE GONE, AND THE NUMBER IS NOW HONEST

162 orphaned canvas-vows rows deleted from `current_prices`, on a
**derived predicate** — `left join catalog_products … where c.id is
null` — rather than a hardcoded list, so the delete could not select a
row the reasoning did not cover. Verified before running: exactly 162,
zero still in the catalog, zero carrying a vintage.

| | before | after |
|---|---|---|
| current_prices | 1,152 | **990** |
| with a vintage | 988 | **988** |
| without | 164 | **2** |

`products` 1,454 and `price_history` untouched. The two remaining are
golden-maple products today's feed did not match, and NULL there means
exactly what the column was added to mean: **we do not know.**

---

## THE CI HALF EXISTS NOW

`scripts/check-migration-manifest.mjs`, wired into `.github/workflows/
verify.yml` ahead of Build, using the `migration_auditor` role.

- build: *files == manifest*
- CI: *manifest == database*
- together: **the repo can rebuild the schema** — which neither half
  proves alone, and which is the property actually wanted.

**A missing credential FAILS, it does not skip.** If
`MIGRATION_AUDITOR_URL` is unset the script exits 2 and says why. A check
that passes when it cannot run reports coverage it does not have — §19,
and rule 5g.

**Its selftest caught my own wrong expectation.** I asserted the fixture
would produce two failures; it produced one, because the fixture I wrote
was internally consistent so the count check correctly stayed silent. The
selftest failed itself before the code could be trusted. Rewritten with a
fixture that triggers all four failure modes exactly once, so the
expected number is derived from the cases rather than guessed.

---

### §58b. Preparation leaves traces that look like completion

The operator's framing, and it is sharper than rule 5h as written.

The `migration_auditor` role was created on **15 August** — a
least-privilege role, `SELECT` granted on exactly one table, every other
privilege explicitly revoked, with a header stating it is "for the CI
migration-history check" and that its password is human-set and held in
Actions secrets. Someone did the **harder** part: reasoning about
privilege, scoping a grant, thinking about who may read what. Then the
easier part — writing the check — was never done, and **six days later
nobody knew.**

This is not carelessness. It is a specific and dangerous shape:

> **Preparation leaves traces that look like completion.**

A provisioned role, a created column, a declared type, an added
dependency — each is real work that shows up in the repo and in the
schema, and each *reads* as though the thing it enables exists. The
artifacts of preparing are indistinguishable, to a later reader, from the
artifacts of finishing. Migration 0015 has the same shape: it added
`feed_id` and `feed_last_imported_at` to `price_history` on 17 August
with the comment "Inert until 4.1-4.3 ship" — and they stayed inert and
NULL for four days while we drew conclusions from that table.

**The general rule: an artifact that ENABLES a capability must not be
mistaken for the capability.** The only reliable distinction is a check
that fails while the capability is absent — which is precisely what was
missing in both cases, and what now exists for both.
