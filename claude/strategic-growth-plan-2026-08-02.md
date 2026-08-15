# GoPriceFinder.com — Strategic Growth Plan

## Cashback, Coupons & Multi-Vertical Marketplace Expansion

*Prepared 2026-08-02 | Target: $1,000,000 Annual Revenue | Independently-Operated Site*

*Last confirmed current: August 5, 2026 — no changes since the original plan.*

---

## How to Read This Plan

Every workstream, phase, and vertical in this plan is labeled with a difficulty rating. This reflects real build/operate complexity for a small, independently-run team — not a generic engineering estimate.

| Rating | Meaning |
|---|---|
| LOW | Well-understood pattern, mostly reusing infrastructure already in this codebase, low external dependency. |
| MEDIUM | New integration or capability, but with established off-the-shelf partners/APIs and no unusual compliance risk. |
| HIGH | Real financial, fraud, or compliance exposure; multiple moving parts; mistakes here cost money or trust directly. |
| VERY HIGH | Requires a real external partnership/negotiation, significant capital, or infrastructure this team has never built before — success is not fully within our control. |

This plan deliberately excludes five features that were part of Price.com's own product: a pharmacy discount card, AI/conversational shopping, a paid Pro subscription tier, editorial shopping guides, and a device trade-in program. These exclusions are permanent product decisions, not gaps — they are referenced again in Section 9 because one of them (the Pro subscription) has a direct, honest revenue consequence worth naming up front.

This plan also excludes Restaurants as a vertical, and assumes a real team of one to two people (not the five-function, 100-person org chart used in Section 3 to organize the work conceptually). Both changes are named explicitly in Section 3.0 and reflected throughout the roadmap, risk register, and financial model — this is not the same plan with a line item deleted, it is a re-sequenced, more conservative plan built around what one operator can actually execute.

---

## 1. Executive Summary

GoPriceFinder.com today is a real, working price-comparison site: six live affiliate partnerships, 956 real products, working accounts, a working wishlist and price-alert system, and a codebase that has just been through a rigorous performance and correctness hardening pass. What it is not yet is a cashback platform, and that is the gap this plan closes.

Independent research into Price.com — the company this plan is modeled after — found that its real revenue engine is unglamorous: commission-arbitrage cash back and coupons at mainstream retailers, with a subscription tier as a secondary lever. Its most-requested-by-us features (restaurants, hotels, gift cards, local stores) are, by contrast, the thinnest and least differentiated parts of its own business. Its single biggest weakness across every public review source checked is trust: slow or missing cash back payouts, unexplained account terminations, and price-accuracy complaints — this from a company that has raised approximately $29,000,000.

The strategic bet of this plan is direct: GoPriceFinder does not need Price.com's capital to compete on trust, tracking speed, and payout reliability — it needs discipline. Every phase below is built around that bet, sequenced by real-world achievability rather than feature-list completeness.

This plan targets $1,000,000 in annual net revenue as a multi-year milestone, not a near-term deliverable. Section 9 explains the financial reasoning behind that timeline honestly, including the real trade-off created by permanently excluding a subscription tier from scope, and the further, larger effect of building this with a one-to-two-person team instead of the conceptual five-function organization used in Section 3.

Two changes were made after the first draft of this plan, both in the direction of realism. First, Restaurants is removed as a vertical entirely — not deferred, not a stretch goal — because it was both the least differentiated opportunity found in the Price.com research and the one most dependent on a partnership (a card-linked-offer network) this team cannot get a meeting for at current scale. Second, every phase in Section 4 is now sequential with no parallel tracks, because a one-to-two-person team cannot run partner outreach and engineering as separate simultaneous efforts the way a staffed organization could. The result is a smaller, slower, but genuinely achievable plan.

---

## 2. Strategic Objectives & Success Criteria

### 2.1 Primary Objective

Transform GoPriceFinder.com from a price-comparison-only site into a trustworthy cash back, coupon, and price-comparison platform covering three verticals — General Products, Gift Cards, and Hotels — plus a lightweight Local Store directory, reaching $1,000,000 in annual net revenue on a realistic multi-year timeline.

### 2.2 Differentiation Thesis

