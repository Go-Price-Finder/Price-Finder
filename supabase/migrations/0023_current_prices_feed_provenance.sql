-- 0023_current_prices_feed_provenance
-- Feed provenance on current_prices, mirroring price_history.
--
-- WHY THIS EXISTS. The as-of label is one sentence for every price:
-- "Price as of {date}", where {date} is ALWAYS the merchant's own feed export
-- timestamp -- never the moment we read the feed. Our reading a price does not
-- make it newer. current_prices currently has no column that can hold that
-- date, which is the sole remaining blocker on serving live prices: we cannot
-- name the date the live price is as of, so we decline to claim one.
--
-- SHAPE MIRRORS price_history DELIBERATELY. Both tables describe the same
-- observation -- a price, from a feed, at a vintage. Two tables describing one
-- thing should describe it the same way, or a future reader must learn two
-- vocabularies for one fact and will eventually conflate them.
--
-- ONE DELIBERATE ASYMMETRY: price_history also carries feed_last_checked_at
-- (when AWIN last checked the feed). It is NOT added here, on purpose. It
-- plays no part in the as-of label, and an unused column invites someone to
-- populate it "for symmetry" and then read it as though it meant something
-- about this price. Recorded so the omission reads as a decision, not a miss.
--
-- BOTH NULLABLE, and NULL carries a specific meaning that must not drift:
-- "we do not know this row's feed vintage." It does NOT mean "no feed" and it
-- does NOT mean "not refreshed." Every row existing before this migration is
-- NULL because the value was never captured, not because it is absent.
--
-- Note this table only ever holds LIVE prices. A partner with no feed
-- (brooklyn-delhi) has no rows here at all -- refreshPrices skips it at the
-- feed_status sentinel -- so "no feed" is not a case this column represents.
--
-- The render contract that depends on this: a LIVE price whose vintage is NULL
-- renders NO as-of stamp. It must never fall back to the catalog vintage,
-- which describes the import and not this number. Catalog prices are a
-- different path entirely and do render a stamp from their own vintage.
--
-- NO BACKFILL, and unlike price_history that costs almost nothing.
-- refresh_runs logs feed_id per partner per run but never logged a vintage, so
-- existing rows cannot be reconstructed. current_prices is current-state --
-- every row is overwritten on each refresh -- so the unrecoverable gap is one
-- 11:00Z run, not nineteen days of history. The next refresh populates
-- everything a live feed can populate.
--
-- Preconditions to verify against the live schema before applying:
--   current_prices columns are exactly: product_id, retailer, price,
--   original_price, source, updated_at -- no column matching feed% exists.
--   PRIMARY KEY (product_id, retailer); FK product_id -> products(id).
--   Neither column added here participates in any key or constraint.

alter table public.current_prices
  add column feed_id text,
  add column feed_last_imported_at timestamptz;

comment on column public.current_prices.feed_id is
  'AWIN feed this price was read from. NULL = unknown.';

comment on column public.current_prices.feed_last_imported_at is
  'The merchant''s own feed export timestamp for the read that produced this price. This is the date the as-of label names. A live price with NULL here renders no stamp -- never fall back to the catalog vintage.';
