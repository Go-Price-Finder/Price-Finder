-- Price Finder — price drop alerts
-- Adds an optional target price to wishlist items plus the bookkeeping the
-- daily cron job (lib/alerts/checkPriceDrops.ts) needs to know which rows
-- still need an email and to avoid sending the same alert twice.
--
-- Run this after 0001_initial_schema.sql and 0002_add_username.sql.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.wishlists
  add column target_price numeric(10, 2) check (target_price >= 0),
  add column alert_sent boolean not null default false,
  add column alert_sent_at timestamptz;

comment on column public.wishlists.target_price is
  'Optional price the user wants to be notified at or below. Null = no alert set for this item.';
comment on column public.wishlists.alert_sent is
  'True once a price-drop email has been sent for the current dip against target_price. Reset to false when target_price changes (see the trigger below) or when the live price rises back above target_price (handled in lib/alerts/checkPriceDrops.ts, since that''s the only place that knows the current price).';
comment on column public.wishlists.alert_sent_at is
  'When the most recent price-drop email was sent for this row. Null until the first alert fires.';

-- ---------------------------------------------------------------------------
-- Reset alert_sent when the user changes their target price
--
-- If someone already got an alert and then edits target_price (lower,
-- higher, or clears it and sets a new one), that's a new ask — they should
-- be eligible for a fresh alert against the new threshold, not silenced by
-- the old alert_sent flag. Only fires when target_price actually changes
-- (`is distinct from`, which also correctly treats null <-> a value as a
-- change), so re-saving the same value is a no-op and doesn't clear
-- alert_sent_at for no reason.
--
-- The complementary reset case — price rises back above target_price after
-- an alert was sent, then drops again later — can't be handled here, since
-- this table never stores the live current price. That reset lives in the
-- cron job's comparison logic instead (see evaluateAlertState's "reset"
-- branch in lib/alerts/evaluateAlertState.ts).
-- ---------------------------------------------------------------------------
create function public.reset_alert_on_target_change()
returns trigger
language plpgsql
as $$
begin
  if new.target_price is distinct from old.target_price then
    new.alert_sent := false;
    new.alert_sent_at := null;
  end if;
  return new;
end;
$$;

create trigger wishlists_reset_alert_on_target_change
  before update on public.wishlists
  for each row
  execute function public.reset_alert_on_target_change();

-- ---------------------------------------------------------------------------
-- RLS — allow users to update their own wishlist rows
--
-- 0001_initial_schema.sql only granted select/insert/delete on wishlists.
-- Setting a target price from the wishlist page is the first in-place
-- update the app needs, so add the missing policy. The cron job itself
-- runs with the service-role key (lib/supabase/admin.ts), which bypasses
-- RLS entirely — this policy only covers a signed-in user editing their
-- own target_price from the UI.
-- ---------------------------------------------------------------------------
create policy "Users can update their own wishlist"
  on public.wishlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Index
--
-- Speeds up the cron job's main query: "which wishlist rows have a target
-- price set and haven't been alerted on yet." Partial so rows without an
-- alert set (the common case) never bloat the index.
-- ---------------------------------------------------------------------------
create index wishlists_pending_alerts_idx
  on public.wishlists (target_price)
  where target_price is not null and alert_sent = false;
