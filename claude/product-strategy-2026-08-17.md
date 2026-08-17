# Product Strategy — 2026-08-17

**Status: current. Supersedes Sections 2, 4, 5 and 9 of
`claude/strategic-growth-plan-2026-08-02.md`.** That document remains in the
repo and remains authoritative for its other sections (1, 3, 6, 7, 8, 10, 11,
12). Superseded material is struck through in §1 below with the reason attached
rather than deleted — the growth plan was a sound plan for the strategy it was
written against, and deleting it would hide that the strategy changed.

**Why this document exists at all.** Both working sessions were executing
against a plan whose Phase 2 names cashback, gift cards and hotels. Two of those
are now deferred and one is cut. That is the same documentation-drift failure
this project spent 2026-08-16/17 correcting in the pricing pipeline, occurring
at the strategy layer, where it is more expensive: a stale status line wastes a
check, a stale strategy wastes a month.

**Provenance labelling, and read this before acting on any number below.**
Claims here are marked **[VERIFIED]** (measured by this session against the
database or repo, or measured earlier and cited), **[OWNER]** (the owner's
decision or judgment, recorded as such), or **[CATEGORY ECONOMICS —
UNVERIFIED]** (reasoning from how these categories generally work, *not* from
our actual affiliate approvals, commission statements, or feed access). The
third class is the most likely to be wrong and is listed together in §10 with
how to check each item.

---

## 1. What this supersedes, and why

| Growth plan section | Disposition |
|---|---|
| §2 Strategic Objectives & Success Criteria | ~~Superseded~~ |
| §4 Phased Roadmap & Schedule | ~~Superseded~~ |
| §5 Vertical-by-Vertical Deep Dive | ~~Superseded~~ |
| §9 Financial Model & Revenue Trajectory | ~~Partly superseded — see below~~ |

~~**§2.1** "Transform GoPriceFinder.com from a price-comparison-only site into a
trustworthy cash back, coupon, and price-comparison platform covering three
verticals — General Products, Gift Cards, and Hotels — plus a lightweight Local
Store directory."~~ — **SUPERSEDED 2026-08-17.** Gift Cards and Hotels are
deferred, cashback is cut from v1, and the organizing principle is no longer
vertical count. Reasonable when written: it was derived from a competitor's
actual product surface, which is a defensible way to scope a roadmap. What
changed is the conclusion that copying that surface competes on commodities
(§3).

~~**§2.2** Differentiation thesis: win on cashback trust, data integrity, focus,
and community presence.~~ — **SUPERSEDED.** Three of the four survive as
operating values, but "win on trust where Price.com is weakest: cashback
tracking and payout" cannot be the differentiator of a product that no longer
ships cashback. Data integrity is promoted from a supporting value to the core
asset (§3).

~~**§2.3** Success criteria keyed to "Cashback Live (v1)", "Multi-Vertical Live"
and a public cashback SLA page.~~ — **SUPERSEDED.** Every milestone named a
cashback or vertical-count deliverable. Replaced by §5.

~~**§4** Six-phase, 17–20 month roadmap: Phase 2 Cashback v1 (Gift Cards +
Hotels), Phase 3 Local Store Directory, Phase 4 Referrals, Phase 5 Coupons.~~ —
**SUPERSEDED.** Phase 0 and Phase 1 (price refresh, price history, alerts) are
retained and their priority is raised — under this strategy they are not
foundation-before-the-real-work, they *are* the product. Phases 2–5 are deferred
or cut per §7.

~~**§5.2 Gift Cards** and **§5.3 Hotels** — recommended for build with named
affiliate models.~~ — **DEFERRED, not cut.** The reasoning in those sections
(self-serve affiliate programs, avoid resale/inventory risk) was sound and
should be re-read if either is revisited. They are deferred because neither
generates the compounding asset in §3: gift-card face value does not have a
price history worth owning, and hotel pricing is a solved, heavily-defended
space with existing meta-search incumbents.

~~**§5.5 Local Store Recommendations** — MVP directory as Phase 3.~~ —
**DEFERRED indefinitely.** No phase reserved.

**§5.4 Restaurants — removed from scope.** *Not superseded; still removed.*
Recorded here so a reader of this document does not conclude the removal lapsed.

~~**§9.4** "$1,000,000/year … realistically 3 to 4 years out."~~ — **RETAINED,
not superseded.** §9's honest-starting-point, revenue-mechanism and
subscription-exclusion analysis all survive, and the 3–4 year figure is
independently reaffirmed (§9). What is superseded is §9.2's assumption that
"every vertical generates revenue the same way: … a portion of that commission
is shared back to the user as cash back" — with cashback cut from v1, the full
commission is retained and there is no consumer rebate line in v1 economics.

