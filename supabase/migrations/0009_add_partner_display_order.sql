-- Adds an explicit display order for partners.
--
-- Why: Step 14 replaces lib/partners.ts's static `PARTNERS` array with
-- lib/catalog.ts's getPartners(). The static array's order is *curated* —
-- it is neither alphabetical nor the order rows happen to come back from
-- Postgres. Measured 2026-08-09:
--
--   static PARTNERS    : brooklyn-delhi, evdance, golden-maple, canvas-vows, king-koil, tsar-bomba
--   catalog row order  : brooklyn-delhi, tsar-bomba, king-koil, evdance, golden-maple, canvas-vows
--   alphabetical       : brooklyn-delhi, canvas-vows, evdance, golden-maple, king-koil, tsar-bomba
--
-- Neither derived order reproduces the curated one, so migrating without
-- storing it would silently reorder "Our Partners" on the homepage and the
-- partner entries in sitemap.xml — a visible change arriving as a side
-- effect of a data migration. This column makes the order data, owned by
-- the database, rather than an implicit property of an array literal.
--
-- NOT NULL with no default is deliberate: a seventh partner must be given
-- an explicit slot rather than landing wherever Postgres puts it. See the
-- note at the bottom about scripts/backfill-catalog-products.ts, which
-- generates a partners INSERT and must be updated in the same change.

alter table public.partners
  add column display_order integer;

-- Backfill from the current lib/partners.ts PARTNERS array order, so the
-- rendered order is byte-identical before and after the cutover.
update public.partners set display_order = 1 where id = 'brooklyn-delhi';
update public.partners set display_order = 2 where id = 'evdance';
update public.partners set display_order = 3 where id = 'golden-maple';
update public.partners set display_order = 4 where id = 'canvas-vows';
update public.partners set display_order = 5 where id = 'king-koil';
update public.partners set display_order = 6 where id = 'tsar-bomba';

-- Fail loudly if any partner was missed rather than letting the NOT NULL
-- below fail with a less specific error.
do $$
declare missing int;
begin
  select count(*) into missing from public.partners where display_order is null;
  if missing > 0 then
    raise exception 'display_order backfill missed % partner row(s)', missing;
  end if;
end $$;

alter table public.partners
  alter column display_order set not null;

-- Two partners sharing a slot would make the order ambiguous again, which
-- is the exact failure this column exists to prevent.
--
-- DEFERRABLE INITIALLY DEFERRED so the constraint is checked at COMMIT
-- rather than per statement. Swapping two partners' positions is a
-- plausible thing to want, and an immediate constraint would reject the
-- first UPDATE of the pair on a transient collision, forcing callers into
-- a park-in-a-temp-slot dance. Deferred still guarantees uniqueness — a
-- transaction that ends with duplicates fails at COMMIT.
--
-- Note: a deferrable unique constraint cannot serve as an ON CONFLICT
-- arbiter. That is fine here — the partners upsert in
-- scripts/backfill-catalog-products.ts conflicts on `id` (the primary
-- key), never on display_order.
alter table public.partners
  add constraint partners_display_order_unique unique (display_order)
  deferrable initially deferred;

-- RLS: no policy change needed. public.partners' existing
-- "Partners are viewable by everyone" SELECT policy (USING true, role
-- public) is column-agnostic, so anon reads this column like any other.
-- Writes remain blocked for anon — verified 2026-08-09: UPDATE as anon
-- affects 0 rows, INSERT raises an RLS violation.
