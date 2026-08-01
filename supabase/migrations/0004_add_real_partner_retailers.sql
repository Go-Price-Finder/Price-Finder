-- Adds the 6 real AWIN partner ids as valid `retailer` enum values,
-- alongside the original 5 mock-catalog values (amazon, walmart, etsy,
-- target, ebay) — additive only, doesn't touch existing rows or values.
-- Lets wishlists reference real partner products (lib/partners.ts) instead
-- of only the legacy mock catalog. Postgres requires each ADD VALUE to run
-- in its own statement outside a multi-value batch when used inside a
-- transaction with other DDL, but a standalone series like this is safe.

alter type retailer add value if not exists 'brooklyn-delhi';
alter type retailer add value if not exists 'evdance';
alter type retailer add value if not exists 'golden-maple';
alter type retailer add value if not exists 'canvas-vows';
alter type retailer add value if not exists 'king-koil';
alter type retailer add value if not exists 'tsar-bomba';
