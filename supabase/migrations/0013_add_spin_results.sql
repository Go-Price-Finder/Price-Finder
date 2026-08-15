-- Price Finder — mobile app spin-to-win game (step 7)
--
-- Daily spin-to-win game. amount is a real cashback bonus (can be 0), shown
-- alongside purchase-based cashback in the app's Rewards tab but tracked
-- separately (a spin bonus doesn't have a retailer/order/vertical, so it
-- doesn't fit cashback_claims' shape).
--
-- Not consumed by any website code — this table and RPC exist purely for
-- Go-Price-Finder/Price-Finder-App. Documented here anyway, for the same
-- reason every other migration lives in this folder: one place to see the
-- full shared-database schema. No corresponding hand-edit to this repo's
-- database.types.ts, since nothing here reads it.
--
-- Applied directly to production via the Supabase MCP on 2026-08-15.

create table public.spin_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric not null default 0 check (amount >= 0),
  spun_at timestamptz not null default now()
);

alter table public.spin_results enable row level security;

create policy "Users can view their own spin results"
  on public.spin_results for select
  using (auth.uid() = user_id);

-- Atomic and tamper-proof: the prize draw AND the once-per-day check both
-- happen server-side, inside one transaction — a client-side random pick,
-- or a client-side "have I spun today" check before a plain insert, would
-- let a modified client always roll the top prize or race two taps past
-- the daily limit.
create or replace function public.spin_daily_reward()
returns public.spin_results
language plpgsql
security definer set search_path = public
as $$
declare
  already_spun boolean;
  roll numeric;
  prize numeric;
  result public.spin_results;
begin
  select exists (
    select 1 from public.spin_results
    where user_id = auth.uid()
      and spun_at >= date_trunc('day', now())
  ) into already_spun;

  if already_spun then
    raise exception 'already_spun_today';
  end if;

  roll := random();
  -- Weighted prize table: 50% $0, 25% $0.25, 15% $0.50, 7% $1, 2.5% $2, 0.5% $5.
  -- A game-design decision, not a business/financial commitment pulled from
  -- anywhere else in the codebase — tune freely.
  prize := case
    when roll < 0.50 then 0
    when roll < 0.75 then 0.25
    when roll < 0.90 then 0.50
    when roll < 0.97 then 1.00
    when roll < 0.995 then 2.00
    else 5.00
  end;

  insert into public.spin_results (user_id, amount)
  values (auth.uid(), prize)
  returning * into result;

  return result;
end;
$$;

grant execute on function public.spin_daily_reward() to authenticated;
