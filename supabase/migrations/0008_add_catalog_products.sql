-- Step 1 of the catalog/search/onboarding migration
-- (see claude/catalog-search-onboarding-migration-scope-2026-08-03.md, Section 2).
--
-- Purely additive: creates the Supabase-backed replacement for
-- lib/partners.ts's static catalog. Nothing in the app reads from these
-- tables yet — lib/partners.ts and the six lib/<partner>-data.ts files
-- remain the live source of truth until the read-path migration (that
-- doc's Section 3, steps 2-4) is done and verified. This migration and
-- its accompanying backfill script (scripts/backfill-catalog-products.ts)
-- are safe to apply and run at any time with zero effect on the running
-- site.
--
-- public.partners mirrors lib/partners.ts's Partner type minus `products`
-- (that relationship is expressed via catalog_products.partner_id
-- instead of a nested array).
create table public.partners (
  id text primary key,
  name text not null,
  tagline text not null,
  href text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

alter table public.partners enable row level security;

create policy "Partners are viewable by everyone"
  on public.partners for select
  using (true);

-- public.catalog_products mirrors lib/partners.ts's RealProduct type.
-- `id` matches today's `${partnerId}:${slug}` scheme exactly so any
-- future code (wishlists, price_history, current_prices — all of which
-- already key on this same product_id format) needs no changes.
--
-- `parent_category` is stored as a plain column, computed once at write
-- time (import script / backfill script) via the existing
-- lib/category-mapper.ts logic, not recomputed per read. That logic was
-- previously the site of a real performance bug (13-18s blocking task,
-- see claude/homepage-lcp-investigation-2026-08-01.md) when it ran
-- per-request/per-normalize instead of once at write time — this schema
-- keeps it a write-time cost, matching how lib/partners.ts already
-- computes RealProduct.parentCategory once at module load.
create table public.catalog_products (
  id text primary key,
  partner_id text not null references public.partners(id),
  slug text not null,
  name text not null,
  description text not null,
  price numeric(10,2) not null,
  original_price numeric(10,2),
  image text not null,
  images text[] not null default '{}',
  category text not null,
  parent_category text not null,
  badge text,
  rating_stars numeric(2,1),
  rating_count integer,
  deep_link text not null,
  variant_label text,
  -- Replaces Fuse.js's in-memory index (lib/search.ts) — see the scoping
  -- doc's Section 3, step 5. Weighting (A/B/C) mirrors Fuse's current
  -- 0.8/0.15/0.05 weight split on name/category/description as a
  -- starting point; expect this to need re-tuning against known
  -- collision cases (e.g. the documented "achar" vs "Charging Adapter"
  -- false positive) once search actually cuts over — full-text search
  -- is lexeme-based, not edit-distance-based, and won't reproduce Fuse's
  -- typo-tolerance automatically.
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (partner_id, slug)
);

create index catalog_products_parent_category_idx
  on public.catalog_products (parent_category);

create index catalog_products_search_vector_idx
  on public.catalog_products using gin (search_vector);

create index catalog_products_partner_id_idx
  on public.catalog_products (partner_id);

alter table public.catalog_products enable row level security;

create policy "Catalog products are viewable by everyone"
  on public.catalog_products for select
  using (true);

-- Writes to both tables are service-role only (backfill script / future
-- onboarding pipeline), same pattern as price_history and current_prices
-- (migrations 0005, 0006) — no insert/update/delete policy is defined
-- here, so RLS denies all client-side writes by default and only the
-- service-role key (which bypasses RLS entirely) can write.

-- No moddatetime extension is used anywhere else in this project
-- (current_prices, migration 0006, just relies on its writer setting
-- updated_at explicitly) — matching that convention here with a plain
-- trigger function rather than introducing a new extension dependency.
create function public.set_catalog_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger catalog_products_set_updated_at
  before update on public.catalog_products
  for each row
  execute function public.set_catalog_products_updated_at();
