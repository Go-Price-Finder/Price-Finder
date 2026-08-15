-- Replay parity: two statements that exist in production but in no repo file.
--
-- Found 2026-08-16 by diffing supabase/migrations/*.sql against Supabase's
-- recorded history in supabase_migrations.schema_migrations. Two migrations
-- were applied to production and never written to the repo:
--
--   add_current_prices_fk                   (2026-08-02)
--   add_affiliate_clicks_click_id_default   (2026-08-15)
--
-- So replaying the repo files produced a schema missing a foreign key and a
-- column default that production has. This file closes that gap FORWARD-ONLY.
--
-- 0011-0013 are deliberately NOT edited. They are already applied, possibly on
-- machines other than this one, and a migration that changes after it has run
-- is worse than one that is incomplete: anyone who already ran it gets no
-- signal, and the file no longer describes what they have. Production is
-- authoritative here — the click_id default is live and data depends on it.
--
-- Both statements are no-ops against production, verified 2026-08-16 rather
-- than assumed:
--   current_prices_product_id_fkey present  -> true
--   click_id default = (gen_random_uuid())::text -> true
--
-- ⚠ This file does NOT make supabase/migrations/ able to rebuild production.
-- 0001-0003 predate migration tracking and are absent from recorded history,
-- so a replay from scratch still fails at the first foreign key to
-- public.users or public.products. See CLAUDE.md's Database rules.

-- Recorded as add_current_prices_fk. ADD CONSTRAINT has no IF NOT EXISTS in
-- Postgres, so guard explicitly on the catalog rather than swallowing the
-- duplicate_object error — a bare exception handler would also hide an
-- unrelated failure.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'current_prices'
      and c.conname = 'current_prices_product_id_fkey'
  ) then
    alter table public.current_prices
      add constraint current_prices_product_id_fkey
      foreign key (product_id) references public.products (id) on delete cascade;
  end if;
end $$;

-- Recorded as add_affiliate_clicks_click_id_default. ALTER COLUMN SET DEFAULT
-- is naturally idempotent — re-running it against a column that already has
-- this exact default is a no-op — so no guard is needed.
alter table public.affiliate_clicks
  alter column click_id set default gen_random_uuid()::text;
