# AWIN + Rakuten Advertiser Research — Standing Role Notes

**Status (2026-07-25):** This chat is the standing point of contact for
affiliate-network advertiser intel for GoPriceFinder.com — parsing directory
exports (any network), scoring fit, and proactively flagging category gaps.
Not something to re-scope each time; just do it and report a concrete
recommendation.

## Pass 1 (2026-07-25): AWIN full directory export

Kawsar uploaded `advertiserdirectory_1.csv` — a bulk AWIN network export of
11,050 unique advertiser programmes (not a curated shortlist). Delivered as
`GoPriceFinder_AWIN_Advertiser_Recommendations.xlsx` (5 sheets: Summary, Top
Picks by Category, Full Shortlist scored, Category Gaps, Data Caveats).

### Filtering pipeline
1. Excluded non-retail sectors (Telco, Travel, Finance, B2B/Lead-Gen,
   Education, Web Hosting, Insurance, Software) → 9,275 of 11,050 remain,
   mapped into 10 groups: Electronics, Fashion, Home Goods, Health & Beauty,
   Sports & Outdoors, Toys/Kids/Baby, Pets, Gifts & Flowers, Books & Media,
   Automotive.
2. Hard filter to `feedEnabled == yes` (6,918 of 11,050 have no feed and were
   excluded everywhere), `primaryRegion == US` (10,962 of 11,050), and
   `paymentStatus != red` (only 1 programme in the whole export was red) →
   3,623 "viable" candidates.
3. Scored viable candidates 0-100 within each category: 35% AWIN Index + 25%
   Approval Rate + 20% normalized EPC + 10% Payment Status + 10% normalized
   Cookie Length.
4. Top 8 per category → Apply/Consider recommendation.

### Key findings
- Fashion (1,201 viable) and Home Goods (755 viable) are the deepest,
  cleanest categories.
- Electronics is thin (274 viable, all niche/DTC brands). Checked by name:
  **zero hits** for Best Buy, Newegg, Samsung, Sony, Lenovo, Microsoft,
  GoPro, Logitech, Bose, Wayfair, IKEA, Home Depot, Lowe's, Costco, Walmart,
  Target, Macy's, Nordstrom — these majors run on CJ Affiliate, Impact
  Radius, or Rakuten Advertising instead of AWIN.
- Pets (31 viable) and Automotive (78 viable) are the smallest usable
  categories.
- Flagged one data anomaly: "Auraelis Couture" showed EPC=$383.68 (extreme
  outlier) but launched Dec 2025 — marked "Consider, verify volume."

## Pass 2 (2026-07-25, same day): Rakuten full directory export

Kawsar uploaded `advertisers.csv` — a bulk Rakuten Advertising export of
1,216 unique advertisers (again the full directory, not a curated list).
Delivered as `GoPriceFinder_Rakuten_Advertiser_Recommendations.xlsx` (6
sheets: Summary, Top Picks by Category, **Priority Brand Matches** [new —
see below], Full Shortlist, Category Gaps, Data Caveats).

### Schema differences from AWIN (important for future passes)
Rakuten's export has a completely different shape — no AWIN-Index,
approval-rate, or EPC fields exist. Available signal instead: `Advertiser
Status` (A/S), `Features: Product Links` (feed equivalent), `Features: Is
Auto Approve`, `Features: Deeplinks`, `Features: ITP` (privacy-compliant
tracking), and `Commission Range` (free-text like `[5.0% - 10.0%]` or
`[$50.00]`, parsed into min/max/type). Two feature columns (`Media
Optimization Report`, `Cross-Device Tracking`) were **entirely blank** for
all 1,216 rows — dropped from scoring. Categories are a flat, non-exclusive
comma-separated tag list per advertiser (not a single primarySector), so an
advertiser can legitimately land in more than one category group — the
scoring/shortlist code explodes one row per (advertiser, matched group) to
handle this correctly rather than picking just one.

### Filtering & scoring pipeline
1. Mapped Rakuten's ~60 raw category tags into the same 10 category groups
   used for AWIN (details of the tag→group mapping are in
   `build_rakuten_report.py`, not persisted elsewhere — regenerate from the
   CSV if needed for a future refresh). Excluded ambiguous tags entirely
   from automated scoring: `Equipment`, `Consumer`, `Art`, `Collectibles`,
   `Supplies` — these mix genuinely unrelated product types (e.g.
   `Equipment` covers fitness gear, office equipment, and consumer
   electronics all at once).
