-- Price Finder — initial schema
-- Users, product catalog, wishlists, and purchase history.
-- Run this in the Supabase SQL editor, or via `supabase db push` if you're
-- using the Supabase CLI locally (see supabase/README.md).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Retailers
-- A fixed, small set matching the app's RetailerId union type
-- (lib/types.ts). Using an enum keeps retailer values constrained at the
-- database level instead of relying on free-text everywhere it's stored.
-- ---------------------------------------------------------------------------
create type retailer as enum ('amazon', 'walmart', 'etsy', 'target', 'ebay');

-- ---------------------------------------------------------------------------
-- Users
--
-- Supabase Auth (the built-in `auth.users` table) already owns email,
-- password (hashed with bcrypt, never stored in plaintext), created_at,
-- email verification, password reset flows, etc. — all handled securely by
-- Supabase itself. We deliberately do NOT duplicate the password anywhere
-- in our own schema: rolling your own password storage next to a table
-- that already does it correctly is a common and avoidable security
-- mistake.
--
-- `public.users` is a 1:1 "profile" row keyed on the auth user's id. It's
-- what the rest of this schema (wishlists, purchases, RLS policies)
-- references via user_id, and it's what you extend with app-specific
-- profile fields over time (display name, avatar, preferences, and later
-- the loyalty-points fields).
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

-- Denormalized copy of auth.users.email, kept in sync by the trigger below.
-- Indexed for the (less common but supported) case of looking a profile up
-- by email from application code instead of by id.
create unique index users_email_idx on public.users (email);

-- Auto-create a public.users row whenever someone signs up via Supabase
-- Auth, so the app never has to remember to do this itself.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, created_at)
  values (new.id, new.email, new.created_at);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Products
--
-- A normalized catalog so wishlists and purchases reference a product once
-- instead of duplicating its name/category/image on every row. `id` is
-- `text` (not a generated uuid) so it can match the existing mock catalog
-- ids already used by the frontend (lib/data.ts: "p1", "p2", ... "p10") —
-- this schema slots in without an id migration. Swap for a generated key
-- later if products start coming from a real supplier feed instead.
-- ---------------------------------------------------------------------------
create table public.products (
  id text primary key,
  name text not null,
  category text,
  image_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Wishlists
--
-- One row per (user, product, retailer) a shopper has saved — matching the
-- app's existing retailer-tagged wishlist feature. price_saved captures the
-- price at save time, so "price when I saved it" vs. "price now" stays
-- answerable without re-fetching history.
-- ---------------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  retailer retailer not null,
  price_saved numeric(10, 2) not null check (price_saved >= 0),
  created_at timestamptz not null default now(),

  -- Saving the same product+retailer twice should update the existing row,
  -- not create a duplicate wishlist entry.
  unique (user_id, product_id, retailer)
);

-- "Get my wishlist" — by far the most common query on this table.
create index wishlists_user_id_idx on public.wishlists (user_id);

-- Supports product-level analytics later, e.g. "how many people have
-- wishlisted this item" for a demand signal.
create index wishlists_product_id_idx on public.wishlists (product_id);

-- ---------------------------------------------------------------------------
-- Purchases
--
-- The record of what a user actually bought. Treated as an append-only
-- ledger: no update/delete RLS policy is granted below, so once a purchase
-- is recorded from the client it can't be edited or removed by the user —
-- only ever inserted, matching how a real order/receipt history behaves.
-- ---------------------------------------------------------------------------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- `restrict`, not `cascade`: a product being removed from the catalog
  -- must never silently delete someone's purchase history.
  product_id text not null references public.products (id) on delete restrict,
  retailer retailer not null,
  amount_spent numeric(10, 2) not null check (amount_spent >= 0),
  purchased_at timestamptz not null default now()
);

-- Covers both "all purchases by a user" and the common "...most recent
-- first" variant in a single index scan (DESC matches typical query order).
create index purchases_user_id_purchased_at_idx
  on public.purchases (user_id, purchased_at desc);

-- Product- and retailer-level reporting (e.g. "top purchased products",
-- "spend by retailer").
create index purchases_product_id_idx on public.purchases (product_id);
create index purchases_retailer_idx on public.purchases (retailer);

-- ---------------------------------------------------------------------------
-- Spending summary view
--
-- Pre-expresses "calculate total spending" as a reusable view instead of
-- every caller re-writing the same GROUP BY. This is also the natural input
-- to the loyalty-points system planned for later (points are typically a
-- function of total or recent spend) — this view doesn't implement that,
-- it just leaves clean ground to build it on.
-- ---------------------------------------------------------------------------
create view public.user_spending_summary as
select
  user_id,
  count(*) as purchase_count,
  sum(amount_spent) as total_spent,
  min(purchased_at) as first_purchase_at,
  max(purchased_at) as last_purchase_at
from public.purchases
group by user_id;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Every table a browser client can reach is locked to "your own rows
-- only" using auth.uid(). The product catalog is public, read-only
-- reference data, so it's readable by anyone (including signed-out
-- visitors browsing the site).
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.wishlists enable row level security;
alter table public.purchases enable row level security;

create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Anyone can read the product catalog"
  on public.products for select
  using (true);

create policy "Users can view their own wishlist"
  on public.wishlists for select
  using (auth.uid() = user_id);

create policy "Users can add to their own wishlist"
  on public.wishlists for insert
  with check (auth.uid() = user_id);

create policy "Users can remove from their own wishlist"
  on public.wishlists for delete
  using (auth.uid() = user_id);

create policy "Users can view their own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- Note: in production, purchases are usually best inserted by a trusted
-- server process (e.g. a checkout webhook using the service-role key)
-- rather than trusted to an anon client — a client that can insert its own
-- purchase rows could in principle report a fake amount_spent. This insert
-- policy is included so the schema is usable end-to-end today; tighten it
-- (or remove it in favor of server-only inserts) once checkout exists.
create policy "Users can record their own purchases"
  on public.purchases for insert
  with check (auth.uid() = user_id);
