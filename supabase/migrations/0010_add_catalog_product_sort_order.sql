-- Adds an explicit per-partner ordering for catalog products.
--
-- Why: the same class of gap migration 0009 closed for partners, one level
-- down. lib/<partner>-data.ts arrays carry a curated product order that every
-- live page renders from today (nothing imports lib/catalog.ts yet), but
-- catalog_products stored no ordering — so read order came back as whatever
-- Postgres happened to return.
--
-- This is a CORRECTION toward production parity, not a pin of current row
-- order. Measured 2026-08-09, catalog row order had ALREADY diverged from the
-- static arrays for three of six partners:
--
--   brooklyn-delhi  29 products  order MATCH
--   evdance         72 products  order MATCH
--   golden-maple   348 products  order DIFFERS (from index 9)
--   canvas-vows    204 products  order DIFFERS (from index 0)
--   tsar-bomba     272 products  order DIFFERS (from index 0)
--   king-koil       29 products  order MATCH
--
-- Every product SET matched; only sequence differed. The three that diverged
-- are exactly the three backfilled in multiple chunked files (golden-maple
-- p1-p5, canvas-vows p1-p3, tsar-bomba p1-p4), two of which had chunks re-run
-- — so row order reflects insertion history, not the catalog.
--
-- The divergence was already visible in output: related-product strips on
-- canvas-vows and tsar-bomba product pages (476 pages) selected different
-- products via .filter().slice(0, 4) depending on which module was read.
-- getFeaturedDeals (n=1) and getBestSellers (n=3) happened to match at this
-- size, by luck rather than design.
--
-- sort_order is the 1-based index of each product in its partner's static
-- array, so post-migration read order is byte-identical to what production
-- renders today.

alter table public.catalog_products
  add column sort_order integer;

-- Backfill: sort_order is the 1-based index of each product in its partner's
-- static lib/<partner>-data.ts array.
--
-- Transmitted as a permutation over the partner's slug-sorted rows rather
-- than 954 literal (slug, index) pairs — 3.4 KB instead of 73 KB, which
-- matters because this project has an explicit rule against pushing bulk SQL
-- through an AI session's context.
--
-- The permutation is only valid against the exact row set it was computed
-- from, so each block first asserts an md5 fingerprint of that partner's
-- slug set and RAISES if it differs. Re-running this on a database whose
-- catalog has changed fails loudly instead of silently assigning wrong
-- orders. `collate "C"` is byte order, matching the generator's JS sort;
-- verified 2026-08-09 that all 954 slugs are pure ASCII with no duplicates
-- within a partner, so the two orderings are identical.

-- brooklyn-delhi: 29 products
do $$
declare fp text;
begin
  select md5(string_agg(slug, ',' order by slug collate "C"))
    into fp from public.catalog_products where partner_id = 'brooklyn-delhi';
  if fp is distinct from 'bad5f1edaba4f438df62123614cb2dfa' then
    raise exception 'brooklyn-delhi: slug set does not match the one this permutation was computed against (got %, expected bad5f1edaba4f438df62123614cb2dfa). Regenerate 0010 from the current lib/brooklyn-delhi-data.ts before applying.', fp;
  end if;
end $$;

update public.catalog_products c
set sort_order = perm.ord
from (
  select r.id, p.ord
  from (
    select id, row_number() over (order by slug collate "C") as rn
    from public.catalog_products where partner_id = 'brooklyn-delhi'
  ) r
  join unnest(array[25,18,9,29,24,14,19,6,17,16,20,4,2,15,5,27,8,10,12,21,22,11,7,13,3,1,26,28,23]) with ordinality as p(ord, rn) on p.rn = r.rn
) perm
where c.id = perm.id;

-- evdance: 72 products
do $$
declare fp text;
begin
  select md5(string_agg(slug, ',' order by slug collate "C"))
    into fp from public.catalog_products where partner_id = 'evdance';
  if fp is distinct from '22a8a13ba2ffd8e043f1d49d85087d6b' then
    raise exception 'evdance: slug set does not match the one this permutation was computed against (got %, expected 22a8a13ba2ffd8e043f1d49d85087d6b). Regenerate 0010 from the current lib/evdance-data.ts before applying.', fp;
  end if;
end $$;

update public.catalog_products c
set sort_order = perm.ord
from (
  select r.id, p.ord
  from (
    select id, row_number() over (order by slug collate "C") as rn
    from public.catalog_products where partner_id = 'evdance'
  ) r
  join unnest(array[11,12,16,59,61,60,62,64,63,41,40,43,42,37,36,39,38,67,68,71,65,70,18,19,4,5,6,8,7,9,10,1,2,3,25,26,27,17,69,66,52,51,54,53,56,55,58,57,45,44,46,48,47,50,49,30,31,32,23,28,29,13,14,35,33,15,34,21,20,24,72,22]) with ordinality as p(ord, rn) on p.rn = r.rn
) perm
where c.id = perm.id;

