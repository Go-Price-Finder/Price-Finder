# Migration `0016` — `feed_status` + per-product `feed_id` (Offers plan, Step 2)

**2026-08-17. APPLIED TO PRODUCTION ~03:31 UTC** via the Supabase MCP
`apply_migration` tool (DDL) plus `execute_sql` (seed + backfill). Not pasted.
Announced per the standing rule.

**All eight gate assertions passed**, with one honest exception recorded in §5:
Gate D passed part 1 (72/72 evdance on `F1320`) but **part 2 is not verified** —
confirming that no evdance product traces to frozen feed `108581` requires
fetching that feed, which needs `AWIN_FEED_LIST_URL`. Assigned to Claude Code,
which holds that credential. The assumption is recorded in `feed_status.notes`
and stays open until it reports.

| gate | expected | actual |
|---|---|---|
| A — null `feed_id` | 0 | **0** |
| B — tsar-bomba 113495 / 105368 | 246 / 26 | **246 / 26** |
| C — price fingerprint | `7e98c30603e7d0659dad827c7a19a7be` | **identical** |
| C — price sum | 270265.91 | **270265.91** |
| D — evdance on F1320 | 72 | **72** (part 2 open) |
| E — `feed_status` rows | 8 | **8** |
| F — all resolve to a catalog source | 954 | **954** |

**This is a REPLACEMENT.** The interim per-product as-of fix shipped in
`790b646` and is production-verified. Claude Code must **delete**
`lib/price-as-of.ts`'s interim path in the same change that switches the reader
to `catalog_products.feed_id` — two hand-maintained layers collapse into one
resolvable join, and leaving the interim in place would mean three.

Ships **alone**, ahead of the rest of `offers-migration-plan-2026-08-17.md`. It
fixes a live 79-day freshness overclaim on 26 pages and has no dependency on the
offers work.

---

## 0. Two corrections to the plan document before anything else

**1. The plan cited the wrong attribution source, and it does not contain what I
said it did.** `offers-migration-plan-2026-08-17.md` Step 2 says the tsar-bomba
246/26 split comes from `scripts/_tsarbomba-mapping.json`. That file is a
three-key column-name map (`deepLink` → `aw_deep_link`, etc.) and carries no
product-to-feed attribution at all. **The real source is
`scripts/_tsarbomba-merged-feed-fresh.csv`**, which has a `data_feed_id` column
per row.

That correction turns out to make the step *stronger*, because the real source
is per-row rather than inferred — see §2 for the verification it made possible.

**2. Tsar Bomba is not the only partner drawing from more than one feed.**
`lib/pricing/refreshPrices.ts` records that EVDANCE has **two** active English
feeds: `F1320` (81 products, current, pinned) and **`108581` (1 product, stale
since 2026-05-15)** — the same freeze date as the other frozen feeds. So:

- **Three of our feeds are caught in the 2026-05-15 freeze, not two.** The
  project record currently names Canvas Vows 103552 and Tsarbomba 105368. EVDANCE
  108581 is a third. It supplies at most 1 product and is not pinned, so the
  practical exposure is small — but "two frozen feeds" is a scoping
  understatement, and this project's convention is to correct understatement as
  well as error.
- **EVDANCE's feed attribution for its 72 catalog products is UNVERIFIED.** The
  catalog was imported 2026-07-25 (`14dc4cf`), *before* `pinnedFeedId` existed,
  so which feed that import read is not recorded anywhere I can check. The
  backfill below assigns all 72 to `F1320`, which is the overwhelmingly likely
  answer, but it is an **assumption, not a measurement**, and Gate D exists to
  bound its blast radius.

---

## 1. Feed IDs — verified independently of the relay

Per instruction, verified against repo and feed data rather than taken from the
relay. I could **not** query the live AWIN feed list: that needs
`AWIN_FEED_LIST_URL`, which is a credential-bearing URL this session must not
read. Every ID below is instead corroborated by a committed artifact.

