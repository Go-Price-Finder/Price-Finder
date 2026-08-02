-- Wallet & Ledger System (Section 6.2 of the strategic growth plan) —
-- drafted dormant per Section 11, item 4: "Draft the wallet/ledger schema
-- (dormant, no activation flow yet) so Phase 2 does not start from zero."
-- No app code reads or writes this yet. Nothing here goes live until
-- Phase 2 (Cashback v1) builds the activation-tracking flow that actually
-- creates claims.
--
-- WHY TWO TABLES, NOT ONE — the plan is explicit: "An append-only
-- transaction ledger (not just a balance field)". A single mutable row
-- per cash-back claim (create it "pending", later UPDATE its status to
-- "available", then "redeemed") is NOT append-only — it destroys the
-- history of when each transition happened, which is exactly the audit
-- trail Section 6.2 calls "non-negotiable" for real money. So this splits
-- the concept in two, the standard event-sourcing shape:
--
--   cashback_claims        — one immutable row per cash-back-eligible
--                             action (what earned it, how much, from
--                             which vertical/retailer/product). Never
--                             updated after insert.
--   cashback_ledger_entries — one row per STATE TRANSITION for a claim
--                             (pending -> available -> redeemed, or a
--                             reversal). Also never updated — a new status
--                             is always a new row referencing the same
--                             claim_id, so the full history of every
--                             transition and when it happened is
--                             preserved forever. A claim's CURRENT status
--                             is "whichever ledger entry for this claim_id
--                             has the latest created_at" — derived by the
--                             reader, not stored as a mutable field
--                             anywhere.
--
-- This mirrors price_history/purchases' existing append-only conventions
-- in this schema, just applied to a case where the "append" needs to
-- happen more than once per real-world thing being tracked.
create type public.cashback_vertical as enum ('products', 'gift_cards', 'hotels');
create type public.cashback_status as enum ('pending', 'available', 'redeemed', 'reversed');

create table public.cashback_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  vertical public.cashback_vertical not null,
  retailer retailer not null,
  -- Nullable: a "products" vertical claim ties to a real product row; a
  -- "hotels" claim (a booking) generally won't have one.
  product_id text references public.products (id) on delete set null,
  -- Nullable: links back to an existing purchases row when one exists
  -- (today, only the "products" vertical's purchase-recording flow
  -- creates purchases rows) — hotels/gift-card claims may not have a
  -- corresponding purchases row until/unless that flow is extended.
  purchase_id uuid references public.purchases (id) on delete set null,
  order_amount numeric(10, 2) not null check (order_amount >= 0),
  cashback_amount numeric(10, 2) not null check (cashback_amount >= 0),
  -- Ties back to the click-tracking/redirect layer (Section 6.3, not yet
  -- built) once it exists — nullable until then, so this table doesn't
  -- block on that one shipping first.
  click_id text,
  created_at timestamptz not null default now()
);

create index cashback_claims_user_id_idx on public.cashback_claims (user_id);

create table public.cashback_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.cashback_claims (id) on delete cascade,
  status public.cashback_status not null,
  -- Signed: positive for pending/available (money coming), negative for
  -- reversed (money taken back after a fraud reversal or return) — so
  -- summing every entry for a claim, or for a user across all their
  -- claims, gives a correct running total without special-casing
  -- reversals in application code.
  amount numeric(10, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index cashback_ledger_entries_claim_id_idx
  on public.cashback_ledger_entries (claim_id, created_at desc);

alter table public.cashback_claims enable row level security;
alter table public.cashback_ledger_entries enable row level security;

-- Read-only for the owning user; no insert/update/delete policy for
-- anon/authenticated on either table — every write comes from the
-- service-role client inside the (not-yet-built) Phase 2 activation and
-- payout-automation jobs, same pattern as price_history/current_prices.
create policy "Users can view their own cashback claims"
  on public.cashback_claims for select
  using (auth.uid() = user_id);

create policy "Users can view their own cashback ledger entries"
  on public.cashback_ledger_entries for select
  using (
    exists (
      select 1 from public.cashback_claims c
      where c.id = claim_id and c.user_id = auth.uid()
    )
  );
