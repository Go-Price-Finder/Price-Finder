-- Provenance for price_history. Design: claude/price-provenance-and-as-of-proposals-2026-08-17.md Part A.
-- Phase 1 of 3. Columns are NULLABLE here ON PURPOSE: snapshotPrices does not yet
-- set them, and the daily 12:00 UTC cron upserts into this table. Adding NOT NULL
-- before the writer ships would break that cron on its next run.
-- Phase 2 (repo, Claude Code): snapshotPrices sets price_source/observed_at/
--   catalog_price_at_snapshot on every write; database.types.ts hand-edited.
-- Phase 3 (db, after Phase 2 verified in production): SET NOT NULL on price_source.
-- No statement in this migration writes to price. Values are untouched by design.

alter table public.price_history
  add column price_source              text,
  add column observed_at               timestamptz,
  add column feed_id                   text,
  add column feed_last_imported_at     timestamptz,
  add column feed_last_checked_at      timestamptz,
  add column catalog_price_at_snapshot numeric;

alter table public.price_history
  add constraint price_history_price_source_check
  check (
    price_source is null
    or price_source in ('live_override', 'catalog_fallback', 'legacy_pre_provenance')
  );

comment on column public.price_history.price_source is
  'Which layer supplied this row''s price. live_override = from current_prices (feed-observed). '
  'catalog_fallback = no override existed; value is our own catalog/static file. '
  'legacy_pre_provenance = written before provenance existed; known catalog echo, since the '
  'override merge never fired before 11ae044 (2026-08-17T01:33Z). '
  'NULL = the writer did not record provenance. NULL on a row dated >= 2026-08-17 means the row '
  'was written post-merge-fix but before snapshotPrices was taught to set this column; such a row '
  'is live-but-unprovenanced and must NOT be treated as an observation.';

comment on column public.price_history.observed_at is
  'When the price was last actually taken from a feed (current_prices.updated_at of the row that '
  'supplied it). NULL for catalog-sourced rows: we have no observation, and NULL says so.';

comment on column public.price_history.feed_id is
  'AWIN Feed ID that supplied the observation, captured at write time. Inert until refreshPrices '
  'persists it (spec as-of-label-spec-and-copy-2026-08-17.md 4.1-4.3, not yet shipped).';

comment on column public.price_history.feed_last_imported_at is
  'AWIN "Last Imported" for that feed AS READ AT WRITE TIME - never read live at render. A feed''s '
  'Last Imported advances when AWIN re-imports, whether or not we pulled from it; reading it live '
  'would date our stale copy with someone else''s fresh timestamp. Inert until 4.1-4.3 ship.';

comment on column public.price_history.feed_last_checked_at is
  'AWIN "Last Checked", diagnostic. On frozen feeds this reads EARLIER than Last Imported, which is '
  'what makes a frozen feed self-identifying. Inert until 4.1-4.3 ship.';

comment on column public.price_history.catalog_price_at_snapshot is
  'The catalog price for this product at snapshot time, recorded alongside whatever price was '
  'written. Load-bearing: catalog_products keeps NO history, so once a catalog is re-imported the '
  'previous price is gone and price_history is the only place a re-import is observable at all - '
  'and only if this column is populated. A change here between consecutive days means a re-import '
  'occurred, and any coincident price change is an artifact until proven otherwise. This is the '
  'column that catches the 79.95 -> 179.95 king-koil case. Deliberately NOT backfilled: today''s '
  'catalog price is not the historical one, and writing it would fabricate a value we do not have.';