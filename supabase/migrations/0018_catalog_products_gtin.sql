-- 0018_catalog_products_gtin
-- Adds the manufacturer identifier to catalog_products so an imported product
-- can be joined to its counterpart at another retailer. Load-bearing for
-- multi-retailer price comparison; without it a comparison cannot be formed.
--
-- Deliberate divergence from 0017's observe-don't-constrain stance, argued:
-- match_strategy in 0017 is an OBSERVATION and constraining it would stop the
-- table recording reality. gtin is an IDENTITY CLAIM used to join. A malformed
-- gtin that happens to collide with another malformed gtin produces a FALSE
-- COMPARISON PAIR — two unrelated products shown to a customer as the same
-- item at two prices. That is not a bad record, it is a lie on the page.
-- Rule: constrain identity, do not constrain observation.

alter table public.catalog_products
  add column gtin text;

-- 8-14 digits covers the whole GTIN family: GTIN-8, UPC-12, EAN-13, GTIN-14.
-- Rejects empty string, whitespace, hyphens, and any non-digit content.
-- NULL is permitted and means "absent from feed" — unknown, not zero.
alter table public.catalog_products
  add constraint catalog_products_gtin_shape
  check (gtin is null or gtin ~ '^[0-9]{8,14}$');

-- Partial index: only rows carrying an identifier are joinable.
-- DELIBERATELY NOT UNIQUE. The same gtin appearing under two partners is the
-- entire point of the column — a unique constraint would forbid comparison.
create index catalog_products_gtin_idx
  on public.catalog_products (gtin)
  where gtin is not null;