- Win on trust where Price.com is weakest: fast, transparent, self-serve cash back tracking and payout — not a support ticket queue.
- Win on data integrity: every product, price, and policy claim on this site is sourced and verifiable — a discipline already established in this codebase and worth carrying into every new vertical.
- Win on focus: three verticals built well and finished in sequence beats a broader roadmap no one has the hours to execute — this is the same lesson the Price.com research surfaced about their own thinly-stitched hotel, flight, and gift-card offerings, applied to our own capacity constraints, not just theirs.
- Win on community trust: Price.com has almost no organic community presence despite its funding — an open lane for a smaller, more transparent operator to actually be talked about.

### 2.3 Success Criteria by Milestone

| Milestone | Definition of Done |
|---|---|
| Foundation Complete | Daily price refresh, price history, wallet ledger schema, and click-tracking redirect layer are live in production. |
| Cashback Live (v1) | At least one vertical (Gift Cards or Hotels) has real, automated activation-to-payout cash back working for real users, with under 1% support-ticket rate on tracking issues. |
| Multi-Vertical Live | Gift Cards and Hotels both have working cash back; Local Store directory is live. |
| Trust Differentiation Proven | Public-facing cash back status/SLA page live; median time-to-Available under 45 days; zero unexplained account terminations. |
| Revenue Scale-Up | Referral program active, first external distribution partnership signed, monthly net revenue run-rate trending toward the $1M/year target. |

---

## 3. Organizational Workstreams

### 3.0 Realistic Operating Model

A 100-person team would divide this work across five standing functions, and the five workstreams below are organized that way because it keeps ownership and scope legible as the business grows. But GoPriceFinder is realistically operated by one to two people today, and pretending otherwise would make the schedule in Section 4 fiction. Three consequences follow directly, and the rest of this plan is written around them:

- No two workstreams run at full effort at the same time. Partner outreach, wallet/ledger engineering, fraud-rule design, and support-flow design all draw on the same hours. Section 4's roadmap is single-track: one phase completes before meaningful work starts on the next, with the only exception being genuinely idle time — for example, waiting days or weeks on a partner's compliance review, which can be spent on the next phase's engineering.
- Trust & Support Operations (3.3) is not a department, it is a personal commitment. Every cash back inquiry and fraud appeal reaches one person directly. The plan treats the volume where that stops being sustainable as a real constraint, not an abstraction — self-serve tracking and auto-resolution rules (6.3, 6.4) must exist before that volume is reached, not after.
- Compliance and partnership outreach consumes real hours per partner (drafting applications, reading terms, answering follow-up questions) in addition to the calendar time spent waiting on a response. Both costs are counted in the schedule below, not just the waiting time.

**3.1 Engineering & Infrastructure — [DIFFICULTY: HIGH]**

Owns the price-refresh pipeline, wallet/ledger system, click-tracking and redirect layer, payout integration, and fraud-detection logic. This is the workstream everything else depends on — nothing in Sections 5–7 ships without it.

**3.2 Partnerships & Vertical Expansion — [DIFFICULTY: HIGH]**

Owns affiliate-network relationships (AWIN and any new networks needed for hotels and gift cards), compliance review per partner, and negotiating terms. This is where the earlier finding about existing partner restrictions on coupons lives — this workstream is responsible for resolving it before Coupons can proceed.

**3.3 Trust & Support Operations — [DIFFICULTY: MEDIUM]**

Owns the self-serve "Where's My Cash Back" resolution flow, the fraud-appeals process, and the public trust/SLA page. This workstream exists specifically because it is Price.com's proven weak point — it is being staffed as a first-class function here, not an afterthought.

**3.4 Growth & Distribution — [DIFFICULTY: MEDIUM]**

Owns the Refer Friends program, community presence (the Reddit/community gap identified in research), and any distribution partnerships analogous to Price.com's Sweatcoin/Erewhon deals, scaled to GoPriceFinder's size.

**3.5 Finance & Analytics — [DIFFICULTY: MEDIUM]**

Owns unit-economics tracking (commission-in vs. cash-back-out spread per vertical), payout reconciliation, and the revenue model in Section 9. Without this function, it is impossible to know if any vertical is actually profitable.

---

## 4. Phased Roadmap & Schedule

