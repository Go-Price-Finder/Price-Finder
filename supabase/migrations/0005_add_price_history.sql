-- Price history — daily snapshots of each product's price per retailer.
--
-- This is Phase 0's highest-leverage piece of infrastructure (see the
-- project's strategic-growth-plan doc, Section 6.1): Price History and
-- Price Alerts currently have no real historical data to work from, and
-- an "effective price" ranking across verticals with different cash back
-- rates isn't possible without it.
--
-- IMPORTANT SCOPE NOTE: this table and its daily job
-- (app/api/cron/snapshot-prices/route.ts -> lib/pricing/snapshotPrices.ts)
-- snapshot whatever price is CURRENTLY DEPLOYED in the static partner
-- catalog (lib/partners.ts) once a day. They do not pull a fresh price
-- from each partner's feed — that catalog still only changes when
-- scripts/import-partner.mjs is re-run by hand against a new CSV. This
-- table starts accumulating real day-over-day data immediately, which is
-- genuinely useful on its own, but automating the *feed ingestion* itself
-- (so prices change daily without a manual re-import) is separate, larger
-- follow-up work, not yet built.
--
-- Append-only, matching the purchases table's ledger pattern: no
-- update/delete policy is granted to any role below. Rows are written
-- exclusively by the cron job's service-role client, which bypasses RLS
-- entirely — the select policy below is what the public site reads from.
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products (id) on delete cascade,
  retailer retailer not null,
  price numeric(10, 2) not null check (price >= 0),
  recorded_at timestamptz not null default now(),
  -- The calendar date of the snapshot (not just a timestamp) is what the
  -- unique constraint below keys on, so re-running the cron job the same
  -- day — e.g. a manual retry after a partial failure — updates that
  -- day's row instead of creating a duplicate snapshot.
  recorded_date date not null default current_date,

  unique (product_id, retailer, recorded_date)
);

-- "Price history for this product" is the only query pattern this table
-- serves today (a product detail page's price chart) — DESC matches
-- "most recent first".
create index price_history_product_retailer_idx
  on public.price_history (product_id, retailer, recorded_at desc);

alter table public.price_history enable row level security;

-- Public, read-only reference data — same treatment as the product
-- catalog itself (public.products' "Anyone can read the product catalog"
-- policy). No insert/update/delete policy exists for anon/authenticated;
-- only the service-role key (used server-side by the cron job) can write
-- here.
create policy "Anyone can read price history"
  on public.price_history for select
  using (true);
