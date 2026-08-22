-- 0019_retailer_enum_aaawave
-- Adds 'aaawave' to the retailer enum, ahead of the aaawave catalogue import.
--
-- SPLIT FROM 0020 DELIBERATELY. PostgreSQL forbids USING a newly added enum
-- value in the same transaction that adds it. partners.id is text, not the
-- enum, so a combined migration would probably work — but "probably" is not a
-- property worth relying on in a migration, and two migrations fail
-- independently and diagnose independently. This one adds the value and
-- nothing else.

alter type public.retailer add value if not exists 'aaawave';
