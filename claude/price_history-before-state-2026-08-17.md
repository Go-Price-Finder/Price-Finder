# `price_history` before-state — captured 2026-08-17 02:47 UTC

Captured by the Cowork session immediately before migration `0015`
(provenance columns + `legacy_pre_provenance` backfill). Same standard as the
mojibake repair: a fingerprint that would detect a value change, captured
before the change, so "no price was touched" is a checked claim rather than an
assertion.

## Global

| metric | value |
|---|---|
| rows | 14293 |
| distinct products | 954 |
| sum(price) | 4051649.50 |
| avg(price) | 283.470895 |
| min(price) | 2.00 |
| max(price) | 4999.99 |
| first recorded_date | 2026-08-02 |
| last recorded_date | 2026-08-16 |
| row-level fingerprint | `557db9985e620a55e8b0dc62aef34db3` |

Fingerprint definition (reproduce exactly to compare):

```sql
select md5(string_agg(id::text || '=' || price::text, ',' order by id))
from price_history;
```

## Per-date

Per-date fingerprints localise any change to a single day rather than only
proving that *something* moved.

| recorded_date | rows | sum(price) | fingerprint |
|---|---|---|---|
| 2026-08-02 | 937 | 267926.76 | `8bc5543e06e67030cd95228fff995817` |
| 2026-08-03 | 954 | 270265.91 | `f9f82de4ae1700c5117d690395dced56` |
| 2026-08-04 | 954 | 270265.91 | `723d76c1fed759f864ad525181e2df74` |
| 2026-08-05 | 954 | 270265.91 | `5ec16517dbbba984c051647947671dcb` |
| 2026-08-06 | 954 | 270265.91 | `077a80bd1fceb16531b29e11688478e2` |
| 2026-08-07 | 954 | 270265.91 | `73fa10f2109f439ecf92a4a302fdab86` |
| 2026-08-08 | 954 | 270265.91 | `907d81debad705a974b727b4552deaec` |
| 2026-08-09 | 954 | 270265.91 | `261a4c15afa8b9ffac67c4db0bb027ae` |
| 2026-08-10 | 954 | 270265.91 | `b4bc7b7327480653e3c2cff764f01ab6` |
| 2026-08-11 | 954 | 270265.91 | `d3a51064e0065057a1c9a01e88ca2fa0` |
| 2026-08-12 | 954 | 270265.91 | `6390895ed8c003199c7ba5f8463878ee` |
| 2026-08-13 | 954 | 270265.91 | `09cb331f0ec19ee49eb86b7ce5d36123` |
| 2026-08-14 | 954 | 270265.91 | `3392e74b0acfe85c1b7979e44b98a851` |
| 2026-08-15 | 954 | 270265.91 | `2dfb51c4272d98c42a2c7abc4e418458` |
| 2026-08-16 | 954 | 270265.91 | `33f79173bb0097df5fc1621c5de59e62` |

**Note on what this table shows independently of the migration:** every date
from 08-03 onward has an identical `sum(price)` of 270265.91 while its
fingerprint differs — the fingerprints differ only because row `id`s are
per-row UUIDs, not because any price moved. Thirteen consecutive days of an
identical catalog-wide price sum is Finding B visible in one column.

## Prediction, stated before applying

- rows: **14293**, unchanged
- sum(price): **4051649.50**, unchanged
- global fingerprint: **`557db9985e620a55e8b0dc62aef34db3`**, unchanged
- `price_source = 'legacy_pre_provenance'`: **14293**
- `observed_at`, `feed_id`, `feed_last_imported_at`, `feed_last_checked_at`,
  `catalog_price_at_snapshot`: **NULL on all 14293**

## Which result would mean the CHECK is wrong rather than the data

- **Fingerprint changes but rows / sum / min / max all match** → the check is at
  fault, not the data. Most likely cause is `numeric::text` rendering or
  `string_agg` ordering differing between runs. Re-verify with a per-row
  self-join against a snapshot table before concluding anything about prices.
- **rows or sum(price) changes** → the **data** changed. Stop, do not proceed,
  report. Nothing in this migration writes to `price`, so any movement here is
  either a concurrent writer or a defect in the migration.
- **Per-date fingerprint changes on exactly one date** → look for a concurrent
  writer on that date before suspecting the migration, which touches all dates
  uniformly.
