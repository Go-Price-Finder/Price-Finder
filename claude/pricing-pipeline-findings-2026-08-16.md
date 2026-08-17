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
sentence (see Section 7). Established with a read-only probe of AWIN's
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
en-dashes vs sentence-names) — the same lesson as Section 7, applied to
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

## 7. Process finding: prose written from the conclusion, not from the table

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
