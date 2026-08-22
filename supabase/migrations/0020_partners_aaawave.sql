-- 0020_partners_aaawave
-- The partners row for aaawave. Applied AFTER 0019 commits.
--
-- Field provenance — every value is sourced, none invented:
--   name     AWIN advertiser directory, advertiserId 43143, programmeName
--            "aaawave"; the merchant's own site styles it "AAAwave".
--   tagline  derived from the merchant's own AWIN programme description:
--            "a premium online retailer of computer components, Storages,
--            Mini PCs, Crypto mining equipment, Network Attached Storage
--            (NAS), Networking and more." Condensed, not embellished.
--   href     internal partner route, matching the six existing rows, which
--            all use "/<partner-id>" rather than an external URL.
--   logo_url NULL, matching all six existing rows. The AWIN CDN URL is
--            deliberately NOT used — hotlinking a network's asset host on a
--            production page is fragile and outside our control.
--   display_order 7. Verified max(display_order) = 6 across 6 rows.
--
-- NOTE: no feed_status row is created here. feed_status.catalog_imported_at
-- is NOT NULL, so that row cannot honestly exist until the import has
-- actually run. It belongs to the import, not to this migration.

insert into public.partners (id, name, tagline, href, logo_url, display_order)
values (
  'aaawave',
  'AAAwave',
  'Computer components, storage, mini PCs and networking gear',
  '/aaawave',
  null,
  7
);