| partner | feed ID | verified how | relay matched? |
|---|---|---|---|
| canvas-vows | `103552` | `lib/price-as-of.ts` + `scripts/_canvas-vows-feed.csv` | ✓ |
| king-koil | `101819` | **literal `data_feed_id` column value** in `scripts/_king-koil-feed-fresh.csv` | ✓ |
| tsar-bomba (frozen) | `105368` | `data_feed_id` value in the merged feed CSV; commit `87877a2` | ✓ |
| tsar-bomba (fresh) | `113495` | `data_feed_id` value in the merged feed CSV; commit `87877a2` | ✓ |
| evdance | `F1320` | `pinnedFeedId` in `lib/pricing/refreshPrices.ts` | ✓ |
| golden-maple | `F2615` | code comment in `refreshPrices.ts` ("exactly one active feed") | ✓ |
| brooklyn-delhi | none | `refreshPrices.ts`: "0 of 21 active feeds belong to it" | ✓ |
| evdance (second) | `108581` | `refreshPrices.ts` — **not in the relay** | added |

**All seven relayed IDs check out.** The strongest single verification is
king-koil `101819`, which appears as the actual `data_feed_id` value inside the
feed file rather than in prose about it.

---

## 2. The tsar-bomba split — measured, not inferred

`scripts/_tsarbomba-merged-feed-fresh.csv`, 272 rows, `data_feed_id` counts:

```
113495 → 246     105368 → 26
```

Exactly matching commit `87877a2`'s own claim of "246 US + 26 Default-only =
272", from an independent artifact.

**The 26 join to `catalog_products` exactly.** Their `aw_product_id` values
appear in `catalog_products.deep_link` as the `p=` parameter; a query matching
all 26 returns **26** rows — no misses, no extras. So this is not an estimate to
reconcile later; it is an exact, executable attribution.

Claude Code reached the same conclusion independently, by intersecting feed
105368's pclick ids with the catalog and reproducing `87877a2`'s own count.
Two sessions, two routes, same answer.

The 26 `aw_product_id` values:

```
41882883943 41882883952 41882883953 41882883962 41882883963 41882883964
41882883965 41882883966 41882883967 41882883971 41882883982 41882883983
41882883984 41882883998 41882884002 41882884003 41882884004 41882884005
41882884006 41882884007 41882884008 41882884009 41882884010 41882884011
41882884026 41882884057
```

**These 26 are the pages currently displaying "Price as of August 2, 2026" over
May-15 data.**

---

## 3. The `brooklyn-delhi` decision (plan Open Question 4)

Brooklyn Delhi has no feed, but its products still need an as-of date. Two
options; I recommend the first and the reason is about downstream code, not
tidiness.

- **Sentinel row, `feed_id = 'none:brooklyn-delhi'`** — RECOMMENDED. Keeps
  `catalog_products.feed_id` and later `offers.feed_id` **NOT NULL and totally
  resolvable**, so every join is inner and no consumer needs a NULL branch. The
  `none:` prefix is self-describing and cannot collide with an AWIN ID.
- Nullable `feed_id` with a separate per-partner import-date path — spreads NULL
  handling into the as-of resolver, the offers join, and every future consumer.

The sentinel trades one slightly ugly identifier for the removal of a NULL
branch from three places. Flagged as a judgment call, not a fact.

---

## 4. The migration

```sql
-- 0016_feed_status.sql
-- Vintage is a property of the FEED, not the partner. A partner may draw from
-- several feeds; a product draws from exactly one. See
-- claude/as-of-label-spec-and-copy-2026-08-17.md section 3 (revised).
-- Fixes a live 79-day freshness overclaim on 26 tsar-bomba product pages.
-- No price value is written by this migration.

create table public.feed_status (
  feed_id               text primary key,
  partner_id            text not null references public.partners(id),
  feed_name             text,
  feed_last_imported_at timestamptz,
  feed_last_checked_at  timestamptz,
  feed_status_read_at   timestamptz,
  catalog_imported_at   timestamptz not null,
  catalog_import_ref    text,
  is_catalog_source     boolean not null default true,
  notes                 text
);

comment on table public.feed_status is
  'One row per source feed, NOT per partner. tsar-bomba draws from two feeds of '
  'different vintages (105368 frozen 2026-05-15, 113495 current), which a '
  'partner-keyed model cannot express - that model shipped and produced a 79-day '
  'overclaim on 26 pages. feed_id is the shared key for three consumers: the '
  'as-of label, feed-freshness monitoring, and price provenance.';

comment on column public.feed_status.feed_last_imported_at is
  'AWIN "Last Imported", captured when we READ the feed list - never read live at '
  'render time. A feed''s Last Imported advances when AWIN re-imports it whether or '
  'not we pulled from it; reading it live would date our stale copy with someone '
  'else''s fresh timestamp. NULL means not yet captured, and LEAST() ignores NULLs, '
  'so as-of correctly falls back to catalog_imported_at.';

comment on column public.feed_status.feed_last_checked_at is
  'AWIN "Last Checked". On frozen feeds this reads EARLIER than Last Imported, which '
  'is what makes a frozen feed self-identifying. With per-feed rows, one query over '
  'this table finds every frozen feed we draw from.';

comment on column public.feed_status.is_catalog_source is
  'False for a feed we have access to but have never imported into the catalog '
  '(evdance 108581). Such a feed still belongs here for monitoring - it is part of '
  'the 2026-05-15 freeze - but must never supply an as-of date.';

alter table public.catalog_products
  add column feed_id text references public.feed_status(feed_id);

comment on column public.catalog_products.feed_id is
  'The feed that supplied THIS product. Per-product, not per-partner: tsar-bomba '
  'splits 246 (113495) / 26 (105368). Same key as offers.feed_id and '
  'price_history.feed_id.';
```