---

## 2. The core question the product answers

**"Is this a good price right now, or should I wait?"** [OWNER]

That is the whole product. Everything below is in service of answering it.

Why it is worth answering:

- Google cannot answer it. It indexes current prices, not the history required
  to judge one.
- Amazon will not answer it. Nothing in its incentives rewards telling a shopper
  to wait.
- Retailers actively obscure it. A struck-through "MSRP" that the item has never
  sold at is a claim about a number the merchant chose, not about the market.

The question is answerable **only** from time-series price data. That is the
strategic fact the rest of this document follows from.

---

## 3. The asset: price history is the only thing here that compounds

[OWNER, and this is the load-bearing decision in the document]

Comparison, cashback and coupons are **commodities**. Anyone with affiliate feed
access has all three working within a day. They are table stakes, not moats.

Price history is different in one specific way: **it cannot be bought, and it
cannot be back-filled.** A competitor starting in two years cannot have two
years of history. Every day the pipeline runs honestly is a day of asset
accumulation that no amount of funding shortcuts. It is the only component of
this business where being early is structurally worth something.

### 3.1 This reframes the provenance work — it moves to the critical path

**Decision: `price_history` provenance is not cleanup. It is the foundation of
the company's core asset, and it is on the critical path.** [OWNER]

The specification already exists
(`claude/price-provenance-and-as-of-proposals-2026-08-17.md`, Part A, approved).
What changes is its priority and its justification. Two consequences follow, and
the second is a hard dependency nobody has written down yet:

1. **An asset you cannot trust is not an asset.** History whose rows cannot
   distinguish an observed merchant price from a catalog-import artifact is not
   a two-year moat; it is two years of unlabelled numbers. Finding C
   (`claude/status-corrections-2026-08-16.md` §4) is therefore not a data-quality
   ticket — it is a defect in the thing the company's value rests on.

2. **The deal-quality verdict in §4 cannot be computed honestly until provenance
   ships.** [VERIFIED] This is a gating dependency, not a sequencing preference.
   The verdict claims things like *"40% below its own 90-day average"* — computed
   from `price_history`. Today that table contains, for five king-koil products,
   a fabricated transition produced by a catalog re-import, including one
   product whose apparent low of $79.95 sits against a $179.95 real price. A
   deal-quality engine run over that table today would emit a confident,
   specific, false verdict — the exact failure mode the inclusion rule in §5
   exists to prevent. **The inclusion rule and the provenance schema are the
   same project viewed from two ends.**

---

## 4. Two halves, one engine

[OWNER]

One observation pipeline and one deal-quality engine, presented two ways.

### 4.1 High-ticket ($800–$3,000, considered purchases) — the revenue side

- Destination pages carrying real price history for the product.
- A **deal-quality verdict computed from the product's own history**, never from
  a merchant MSRP claim.
- Price alerts.

**Alerts are the monetization mechanism, not a feature.** [OWNER] On a
considered purchase the user does not convert in-session — they research for
weeks and leave. An alert is what makes the return happen *through our email,
with our attribution, at the moment intent peaks*. Without alerts, a high-ticket
strategy donates its research value to whoever the buyer happens to visit on
purchase day.

**Status note, and it matters for planning** [VERIFIED]: the alert path
(`lib/alerts/checkPriceDrops.ts`) shared the Finding B merge defect and has never
compared against a live price in production. The merge fix landed today
(`11ae044`). The mechanism this half of the strategy monetizes through has, as of
this document, never actually run correctly against live data. Treat alert
performance as entirely unmeasured rather than as a known quantity.

### 4.2 Low-ticket — acquisition, habit, list-building

- A deals feed.
- Coupons.
- A weekly digest.

**This is explicitly NOT a revenue line, and must not be judged as one.**
[OWNER] Its outputs are traffic, return visits, and email subscribers. Measuring
it on commission revenue will make it look like a failure at exactly the moment
it is working, and the predictable wrong response — chasing revenue in the
low-ticket feed — is what breaks the inclusion rule in §5.

### 4.3 Why one engine

Both halves consume the same observation pipeline and the same deal-quality
computation. The difference is presentation and cadence, not logic. This is also
what keeps the low-ticket half cheap enough to justify as pure acquisition.

---

## 5. The inclusion rule — load-bearing, and the first thing that will be attacked

**An item appears in the deals feed only if OUR OWN price history supports the
claim.** [OWNER]

- Not: "50% off MSRP."
- Instead: "40% below its own 90-day average, cheapest since March."

