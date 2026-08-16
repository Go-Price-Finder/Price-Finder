# Incident: PriceHistoryChart rendered unmeasured price history on every product page

**Status:** suppressed in production (`cfc8c03`, 2026-08-16). Component,
data, and RLS untouched; single-commit revert restores rendering — but see
the restore condition, which is deliberately stricter than "revert."

## What shipped

A camelcamelcamel-style price-history chart (`components/PriceHistoryChart.tsx`)
on **all 954 product detail pages**, across all six partner templates,
ungated. For each product it fetched `public.price_history` client-side
(RLS policy "Anyone can read price history", role public, qual `true` —
verified against `pg_policy`) and rendered a 90-day price line with
Lowest / Average / Highest stats, plus an affirmative claim when current
price ≤ tracked low: *"This is the lowest price we've tracked in the last
90 days."*

## How long

13 days: shipped `38f0ce2` 2026-08-03, suppressed `cfc8c03` 2026-08-16.

## The problem

`price_history` has never held an observed merchant price. The snapshot
cron records **our own static display price** daily — the
`current_prices` merge in `lib/pricing/getEffectivePrice.ts` has never hit
(see `claude/pricing-pipeline-findings-2026-08-16.md`, Section 2). So:

- **949 products** rendered a flat line asserting ~13 days of price
  stability nobody observed. Flat is not neutral: a flat chart is an
  affirmative claim that the merchant's price did not move, and we have no
  basis for it.
- **5 products** (all king-koil, all from the `87877a2` catalog rewrite of
  2026-08-02) rendered movement that was a catalog edit, not a market
  event. Three of them (pump-5, pump-6, pump-11 — current price equal to
  the tracked low) displayed the affirmative lowest-price claim, sourced
  entirely from that rewrite.
- **Worst case:** `king-koil:…-pump-7` displayed "Lowest: $79.95" against a
  current $179.95 — a 55.6% price advantage implied on a price no customer
  could ever have transacted at. (Verified live in `price_history`:
  low 79.95, high 179.95, current 179.95.)

## Root cause

**A correct component rendering a mis-modelled table.** The component's own
header says it reads "real rows … not fabricated data." That is true of its
inputs and false of its output: the rows are real; what they *mean* is not
what the chart says they mean. The chart's y-axis label is, implicitly,
"the price at this retailer on this day." The table's actual content is
"the price our site displayed on this day" — which, with the merge broken,
is "the price in our static catalog on this day." No bug exists in the
component, the query, the cron, or the RLS policy; every piece works as
written. The failure is that the table's name and the table's meaning
diverged, and the component trusted the name. This is the same failure
family as the rest of the 2026-08-16 findings — a thing not measuring what
its name claims — expressed this time as a user-facing feature.

## Why suppression is total, not partial

Suppressing only the five moved products, or only the lowest-price line,
would keep 949 flat charts asserting stability we never measured.
CLAUDE.md's real-data rule ("never invent placeholder numbers … or made-up
statistics in anything that ships") has no exception for fabrication that
looks plausible. The whole component returns `null` via a constant-gated,
hook-free wrapper; it mounts nothing and fetches nothing.

## What was deliberately NOT done

- `price_history` rows: untouched (they are evidence — see the findings
  doc's no-deletion rule).
- RLS policy: unchanged.
- Component code: fully intact below the gate.
- The `getEffectivePrice` merge bug: still unfixed, still unauthorized.

## Restore condition

Restoring the chart requires **provenance, not just the merge fix**:

1. `price_history` rows must carry provenance distinguishing observed
   merchant prices from display-price snapshots and catalog-rewrite
   artifacts (the 5 king-koil movements above are the proof that rewrite
   artifacts already exist in the table).
2. The chart must read only observed rows (or rows after a recorded
   cutover date, per the findings doc).

Fixing the merge alone changes what *future* rows mean; it does nothing
about the 14 days of display-price snapshots already in the table, and a
restored chart would render them as market history again the moment it
mounted. The gate comment in the component carries the same condition.

## Verification

- Local gate: `tsc` 0, `eslint` 0, `next build` 1043/1043, First Load JS
  unchanged at 103 kB.
- Production: deployed SHA confirmed `cfc8c03` via Vercel API; product page
  fetched post-deploy and confirmed free of the chart container (the chart
  body was client-rendered, so the check asserts the absence of its
  loading-state markup, which WAS in the prerendered HTML).
