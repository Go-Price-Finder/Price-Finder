# Partner sourcing — four networks, two gates (2026-08-18)

## THE AAAWAVE CLUSTER: is comparison reachable TODAY? (2026-08-19) — YES, via antonline

**The question:** aaawave is already approved (AWIN, 1,683 products,
91% GTIN); its inventory lands in a CJ cluster. Which cluster members
are plausibly accessible at 227 visitors/month? Measured on a 120-GTIN
aaawave sample (68/120 = 57% exist on CJ at all):

| CJ merchant | overlap depth (of 120) | rank | comm | US-serviceable | verdict |
|---|---|---|---|---|---|
| UnbeatableSale.com | 37 | UNKNOWN (keyword lookup doesn't return its record) | ? | yes | possible — bar unmeasurable via API |
| **antonline** | **33** | **2** | 1.5% | yes | **THE candidate — accessible reseller (66 brands/100 rows, 25,572 products)** |
| Alza.at / Alza.de | 27 / 26 | 0 | 1.5% | no (EU) | geography, not bar |
| Zoro | 23 | 5 | 4% | yes | gated (wait list ~5k/mo) |
| OnBuy.com | 22 | 5 | 1% | no (UK) | out |
| WD Europe | 15 | 0 | 5% | no (EU) | out |
| Office Depot | 9 | 5 | 0.5% | yes | gated + thin |

**Answer: antonline (CJ 6217498, rank 2) + already-held aaawave =
genuine multi-retailer price comparison on ~28% of aaawave's sampled
GTIN inventory (33/120), TODAY, with a single application.** The first
time this site could do the thing it is named after. UnbeatableSale
(deepest at 37) is the possible second — its approval bar is not
exposed via the API and needs application-time reading.

## THE THIRD AXIS, MEASURED: own-brand vs reseller (2026-08-19)

Distinct `brand` values per 100-row CJ feed sample:

- **RESELLERS (comparison-capable):** antonline 66, Full Compass 71,
  Sonic Electronix 46, Zoro 26, Wayfair 47, Mattress Firm 17.
- **OWN-BRAND (pages, never comparison):** SVS 1, Audioengine 1,
  Worx 1, Bluetti 1, Vevor-on-CJ 1, OM SYSTEM 2 (olympus/om system),
  **Monoprice 2 — a surprise: house-brand, NOT the reseller its name
  suggests.** EcoFlow 6 (mostly-own).
- AWIN Tier-1 shortlist (BedJet, KEETSA, Big Fig, Mellow Sleep, GARVEE,
  Erommy, Kingbull, Troxus, Addmotor, Cyrusher): own-brand by
  inspection (each sells only its own label) — the sixth-instance
  finding; see findings §13.

**Re-sweep verdict, re-classified on the third axis:** the accessible
AV tier splits — Full Compass (r2) and Sonic Electronix (r2) are
accessible RESELLERS (comparison-capable); SVS/Audioengine/Monoprice
are own-brand (pages only). Cameras: OM SYSTEM is own-brand — the CJ
camera cell is empty for comparison, not just thin. Power tools:
Worx/EcoFlow/Bluetti own-brand; the comparison-capable names (Zoro,
Global Equipment, MSC) are all gated — tools comparison waits on
traffic, or on antonline's tools slice.

## GTIN COVERAGE, AWIN SIDE — and the measured AWIN↔CJ join (2026-08-19)

**Question:** does adding GTIN to catalog_products join AWIN to CJ, or
is it pure schema cost? Measured across 29 fresh feed pulls (23 shelf
baselined feeds + 6 catalog-partner feeds — one gone from the list),
then the join itself tested by querying AWIN GTINs against CJ's
network-wide product API.

**Coverage is bimodal.** High: Sparkle 100%, Tennis Express 99% (49,325
of 49,782!), evdance 97%, aaawave 91%, Kings Camo 72%, Autel 56%, FED
Fitness 47%. Zero or near-zero: **Vevor 0% (no identifier column at
all — the biggest volatile shelf feed cannot join)**, Creality ~0%,
Oedro/Ottocast/Nextrition/Ravin/Feinuote/FENRIR/Freshine 0%, Valerion
1%, XGIMI 7%. Current catalog partners: canvas-vows 0%, tsar-bomba 0%
(both feeds), golden-maple 0%, king-koil 22% — **only evdance (97%)
carries GTIN among today's six.**

**The join test (15 sampled GTINs per merchant, one CJ query each):**
- **aaawave: 15/15 (100%) found on CJ** — carriers WD Europe,
  antonline, UnbeatableSale, Alza, OnBuy. Branded PC-components
  inventory joins the networks perfectly.
- evdance: 0/15. Autel: 0/15 — own-brand DTC goods; GTINs populated
  but nobody else carries the products.
- Tennis Express: 1/15 (Holabird Sports) — branded but thin overlap.

**VERDICT, stated plainly: neither fantasy nor free.** The AWIN↔CJ
GTIN join is real and measured — but only for BRANDED multi-retailer
inventory. It is dead for DTC own-brand merchants, which is most of the
current catalogue (evdance's 97% GTIN coverage joins to nothing because
only evdance sells evdance). The schema column is worth adding IF and
only if the catalogue expands toward branded goods (aaawave is the
proof case: an already-approved shelf merchant whose entire inventory
joins CJ's Abt/Wayfair/antonline cluster). Strategy consequence,
flagged: the price-comparison vision runs through branded inventory —
own-brand DTC merchants can populate pages but can never populate a
comparison.

## TARGETED RE-SWEEP: TVs/AV, cameras, power tools (2026-08-19) — was the bedroom-heavy shortlist a market fact or a search artifact?

**Method difference, stated first:** the original sweep gave every
category 3 keywords × 1 page with no feed probes, and its top-40 output
was globally EPC-sorted — mattress keywords were on-target while
"electronics"/"tools" matched junk, so furniture dominated what was
visible. This re-sweep: 7–8 sharper keywords per category, 2 pages,
and a per-candidate FEED-EXISTENCE probe (shoppingProducts totalCount,
knowable pre-join). **Part artifact, part market fact — and it differs
by category.**

**TV / home-AV (257 unique advertisers): the accessible middle tier
EXISTS — for AV, not for television panels.** Accessible with feeds:
SVS (rank 3, 7%, 91 products — premium speakers/subs, $500–2,500 AOV),
Monoprice (rank 3, 10%, 4,629), Audioengine (rank 1, 5%, 6,279), Full
Compass (rank 2, 4%, 93,769 — pro AV). Gated: Sony (r4), Epson (r4),
Harman (r4), Abt (r4). Television PANELS specifically are structurally
big-box/brand-gated on CJ; projector/audio AV is reachable today — and
pairs with the already-joined AWIN XGIMI + Valerion.

**Cameras (38 unique — genuinely thin, NOT an artifact):** even the
deeper sweep finds almost nothing accessible. Canon (r5), Sony (r4)
gated; the one real accessible camera brand is **OM SYSTEM (rank 1,
3%, 1,364-product feed** — the Olympus successor: mirrorless bodies
and lenses, high AOV). Everything else is adjacent (dash cams, photo
frames, car AV). The camera mid-tier isn't absent from the MARKET —
it lives at Impact's retailers (B&H, Adorama) rather than on CJ.
Verdict: on CJ, the accessible cell is near-empty with one real
exception; the category is reachable via a different network, not via
more traffic on this one.

**Power tools (222 unique): the middle tier EXISTS but is SHIFTED —
power stations and prosumer outdoor, not traditional trade brands.**
Accessible with feeds: **Worx (rank 2, 3%, 371 — a real consumer
power-tool brand)**, EcoFlow (r3/r2, feeds), Bluetti (r3, 374), Bad Ass
Extension Cords (r1, 316). Gated: Jackery (r5), Global Equipment (r4,
359k products), MSC (r4, 2.17M). DeWalt/Milwaukee don't appear as CJ
programmes — trade brands route through gated retailers on other
networks (Acme/ShareASale, ToolNut/Impact).

**Cross-network finding, possibly the most valuable line: Vevor is ALSO
on CJ (5966681, rank 4, 4%, 15,146-product feed) — with GTIN populated
on 100% of 200 sampled rows,** versus its AWIN feed's zero identifier
columns. The "Vevor can't join" problem is an AWIN-export artifact,
not a merchant property: CJ-Vevor provides the identity layer
AWIN-Vevor lacks (source via CJ, or CJ-for-identity + AWIN-for-
commission — a commercial call; the rank-4 gate applies on the CJ
side).

**Direct answer to the structural question:** the DTC middle tier that
exists in mattresses and e-bikes is PRESENT in home-AV and
power-adjacent tools, ABSENT-on-CJ (but present-on-Impact) for
cameras, and absent for television panels at any traffic level —
panels are a brand/big-box category, full stop.

## CJ SWEEP (2026-08-19, API — credentials landed) — and the finding that outranks the shortlist

**Smoke test:** token + CID authenticate (200); joined advertisers: 0 —
fresh account, everything below is not-joined. Redaction rule held
throughout (status codes only on auth errors).

### THE STRATEGIC ANSWER: YES, AND SUBSTANTIAL — CJ makes the product's name true

Measured with a 0-joined account (CJ's GraphQL `shoppingProducts` is
network-wide pre-join — 731.8M products visible):

- **GTIN population:** Abt Electronics 95% of 1,000 sampled (catalog
  22,679); Mattress Firm 100% of 1,000 (catalog 2,855); Wayfair 77% of
  1,000 (catalog 41.7M). Manufacturer GTIN does not churn —
  structurally better identity than aw_product_id (213/234 regenerated
  in 16 days) and aligned with the standing durable-key rule.
- **Cross-merchant overlap, measured directly** (gtin filter is a
  SINGLE String — the list form silently returns zero, the vacuous-zero
  trap, caught by positive control): **52% of Abt's appliance/TV GTINs
  are carried by ≥2 CJ merchants** (co-carriers: Wayfair, Perigold,
  Office Depot, Macy's, UnbeatableSale, Full Compass…); **32% of
  Mattress Firm's GTINs** (1stopbedrooms, Macy's, Wayfair, JCPenney,
  Boscov's…). One sampled GTIN appears at FIVE merchants
  (662997155356: Abt | Birch Lane | Perigold | Wayfair |
  1stopbedrooms).

Consequence: every product in the current catalogue exists at exactly
one retailer — the site cannot compare prices today. On CJ,
multi-retailer comparison is measurably real in exactly our volatile
target categories. CJ is not "another network."

Also pre-join visible: `productFeeds` lists **15,542 feeds with product
counts** — feed-exists is a knowable gate on CJ (unlike AWIN's
pre-join walls). Feed schema is Google-shopping-shaped
(gtin/mpn/brand/price/salePrice with sale windows).

### Sweep results (advertiser-lookup, notjoined, keyword sweeps; 356 unique advertisers collected)

EPC (3-month, per-100-clicks earnings) used as the volume/AOV proxy;
network-rank 1–5 (5 = largest). Feed existence per advertiser is
checkable via productFeeds/shoppingProducts before any application.

**Volatile + accessible (the target):** BedJet (epc 365, rank 3, 8%),
Mellow Sleep (216, 10%), Erommy (236, 8%), KEETSA (7%), DreamSofa (4%),
Big Fig Mattress (5%), GARVEE (tools/equipment, 5%), Linsy Home (3%) —
DTC tier, plausible approval at our traffic. With GTIN overlap, even
single joins contribute to cross-merchant pairs (e.g. 1stopbedrooms
rank-1 co-carries 10/16 of Mattress Firm's overlapping GTINs — a
low-rank merchant that instantly creates comparison pairs).
**Volatile + inaccessible today (wait list, unlock ≈5k visitors/mo
sustained per public network guidance — not merchant quotes):**
Mattress Firm (rank 5, epc 162), Macy's (rank 5), Abt Electronics
(rank 4 — 1% commission but the OVERLAP HUB for appliances/TV),
Wayfair, Frontgate, La-Z-Boy, Herman Miller, Lovesac, Office Depot.
**Static + accessible (AVOID — the trap):** decor/craft DTC long tail
(Olive Ateliers, ferm LIVING, Acanva…).
**Static + inaccessible:** ignored.

Gate 2 caveat, stated honestly: CJ program terms (coupon/deal/
comparison-engine exclusions) are NOT exposed via the API — each
target's terms need reading at application time, per the Best Buy
precedent. Gate 1 numbers are public-guidance estimates.

**No applications made, no terms accepted** — operator's, as always.

### What this changes (flagged for the operator's strategy queue)

1. The re-import/durable-key plan gains a second reason: GTIN in
   catalog_products would let AWIN and CJ inventories join across
   networks.
2. The cutover (Step 14) remains the critical path — multi-retailer
   product pages need the DB catalog as the single source before a
   second network's products can mount.
3. Abt + Wayfair + Perigold as a joined trio would make appliance/TV
   comparison pages real at ~50% coverage of Abt's range — the first
   true price-comparison inventory available to this project.

## ADDENDUM (same day): the shelf audit — 31 joined, 6 used, 23 baselined

**The reordering finding (operator): 25 approved AWIN relationships sit
unused.** Audit of all 31 joined programmes: 6 are catalogue partners;
of the other 25, **23 have live feeds** (Cosabella and Cozeware do not).
Notable unused inventory: **Vevor US (20,453-product feed** — tools,
equipment, appliances, e-mobility, promo-heavy), **Tennis Express
(49,850)**, **Creality (48,028** — 3D printers), **XGIMI (10 feeds)** and
**Valerion (540)** projectors, **Autel (43** — EV chargers, sits right
next to evdance), Kings Camo (8,138), Sparkle (3,689), aaawave (1,678),
Feinuote (1,652), Monument Grills (1,055), Oedro (789), plus smaller
(FENRIR 298, FED Fitness 322, Wavytalk 420, AUTO-VOX 156, Alorair 186,
Ravin 181, PURTY BODY 134, DDPAI 114, Argendon 61, Nextrition 19,
Ottocast 14).

**Baselines captured 2026-08-18 (~00:5x–01:1x UTC 08-19), one chosen
English feed per advertiser, 23/23 succeeded:** compact price snapshots
(id/name/effective price/regular price) in
`claude/feed-baselines-2026-08-18/*.ndjson.gz` with `manifest.json`
(feed id, row counts, sha256 of uncompressed content, id column/format,
capture time — feed URLs deliberately excluded: they carry the publisher
key). The 7-day diff (due 2026-08-25) measures real repricing per
merchant. Nothing imported to the catalogue — Step 14 sequencing
constraint holds.

**Feed-template finding:** joined feeds split into two templates.
F-prefixed feeds are Google-Shopping-schema (id/title/price/sale_price);
numeric feeds are AWIN-classic (aw_product_id/search_price). **No feed
of the 23 — nor evdance's F1320, used as positive control because our
catalogue holds originalPrice values imported from it — populates
sale_price or any rrp/was column today.** These merchants express
promotion by MOVING the price, not by flagging it, so the 7-day price
diff is the only volatility instrument these feeds support — and the
scarcity of was-price data measured here also bounds what any future
"original price" UI can honestly claim. All 23 baselined feeds carry
numeric product ids (the id scheme the 2026-05-15 freeze hit; F-scheme
FEED IDS are unrelated to product-id format — recorded to prevent
conflating the two).

**FlexOffers resolved as far as code can:** commit `36609b3`,
2026-07-24 04:43Z, "Add FlexOffers site-verification meta tag" — the
account reached the domain-verification step 25 days ago, during the
same build era as the 07-23 test email. Account state beyond that is
credential-gated (operator checking). If live: Purple (~3.2%/30d) and
Saatva open the mattress cell with zero applications. Technique noted at
operator request: reading our own served <head> located a network
relationship no inventory listed — assets leave fingerprints in the
artifact even when they're absent from the records.

## The application shortlist (operator's clicks, kept short)

1. **Kingbull Bike** — AWIN 124136, e-bike, published 362-product feed.
2. **Troxus / Addmotor / Cyrusher** — AWIN e-bike DTC tier; feeds
   unknown-not-absent pre-join.
3. **GE Appliances (71161), Electrolux (34515), DeLonghi (33739)** —
   appliance majors on the network where we already exist; bar unknown,
   application free.

Nothing else this week. Projectors need no application (XGIMI + Valerion
already joined); mattresses ride on the FlexOffers account check; tools
wait for the Vevor 7-day diff (Vevor may cover the category without any
application at all).

## Best Buy: PERMANENTLY EXCLUDED (decision recorded 2026-08-18)

Not a wait-list entry, and not to be re-litigated at higher traffic:
program guidance restricts deal/coupon sites, brand-comparison content,
and high-volume comparison pages — a category ban aimed at this exact
business model — and even admitted publishers get ~0.5% commission on a
1-day cookie, which cannot fund a comparison site's economics at any
traffic level. Both the ban and the economics have to change before
this is worth an hour of anyone's time.

## OPEN STRATEGIC DECISION — flagged, not resolved: cashback vs the merchant pool

Two recorded facts in tension. (1) The August strategic growth plan puts
cashback at the centre of the revenue model. (2) This research found
that merchant affiliate terms exclude coupon/deal/cashback publishers
often enough that it is a named genre of exclusion clause — and
cashback status trips those clauses MORE often than price-comparison
framing does (Best Buy above is one concrete instance; affiliate-manager
guidance treats "should we allow coupon/cashback sites" as a standing
policy question). Consequence if unaddressed: the cashback pivot may
systematically shrink the merchant pool the whole business depends on —
the wallet ledger would be built for relationships the wallet itself
disqualifies us from. Needs an operator decision BEFORE anyone builds a
wallet ledger: cashback-first (accept a smaller pool), comparison-first
(defer cashback), or a split-brand structure. Evidence level: public
terms and directory guidance, not merchant conversations — a
merchant-by-merchant terms read should precede the decision.

Read-only research. Nothing applied to, no accounts created, no terms
accepted — all commercial commitments remain the operator's.

Method note: AWIN half measured via API (programme directory: 21,287
not-joined; 10,849 US) joined against the publisher feed-list CSV (967
feeds, 624 distinct advertisers, including Not-Joined advertisers — so
"has published feed" is knowable pre-join and rare: ~3% of programmes).
Commission rates are NOT visible pre-join via API (401 on
commissiongroups for all 15 candidates probed) — they ARE visible in the
AWIN dashboard UI, operator-side. CJ/Rakuten/Impact half is public-web
research; per-merchant terms marked verified vs directory-reported.

## The verdict on the hypothesis

**E-bikes: SUPPORTED, with one correction.** The volatile+accessible
cell is NOT empty, and e-bikes are its strongest occupant — but the
accessible slice is the second tier. The biggest US e-bike brands are
not reachable today: Aventon is on AvantLink (4%/30d — AvantLink has a
real editorial review bar), Lectric runs a $25 referral scheme (not an
affiliate programme), Rad Power's programme status is unclear. What IS
reachable is AWIN's DTC e-bike tier, where we are already an approved
publisher: **Kingbull Bike (programme 124136, published feed, 362
products)** plus ~a dozen joinable no-feed-listed brands (Troxus, NAKTO,
Addmotor, Cyrusher, Magicycle, Vintage Electric…). $1–3k AOV and
seasonal promo cycling hold for these. Power tools as second: NOT
supported on AWIN (10 candidates, zero feeds, mostly false matches);
the tools path runs through Acme Tools (ShareASale — now part of the
AWIN group, may surface on AWIN), ToolNut (Impact), CPO/DeWalt (CJ) —
retailer programmes with content-site expectations.

## Ranked shortlist (network / category / commission / feed / bar / restrictions)

1. **Kingbull Bike — AWIN, e-bike.** Commission pre-join-hidden (dashboard
   shows it). FEED: yes, 362 products. Bar: standard AWIN programme
   approval, DTC brand that needs distribution — the exact profile that
   said yes six times already. No site-type restriction visible.
   Rationale: the only candidate found tonight with all three of
   high-ticket, promo-cycling, and a published feed.
2. **XGIMI + Valerion (projectors) — AWIN, ALREADY JOINED.** Zero
   approval cost: both are high-ticket promo-cycling electronics sitting
   in the existing 31 joined programmes, unused by the catalog. Check
   their feeds before sourcing anything new.
3. **Nothingprojector — AWIN, tv/projector.** FEED: yes, 333 products.
   Same joined-programme profile as XGIMI.
4. **Troxus / Addmotor / Cyrusher / NAKTO — AWIN, e-bike.** No feed in
   the pre-join list (feeds may exist post-join — absence here is
   absence-from-the-visible-list, not proof). DTC, low bar expected.
5. **GE Appliances (71161) + Electrolux + DeLonghi — AWIN, appliances.**
   Majors, on the network where we already exist. Feed not visible
   pre-join; approval bar unknown and plausibly high — but an AWIN
   application costs nothing and skips the network-level gate entirely.
   The one big-brand path that doesn't require a new network identity.
6. **Purple / Saatva (mattress) — FlexOffers**, not one of the four
   asked-about networks, but the layout already carries a FlexOffers
   `fo-verify` ownership tag, so that account is already in motion
   operator-side. Purple ≈3.2%/30d, Saatva listed. Mattress DTC promo
   cycling is real and famous. Bar: FlexOffers is mid.
7. **ToolNut — Impact, power tools.** Impact marketplace signup is open
   (~72h review). Retailer carrying Milwaukee/DeWalt/Festool. Traffic
   bar plausible at our size but unverified.
8. **Acme Tools — ShareASale (AWIN group), power tools, ~3%.** 70k
   products incl. the volatile brands. ShareASale's migration into AWIN
   may make this reachable with existing standing.
9. **B&H (≈3–8%) / Adorama (4–8%) — cameras.** Content-site programmes,
   30d cookies. Bar: mid; comparison-model tolerance unverified — check
   terms at application time. KEH at 1% not worth the slot.
10. **EGOHOME Mattress / The Futon Shop / Article — AWIN,
    mattress+furniture.** Joinable DTC; no visible feeds; Article is a
    real mid-size furniture brand.

## The four-cell grid

- **VOLATILE + ACCESSIBLE (the target — NOT empty):** AWIN e-bike tier-2
  (Kingbull with feed; Troxus/Addmotor/Cyrusher/NAKTO), projectors
  (XGIMI/Valerion already joined + Nothingprojector), GE/Electrolux/
  DeLonghi *if* AWIN approval lands (unknown bar, zero cost to ask),
  mattress DTC via the already-in-motion FlexOffers (Purple/Saatva),
  power stations (VTOMAN, Dabbsson — volatile promo pricing, AWIN).
- **VOLATILE + INACCESSIBLE (wait list, below):** Best Buy (see Gate 2 —
  permanently out, not waiting), Home Depot, Lowe's, Samsung/LG
  (unverified this pass), B&H/Adorama (borderline — may be accessible
  now, terms unverified), Aventon and the AvantLink e-bike tier-1.
- **STATIC + ACCESSIBLE (the trap, named):** AWIN's long tail of DTC
  decor/accessory brands with big feeds (Belord 5,189; Vintage Realm
  4,927; Lucasgift 15,596) — large catalogues, willing merchants,
  prices that never move. This is exactly how the current catalogue was
  built. Catalogue size ranked LAST per the brief; these ranked
  nowhere.
- **STATIC + INACCESSIBLE:** ignored, per brief.

## Gate findings

**Gate 1 (traffic, ~227 visitors / 5 organic clicks per month) —
disqualified TODAY, stated plainly:** Lowe's (CJ; US content site with
"decent traffic"; ~1-day cookie), Home Depot (Impact; big-retailer
review), premium CJ brands generally (public guidance clusters around
5k+ monthly visitors), AvantLink as a network (editorial review of
content quality — thin/young sites rejected), likely Samsung/LG.
Network-LEVEL signup, by contrast, is open at all three: CJ (no hard
minimum, merchants gate individually), Rakuten (open; asks monthly
visitors at signup; operator already has an account), Impact (open,
~72h marketplace review). Joining the networks now costs nothing and
starts the account-age clock; the merchants inside them are the gate.

**Gate 2 (site type) — one confirmed category ban:** Best Buy's
programme guidance restricts deal/coupon sites, brand-comparison
content, and "high-volume comparison pages" — plus 0.5% commission and
a 1-day cookie even for those admitted. That is a structural exclusion
of this business model: PERMANENTLY OUT, no traffic number unlocks it.
Broader pattern confirmed: coupon/deal-site exclusion clauses are
common enough to be a named genre in affiliate-manager guidance —
every application should be read for "comparison shopping engine"
language before applying, and the growth plan's cashback ambition
(recorded 2026-08) will trip these same clauses more often than the
price-comparison framing does.

## Wait list, with unlock numbers (estimates from public guidance, not merchant quotes)

- Lowe's (CJ): ~5k monthly visitors + established US content. Revisit
  at 5k/mo sustained.
- Home Depot (Impact): similar; 1–8%/7d makes it the best of the big-box
  three when reachable. Revisit at 5k/mo.
- B&H / Adorama: plausibly 1–5k/mo content-site bar; MAY accept sooner —
  cheap to test once Impact/CJ accounts exist. Revisit at 1k/mo or on
  network acceptance.
- Aventon (AvantLink): AvantLink's own review is the gate; revisit at
  ~5k/mo with established content pages.
- Samsung / LG: unverified this pass; research at Search Console
  milestone.
- Best Buy: no number. Category ban.

## What was deliberately NOT done

No applications, no accounts, no terms accepted, no feed pulls beyond
the AWIN list we already consume. Commission figures for AWIN candidates
await either dashboard reads (operator) or joining.