-- golden-maple: 348 products
do $$
declare fp text;
begin
  select md5(string_agg(slug, ',' order by slug collate "C"))
    into fp from public.catalog_products where partner_id = 'golden-maple';
  if fp is distinct from '2cd98dd519329f9912127ab2e066cc30' then
    raise exception 'golden-maple: slug set does not match the one this permutation was computed against (got %, expected 2cd98dd519329f9912127ab2e066cc30). Regenerate 0010 from the current lib/golden-maple-data.ts before applying.', fp;
  end if;
end $$;

update public.catalog_products c
set sort_order = perm.ord
from (
  select r.id, p.ord
  from (
    select id, row_number() over (order by slug collate "C") as rn
    from public.catalog_products where partner_id = 'golden-maple'
  ) r
  join unnest(array[84,88,325,326,322,327,323,324,44,20,34,37,36,35,38,316,99,314,266,317,94,93,263,178,89,321,304,305,340,338,339,336,337,291,332,13,15,19,16,17,18,262,87,57,267,269,268,270,272,271,90,91,92,45,23,1,298,299,12,208,200,201,202,203,184,185,186,187,188,199,189,190,191,192,193,194,195,196,197,198,204,205,206,207,149,150,273,106,55,86,277,61,62,63,64,40,53,52,50,49,51,301,302,300,136,137,138,139,140,141,142,143,39,95,128,129,123,121,122,276,275,213,212,211,210,209,47,112,175,170,169,171,172,173,174,306,342,132,165,318,296,333,46,261,294,293,292,295,109,110,278,77,75,76,98,241,96,97,249,83,102,101,100,103,104,105,247,107,33,29,30,31,32,6,5,4,7,8,9,10,133,134,135,148,214,334,335,74,315,240,238,236,235,237,239,221,222,223,224,225,220,218,215,219,217,216,233,226,227,228,229,230,231,232,234,286,290,287,288,289,180,179,182,181,347,157,156,158,159,160,113,114,115,116,117,118,119,120,70,71,66,67,68,69,72,59,42,85,250,80,2,3,65,131,130,79,28,274,81,78,60,11,56,43,48,41,176,242,244,243,245,264,265,21,22,320,54,297,279,285,280,281,282,283,284,24,27,25,26,111,308,309,310,311,313,312,307,58,14,341,162,163,164,348,154,155,127,126,125,124,259,256,255,251,257,252,258,254,260,253,177,319,246,166,168,167,82,344,343,346,345,151,152,153,303,108,144,145,146,147,183,331,330,329,328,161,248,73]) with ordinality as p(ord, rn) on p.rn = r.rn
) perm
where c.id = perm.id;

-- canvas-vows: 204 products
do $$
declare fp text;
begin
  select md5(string_agg(slug, ',' order by slug collate "C"))
    into fp from public.catalog_products where partner_id = 'canvas-vows';
  if fp is distinct from '1e8a769b5d84f63aa1f8f1ee83cdcd40' then
    raise exception 'canvas-vows: slug set does not match the one this permutation was computed against (got %, expected 1e8a769b5d84f63aa1f8f1ee83cdcd40). Regenerate 0010 from the current lib/canvas-vows-data.ts before applying.', fp;
  end if;
end $$;

update public.catalog_products c
set sort_order = perm.ord
from (
  select r.id, p.ord
  from (
    select id, row_number() over (order by slug collate "C") as rn
    from public.catalog_products where partner_id = 'canvas-vows'
  ) r
  join unnest(array[10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,121,122,139,140,141,142,143,144,145,146,36,37,38,39,40,41,42,43,60,61,62,63,64,65,66,67,72,73,74,75,76,77,78,79,179,180,181,182,183,184,185,186,190,171,172,173,174,175,176,177,178,48,49,50,51,163,164,165,166,167,168,169,170,80,81,82,83,84,85,86,87,202,52,53,54,55,56,57,58,59,102,103,104,105,106,107,108,109,94,95,96,97,98,99,100,101,187,88,89,90,193,194,195,68,69,70,71,44,45,46,47,155,156,157,158,159,160,161,162,201,147,148,149,150,151,152,153,154,200,131,132,133,134,135,136,137,138,91,92,93,191,1,2,3,4,5,6,7,8,9,110,119,120,111,112,113,114,115,116,117,118,196,192,26,35,27,28,29,30,31,32,33,34,123,124,125,126,127,128,129,130,197,198,199,188,203,189,204]) with ordinality as p(ord, rn) on p.rn = r.rn
) perm
where c.id = perm.id;