2. Hard filter: `Advertiser Status == 'A'`, `Features: Product Links ==
   'Y'`, ships to US → 954 unique viable advertisers (1,556 rows across
   categories).
3. Score = 45% normalized commission midpoint + 20% Auto-Approve bonus +
   20% Deeplinks bonus + 15% ITP bonus, ranked within each category.

### Key finding — Rakuten has real national brands AWIN's export lacked
Unlike AWIN (zero hits for any major electronics/home retailer), this
Rakuten export **does** include: **Newegg** (electronics superstore, feed
enabled — the single best electronics find across both passes), **IKEA**,
**Dyson**, **Anker** (Innovations + SOLIX), **Keurig**, **KitchenAid Major
Appliances**, **Reebok**, **UGG US**, **Estee Lauder**, **Clinique Online**,
**e.l.f. cosmetics**, and **Bass Pro Shops & Cabela's Canada**. Two more
(**Samsung VXT US**, **Seagate**) are present but have `Features: Product
Links = N` — no feed, so excluded from viable shortlists despite the brand
value; worth a direct inquiry if a feed later becomes available.

These brands mostly carry low, unremarkable commission (2-8%, since majors
don't need to compete on payout), so a pure commission-weighted score buries
them below small DTC brands paying 15-20%+. Built a dedicated **"Priority
Brand Matches"** sheet listing them regardless of automatic score — for a
price-comparison site, brand recognition and catalog breadth outweigh
commission rate. This is now a standard step for any future network export:
after the automated top-picks pass, always run a manual brand-name sweep
(grep for major retailer names in each category) and surface anything found
in a dedicated sheet, since the commission-based formula systematically
under-ranks recognizable names.

### Other findings
- Electronics again thin (21 viable) but qualitatively better than AWIN's
  because Newegg is real.
- **No dedicated Sports/Outdoors category tag exists in Rakuten's taxonomy
  at all** (structural gap, not just thin supply) — sports merchants get
  filed under generic tags like `Equipment`/`Clothing` instead. Bass Pro
  Shops & Cabela's Canada was the only one surfaced this way; a manual pass
  through the 73 `Equipment`-tagged advertisers would likely find more.
- Automotive (10 viable) includes recognizable names this time: NAPA,
  CarParts.com, Escort Radar, Cobra Electronics.
- Fashion (628 viable) and Health & Beauty (226 viable) are the deepest
  categories here, consistent with the AWIN pass's Fashion/Home-Goods
  conclusion.

## Known limitations (apply to both passes)
- Neither export has commission T&C text, exclusivity clauses, or brand/
  logo-usage restrictions — those only appear on each advertiser's actual
  network programme page, only visible after applying/being accepted. No
  "Apply" call from either pass has had that page checked yet — would need
  either network portal login (no credentials available to this session) or
  the user/team doing it manually.
- Rakuten's `Auto-Approve = Y` is true for only 14 of 1,216 advertisers —
  budget lead time for manual application review even on top picks.

## Open items for next session
- No AWIN or Rakuten portal login available to this session — can't pull
  live T&C/branding-restriction text per advertiser directly. Would need
  either network API credentials or a Chrome browser-automation pass with
  Kawsar's logged-in session on the relevant network.
- Haven't cross-checked either shortlist against GoPriceFinder's existing
  partners (Brooklyn Delhi, EVDANCE, Golden Maple) for category overlap —
  none of the three overlap with the top-picked categories so far, but worth
  a check on future imports.
- CJ Affiliate / Impact applications for the electronics/home/fashion majors
  identified as missing from *both* AWIN and Rakuten (Best Buy, Walmart,
  Wayfair, Target, Samsung, etc.) haven't been started — a separate network
  each, out of scope unless asked to expand this role to cover them too.
- If a third network export shows up, reuse this same pipeline shape:
  (1) map raw categories to the same 10 groups, (2) hard-filter on
  feed/status/region equivalents, (3) score with whatever signal that
  network actually reports, (4) always run the manual brand-name sweep and
  put hits in a Priority Brand Matches sheet regardless of score.
