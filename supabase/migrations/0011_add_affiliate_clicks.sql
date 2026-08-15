-- Price Finder — affiliate click tracking (app side)
--
-- Tracks outbound affiliate-link taps from the mobile app so a later AWIN
-- postback (a completed sale, matched by click_id) can be attributed back
-- to the app user who tapped through. Attribution requires a signed-in
-- user, so user_id is NOT NULL — anonymous browsing taps aren't logged
-- here at all.
--
-- Applied directly to production via the Supabase MCP on 2026-08-15; this
-- file exists so the schema is documented alongside every other migration,
-- not because it still needs to be run.

create table public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id text not null references public.products(id),
  retailer retailer not null,
  click_id text not null unique,
  clicked_at timestamptz not null default now()
);

alter table public.affiliate_clicks enable row level security;

create policy "Users can log their own affiliate clicks"
  on public.affiliate_clicks for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own affiliate clicks"
  on public.affiliate_clicks for select
  using (auth.uid() = user_id);

-- Generated server-side so the app never needs a client-side UUID library
-- just to make an insert it can immediately read back via .select().
alter table public.affiliate_clicks
  alter column click_id set default gen_random_uuid()::text;
