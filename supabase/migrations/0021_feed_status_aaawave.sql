-- 0021_feed_status_aaawave
-- The feed_status row for aaawave F2639. Applied AFTER the tranche-1 import
-- landed, which is the only point at which this row can honestly exist:
-- catalog_imported_at is NOT NULL, so the row asserts an import happened.
--
-- Written from Claude Code's handoff, with three corrections made as second
-- reader after measuring the live table. Each is stated so it can be disputed:
--
--   1. catalog_import_ref shortened to '98f14c9'. All four existing distinct
--      refs are 7-char short shas (8f1342a, 4f6f302, 14dc4cf, 87877a2). The
--      handoff supplied the full 40-char sha. Same commit, house format.
--   2. feed_last_imported_at populated with 2026-08-18. AWIN's own "Last
--      Imported" for F2639, read from the feed list at import time and used
--      in the same breath to corroborate the PARTNER_AWIN_NAMES entry. The
--      handoff omitted it while reporting it as verified. Date only, no time,
--      because AWIN reports a date -- matching the 2026-05-15 rows.
--   3. notes populated. Every one of the eight existing rows carries notes;
--      this is where the table keeps its institutional memory. The aaawave
--      row has a caveat that will otherwise be misread on first sight.
--
-- feed_name and feed_status_read_at left NULL. Both are knowable in principle
-- and neither was measured, and all eight existing rows are NULL on both.
-- Guessing a plausible minute for feed_status_read_at would be invention.
--
-- Preconditions verified against the live schema before applying:
--   feed_status_pkey is PRIMARY KEY (feed_id) alone -- 'F2639' collides with
--   none of the eight existing feed_ids.
--   feed_status_partner_id_fkey references partners(id) -- 'aaawave' present
--   since 0020.
--   Zero existing feed_status rows for partner_id 'aaawave'.
--   catalog_products: 500 aaawave rows, 500 with gtin, 500 DISTINCT gtin
--   (no intra-partner collisions), 1454 rows total.

insert into public.feed_status (
  feed_id,
  partner_id,
  is_catalog_source,
  feed_last_imported_at,
  catalog_imported_at,
  catalog_import_ref,
  notes
)
values (
  'F2639',
  'aaawave',
  true,
  '2026-08-18T00:00:00Z',
  '2026-08-19T01:24:57Z',
  '98f14c9',
  'Tranche 1. F2639 carries 1,683 rows; we imported 500, selected GTIN-bearing x highest-price. matched will therefore be far below feed_rows on every refresh line BY DESIGN -- that gap is the selection, not a match failure, and must not be read as breakage. All 500 carry a GTIN and all 500 GTINs are distinct. catalog_imported_at is the import commit''s timestamp, matching the convention of the other rows; the database sync itself completed a few minutes earlier.'
);