### 4.1 Seed — eight rows

Dates are UTC and traceable to commits. `feed_last_imported_at` is set **only
where a committed artifact records it**; fresh feeds are left NULL for the first
`refreshPrices` run to populate, which yields the correct as-of anyway because
`LEAST()` ignores NULLs.

```sql
insert into public.feed_status
  (feed_id, partner_id, feed_last_imported_at, catalog_imported_at,
   catalog_import_ref, is_catalog_source, notes)
values
  ('103552','canvas-vows','2026-05-15T00:00:00Z','2026-07-29T17:38:44Z','4f6f302',true,
   'Frozen at AWIN 2026-05-15; part of the 190-feed freeze.'),
  ('101819','king-koil',   null,                  '2026-08-02T23:32:59Z','87877a2',true,
   'Feed current. Last Imported to be populated by the next refreshPrices run.'),
  ('105368','tsar-bomba', '2026-05-15T00:00:00Z','2026-08-02T23:32:59Z','87877a2',true,
   'Default feed, frozen 2026-05-15. Supplies 26 of 272 tsar-bomba products.'),
  ('113495','tsar-bomba',  null,                  '2026-08-02T23:32:59Z','87877a2',true,
   'US feed, current. Supplies 246 of 272. Skipped by refreshPrices selection '
   '(vertical=Fashion) - separate issue, see pinnedFeedId.'),
  ('F1320','evdance',      null,                  '2026-07-25T19:47:53Z','14dc4cf',true,
   'Pinned in refreshPrices. Catalog attribution ASSUMED, not measured: the '
   '2026-07-25 import predates pinnedFeedId. See Gate D.'),
  ('F2615','golden-maple', null,                  '2026-07-25T19:47:53Z','14dc4cf',true,
   'Only active feed for this advertiser; no ambiguity.'),
  ('108581','evdance',    '2026-05-15T00:00:00Z','2026-07-25T19:47:53Z','14dc4cf',false,
   'Second EVDANCE feed, 1 product, frozen 2026-05-15 - a THIRD feed in the freeze. '
   'Not pinned and not believed to be a catalog source; is_catalog_source=false so '
   'it is monitored but never supplies an as-of date.'),
  ('none:brooklyn-delhi','brooklyn-delhi', null,  '2026-07-25T03:41:36Z','8f1342a',true,
   'Sentinel. AWIN has no datafeed for this advertiser (0 of 21 active feeds). '
   'Products still need an as-of date, which comes from catalog_imported_at alone.');
```

### 4.2 Per-product backfill

```sql
-- Single-feed partners
update public.catalog_products set feed_id = '103552'            where partner_id = 'canvas-vows';
update public.catalog_products set feed_id = '101819'            where partner_id = 'king-koil';
update public.catalog_products set feed_id = 'F1320'             where partner_id = 'evdance';
update public.catalog_products set feed_id = 'F2615'             where partner_id = 'golden-maple';
update public.catalog_products set feed_id = 'none:brooklyn-delhi' where partner_id = 'brooklyn-delhi';

-- tsar-bomba: the 26 Default-feed products, by aw_product_id in the deep link
update public.catalog_products set feed_id = '105368'
where partner_id = 'tsar-bomba'
  and substring(deep_link from 'p=([0-9]+)') in (
    '41882883943','41882883952','41882883953','41882883962','41882883963','41882883964',
    '41882883965','41882883966','41882883967','41882883971','41882883982','41882883983',
    '41882883984','41882883998','41882884002','41882884003','41882884004','41882884005',
    '41882884006','41882884007','41882884008','41882884009','41882884010','41882884011',
    '41882884026','41882884057');

-- remaining tsar-bomba products come from the US feed
update public.catalog_products set feed_id = '113495'
where partner_id = 'tsar-bomba' and feed_id is null;
```

