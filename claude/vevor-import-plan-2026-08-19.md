# Vevor import plan (2026-08-19) — MEASURED, and the measurement pushes back

Prepared per the operator's selection principle: intersect multi-seller
overlap × price point × category fit; report survivors before proposing
a number. The measurement ran — and found a structural blocker that the
plan must lead with rather than bury.

## The filter numbers

- **Universes:** AWIN feed 20,453 SKUs (the membership we hold); CJ
  feed 15,146 (not a member; rank-4 gate). The two are DIFFERENT
  slices, not the same catalogue twice.
- **Price tiers (CJ, exact via totalCount):** ≥$100 → 6,797; ≥$300 →
  1,738; ≥$500 → 932. AWIN side: ≥$100 → 8,844.
- **Multi-seller share, ≥$100 tier, CORRECTED:** first pass read 92%
  but 47/60 hits were Vevor's own regional programmes (AU/CA/UK/MX) —
  same merchant, not a counterparty; excluded. **Real share: 43/60 =
  72%**, dominated by UnbeatableSale (41/60 = 68% alone), then Wayfair
  (12), Zoro (3).
- **Survivor estimates (IF identity were attachable):** ≥$100 ≈ 6,797 ×
  72% ≈ **4,900**; ≥$300 ≈ **1,250** (per-tier share unmeasured —
  assumed flat, flagged).
- **Category fit: NOT computable from either feed.** AWIN
  merchant_category/category_name are EMPTY on all 8,844 ≥$100 rows;
  CJ googleProductCategory came back empty on the sample too. Category
  selection would be title-keyword heuristics — the §13 model-token
  hazard's cousin. Flagged, not attempted.

## THE STRUCTURAL BLOCKER: no per-product bridge between the feeds

The import source must be the AWIN feed (that's the membership and the
commission). But AWIN-Vevor carries NO identifier column, and no bridge
to CJ's GTINs exists: **SKU bridge 0/300** (CJ `id` is a GTIN-like
code; AWIN merchant_product_id is opaque alphanumeric), **title bridge
12/500 = 2%** (different title copy AND different catalog slices).

Consequence, stated plainly: **products imported from AWIN-Vevor cannot
be joined to their counterparties.** The 72% multi-seller share is
real, and unreachable through the membership we hold. Two paths:

- **Path A — comparison-capable:** apply to Vevor on CJ (rank 4 —
  probably gated at 227/mo; unlock ≈5k/mo), import from the CJ feed
  (GTIN-native, identity attaches at import via the new capture),
  links/commission via CJ. Requires CJ approval AND CJ-feed import
  plumbing (the importer reads CSVs; CJ products come via GraphQL —
  new, modest, not built).
- **Path B — pages and price-history only:** import an AWIN price-tier
  slice now (e.g. ≥$300 ≈ AWIN-side ~2,000 est.) selected WITHOUT the
  comparison filter, accepting those products join nothing until Path A
  exists. Honest label: this is catalogue volume and volatility data,
  not comparison inventory.

## RECOMMENDATION — and it argues with the brief that ordered it

The selection principle you mandated (multi-seller × price × category)
is COMPUTABLE FOR AAAWAVE and NOT COMPUTABLE FOR VEVOR-VIA-AWIN:
aaawave's AWIN feed is Google-template with 91% native GTIN, so its
imported products carry identity immediately and join antonline /
UnbeatableSale counterparties the day those approvals land. Vevor's
comparison capability is real but gated behind a CJ application we
probably can't win at current traffic. **For the comparison thesis,
aaawave-first stands; Vevor should wait for either the CJ-Vevor
approval (Path A) or an explicit decision to take Path B's
volume-without-comparison.** The operator re-ranked Vevor first before
this measurement existed — re-ruling requested with the numbers now on
the table.

## Staging (whichever path, whenever ruled)

Tranches of ~500 products, next tranche gated on a NAMED signal:
Search Console shows the prior tranche's URLs moving
discovered→crawled→indexed AND the overall discovered-not-indexed
backlog (203 today at 1,035 URLs) not growing faster than the tranche
added. If a tranche stalls unindexed for 3+ weeks, stop adding and
investigate quality signals instead of volume.

## Recorded alongside (findings §13b addendum)

The corrected-share lesson: a merchant's own regional programmes are
not counterparties — multi-seller tallies must exclude same-nameplate
carriers, which the league table now does. Vevor league entry stands at
72% (corrected from the raw 85%/92% reads which included
Vevor-regional rows in different proportions).