-- king-koil: 29 products
do $$
declare fp text;
begin
  select md5(string_agg(slug, ',' order by slug collate "C"))
    into fp from public.catalog_products where partner_id = 'king-koil';
  if fp is distinct from '6a35ac568214fcd3d065515d7e7003b2' then
    raise exception 'king-koil: slug set does not match the one this permutation was computed against (got %, expected 6a35ac568214fcd3d065515d7e7003b2). Regenerate 0010 from the current lib/king-koil-data.ts before applying.', fp;
  end if;
end $$;

update public.catalog_products c
set sort_order = perm.ord
from (
  select r.id, p.ord
  from (
    select id, row_number() over (order by slug collate "C") as rn
    from public.catalog_products where partner_id = 'king-koil'
  ) r
  join unnest(array[1,10,11,12,13,14,15,16,17,18,19,2,20,21,22,23,24,25,26,27,28,29,3,4,5,6,7,8,9]) with ordinality as p(ord, rn) on p.rn = r.rn
) perm
where c.id = perm.id;

-- tsar-bomba: 272 products
do $$
declare fp text;
begin
  select md5(string_agg(slug, ',' order by slug collate "C"))
    into fp from public.catalog_products where partner_id = 'tsar-bomba';
  if fp is distinct from 'b4b71fa5e090ebcf46e9e04c53ee496f' then
    raise exception 'tsar-bomba: slug set does not match the one this permutation was computed against (got %, expected b4b71fa5e090ebcf46e9e04c53ee496f). Regenerate 0010 from the current lib/tsar-bomba-data.ts before applying.', fp;
  end if;
end $$;

update public.catalog_products c
set sort_order = perm.ord
from (
  select r.id, p.ord
  from (
    select id, row_number() over (order by slug collate "C") as rn
    from public.catalog_products where partner_id = 'tsar-bomba'
  ) r
  join unnest(array[271,272,247,248,249,251,252,250,253,255,254,256,258,257,259,260,263,261,262,266,265,267,264,268,270,269,128,94,99,117,135,72,206,210,207,211,213,205,212,208,209,204,185,70,69,68,67,141,145,143,218,136,214,139,219,144,215,140,216,137,142,217,138,5,6,4,8,11,10,7,9,1,3,2,12,16,32,41,15,20,21,33,24,25,26,27,28,29,30,31,17,38,22,23,34,35,36,13,19,37,42,43,14,18,39,40,48,170,110,112,197,230,113,194,203,155,114,198,169,162,154,96,98,97,100,95,65,200,166,199,64,202,115,224,225,226,227,167,165,164,229,160,158,228,161,168,153,157,66,201,171,108,195,111,118,196,116,163,109,159,156,232,234,235,233,231,187,188,186,173,182,176,172,183,174,181,175,184,134,52,51,71,53,73,131,129,130,132,133,149,150,221,147,222,148,223,146,220,101,102,104,105,107,103,106,193,189,190,191,192,55,61,82,90,57,83,74,75,76,77,78,79,80,81,58,59,84,85,60,86,56,62,87,91,92,54,63,88,89,50,45,44,47,46,49,151,93,152,243,244,245,246,240,242,241,239,126,125,127,177,124,180,179,237,119,120,122,178,121,238,123,236]) with ordinality as p(ord, rn) on p.rn = r.rn
) perm
where c.id = perm.id;

-- Fail loudly if any row was missed rather than letting the NOT NULL below
-- fail with a less specific error. Same guard as 0009.
do $$
declare missing int;
begin
  select count(*) into missing from public.catalog_products where sort_order is null;
  if missing > 0 then
    raise exception 'sort_order backfill missed % catalog_products row(s)', missing;
  end if;
end $$;

alter table public.catalog_products
  alter column sort_order set not null;

-- Per-partner, NOT global: ordering is only meaningful within a partner's own
-- listing, and a global sequence would force renumbering every existing row
-- each time a partner is added. DEFERRABLE INITIALLY DEFERRED so two products
-- can swap positions without parking one in a temp slot — same reasoning as
-- 0009's partners_display_order_unique.
--
-- Note: a deferrable unique constraint cannot serve as an ON CONFLICT
-- arbiter. Fine here — the catalog_products upsert in
-- scripts/backfill-catalog-products.ts conflicts on `id` (the primary key).
alter table public.catalog_products
  add constraint catalog_products_partner_sort_unique unique (partner_id, sort_order)
  deferrable initially deferred;

-- RLS: no policy change needed. The existing "Catalog products are viewable
-- by everyone" SELECT policy (USING true, role public) is column-agnostic.