A single-track, 17-20 month build-out horizon, organized in six phases, sized for a one-to-two-person team per Section 3.0. Every phase is fully sequential — none overlap — and timeframes assume focused, consistent work with no second person to absorb partner outreach or support load while engineering is underway. Phase 0 starts immediately.

| Phase | Timeframe | Focus | Difficulty |
|---|---|---|---|
| Phase 0 — Foundation | Months 1–3 | Daily price refresh, price history table, wallet schema, click-tracking redirect layer, compliance outreach to existing partners | MEDIUM |
| Phase 1 — Trust Groundwork | Months 3–6 | Price History goes live with real data; Price Alerts hardened; self-serve support flow scaffolded before it's needed | LOW |
| Phase 2 — Cashback v1: Gift Cards + Hotels | Months 6–12 | Join Booking.com/Expedia + gift card affiliate programs; build activation tracking, wallet crediting, automated payout, fraud rules v1 — the largest single phase, done one integration at a time | HIGH |
| Phase 3 — Local Store Directory MVP | Months 12–14 | Lightweight "nearby stores carrying this category" directory — no real-time inventory yet | LOW |
| Phase 4 — Refer Friends + Growth Push | Months 14–17 | Activate referral bonus payouts; pursue first distribution partnership; launch public trust/SLA page | MEDIUM |
| Phase 5 — Coupons (Conditional) | Months 17+ | Only for compliance-cleared verticals/partners; daily code-testing automation; scheduled last because it adds scope, not because it is architecturally blocked | HIGH |

Restaurants does not appear on this roadmap. It was removed from scope entirely, not deferred to a later phase — see Section 5.4 and Section 10 for the reasoning.

---

## 5. Vertical-by-Vertical Deep Dive

**5.1 General Products (Existing) — [DIFFICULTY: LOW]**

Already live: 6 partners, 956 real products, real category taxonomy, working search. The only new work here is layering the wallet/redirect infrastructure on top, and resolving the compliance question for any partner that restricts coupon or cashback behavior before extending those specific features to them.

**5.2 Gift Cards — [DIFFICULTY: MEDIUM]**

Recommended model: join existing gift-card affiliate programs (available on standard affiliate networks) and pay flat cash back on face-value purchases — the same model Price.com uses. This avoids the inventory risk, fraud exposure, and working-capital requirements of real discount-resale arbitrage (the CardCash/Raise model), which this plan explicitly does not pursue in its first 18 months. If discount resale is revisited later, it should be scoped as its own standalone initiative with its own risk review, not folded into this roadmap.

**5.3 Hotels — [DIFFICULTY: MEDIUM]**

Recommended model: Booking.com and Expedia both run self-serve, publicly-available affiliate programs suited to a site this size — no special negotiating leverage required to join. This is the vertical where GoPriceFinder has the clearest opportunity to out-build Price.com, since research found no evidence Price.com invested deeply here beyond a single "Travel Cashback" feature launch.

**5.4 Restaurants — Removed From Scope — [DIFFICULTY: N/A]**

Restaurants was in the original draft of this plan, split into an online-delivery stage and a card-linked-offer (CLO) stretch goal. It has been removed entirely, not deferred, for two reasons that only became decisive once real team-size constraints were applied: it was the thinnest, least differentiated part of Price.com's own business per the research in claude/price-com-competitor-research-2026-08-02.md, and its full-vision version depended on a CLO network partnership that is not self-serve and realistically unreachable at this team's current scale and traffic. Cutting it removes the single riskiest, least controllable item from the entire roadmap. If GoPriceFinder's other three verticals prove out and traffic grows meaningfully, Restaurants can be re-scoped as a fresh initiative — but it is not on this roadmap, and no phase number is reserved for it.

**5.5 Local Store Recommendations — [DIFFICULTY: LOW (MVP) / VERY HIGH (FULL VISION)]**

Price.com's version is powered by a real-time local-inventory data partnership with a company called Locally — a genuine data infrastructure relationship, not a simple feature. This plan recommends an MVP version instead: a lightweight "stores near you that carry this category" directory, without live inventory data, as Phase 3. A real-time inventory version should only be pursued later, and only if the MVP proves that users actually want and use this feature.

---

## 6. Cross-Cutting Infrastructure Requirements

