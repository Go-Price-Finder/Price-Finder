-- Vintage is a property of the FEED, not the partner. A partner may draw from
-- several feeds; a product draws from exactly one. See
-- claude/as-of-label-spec-and-copy-2026-08-17.md section 3 (revised) and
-- claude/migration-0016-feed-status-STEP2.md.
-- Replaces the interim per-product override list shipped in 790b646.
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
  'overclaim on 26 pages. feed_id is the shared key for four consumers: the as-of '
  'label, feed-freshness monitoring, price provenance, and import attribution.';

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
  'splits 246 (113495) / 26 (105368). Same key as feed_status.feed_id and '
  'price_history.feed_id. Nullable now, NOT NULL once import-partner.mjs sets it '
  '(offers plan Step 2b) - same nullable-then-tighten pattern as price_source.';