**This deliberately produces a smaller feed than Slickdeals or DealNews.** That
is the intended outcome, not a limitation to be engineered around. The smaller
feed is the product: a feed where every entry is defensible is worth more than a
larger feed where entries are merchant marketing restated.

**Recorded explicitly, because it is the first temptation:** relaxing this rule
is the single change most likely to be proposed, most likely to look reasonable
at the time, and most destructive to the brand. It will be proposed as "we only
have eleven deals this week, let's include the ones where the merchant says it's
a discount." The moment merchant-claimed discounts enter the feed, the feed
becomes the thing every competitor already has, and the compounding asset in §3
stops being the reason anyone visits. **If the feed is too small, the answer is
more observed history or more retailers — never a weaker claim.**

Direct dependency on §3.1: the rule is only enforceable if history can be
trusted. An inclusion rule computed over unlabelled rows enforces nothing.

### 5.1 Adoption cost, measured 2026-08-17: zero items — DECIDED, adopt immediately

The sequencing worry ("we cannot switch to a history-based rule until history is
thick enough") does not apply, because **the current MSRP-based feed is already
empty.** [VERIFIED, measured against production]

| rule | items today |
|---|---|
| Current live path — `getFeaturedDeals` from `lib/partners` (static) | **0** — `originalPrice` appears in each static data file only in a comment and a type declaration; no product literal sets it |
| Supabase path, if `/deals` were migrated | **1** — `brooklyn-delhi:celebrations-gift-box`, $63 from $95, the only one of 954 rows with a non-null `original_price` |
| History-based, ≥5% below own 90-day average | **0** (also 0 at ≥10%, ≥40%) |
| History-based, *any* margin | **3** |

**Adopting the inclusion rule costs zero items, because there is no populated
feed to lose.** It is not a sequencing problem; it is free today and gets more
expensive to adopt the longer an MSRP-based feed is allowed to populate.

### 5.2 The three products a naive history rule surfaces are all fabrications

The strongest available argument for gating the deal engine behind provenance,
and it is data rather than principle. [VERIFIED]

The only three products currently below their own 90-day average are
`king-koil:…-pump-5`, `-6` and `-11` — at 0.5%, 1.9% and 2.2%. **All three are
artifacts of the `87877a2` catalog re-import** (Finding C), not market movements.
No merchant lowered a price; we rewrote a file.

So a history-based deals feed built today, without the provenance filter, would
contain exactly three items and **every one of them would be fabricated**. The
inclusion rule and the provenance schema are not merely related (§3.1) — without
provenance, the inclusion rule actively selects *for* the fabricated rows,
because artifacts are the only thing in the table that moves.

---

## 6. Verticals

### 6.1 High-ticket: sleep and furniture first

Mattresses are close to an ideal first category [OWNER, with the underlying
category characteristics marked UNVERIFIED in §10]:

- $800–$3,000 — squarely in the considered-purchase band.
- Violent promotional swings — which is what makes a history chart *useful*
  rather than flat.
- Weeks of research per purchase — which is what makes alerts work.
- Famously poor price transparency — which is the problem being solved.
- **We already have King Koil as a live partner** [VERIFIED — 29 products in the
  catalog, AWIN, feed currently healthy].

### 6.2 Low-ticket: beauty/skincare and women's innerwear

Chosen for high repurchase rate, real promotional cycles, DTC-heavy merchant
mix, and 8–15% commissions [CATEGORY ECONOMICS — UNVERIFIED, §10].

### 6.3 Explicitly avoided: cheap electronics accessories

Amazon owns the category, commissions are 1–3%, and CamelCamelCamel already does
price history there better than we would [CATEGORY ECONOMICS — UNVERIFIED].
Recording the avoidance matters as much as recording the choices: this is the
category a price-history product drifts into by default, because it is the one
where price-history tooling is most obviously associated.

---

## 7. Supply: the bar for "live"

**A category is live only when five or more retailers carry overlapping
products. Below that it is a catalog, not a comparison.** [OWNER]

**[VERIFIED] By this bar, no category on the site is live today — and the gap is
larger than "not yet five."** Across all 954 products and 6 partners, the number
of products carried by more than one partner is **zero**. Six partners, six
parent categories, and only two parent categories contain products from more
than one partner. The site cannot currently answer "who has this cheapest" for
any product, because no product exists at more than one retailer.

**This is an argument for the strategy rather than against it, and the reason is
worth stating plainly:** cross-retailer comparison requires supply we do not
have and cannot quickly get. Price history over time requires only *one*
retailer and *time* — which we can start accumulating today with the partners we
already have. **The asset chosen in §3 is the one achievable at current supply;
the commodity we are declining to compete on is the one that is not.** Whoever
revisits the supply bar should not read the zero as evidence the bar is too
high.

**Where the supply actually is** [CATEGORY ECONOMICS — UNVERIFIED, §10]: the
large home and furniture retailers are on CJ Affiliate and Impact, not AWIN.
This is offered as the explanation for why the AWIN partner research came back
thin on recognizable retailers — a result already recorded in
`claude/awin-partner-research-*`. If correct, reaching the five-retailer bar in
sleep/furniture requires network expansion beyond AWIN, which is a business
development dependency, not an engineering one, and it is currently unstaffed.

---

## 8. Monetization

**Affiliate commission is the primary and, in v1, the only revenue line.**
[OWNER]

### 8.1 No consumer subscription — permanent, and the reasoning is specific

Comparables show that the people who pay for price data are **sellers and
arbitrageurs, not shoppers** [CATEGORY ECONOMICS — UNVERIFIED]. And the
structural argument, which does not depend on comparables [OWNER]: a mattress
buyer needs this product intensely for three weeks, once every eight years. That
is the worst possible subscription customer — maximum value delivered inside a
window shorter than a billing cycle they would ever renew.

This is consistent with, and strengthens, growth plan §9.3, which already
excluded a Pro tier and named the revenue consequence honestly. That section
stands.

### 8.2 Cashback — CUT from v1

Three independent reasons, any one of which would be sufficient [OWNER]:

1. **It is a discount funded from our own commission.** It converts revenue into
   a price cut, which is only rational if it buys acquisition more cheaply than
   the alternatives.
2. **It does not buy acquisition here.** It is a brand-and-budget competition
   against Rakuten, which we cannot win at current scale [CATEGORY ECONOMICS —
   UNVERIFIED as to Rakuten's specific position; the general point that cashback
   competition is won on brand and budget is the owner's judgment].
3. **It drags in a wallet, a ledger, fraud rules and payout rails before we have
   traffic** — the largest and highest-risk phase in the superseded roadmap,
   built to serve users who do not exist yet.

**Returns later as retention for logged-in users, if at all.** Not as
acquisition.

**Already-built cashback infrastructure is not wasted and should not be
removed** [VERIFIED — wallet/ledger schema shipped, live and dormant, RLS
verified for reads, per the handoff record]. It is dormant, costs nothing to
leave in place, and the two open RLS decisions on it can now be deprioritised
rather than resolved before a Phase 2 that is no longer scheduled. **Do not
delete it** — that would be the same error as deleting the king-koil evidence
rows: cheap to keep, expensive to rebuild, and its existence is the record of a
decision.

### 8.3 B2B pricing intelligence — plausible second line, years out

MAP (minimum advertised price) violation monitoring sold to brands is a credible
second revenue line on a multi-year horizon [OWNER; market sizing UNVERIFIED].

**Its strategic function today is different from its revenue function:** it is a
second, independent reason observation integrity matters now. A brand paying for
violation monitoring is paying for the claim that an observation is real and
correctly dated. A history table that cannot distinguish an observation from a
re-import artifact is unsellable for that purpose — the same defect, with a
customer attached.

---

## 9. What kills this

Named honestly, in rough order of likelihood.

1. **No traffic today, and SEO takes 6–18 months.** [OWNER] The revenue model
   requires transaction volume; the acquisition model requires organic search;
   organic search requires time that has not started accruing.
2. **Cold start on price history.** [VERIFIED] The asset in §3 is worth nothing
   on day one. The site ships with thin charts and must say so — "tracking since
   August 2026" — rather than dressing up 15 days of flat data. This is already
   partly handled: `PriceHistoryChart` has an honest below-threshold empty state,
   and the as-of label specced today (`claude/as-of-label-spec-and-copy-2026-08-17.md`)
   is the same discipline applied to prices. **The cold-start problem and the
   honesty requirement are the same problem**, and the temptation to solve it by
   rendering something impressive from thin data is the §5 temptation wearing
   different clothes.
3. **Affiliate dependency.** [VERIFIED] The 190 AWIN feeds that froze on
   2026-05-15 are a preview, not a one-off — two of our six partners were caught
   in it, and we did not notice for three months. A business whose only revenue
   line is affiliate commission has counterparty risk it does not control, and
   whose failures are silent by default.
4. **A 2–4 year build at current capacity.** [OWNER] The growth plan reached the
   same conclusion independently from different premises (§9.4, one-to-two-person
   team, 3–4 years to $1M). Nothing decided tonight shortens it. Two independent
   routes to the same estimate is the strongest form this number has taken.
5. **Operational cadence, added from today's measurements** [VERIFIED]: catalog
   re-import currently happens when someone runs a script — three of six
   partners have healthy feeds and catalogs two to three weeks old
   (as-of spec §4.5). Under the old strategy this was a minor freshness issue.
   Under a strategy where observation cadence *is* the asset, an unautomated
   re-import cadence is a direct constraint on the rate the asset accumulates.

---

## 10. Claims reasoning from category economics — NOT verified against our own data

Listed together because the owner flagged this class as most likely to be wrong,
and because none of it has been checked by this session. **None of the following
comes from our affiliate approvals, commission statements, or network access.**

| Claim | Where used | How to check |
|---|---|---|
| Beauty/skincare and innerwear pay 8–15% commission | §6.2 | Network program terms for specific merchants once applications are in |
| Cheap electronics accessories pay 1–3% | §6.3 | Amazon Associates published rate card; network terms |
| Large home/furniture retailers are on CJ and Impact, not AWIN | §7 | Direct check of CJ/Impact advertiser directories |
| Mattresses show violent promotional swings | §6.1 | Our own price history once mattress supply exists — self-answering, and the first category where the product tests its own premise |
| Beauty and innerwear have high repurchase rates | §6.2 | Category benchmarks; ultimately our own return-visit data |
| CamelCamelCamel does electronics price history better | §6.3 | Direct product comparison |
| People who pay for price data are sellers/arbitrageurs | §8.1 | Comparable pricing pages and their positioning |
| Rakuten's brand and budget make cashback unwinnable at our scale | §8.2 | Not cleanly checkable; treat as judgment |
| MAP monitoring is a viable B2B line | §8.3 | Competitor pricing in that space; brand-side interviews |

**One of these is self-answering and worth noting as a design consequence:** the
mattress volatility premise (§6.1) is the premise the entire high-ticket bet
rests on, and the product itself measures it. If King Koil's history over the
next quarter shows flat pricing, the category thesis is wrong and we will have
the data to say so. Nothing else on this list has that property.

---

## 11. Operational note — paid acquisition for innerwear

[OWNER — log now, act later]

Paid advertising creative for lingerie and intimate apparel is restricted or
outright rejected on most major ad platforms, and some ad networks apply separate
approval tiers to the category.

**Consequence:** this is irrelevant to an SEO-and-email business, which is what
§4.2 and §9.1 describe — so it does not affect the decision to include innerwear
as a low-ticket vertical. But it **permanently closes the paid-acquisition lever
for that category**. If a future strategy adds paid acquisition as a channel,
innerwear cannot participate in it, and any plan that assumes uniform channel
availability across low-ticket verticals will be wrong at exactly that point.
Logged now because this is the kind of constraint that is invisible until
someone builds a plan on top of it.

---

## 12. What this changes for work currently in flight

| Work | Effect |
|---|---|
| `price_history` provenance schema (Part A, approved) | **Priority raised to critical path** (§3.1). Unchanged in content. |
| As-of label (spec approved, `ac9506a` shipped the first cut) | Unchanged. Same honesty discipline; now also serving §9.2 cold-start. |
| Merge fix `11ae044` | Unchanged, and its value rises — it is what makes alerts (§4.1) possible at all. |
| `withLivePrice` / page-level live pricing | Still undecided, and §3 strengthens the case again — declined on "only 27 products," now also weighed against observation cadence being the asset. |
| Manual `refresh-prices` diagnostic run | Unchanged, still pending, still HUMAN-ONLY. |
| Feed-ID migration investigation | Priority raised — §9.3 makes feed reliability a named existential risk rather than a maintenance task. |
| Cashback wallet/ledger schema | Dormant. Do not remove (§8.2). Two open RLS decisions deprioritised, not resolved. |
| Step 14 batches | **Complete for products** — 954 detail pages, six partners, verified live. **Batches 5–7 remain, as scheduled**: the cross-partner surface (homepage, deals, trending, categories, sitemap, `OurPartners`) still renders from `lib/partners`. Not drift; planned work the old gate could not see. |

---

## 13. Open questions this document does not answer

1. Which network(s) to pursue for sleep/furniture supply, and who does that work
   — it is business development, currently unstaffed (§7).
2. What the deal-quality verdict's actual thresholds are. "40% below 90-day
   average" is illustrative copy, not a specified rule; the real thresholds
   should be derived from observed distributions once history exists, not chosen
   in advance.
3. How many observed days are required before a product is eligible for a
   verdict at all — related to, but distinct from, `MIN_POINTS_FOR_CHART`.
4. Whether the low-ticket half ships before the high-ticket half, or after.
   §4 defines both; it does not sequence them.