These are not vertical-specific — every vertical in Section 5 depends on all of them. Building them once, well, in Phase 0–2 avoids rebuilding the same logic four times.

**6.1 Daily Price Refresh Pipeline — [DIFFICULTY: MEDIUM]** — *Status: LIVE (shipped August 2, 2026)*

Currently, product prices only change when a partner's feed is manually re-imported. This blocks Price History, weakens Price Alerts, and blocks accurate "effective price" ranking once cash back rates vary by vertical. This is the single highest-leverage piece of infrastructure in the entire plan — build it first.

**6.2 Wallet & Ledger System — [DIFFICULTY: HIGH]**

An append-only transaction ledger (not just a balance field) tracking Pending, Available, and Redeemed cash back per user, across all verticals. Financial correctness here is non-negotiable — this is real money, and any bug is a trust incident, not just a software bug.

**6.3 Click-Tracking & Redirect Layer — [DIFFICULTY: MEDIUM]**

An internal redirect route that records which user clicked which offer before sending them to the partner, replacing today's direct-to-partner links. This is the mechanism that makes it possible to match a later conversion back to a specific user — without it, cash back cannot function at all.

**6.4 Conversion Tracking & Payout Automation — [DIFFICULTY: HIGH]**

Polling or webhook-based ingestion of confirmed transactions from each affiliate network, automatic Pending-to-Available state transitions, and automated payout via a real payout API (for example, a gift-card disbursement API and a cash payout API) rather than manual processing. This is the direct, concrete fix for Price.com's most common complaint — build it to be faster and more transparent than the industry norm, not just functional.

**6.5 Fraud Detection & Appeals — [DIFFICULTY: HIGH]**

Rules-based fraud detection (velocity limits, duplicate-account detection, self-referral abuse) is necessary to protect margin, but must be built alongside a real appeals process from day one. Price.com's worst reviews describe accounts silently deleted after earning cash back with no explanation — that is a design failure this plan must not repeat. A user should always be able to see why an action was flagged and contest it.

**6.6 Compliance & Partner Terms Review — [DIFFICULTY: HIGH]**

Every new affiliate relationship (hotels, gift cards) must be checked for cashback/coupon-publisher eligibility before launch, the same discipline already applied to the existing six product partners. This workstream is what prevents a repeat of the Canvas Vows situation, where a partner explicitly forbids the behavior this plan wants to build.

---

## 7. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| An existing or new partner revokes/denies cashback or coupon eligibility | Medium | High | Compliance review before launch per partner (Workstream 3.2); vertical selection (5.2/5.3) deliberately favors partners with self-serve, cashback-friendly programs. |
| Fraud losses erode margin | Medium | High | Rules-based detection plus manual review queue (6.5) before losses scale; conservative initial payout thresholds. |
| Payout delay/trust incident damages reputation, same as Price.com's worst reviews | Medium | Very High | Automated payout pipeline (6.4) with public SLA page (Phase 5) and self-serve tracking, not support-ticket-dependent resolution. |
| Traffic/volume insufficient to reach real revenue targets | High | High | Section 9 treats this honestly as the central constraint; Growth workstream (3.4) is staffed as a first-class function, not an afterthought. |
| Single-operator capacity: sequential-only work means schedule slippage in one phase pushes every later phase; no redundancy if the operator is unavailable | High | Medium | Section 3.0 and Section 4's single-track schedule already assume this — no phase assumes help that doesn't exist; Phase 5 (Coupons) is explicitly the first thing cut if a phase runs long. **Note: this risk's likelihood should be revisited now that a second team member has been confirmed — see Section 10, item 6.** |
| Wallet/ledger bug causes incorrect payouts | Low | Very High | Append-only ledger design (6.2), reconciliation owned by Finance workstream (3.5), staged rollout starting with one vertical before all three. |

---

## 8. Key Performance Indicators by Phase

