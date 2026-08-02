-- current_prices: the live-price override layer for the daily price-refresh
-- pipeline (Section 6.1 of the strategic growth plan).
--
-- Why this table exists instead of editing lib/<partner>-data.ts directly:
-- product catalogs (name/description/image/slug) are static TS files
-- generated once by scripts/import-partner.mjs, and rewriting those files
-- from a Vercel Cron job isn't viable (no filesystem writes in a serverless
-- function, and even if there were, redeploying on every price tick is the
-- wrong shape for something that should run unattended, daily, forever).
--
-- Instead this table is a sparse override: a row here means "this
-- product's live price is different from what's baked into the static
-- data file." Absence of a row means "use the static file's price" — so a
-- product never regresses to 'no price' just because it hasn't been
-- refreshed yet. lib/pricing/getEffectivePrice.ts is the single place that
-- merges this table over the static catalog; every price-reading call site
-- (product pages, price alerts, price_history snapshotting) goes through
-- that helper rather than reading product.price directly once it's wired
-- in.
--
-- One row per (product_id, retailer) — matches the same composite key
-- shape as price_history (0005) and wishlists' real-partner retailer
-- column (0004).
create table public.current_prices (
  product_id text not null references public.products (id) on delete cascade,
  retailer retailer not null,
  price numeric(10, 2) not null check (price >= 0),
  original_price numeric(10, 2) check (original_price is null or original_price > price),
  source text not null default 'awin_feed',
  updated_at timestamptz not null default now(),
  primary key (product_id, retailer)
);

create index current_prices_updated_at_idx
  on public.current_prices (updated_at desc);

alter table public.current_prices enable row level security;

-- Read is public (same policy shape as price_history) — prices are
-- non-sensitive, shown to every visitor regardless of auth state. Writes
-- only ever come from the service-role client inside the refresh-prices
-- cron job, so no insert/update/delete policy is needed for anon/authenticated.
create policy "Anyone can read current prices"
  on public.current_prices for select
  using (true);