**Order matters:** the 26 are set explicitly first, and the US feed claims only
what is left. Reversing it would silently overwrite the 26.

---

## 5. Gates

Run in order. Any failure stops the step; none of these is a number to reconcile
in passing.

| gate | assertion | expected | result |
|---|---|---|---|
| **A** | `select count(*) from catalog_products where feed_id is null` | **0** | ✓ 0 |
| **B** | tsar-bomba split by `feed_id` | **113495 → 246, 105368 → 26** | ✓ 246 / 26 |
| **C** | `catalog_products` price fingerprint, same expression as `0015` | **unchanged from Step 1 capture** | ✓ `7e98c306…` identical |
| **D** | evdance products all on `F1320`; **and** the count of products whose deep link matches a `108581` product | **72 on F1320; 0 matching 108581** | ✓ 72 / **part 2 OPEN** |
| **E** | `select count(*) from feed_status` | **8** | ✓ 8 |
| **F** | every `catalog_products.feed_id` resolves to a `feed_status` row with `is_catalog_source = true` | **954** | ✓ 954 |

**Gate D is the one that can genuinely fail**, and it is the check that turns
§0's EVDANCE assumption into a measurement. If any evdance product traces to
`108581`, that product's as-of is 2026-05-15, not 2026-07-25, and the backfill
must split evdance the way tsar-bomba splits. **Do not skip D on the grounds
that 108581 has only one product** — one product with a 71-day overclaim is the
same defect class as the 26, just smaller, and the whole point of this step is
that per-partner assumptions hide exactly this.

**Status of Gate D part 2, recorded honestly:** it is **not verified**, and it is
not unverifiable either — it was assigned to the wrong session. Testing it
requires fetching feed `108581`, which needs `AWIN_FEED_LIST_URL`. The Cowork
session must not read that credential; Claude Code holds it and is fetching. The
`F1320` seed row's `notes` field carries the open assumption until it reports.
Declining to mark D passed on availability grounds is the same standard as
declining to skip it on efficiency grounds.

**Gate F is the sentinel's payoff:** it can be an inner join with no NULL branch,
which is only true because of the §3 decision.

---

## 6. After this migration

`lib/price-as-of.ts` reads `catalog_products.feed_id` → `feed_status`, and the
as-of becomes:

```
as_of = LEAST(feed_status.catalog_imported_at, feed_status.feed_last_imported_at)
```

`LEAST` ignores NULLs, so a feed with no captured Last Imported yields
`catalog_imported_at`, which is the correct conservative answer.

Resulting labels — **only tsar-bomba changes**, and that change is the fix:

| products | before | after |
|---|---|---|
| tsar-bomba, 246 | Aug 2, 2026 | **Aug 2, 2026** (unchanged, and now correct rather than coincidentally right) |
| **tsar-bomba, 26** | **Aug 2, 2026** | **May 15, 2026** ← the fix |
| canvas-vows, 204 | May 15, 2026 | May 15, 2026 |
| king-koil, 29 | Aug 2, 2026 | Aug 2, 2026 |
| evdance, 72 | Jul 25, 2026 | Jul 25, 2026 (pending Gate D) |
| golden-maple, 348 | Jul 25, 2026 | Jul 25, 2026 |
| brooklyn-delhi, 29 | Jul 25, 2026 | Jul 25, 2026 |

**The hand-maintained map in `lib/price-as-of.ts` is deleted by this change, not
extended.** That was the argument for shipping Step 2 alone: any interim
per-product override list is debt layered on debt, and this removes both.

## 7. Rollback

```sql
alter table public.catalog_products drop column feed_id;
drop table public.feed_status;
```

Fully reversible. No price value is touched, so the `0015` fingerprint method
proves reversal as cleanly as it proves application.