| Phase | Primary KPI | Target |
|---|---|---|
| Phase 0 | Price data freshness | 100% of active products refreshed within 24 hours |
| Phase 1 | Price Alert accuracy | 0 alerts fired against stale (>24hr) price data |
| Phase 2 | Cash back tracking accuracy | ≥ 98% of activations correctly matched to a conversion |
| Phase 2 | Time to Available | Median under 45 days (faster than Price.com's typical 30-90 day range) |
| Phase 3 | Local Store directory usefulness | ≥ 3% of product-page visitors click through to a local store result within 60 days of launch |
| Phase 4 | Referral program | ≥ 10% of new signups attributed to a referral within 90 days of launch |
| Ongoing | Support-ticket rate on cash back issues | Under 1% of tracked activations, versus the multi-month resolution pattern found in Price.com's own reviews |

---

## 9. Financial Model & Realistic Revenue Trajectory

**9.1 The Honest Starting Point — [DIFFICULTY: N/A]**

Independent research found that Price.com — after raising approximately $29,000,000 across seven funding rounds since 2016 — shows an estimated ~195,000 monthly website visits, roughly 10,000 Chrome extension users, and 100,000+ app installs. Their most recent $12,000,000 raise (September 2025) was explicitly to fund new growth, which signals continued revenue scale-up, not a company that has already comfortably cleared $1,000,000/year and moved on. This plan should not assume reaching that revenue level is fast, even with strong execution.

**9.2 The Revenue Mechanism — [DIFFICULTY: N/A]**

Every vertical in this plan generates revenue the same way: an affiliate commission is earned from the retailer/partner on a completed transaction, a portion of that commission is shared back to the user as cash back, and the remainder is retained as net revenue. This spread is typically a few percent of order value — meaningful revenue at this model's scale requires real transaction volume, not just feature completeness.

**9.3 The Subscription Trade-Off, Named Honestly — [DIFFICULTY: N/A]**

Price.com's Pro subscription tier was identified as a likely secondary revenue driver precisely because it is guaranteed, recurring revenue independent of transaction volume or affiliate-network payment timing. This plan permanently excludes a subscription tier, per explicit product direction. That is a legitimate product choice, but it removes one of the two real revenue levers identified in Price.com's own model — which means GoPriceFinder's path to $1,000,000/year rests entirely on transaction-spread volume, and should be expected to take longer, or require higher traffic, than it would with a subscription layer included. This should be revisited only if a future strategic decision changes, not assumed away.

**9.4 Realistic Timeline — [DIFFICULTY: N/A]**

$1,000,000/year in net revenue from transaction spread alone is a multi-year milestone — realistically 3 to 4 years out, not the 17-20 month build-out horizon in Section 4 — dependent on sustained traffic growth, retention, and trust-building, not something that follows automatically from shipping every phase in this plan. The build-out phases make the revenue possible; they do not make it inevitable. Growth (Workstream 3.4) and Trust (Workstream 3.3) are what actually move this number after the infrastructure exists.

This timeline is more conservative than the first draft of this plan for two compounding reasons, not one: removing Restaurants removes a vertical that would have added revenue surface area, and building with a one-to-two-person team (Section 3.0) means the 17-20 month build-out itself is already the realistic floor, with no slack for delays. Treat the 3-4 year figure as a planning assumption to revisit once Phase 2 (Cashback v1) is live and real conversion, payout, and retention numbers exist — not as a target to defend.

---

## 10. Open Decisions Still Needed

1. Confirm the three-vertical scope (Products, Gift Cards, Hotels), the explicit removal of Restaurants from scope entirely, and the explicit exclusion of Flights, matching the direction already given.
2. Confirm the gift-card model (flat cash back on face value, matching Price.com) rather than pursuing discount-resale arbitrage.
3. Decide the minimum redemption threshold and initial payout methods (a gift-card payout API and/or a direct cash payout API).
4. Decide the referral bonus structure (flat amount, percentage of referred user's first cash back, or a capped structure).
5. Confirm whether the existing six product partners should be individually re-approached for cashback/coupon eligibility, or whether new-vertical partners (hotels, gift cards) should be prioritized first since they carry no existing restriction.
6. Confirm the single-operator assumption in Section 3.0 is accurate — **a second team member has since been confirmed (as of early August 2026), so the sequential-only schedule in Section 4 should be revisited now**, since it is the single biggest lever on the timeline. This is the one item in this section whose facts have changed since the plan was first written.

---

## 11. Immediate Next Actions (First 30 Days)

1. Begin Phase 0: build the daily price-refresh pipeline (Section 6.1) — the highest-leverage single piece of work in this entire plan. **Status: done, live in production since August 2, 2026.**
2. Draft and send compliance/eligibility outreach to Booking.com and Expedia affiliate programs, and to two to three gift-card affiliate programs, during the idle time built into Phase 0 (waiting on partner responses), so Phase 2 does not start from a cold outreach list. **Status: not yet started.**
3. Stand up the price_history table and begin daily snapshotting so Price History has real data by the time Phase 1 begins. **Status: done, live alongside the price-refresh pipeline.**
4. Draft the wallet/ledger schema (dormant, no activation flow yet) so Phase 2 does not start from zero. **Status: not yet started.**
5. Confirm the open decisions in Section 10 before Phase 2 engineering work begins in earnest. **Status: pending — see Section 10.**

---

## 12. Tooling, Connectors & Claude Code Setup

This plan assumes the operator works closely with Claude Code / Claude in Cowork throughout the build-out, not just for one-off coding help. The right connectors and skills turn a one-person team into something closer to a one-person team with real leverage. Recommendations below are ranked by when they matter, not alphabetically.

### 12.1 Connect Now (Phase 0)

- Supabase MCP connector — already the database of record. Use it directly for schema migrations (the wallet/ledger tables in 6.2, the price_history table in 6.1), reading logs when the price-refresh job misbehaves, and checking advisors before shipping anything that touches money. **Status: connected and in active use.**
- Vercel MCP connector — deployments, build logs, runtime errors, and web analytics without leaving the session. Useful for catching a broken deploy or a regression in Core Web Vitals immediately rather than discovering it days later. **Status: connected and in active use.**
- GitHub connector or CLI access — every phase in Section 4 should ship as reviewable commits/PRs, especially Phase 2 (wallet/ledger, payout automation) where a bad merge is a financial bug, not a cosmetic one. **Status: repo access confirmed, push currently only from the local machine.**

### 12.2 Connect Before Phase 2 (Cashback v1)

- An email-sending connector (e.g. Resend) or equivalent — cash back activation confirmations, payout notifications, and price-alert emails are all real product requirements from Phase 1 onward, not nice-to-haves; wire this up before Phase 2 needs it, not during. **Status: not yet connected.**
- Gmail/Calendar connectors — useful for managing the compliance and partner-outreach correspondence described in Section 3.0 (Booking.com, Expedia, gift-card programs) in the same place the engineering work happens, instead of a separate inbox workflow. **Status: not yet connected.**

### 12.3 Skills Used Throughout

- The docx skill — for any deliverable meant to be reviewed or shared outside the codebase (this plan, partner compliance write-ups, investor-style summaries if ever needed).
- The xlsx skill — recommended for Section 3.5's unit-economics tracking (commission-in vs. cash-back-out spread per vertical) once Phase 2 goes live; a real spreadsheet, not a mental model, is what lets one person catch a vertical quietly losing money.
- Claude Code Remote scheduled tasks — for anything that must run on a cadence without a person remembering to trigger it: the daily price-refresh job (6.1) is the obvious first candidate, followed later by a periodic fraud-pattern review once Phase 2's fraud rules (6.5) are live.

### 12.4 Use Selectively, Not By Default

- Multi-agent workflows (fan-out/parallel subagents) — genuinely useful for one-time heavy-lift work like the original Price.com research pass, or a future compliance sweep across every affiliate partner's terms at once. Not something to reach for on routine feature work; for a one-person team the overhead of orchestrating several agents rarely beats just doing the task directly.
- Design tools (e.g. a Figma connector) — only worth wiring up if the operator is doing real visual design iteration beyond what Tailwind component patterns already cover; skip it if the design system stays code-first.

None of this tooling changes the schedule in Section 4 by itself — it reduces the hours each phase actually costs, which is the only lever available to a one-to-two-person team working against a fixed roadmap.

---

*End of plan. All findings on Price.com referenced above are sourced in claude/price-com-competitor-research-2026-08-02.md. This version adds live status annotations (Sections 6.1, 10, 11, 12) confirming what's shipped since the plan was first written on 2026-08-02 — the plan's substance, phases, and open decisions are otherwise unchanged.*
