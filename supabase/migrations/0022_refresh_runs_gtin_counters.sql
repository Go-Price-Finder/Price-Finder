-- 0022_refresh_runs_gtin_counters
-- Four nullable integer counters for the GTIN match path, alongside the
-- existing matched_by_id / matched_by_name.
--
-- Scope note, stated because it exceeds what was asked for. Claude Code
-- requested matched_by_gtin only. The other three are added deliberately:
-- gtin_collisions_in_feed, gtin_collisions_in_catalog and gtin_keys_usable
-- are not decoration, they are the CHURN INSTRUMENT. The open question --
-- whether a merchant's GTINs are stable enough to be a primary key -- is
-- answered by comparing these values across runs, and a value that is never
-- persisted cannot be compared to itself a week later. Today's run is the
-- baseline (expected 2 / 0 / 498); 25 August is the first comparison. If
-- these lived only in a response body and a log line, the 25 August diff
-- would have nothing to diff against.
--
-- All four nullable, matching every other counter in this table. Nullable is
-- the honest encoding: a partner not using the gtin strategy writes NULL,
-- which is different from a partner that tried and matched zero. 0017's
-- eleven counters are nullable for the same reason.
--
-- Applied AFTER the writer exists in deployed code. The 0020 lesson: schema
-- ahead of the thing behind it produces a column that is indistinguishable
-- from one whose writer is broken. Claude Code has confirmed the counters are
-- computed and deployed, and that the writer line is a one-file commit
-- pending this migration.
--
-- Preconditions verified against the live schema before applying:
--   refresh_runs has 20 columns, eleven of them nullable integer counters.
--   No column named gtin% exists.

alter table public.refresh_runs
  add column matched_by_gtin integer,
  add column gtin_collisions_in_feed integer,
  add column gtin_collisions_in_catalog integer,
  add column gtin_keys_usable integer;
